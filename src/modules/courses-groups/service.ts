import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { err, ok, type Result } from '@/lib/result'
import type { Database } from '@/types/database'

// Klient o'qituvchi sessiyasidan keladi (RLS `is_teacher()` yozishga ruxsat beradi).
// PostgREST tranzaksiyani qo'llamaydi: ikki bosqichli amallar "eskisini yopish -> yangisini
// ochish" tartibida bajariladi, ochish muvaffaqiyatsiz bo'lsa eskisi qayta ochiladi.
// Cheklov: ikki so'rov orasida jarayon uzilsa (tarmoq/server o'chishi) guruh kurssiz yoki
// o'quvchi guruhsiz qolishi mumkin; amalni qayta bajarish buni tuzatadi.

export type GroupError = 'invalid_name' | 'not_found' | 'forbidden'

type Db = SupabaseClient<Database>
type DbError = { code?: string; message: string }

const MAX_NAME = 60
const uuidSchema = z.uuid()

function fail(what: string, error: DbError | null | undefined): never {
  throw new Error(`${what}: ${error?.message ?? "noma'lum xato"}`)
}

function isForbidden(error: DbError): boolean {
  return error.code === '42501'
}

function cleanName(raw: string): string | null {
  const name = raw.trim()
  return name.length === 0 || name.length > MAX_NAME ? null : name
}

async function exists(db: Db, table: 'courses' | 'groups', id: string): Promise<boolean> {
  if (!uuidSchema.safeParse(id).success) return false
  const { data, error } = await db.from(table).select('id').eq('id', id).maybeSingle()
  if (error) fail(`${table} o'qilmadi`, error)
  return data !== null
}

export async function createCourse(
  db: Db,
  input: { title: string },
): Promise<Result<{ id: string }, GroupError>> {
  const title = cleanName(input.title)
  if (!title) return err('invalid_name')

  const { data: last, error: lastError } = await db
    .from('courses')
    .select('position')
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (lastError) fail("kurs o'qilmadi", lastError)

  const { data, error } = await db
    .from('courses')
    .insert({ title, position: (last?.position ?? 0) + 1 })
    .select('id')
    .single()
  if (error) {
    if (isForbidden(error)) return err('forbidden')
    fail('kurs yaratilmadi', error)
  }
  return ok({ id: data.id })
}

export async function finishCourse(db: Db, courseId: string): Promise<Result<null, GroupError>> {
  if (!(await exists(db, 'courses', courseId))) return err('not_found')
  const { error } = await db.from('courses').update({ status: 'finished' }).eq('id', courseId)
  if (error) {
    if (isForbidden(error)) return err('forbidden')
    fail('kurs tugatilmadi', error)
  }
  return ok(null)
}

export async function createGroup(
  db: Db,
  input: { name: string; description?: string },
): Promise<Result<{ id: string }, GroupError>> {
  const name = cleanName(input.name)
  if (!name) return err('invalid_name')
  const description = input.description?.trim() || null

  // O'quvchi guruhni o'qiy olmaydi, shuning uchun id'ni oldindan beramiz va .select() qilmaymiz.
  const id = crypto.randomUUID()
  const { error } = await db.from('groups').insert({ id, name, description })
  if (error) {
    if (isForbidden(error)) return err('forbidden')
    fail('guruh yaratilmadi', error)
  }
  return ok({ id })
}

export async function assignGroupToCourse(
  db: Db,
  groupId: string,
  courseId: string,
): Promise<Result<null, GroupError>> {
  if (!(await exists(db, 'groups', groupId)) || !(await exists(db, 'courses', courseId))) {
    return err('not_found')
  }

  const { data: active, error: activeError } = await db
    .from('group_courses')
    .select('id, course_id')
    .eq('group_id', groupId)
    .is('ended_at', null)
    .maybeSingle()
  if (activeError) fail("faol kurs o'qilmadi", activeError)
  if (active?.course_id === courseId) return ok(null)

  if (active) {
    const { error } = await db
      .from('group_courses')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', active.id)
    if (error) {
      if (isForbidden(error)) return err('forbidden')
      fail('eski kurs yopilmadi', error)
    }
  }

  const { error: insertError } = await db
    .from('group_courses')
    .insert({ group_id: groupId, course_id: courseId })
  if (insertError) {
    if (active) {
      await db.from('group_courses').update({ ended_at: null }).eq('id', active.id)
    }
    if (isForbidden(insertError)) return err('forbidden')
    if (insertError.code === '23503') return err('not_found')
    fail('kurs biriktirilmadi', insertError)
  }
  return ok(null)
}

export async function moveStudent(
  db: Db,
  studentId: string,
  toGroupId: string,
): Promise<Result<null, GroupError>> {
  if (!uuidSchema.safeParse(studentId).success || !(await exists(db, 'groups', toGroupId))) {
    return err('not_found')
  }
  const { data: student, error: studentError } = await db
    .from('profiles')
    .select('id')
    .eq('id', studentId)
    .eq('role', 'student')
    .eq('status', 'active')
    .maybeSingle()
  if (studentError) fail("o'quvchi o'qilmadi", studentError)
  if (!student) return err('not_found')

  const { data: active, error: activeError } = await db
    .from('group_memberships')
    .select('id, group_id')
    .eq('student_id', studentId)
    .is('left_at', null)
    .maybeSingle()
  if (activeError) fail("a'zolik o'qilmadi", activeError)
  if (active?.group_id === toGroupId) return ok(null)

  if (active) {
    const { error } = await db
      .from('group_memberships')
      .update({ left_at: new Date().toISOString() })
      .eq('id', active.id)
    if (error) {
      if (isForbidden(error)) return err('forbidden')
      fail("eski a'zolik yopilmadi", error)
    }
  }

  const { error: insertError } = await db
    .from('group_memberships')
    .insert({ student_id: studentId, group_id: toGroupId })
  if (insertError) {
    if (active) {
      await db.from('group_memberships').update({ left_at: null }).eq('id', active.id)
    }
    if (isForbidden(insertError)) return err('forbidden')
    if (insertError.code === '23503') return err('not_found')
    fail("yangi a'zolik yozilmadi", insertError)
  }
  return ok(null)
}

export async function getGroupCourseHistory(
  db: Db,
  groupId: string,
): Promise<{ courseId: string; title: string; startedAt: string; endedAt: string | null }[]> {
  const { data, error } = await db
    .from('group_courses')
    .select('course_id, started_at, ended_at, courses(title)')
    .eq('group_id', groupId)
    .order('started_at', { ascending: true })
  if (error) fail("kurs tarixi o'qilmadi", error)
  return (data ?? []).map((r) => ({
    courseId: r.course_id,
    title: r.courses?.title ?? '',
    startedAt: r.started_at,
    endedAt: r.ended_at,
  }))
}

import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { err, ok, type Result } from '@/lib/result'
import { titleSchema } from '@/modules/resources/validation'
import type { Database } from '@/types/database'

export type TopicError =
  | 'invalid_title'
  | 'course_not_found'
  | 'not_found'
  | 'topic_not_empty'
  | 'forbidden'

export type Topic = { id: string; courseId: string; title: string; position: number }

type Db = SupabaseClient<Database>
type DbError = { code?: string; message: string }
type TopicRow = Database['public']['Tables']['topics']['Row']

const uuidSchema = z.uuid()

function fail(what: string, error: DbError | null | undefined): never {
  throw new Error(`${what}: ${error?.message ?? "noma'lum xato"}`)
}

const isForbidden = (e: DbError) => e.code === '42501'
const isFkViolation = (e: DbError) => e.code === '23503'

function toTopic(row: TopicRow): Topic {
  return { id: row.id, courseId: row.course_id, title: row.title, position: row.position }
}

async function findTopic(db: Db, id: string): Promise<TopicRow | null> {
  if (!uuidSchema.safeParse(id).success) return null
  const { data, error } = await db.from('topics').select('*').eq('id', id).maybeSingle()
  if (error) fail("mavzu o'qilmadi", error)
  return data
}

export async function listTopics(db: Db, courseId: string): Promise<Topic[]> {
  if (!uuidSchema.safeParse(courseId).success) return []
  const { data, error } = await db
    .from('topics')
    .select('*')
    .eq('course_id', courseId)
    .order('position')
    .order('created_at')
  if (error) fail("mavzular o'qilmadi", error)
  return data.map(toTopic)
}

export async function createTopic(
  db: Db,
  input: { courseId: string; title: string },
): Promise<Result<{ id: string }, TopicError>> {
  const title = titleSchema.safeParse(input.title)
  if (!title.success) return err('invalid_title')
  if (!uuidSchema.safeParse(input.courseId).success) return err('course_not_found')

  const { data: last, error: lastError } = await db
    .from('topics')
    .select('position')
    .eq('course_id', input.courseId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (lastError) fail("mavzu o'qilmadi", lastError)

  const { data, error } = await db
    .from('topics')
    .insert({ course_id: input.courseId, title: title.data, position: (last?.position ?? 0) + 1 })
    .select('id')
    .single()
  if (error) {
    if (isForbidden(error)) return err('forbidden')
    if (isFkViolation(error)) return err('course_not_found')
    fail('mavzu yaratilmadi', error)
  }
  return ok({ id: data.id })
}

export async function renameTopic(
  db: Db,
  topicId: string,
  rawTitle: string,
): Promise<Result<null, TopicError>> {
  const title = titleSchema.safeParse(rawTitle)
  if (!title.success) return err('invalid_title')
  if (!(await findTopic(db, topicId))) return err('not_found')

  const { error } = await db.from('topics').update({ title: title.data }).eq('id', topicId)
  if (error) {
    if (isForbidden(error)) return err('forbidden')
    fail("mavzu nomi o'zgarmadi", error)
  }
  return ok(null)
}

// Ikki ketma-ket update (position ustida unique cheklov yo'q).
export async function moveTopic(
  db: Db,
  topicId: string,
  direction: 'up' | 'down',
): Promise<Result<null, TopicError>> {
  const topic = await findTopic(db, topicId)
  if (!topic) return err('not_found')

  const siblings = await listTopics(db, topic.course_id)
  const index = siblings.findIndex((t) => t.id === topicId)
  const neighbour = siblings[direction === 'up' ? index - 1 : index + 1]
  if (!neighbour) return ok(null)

  // Teng position bo'lsa ham almashish ishlashi uchun indekslar bo'yicha qayta raqamlanadi.
  const order = siblings.map((t) => t.id)
  const other = direction === 'up' ? index - 1 : index + 1
  ;[order[index], order[other]] = [order[other], order[index]]

  for (const [i, id] of order.entries()) {
    const current = siblings.find((t) => t.id === id)!
    if (current.position === i + 1) continue
    const { error } = await db.from('topics').update({ position: i + 1 }).eq('id', id)
    if (error) {
      if (isForbidden(error)) return err('forbidden')
      fail("mavzu ko'chirilmadi", error)
    }
  }
  return ok(null)
}

export async function deleteTopic(db: Db, topicId: string): Promise<Result<null, TopicError>> {
  if (!(await findTopic(db, topicId))) return err('not_found')

  const { count, error: countError } = await db
    .from('resources')
    .select('id', { count: 'exact', head: true })
    .eq('topic_id', topicId)
  if (countError) fail("resurslar o'qilmadi", countError)
  if ((count ?? 0) > 0) return err('topic_not_empty')

  const { error } = await db.from('topics').delete().eq('id', topicId)
  if (error) {
    if (isForbidden(error)) return err('forbidden')
    if (isFkViolation(error)) return err('topic_not_empty')
    fail("mavzu o'chirilmadi", error)
  }
  return ok(null)
}

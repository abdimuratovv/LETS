import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { err, ok, type Result } from '@/lib/result'
import type { Database } from '@/types/database'
import { buildStoragePath } from './path'
import { noteBodySchema, titleSchema, urlSchema, validateUpload } from './validation'

// Klient chaqiruvchining sessiyasidan keladi: o'qituvchi funksiyalari o'qituvchi sessiyasi,
// o'quvchi funksiyalari o'quvchi sessiyasi bilan. Kirish huquqini RLS hal qiladi: o'quvchiga
// ko'rinmaydigan resurs so'rovda umuman qaytmaydi (`not_found`).
// RLS rad etgan UPDATE/DELETE xatosiz 0 qatorga ta'sir qiladi, shuning uchun `.select('id')`.

export type ResourceError =
  | 'invalid_title'
  | 'invalid_url'
  | 'invalid_body'
  | 'invalid_file'
  | 'file_too_large'
  | 'invalid_group'
  | 'topic_not_found'
  | 'not_found'
  | 'forbidden'

export type ResourceType = 'link' | 'file' | 'note'

export type Resource = {
  id: string
  topicId: string
  type: ResourceType
  title: string
  url: string | null
  fileName: string | null
  fileSize: number | null
  bodyMd: string | null
  position: number
  groupIds: string[]
}

export type ViewStats = {
  viewed: number
  total: number
  notViewed: { id: string; fullName: string }[]
}

export type StudentResource = {
  id: string
  type: ResourceType
  title: string
  fileName: string | null
  fileSize: number | null
  viewed: boolean
}

type Db = SupabaseClient<Database>
type DbError = { code?: string; message: string }

const BUCKET = 'resources'
const SIGNED_URL_SECONDS = 60
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const RESOURCE_COLUMNS =
  'id, topic_id, type, title, url, file_name, file_size, body_md, position, resource_groups(group_id)'

const uuidSchema = z.uuid()
const isUuid = (value: string) => uuidSchema.safeParse(value).success

function fail(what: string, error: DbError | null | undefined): never {
  throw new Error(`${what}: ${error?.message ?? "noma'lum xato"}`)
}

const isForbidden = (e: DbError) => e.code === '42501'
const isFkViolation = (e: DbError) => e.code === '23503'
const isUniqueViolation = (e: DbError) => e.code === '23505'

/** Storage xatosining HTTP holati (StorageApiError da bor). */
function storageStatus(error: unknown): number | null {
  const e = error as { status?: unknown; statusCode?: unknown }
  const n = Number(e.status ?? e.statusCode)
  return Number.isFinite(n) ? n : null
}

function isStorageDenied(error: { message: string }): boolean {
  const status = storageStatus(error)
  return status === 401 || status === 403 || /row-level security/i.test(error.message)
}

type ResourceRow = {
  id: string
  topic_id: string
  type: ResourceType
  title: string
  url: string | null
  file_name: string | null
  file_size: number | null
  body_md: string | null
  position: number
  resource_groups: { group_id: string }[]
}

function toResource(row: ResourceRow): Resource {
  return {
    id: row.id,
    topicId: row.topic_id,
    type: row.type,
    title: row.title,
    url: row.url,
    fileName: row.file_name,
    fileSize: row.file_size,
    bodyMd: row.body_md,
    position: row.position,
    groupIds: row.resource_groups.map((g) => g.group_id).sort(),
  }
}

/** Joriy foydalanuvchi id'si (JWT'dan). */
async function currentUserId(db: Db): Promise<string | null> {
  const { data } = await db.auth.getClaims()
  return data?.claims?.sub ?? null
}

// Bo'sh joydan iborat matn ham bo'sh hisoblanadi.
function parseBody(raw: string): string | null {
  const body = noteBodySchema.safeParse(raw)
  return body.success && body.data.trim().length > 0 ? body.data : null
}

/** Takrorlarsiz ro'yxat; har bir id `groups` da bo'lmasa null. */
async function checkGroups(db: Db, groupIds: string[] | undefined): Promise<string[] | null> {
  const ids = [...new Set(groupIds ?? [])]
  if (ids.length === 0) return []
  if (!ids.every(isUuid)) return null
  const { data, error } = await db.from('groups').select('id').in('id', ids)
  if (error) fail("guruhlar o'qilmadi", error)
  return data.length === ids.length ? ids : null
}

async function topicExists(db: Db, topicId: string): Promise<boolean> {
  if (!isUuid(topicId)) return false
  const { data, error } = await db.from('topics').select('id').eq('id', topicId).maybeSingle()
  if (error) fail("mavzu o'qilmadi", error)
  return data !== null
}

async function nextPosition(db: Db, topicId: string): Promise<number> {
  const { data, error } = await db
    .from('resources')
    .select('position')
    .eq('topic_id', topicId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) fail("resurs o'qilmadi", error)
  return (data?.position ?? 0) + 1
}

async function setGroups(
  db: Db,
  resourceId: string,
  groupIds: string[],
): Promise<Result<null, ResourceError>> {
  if (groupIds.length === 0) {
    // Bo'sh ro'yxat = hammaga ochish: oddiy o'chirish.
    const { error: delError } = await db.from('resource_groups').delete().eq('resource_id', resourceId)
    if (delError) {
      if (isForbidden(delError)) return err('forbidden')
      fail("guruh cheklovi o'chirilmadi", delError)
    }
    return ok(null)
  }
  if (!groupIds.every(isUuid)) return err('invalid_group')

  // Avval yangilarini qo'shamiz, keyin ortiqchasini o'chiramiz: xatoda eski ∪ yangi
  // qoladi, hech qachon bo'sh (hammaga ochiq) to'plam emas.
  const { error } = await db
    .from('resource_groups')
    .upsert(
      groupIds.map((group_id) => ({ resource_id: resourceId, group_id })),
      { onConflict: 'resource_id,group_id', ignoreDuplicates: true },
    )
  if (error) {
    if (isForbidden(error)) return err('forbidden')
    if (isFkViolation(error)) return err('invalid_group')
    fail('guruh cheklovi yozilmadi', error)
  }
  const { error: delError } = await db
    .from('resource_groups')
    .delete()
    .eq('resource_id', resourceId)
    .not('group_id', 'in', `(${groupIds.join(',')})`)
  if (delError) {
    if (isForbidden(delError)) return err('forbidden')
    fail("guruh cheklovi o'chirilmadi", delError)
  }
  return ok(null)
}

type NewResource =
  | { type: 'link'; url: string }
  | { type: 'note'; body_md: string }
  | { type: 'file'; storage_path: string; file_name: string; file_size: number }

async function insertResource(
  db: Db,
  topicId: string,
  title: string,
  fields: NewResource,
  groupIds: string[],
): Promise<Result<{ id: string }, ResourceError>> {
  const position = await nextPosition(db, topicId)
  const { data, error } = await db
    .from('resources')
    .insert({ topic_id: topicId, title, position, ...fields })
    .select('id')
    .single()
  if (error) {
    if (isForbidden(error)) return err('forbidden')
    if (isFkViolation(error)) return err('topic_not_found')
    if (isUniqueViolation(error)) return err('invalid_file') // storage_path allaqachon band
    fail('resurs yaratilmadi', error)
  }

  // Cheklovsiz resurs hammaga ochilib qolmasin: xato yoki istisnoda yangi resurs o'chiriladi.
  const compensate = async () => {
    const { error: delError } = await db.from('resources').delete().eq('id', data.id)
    if (delError) console.error('resurs qaytarib olinmadi', delError)
  }
  let groups: Result<null, ResourceError>
  try {
    groups = await setGroups(db, data.id, groupIds)
  } catch (e) {
    await compensate()
    throw e
  }
  if (!groups.ok) {
    await compensate()
    return groups
  }
  return ok({ id: data.id })
}

// ===== O'qituvchi =====

export async function createLinkResource(
  db: Db,
  input: { topicId: string; title: string; url: string; groupIds?: string[] },
): Promise<Result<{ id: string }, ResourceError>> {
  const title = titleSchema.safeParse(input.title)
  if (!title.success) return err('invalid_title')
  const url = urlSchema.safeParse(input.url)
  if (!url.success) return err('invalid_url')
  if (!isUuid(input.topicId)) return err('topic_not_found')
  const groupIds = await checkGroups(db, input.groupIds)
  if (!groupIds) return err('invalid_group')

  return insertResource(db, input.topicId, title.data, { type: 'link', url: url.data }, groupIds)
}

export async function createNoteResource(
  db: Db,
  input: { topicId: string; title: string; bodyMd: string; groupIds?: string[] },
): Promise<Result<{ id: string }, ResourceError>> {
  const title = titleSchema.safeParse(input.title)
  if (!title.success) return err('invalid_title')
  const body = parseBody(input.bodyMd)
  if (body === null) return err('invalid_body')
  if (!isUuid(input.topicId)) return err('topic_not_found')
  const groupIds = await checkGroups(db, input.groupIds)
  if (!groupIds) return err('invalid_group')

  return insertResource(db, input.topicId, title.data, { type: 'note', body_md: body }, groupIds)
}

/** Brauzer faylni to'g'ridan-to'g'ri Storage'ga yuklashi uchun imzolangan havola (2 soat). */
export async function prepareFileUpload(
  db: Db,
  input: { topicId: string; fileName: string; fileSize: number },
): Promise<Result<{ path: string; token: string }, ResourceError>> {
  const upload = validateUpload({ name: input.fileName, size: input.fileSize })
  if (!upload.ok) return upload
  if (!(await topicExists(db, input.topicId))) return err('topic_not_found')

  const path = buildStoragePath(input.topicId, upload.data.ext)
  const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path)
  if (error) {
    if (isStorageDenied(error)) return err('forbidden')
    fail('yuklash havolasi yaratilmadi', error)
  }
  return ok({ path: data.path, token: data.token })
}

/** Yuklangan faylni resurs sifatida yozadi. Yo'l shu mavzuga tegishli va Storage'da bo'lishi shart. */
export async function registerFileResource(
  db: Db,
  input: {
    topicId: string
    title: string
    path: string
    fileName: string
    fileSize: number
    groupIds?: string[]
  },
): Promise<Result<{ id: string }, ResourceError>> {
  const title = titleSchema.safeParse(input.title)
  if (!title.success) return err('invalid_title')
  const upload = validateUpload({ name: input.fileName, size: input.fileSize })
  if (!upload.ok) return upload
  if (!isUuid(input.topicId)) return err('topic_not_found')

  const pathPattern = new RegExp(`^${input.topicId}/${UUID}\\.${upload.data.ext}$`)
  if (!pathPattern.test(input.path)) return err('invalid_file')

  const groupIds = await checkGroups(db, input.groupIds)
  if (!groupIds) return err('invalid_group')

  const { data: exists } = await db.storage.from(BUCKET).exists(input.path)
  if (!exists) return err('invalid_file')

  return insertResource(
    db,
    input.topicId,
    title.data,
    {
      type: 'file',
      storage_path: input.path,
      file_name: input.fileName.trim(),
      file_size: input.fileSize,
    },
    groupIds,
  )
}

/** `groupIds: []` cheklovni olib tashlaydi (barcha guruhlarga ochiq). */
export async function updateResource(
  db: Db,
  id: string,
  patch: { title?: string; url?: string; bodyMd?: string; groupIds?: string[] },
): Promise<Result<null, ResourceError>> {
  const changes: { title?: string; url?: string; body_md?: string; updated_at: string } = {
    updated_at: new Date().toISOString(),
  }
  if (patch.title !== undefined) {
    const title = titleSchema.safeParse(patch.title)
    if (!title.success) return err('invalid_title')
    changes.title = title.data
  }

  const row = await findRow(db, id)
  if (!row) return err('not_found')

  if (patch.url !== undefined) {
    const url = urlSchema.safeParse(patch.url)
    if (row.type !== 'link' || !url.success) return err('invalid_url')
    changes.url = url.data
  }
  if (patch.bodyMd !== undefined) {
    const body = parseBody(patch.bodyMd)
    if (row.type !== 'note' || body === null) return err('invalid_body')
    changes.body_md = body
  }
  let groupIds: string[] | null = null
  if (patch.groupIds !== undefined) {
    groupIds = await checkGroups(db, patch.groupIds)
    if (!groupIds) return err('invalid_group')
  }

  const { data, error } = await db.from('resources').update(changes).eq('id', id).select('id')
  if (error) {
    if (isForbidden(error)) return err('forbidden')
    fail('resurs saqlanmadi', error)
  }
  if (data.length === 0) return err('not_found')

  if (groupIds) return setGroups(db, id, groupIds)
  return ok(null)
}

async function findRow(
  db: Db,
  id: string,
): Promise<{ id: string; topic_id: string; type: ResourceType; storage_path: string | null } | null> {
  if (!isUuid(id)) return null
  const { data, error } = await db
    .from('resources')
    .select('id, topic_id, type, storage_path')
    .eq('id', id)
    .maybeSingle()
  if (error) fail("resurs o'qilmadi", error)
  return data
}

// Ikki ketma-ket update (position ustida unique cheklov yo'q); teng position bo'lsa ham
// ishlashi uchun mavzu resurslari indekslar bo'yicha qayta raqamlanadi.
export async function moveResource(
  db: Db,
  id: string,
  direction: 'up' | 'down',
): Promise<Result<null, ResourceError>> {
  const row = await findRow(db, id)
  if (!row) return err('not_found')

  const { data: siblings, error } = await db
    .from('resources')
    .select('id, position')
    .eq('topic_id', row.topic_id)
    .order('position')
    .order('created_at')
  if (error) fail("resurslar o'qilmadi", error)

  const index = siblings.findIndex((r) => r.id === id)
  const other = direction === 'up' ? index - 1 : index + 1
  if (index < 0 || other < 0 || other >= siblings.length) return ok(null)

  const order = siblings.map((r) => r.id)
  ;[order[index], order[other]] = [order[other], order[index]]

  for (const [i, rid] of order.entries()) {
    if (siblings.find((r) => r.id === rid)!.position === i + 1) continue
    const { data, error: updateError } = await db
      .from('resources')
      .update({ position: i + 1 })
      .eq('id', rid)
      .select('id')
    if (updateError) {
      if (isForbidden(updateError)) return err('forbidden')
      fail("resurs ko'chirilmadi", updateError)
    }
    if (data.length === 0) return err('not_found')
  }
  return ok(null)
}

/** Resurs o'chadi; fayl bo'lsa Storage obyekti ham. */
export async function deleteResource(db: Db, id: string): Promise<Result<null, ResourceError>> {
  const row = await findRow(db, id)
  if (!row) return err('not_found')

  const { data, error } = await db.from('resources').delete().eq('id', id).select('id')
  if (error) {
    if (isForbidden(error)) return err('forbidden')
    fail("resurs o'chirilmadi", error)
  }
  if (data.length === 0) return err('not_found')

  // Avval yozuv o'chadi: Storage xatosida faqat egasiz obyekt qoladi, "fayli yo'q resurs" emas.
  if (row.storage_path) {
    const { error: removeError } = await db.storage.from(BUCKET).remove([row.storage_path])
    if (removeError) console.error('[resources] fayl o\'chirilmadi', row.storage_path, removeError)
  }
  return ok(null)
}

/**
 * Yuklangan, lekin resurs sifatida yozilmagan obyektni o'chiradi (R5).
 * Mavjud resursning fayli o'chirilmasligi uchun yo'l hech bir resursga tegishli bo'lmasligi shart.
 */
export async function discardUpload(
  db: Db,
  input: { topicId: string; path: string },
): Promise<Result<null, ResourceError>> {
  if (!isUuid(input.topicId)) return err('invalid_file')
  if (!new RegExp(`^${input.topicId}/${UUID}\\.[a-z0-9]+$`).test(input.path)) {
    return err('invalid_file')
  }
  const { data, error } = await db
    .from('resources')
    .select('id')
    .eq('storage_path', input.path)
    .maybeSingle()
  if (error) fail("resurs o'qilmadi", error)
  if (data) return err('invalid_file')

  const { error: removeError } = await db.storage.from(BUCKET).remove([input.path])
  if (removeError) fail("fayl o'chirilmadi", removeError)
  return ok(null)
}

export async function listResourcesForTopic(db: Db, topicId: string): Promise<Resource[]> {
  if (!isUuid(topicId)) return []
  const { data, error } = await db
    .from('resources')
    .select(RESOURCE_COLUMNS)
    .eq('topic_id', topicId)
    .order('position')
    .order('created_at')
  if (error) fail("resurslar o'qilmadi", error)
  return (data as ResourceRow[]).map(toResource)
}

/**
 * Bir kursdagi resurslar uchun ko'rish statistikasi (3 ta so'rov).
 * Ruxsatli guruhlar: kursni o'tgan (hozir yoki avval) guruhlar; resurs cheklangan bo'lsa
 * ulardan faqat ro'yxatdagilari. Hisobga faqat shu guruhlarning faol o'quvchilari kiradi.
 */
export async function listResourceViewStats(
  db: Db,
  courseId: string,
  resources: { id: string; groupIds: string[] }[],
): Promise<Map<string, ViewStats>> {
  const result = new Map<string, ViewStats>()
  if (resources.length === 0) return result

  const { data: courseGroups, error: gcError } = await db
    .from('group_courses')
    .select('group_id')
    .eq('course_id', courseId)
  if (gcError) fail("kurs guruhlari o'qilmadi", gcError)
  const courseGroupIds = new Set(courseGroups.map((g) => g.group_id))

  const allowed = new Map(
    resources.map((r) => [
      r.id,
      new Set(
        r.groupIds.length > 0
          ? r.groupIds.filter((g) => courseGroupIds.has(g))
          : [...courseGroupIds],
      ),
    ]),
  )
  const groupIds = [...new Set([...allowed.values()].flatMap((s) => [...s]))]

  let members: { groupId: string; id: string; fullName: string }[] = []
  if (groupIds.length > 0) {
    const { data, error } = await db
      .from('group_memberships')
      .select('group_id, student_id, profiles!inner(full_name, status)')
      .in('group_id', groupIds)
      .is('left_at', null)
      .eq('profiles.status', 'active')
    if (error) fail("o'quvchilar o'qilmadi", error)
    members = data.map((m) => ({
      groupId: m.group_id,
      id: m.student_id,
      fullName: m.profiles.full_name ?? '',
    }))
  }

  const { data: views, error: viewsError } = await db
    .from('resource_views')
    .select('resource_id, student_id')
    .in(
      'resource_id',
      resources.map((r) => r.id),
    )
  if (viewsError) fail("ko'rishlar o'qilmadi", viewsError)
  const seen = new Set(views.map((v) => `${v.resource_id}:${v.student_id}`))

  for (const r of resources) {
    const groups = allowed.get(r.id)!
    const students = members.filter((m) => groups.has(m.groupId))
    const notViewed = students
      .filter((s) => !seen.has(`${r.id}:${s.id}`))
      .map((s) => ({ id: s.id, fullName: s.fullName }))
      .sort((x, y) => x.fullName.localeCompare(y.fullName, 'uz'))
    result.set(r.id, {
      viewed: students.length - notViewed.length,
      total: students.length,
      notViewed,
    })
  }
  return result
}

export async function getResourceViewStats(
  db: Db,
  resourceId: string,
): Promise<Result<ViewStats, 'not_found'>> {
  if (!isUuid(resourceId)) return err('not_found')
  const { data, error } = await db
    .from('resources')
    .select('id, topics!inner(course_id), resource_groups(group_id)')
    .eq('id', resourceId)
    .maybeSingle()
  if (error) fail("resurs o'qilmadi", error)
  if (!data) return err('not_found')

  const stats = await listResourceViewStats(db, data.topics.course_id, [
    { id: data.id, groupIds: data.resource_groups.map((g) => g.group_id) },
  ])
  return ok(stats.get(data.id)!)
}

// ===== O'quvchi =====

/** Faol guruhning kurslari: joriy kurs birinchi, keyin oldingilari (yangidan eskiga). */
export async function listMyCourses(
  db: Db,
): Promise<{ id: string; title: string; current: boolean }[]> {
  const userId = await currentUserId(db)
  if (!userId) return []

  const { data: membership, error: mError } = await db
    .from('group_memberships')
    .select('group_id')
    .eq('student_id', userId)
    .is('left_at', null)
    .maybeSingle()
  if (mError) fail("a'zolik o'qilmadi", mError)
  if (!membership) return []

  const { data, error } = await db
    .from('group_courses')
    .select('course_id, ended_at, courses(title)')
    .eq('group_id', membership.group_id)
    .order('started_at', { ascending: false })
  if (error) fail("kurslar o'qilmadi", error)

  const courses = new Map<string, { id: string; title: string; current: boolean }>()
  for (const row of data) {
    const existing = courses.get(row.course_id)
    if (existing) {
      existing.current ||= row.ended_at === null
      continue
    }
    courses.set(row.course_id, {
      id: row.course_id,
      title: row.courses?.title ?? '',
      current: row.ended_at === null,
    })
  }
  const list = [...courses.values()]
  return [...list.filter((c) => c.current), ...list.filter((c) => !c.current)]
}

/** Kurs mavzulari va o'quvchiga ko'rinadigan resurslar (RLS filtrlaydi). */
export async function listCourseResources(
  db: Db,
  courseId: string,
): Promise<{ id: string; title: string; resources: StudentResource[] }[]> {
  if (!isUuid(courseId)) return []
  const { data: topics, error } = await db
    .from('topics')
    .select('id, title')
    .eq('course_id', courseId)
    .order('position')
    .order('created_at')
  if (error) fail("mavzular o'qilmadi", error)
  if (topics.length === 0) return []

  const { data: resources, error: rError } = await db
    .from('resources')
    .select('id, topic_id, type, title, file_name, file_size')
    .in(
      'topic_id',
      topics.map((t) => t.id),
    )
    .order('position')
    .order('created_at')
  if (rError) fail("resurslar o'qilmadi", rError)

  const viewed = new Set<string>()
  const userId = await currentUserId(db)
  if (userId && resources.length > 0) {
    const { data: views, error: vError } = await db
      .from('resource_views')
      .select('resource_id')
      .eq('student_id', userId)
      .in(
        'resource_id',
        resources.map((r) => r.id),
      )
    if (vError) fail("ko'rishlar o'qilmadi", vError)
    views.forEach((v) => viewed.add(v.resource_id))
  }

  return topics.map((t) => ({
    id: t.id,
    title: t.title,
    resources: resources
      .filter((r) => r.topic_id === t.id)
      .map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        fileName: r.file_name,
        fileSize: r.file_size,
        viewed: viewed.has(r.id),
      })),
  }))
}

export async function getResourceForViewing(
  db: Db,
  id: string,
): Promise<Result<Resource, 'not_found'>> {
  if (!isUuid(id)) return err('not_found')
  const { data, error } = await db.from('resources').select(RESOURCE_COLUMNS).eq('id', id).maybeSingle()
  if (error) fail("resurs o'qilmadi", error)
  if (!data) return err('not_found')
  return ok(toResource(data as ResourceRow))
}

/** Birinchi ochilishni yozadi; takror chaqiruv hech narsani o'zgartirmaydi. */
export async function recordView(db: Db, resourceId: string): Promise<void> {
  const userId = await currentUserId(db)
  if (!userId) throw new Error("ko'rish yozilmadi: sessiya yo'q")
  const { error } = await db
    .from('resource_views')
    .upsert(
      { student_id: userId, resource_id: resourceId },
      { onConflict: 'student_id,resource_id', ignoreDuplicates: true },
    )
  if (error) fail("ko'rish yozilmadi", error)
}

/** 60 soniyalik, yuklab olish (attachment) rejimidagi imzolangan havola. */
export async function getFileDownloadUrl(
  db: Db,
  resourceId: string,
): Promise<Result<{ url: string }, 'not_found'>> {
  if (!isUuid(resourceId)) return err('not_found')
  const { data, error } = await db
    .from('resources')
    .select('type, storage_path, file_name')
    .eq('id', resourceId)
    .maybeSingle()
  if (error) fail("resurs o'qilmadi", error)
  if (!data || data.type !== 'file' || !data.storage_path) return err('not_found')

  const { data: signed, error: signError } = await db.storage
    .from(BUCKET)
    .createSignedUrl(data.storage_path, SIGNED_URL_SECONDS, {
      download: data.file_name ?? true,
    })
  if (signError) {
    const status = storageStatus(signError)
    if (status === 400 || status === 404) return err('not_found')
    fail('yuklab olish havolasi yaratilmadi', signError)
  }
  return ok({ url: signed.signedUrl })
}

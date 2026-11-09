import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { archiveStudent } from '@/modules/auth-accounts/service'
import { assignGroupToCourse, moveStudent } from '@/modules/courses-groups/service'
import {
  createLinkResource,
  createNoteResource,
  getFileDownloadUrl,
  getResourceForViewing,
  getResourceViewStats,
  listCourseResources,
  listMyCourses,
  prepareFileUpload,
  recordView,
  registerFileResource,
} from '@/modules/resources/service'
import { createTopic } from '@/modules/topics/service'
import {
  adminClient,
  makeCourse,
  makeGroup,
  makeStudent,
  makeTeacher,
  resetData,
  signInAs,
  type DbClient,
  type TestStudent,
} from './helpers'

type Student = TestStudent & { db: DbClient }

describe("resurslarga kirish (o'quvchi)", () => {
  let teacher: DbClient
  let courseId: string
  let topicId: string
  let groupA: string
  let groupB: string
  let a: Student
  let b: Student

  beforeEach(async () => {
    await resetData()
    const t = await makeTeacher()
    teacher = await signInAs(t.login, t.password)
    courseId = (await makeCourse('Python')).id
    const topic = await createTopic(teacher, { courseId, title: 'Kirish' })
    if (!topic.ok) throw new Error(topic.error)
    topicId = topic.data.id

    groupA = (await makeGroup('A')).id
    groupB = (await makeGroup('B')).id
    expect((await assignGroupToCourse(teacher, groupA, courseId)).ok).toBe(true)
    expect((await assignGroupToCourse(teacher, groupB, courseId)).ok).toBe(true)

    a = await student(groupA, 'stud_a', 'Ali Valiyev')
    b = await student(groupB, 'stud_b', 'Bobur Karimov')
  })

  afterAll(async () => {
    await resetData()
  })

  async function student(groupId: string, login: string, fullName: string): Promise<Student> {
    const s = await makeStudent(groupId, login)
    const { error } = await adminClient()
      .from('profiles')
      .update({ full_name: fullName })
      .eq('id', s.id)
    expect(error).toBeNull()
    return { ...s, db: await signInAs(s.login, s.password) }
  }

  async function link(title: string, groupIds?: string[]): Promise<string> {
    const res = await createLinkResource(teacher, { topicId, title, url: 'https://a.uz', groupIds })
    if (!res.ok) throw new Error(res.error)
    return res.data.id
  }

  async function pdf(groupIds?: string[]): Promise<string> {
    const prep = await prepareFileUpload(teacher, { topicId, fileName: 'dars.pdf', fileSize: 1024 })
    if (!prep.ok) throw new Error(prep.error)
    const { error } = await teacher.storage
      .from('resources')
      .uploadToSignedUrl(
        prep.data.path,
        prep.data.token,
        new Blob([new Uint8Array(1024).fill(66)], { type: 'application/pdf' }),
      )
    expect(error).toBeNull()
    const res = await registerFileResource(teacher, {
      topicId,
      title: 'Dars taqdimoti',
      path: prep.data.path,
      fileName: 'dars.pdf',
      fileSize: 1024,
      groupIds,
    })
    if (!res.ok) throw new Error(res.error)
    return res.data.id
  }

  async function visibleIds(db: DbClient): Promise<string[]> {
    const topics = await listCourseResources(db, courseId)
    return topics.flatMap((t) => t.resources.map((r) => r.id))
  }

  it("hamma uchun ochiq resurs ikkalasiga, A ga cheklangani faqat A ga ko'rinadi", async () => {
    const open = await link('Ochiq')
    const onlyA = await link('Faqat A', [groupA])

    expect(await visibleIds(a.db)).toEqual([open, onlyA])
    expect(await visibleIds(b.db)).toEqual([open])

    const topics = await listCourseResources(b.db, courseId)
    expect(topics).toHaveLength(1)
    expect(topics[0]).toMatchObject({ id: topicId, title: 'Kirish' })

    expect(await getResourceForViewing(b.db, onlyA)).toEqual({ ok: false, error: 'not_found' })
    const forA = await getResourceForViewing(a.db, onlyA)
    expect(forA).toMatchObject({ ok: true, data: { id: onlyA, type: 'link', url: 'https://a.uz' } })
    expect(await getResourceForViewing(a.db, 'abc')).toEqual({ ok: false, error: 'not_found' })
  })

  it("A ga cheklangan fayl: B -> not_found; A -> 60 soniyalik havola, yuklab olinadi", async () => {
    const file = await pdf([groupA])
    expect(await getFileDownloadUrl(b.db, file)).toEqual({ ok: false, error: 'not_found' })

    const res = await getFileDownloadUrl(a.db, file)
    if (!res.ok) throw new Error(res.error)
    const response = await fetch(res.data.url)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-disposition') ?? '').toContain('attachment')
    expect(response.headers.get('content-disposition') ?? '').toContain('dars.pdf')
    expect((await response.arrayBuffer()).byteLength).toBe(1024)
  })

  it("havola/konspekt uchun getFileDownloadUrl -> not_found", async () => {
    const open = await link('Ochiq')
    expect(await getFileDownloadUrl(a.db, open)).toEqual({ ok: false, error: 'not_found' })
  })

  it("kursga biriktirilmagan guruh o'quvchisi hech narsani ko'rmaydi", async () => {
    const open = await link('Ochiq')
    const groupC = (await makeGroup('C')).id
    const c = await student(groupC, 'stud_c', 'Che Guevara')

    expect(await listMyCourses(c.db)).toEqual([])
    expect(await listCourseResources(c.db, courseId)).toEqual([])
    expect(await getResourceForViewing(c.db, open)).toEqual({ ok: false, error: 'not_found' })
  })

  it("listMyCourses: joriy kurs va oldingi kurslar", async () => {
    expect(await listMyCourses(a.db)).toEqual([{ id: courseId, title: 'Python', current: true }])

    const next = await makeCourse('JavaScript')
    expect((await assignGroupToCourse(teacher, groupA, next.id)).ok).toBe(true)
    expect(await listMyCourses(a.db)).toEqual([
      { id: next.id, title: 'JavaScript', current: true },
      { id: courseId, title: 'Python', current: false },
    ])

    // O'tilgan kurs resurslari ham ko'rinadi
    const open = await link('Ochiq')
    expect(await visibleIds(a.db)).toEqual([open])
  })

  it("recordView ikki marta: bitta qator, first_viewed_at o'zgarmaydi, viewed: true", async () => {
    const open = await link('Ochiq')
    const note = await createNoteResource(teacher, { topicId, title: 'Konspekt', bodyMd: 'a' })
    if (!note.ok) throw new Error(note.error)

    await recordView(a.db, open)
    const first = await adminClient()
      .from('resource_views')
      .select('first_viewed_at')
      .eq('resource_id', open)
    expect(first.data).toHaveLength(1)

    await recordView(a.db, open)
    const second = await adminClient()
      .from('resource_views')
      .select('student_id, first_viewed_at')
      .eq('resource_id', open)
    expect(second.data).toEqual([{ student_id: a.id, first_viewed_at: first.data![0].first_viewed_at }])

    const [topic] = await listCourseResources(a.db, courseId)
    expect(topic.resources.map((r) => [r.title, r.viewed])).toEqual([
      ['Ochiq', true],
      ['Konspekt', false],
    ])
    const [topicB] = await listCourseResources(b.db, courseId)
    expect(topicB.resources.map((r) => r.viewed)).toEqual([false, false])
  })

  it("getResourceViewStats: 2 tadan 1 tasi ko'rgan", async () => {
    const open = await link('Ochiq')
    await recordView(a.db, open)
    expect(await getResourceViewStats(teacher, open)).toEqual({
      ok: true,
      data: { viewed: 1, total: 2, notViewed: [{ id: b.id, fullName: 'Bobur Karimov' }] },
    })
  })

  it("getResourceViewStats: A ga cheklangan - faqat A o'quvchilari", async () => {
    const a2 = await student(groupA, 'stud_a2', 'Anvar Toshev')
    const onlyA = await link('Faqat A', [groupA])
    await recordView(a.db, onlyA)
    expect(await getResourceViewStats(teacher, onlyA)).toEqual({
      ok: true,
      data: { viewed: 1, total: 2, notViewed: [{ id: a2.id, fullName: 'Anvar Toshev' }] },
    })
  })

  it("getResourceViewStats: arxivlangan va boshqa kurs o'quvchilari hisobga kirmaydi", async () => {
    const open = await link('Ochiq')
    const groupC = (await makeGroup('C')).id
    await student(groupC, 'stud_c', 'Che Guevara')
    expect(await archiveStudent(adminClient(), b.id)).toEqual({ ok: true, data: null })

    expect(await getResourceViewStats(teacher, open)).toEqual({
      ok: true,
      data: { viewed: 0, total: 1, notViewed: [{ id: a.id, fullName: 'Ali Valiyev' }] },
    })
    expect(await getResourceViewStats(teacher, '11111111-1111-4111-8111-111111111111')).toEqual({
      ok: false,
      error: 'not_found',
    })
  })

  it("guruhi o'zgargan o'quvchi A ga cheklangan resursni ko'rmay qoladi", async () => {
    const onlyA = await link('Faqat A', [groupA])
    expect(await visibleIds(a.db)).toEqual([onlyA])

    expect(await moveStudent(teacher, a.id, groupB)).toEqual({ ok: true, data: null })
    expect(await visibleIds(a.db)).toEqual([])
    expect(await getResourceForViewing(a.db, onlyA)).toEqual({ ok: false, error: 'not_found' })
  })

  it("o'quvchi sessiyasi bilan createLinkResource -> forbidden", async () => {
    expect(
      await createLinkResource(a.db, { topicId, title: 'Havola', url: 'https://a.uz' }),
    ).toEqual({ ok: false, error: 'forbidden' })
  })
})

import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  createTopic,
  deleteTopic,
  listTopics,
  moveTopic,
  renameTopic,
} from '@/modules/topics/service'
import {
  adminClient,
  makeCourse,
  makeGroup,
  makeStudent,
  makeTeacher,
  resetData,
  signInAs,
  type DbClient,
} from './helpers'

const MISSING_ID = '11111111-1111-4111-8111-111111111111'

describe('topics service', () => {
  let teacher: DbClient
  let courseId: string

  beforeEach(async () => {
    await resetData()
    const t = await makeTeacher()
    teacher = await signInAs(t.login, t.password)
    courseId = (await makeCourse('CS')).id
  })

  afterAll(async () => {
    await resetData()
  })

  async function newTopic(title: string): Promise<string> {
    const res = await createTopic(teacher, { courseId, title })
    if (!res.ok) throw new Error(res.error)
    return res.data.id
  }

  it('position = oxirgi + 1 va nom trim qilinadi', async () => {
    await newTopic(' Kirish ')
    await newTopic('Funksiyalar')
    const topics = await listTopics(teacher, courseId)
    expect(topics.map((t) => [t.title, t.position])).toEqual([
      ['Kirish', 1],
      ['Funksiyalar', 2],
    ])
  })

  it("noto'g'ri nom -> invalid_title", async () => {
    expect(await createTopic(teacher, { courseId, title: ' ' })).toEqual({
      ok: false,
      error: 'invalid_title',
    })
  })

  it('moveTopic joylarni almashtiradi; chetda hech narsa o\'zgarmaydi', async () => {
    const a = await newTopic('Aaa')
    const b = await newTopic('Bbb')
    expect(await moveTopic(teacher, a, 'up')).toEqual({ ok: true, data: null })
    expect((await listTopics(teacher, courseId)).map((t) => t.title)).toEqual(['Aaa', 'Bbb'])
    expect(await moveTopic(teacher, b, 'down')).toEqual({ ok: true, data: null })
    expect((await listTopics(teacher, courseId)).map((t) => t.title)).toEqual(['Aaa', 'Bbb'])

    expect(await moveTopic(teacher, b, 'up')).toEqual({ ok: true, data: null })
    expect((await listTopics(teacher, courseId)).map((t) => t.title)).toEqual(['Bbb', 'Aaa'])
  })

  it('moveTopic: mavjud bo\'lmagan mavzu -> not_found', async () => {
    expect(await moveTopic(teacher, MISSING_ID, 'up')).toEqual({ ok: false, error: 'not_found' })
  })

  it("renameTopic: bo'sh nom -> invalid_title; to'g'ri nom saqlanadi", async () => {
    const id = await newTopic('Eski')
    expect(await renameTopic(teacher, id, ' ')).toEqual({ ok: false, error: 'invalid_title' })
    expect(await renameTopic(teacher, id, ' Yangi ')).toEqual({ ok: true, data: null })
    expect((await listTopics(teacher, courseId))[0].title).toBe('Yangi')
    expect(await renameTopic(teacher, MISSING_ID, 'Yangi')).toEqual({ ok: false, error: 'not_found' })
  })

  it("bo'sh mavzu o'chadi", async () => {
    const id = await newTopic('Aaa')
    expect(await deleteTopic(teacher, id)).toEqual({ ok: true, data: null })
    expect(await listTopics(teacher, courseId)).toEqual([])
    expect(await deleteTopic(teacher, id)).toEqual({ ok: false, error: 'not_found' })
  })

  it("resursi bor mavzu o'chmaydi -> topic_not_empty", async () => {
    const id = await newTopic('Aaa')
    const { error } = await adminClient()
      .from('resources')
      .insert({ topic_id: id, type: 'link', title: 'Havola', url: 'https://example.com' })
    expect(error).toBeNull()
    expect(await deleteTopic(teacher, id)).toEqual({ ok: false, error: 'topic_not_empty' })
    expect(await listTopics(teacher, courseId)).toHaveLength(1)
  })

  it("o'quvchi sessiyasi bilan createTopic -> forbidden", async () => {
    const group = await makeGroup('G1')
    const s = await makeStudent(group.id)
    const student = await signInAs(s.login, s.password)
    expect(await createTopic(student, { courseId, title: 'Mavzu' })).toEqual({
      ok: false,
      error: 'forbidden',
    })
  })

  it("mavjud bo'lmagan courseId -> course_not_found", async () => {
    expect(await createTopic(teacher, { courseId: MISSING_ID, title: 'Mavzu' })).toEqual({
      ok: false,
      error: 'course_not_found',
    })
    expect(await createTopic(teacher, { courseId: 'abc', title: 'Mavzu' })).toEqual({
      ok: false,
      error: 'course_not_found',
    })
  })
})

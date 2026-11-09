import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createStudent } from '@/modules/auth-accounts/service'
import {
  assignGroupToCourse,
  createCourse,
  createGroup,
  finishCourse,
  getGroupCourseHistory,
  moveStudent,
} from '@/modules/courses-groups/service'
import { adminClient, makeGroup, makeTeacher, resetData, signInAs, type DbClient } from './helpers'

const MISSING_ID = '11111111-1111-4111-8111-111111111111'

describe('courses-groups service', () => {
  let teacher: DbClient

  beforeEach(async () => {
    await resetData()
    const t = await makeTeacher()
    teacher = await signInAs(t.login, t.password)
  })

  afterAll(async () => {
    await resetData()
  })

  async function newCourse(title: string): Promise<string> {
    const res = await createCourse(teacher, { title })
    if (!res.ok) throw new Error(res.error)
    return res.data.id
  }

  describe('createCourse / finishCourse', () => {
    it('position = oxirgi + 1; finishCourse status=finished', async () => {
      const a = await newCourse(' CS ')
      const b = await newCourse('Frontend')
      const { data } = await adminClient().from('courses').select('id, title, position, status').order('position')
      expect(data).toEqual([
        { id: a, title: 'CS', position: 1, status: 'active' },
        { id: b, title: 'Frontend', position: 2, status: 'active' },
      ])

      expect((await finishCourse(teacher, a)).ok).toBe(true)
      const { data: row } = await adminClient().from('courses').select('status').eq('id', a).single()
      expect(row!.status).toBe('finished')
      expect(await finishCourse(teacher, MISSING_ID)).toEqual({ ok: false, error: 'not_found' })
    })

    it("bo'sh yoki 60 belgidan uzun nom rad etiladi", async () => {
      expect(await createCourse(teacher, { title: '  ' })).toEqual({ ok: false, error: 'invalid_name' })
      expect(await createCourse(teacher, { title: 'x'.repeat(61) })).toEqual({
        ok: false,
        error: 'invalid_name',
      })
    })
  })

  describe('createGroup', () => {
    it("bo'sh nomli guruh invalid_name", async () => {
      expect(await createGroup(teacher, { name: '  ' })).toEqual({ ok: false, error: 'invalid_name' })
    })

    it("o'quvchi sessiyasi bilan ok:false (RLS)", async () => {
      const g = await makeGroup('A')
      const made = await createStudent(adminClient(), { login: 'stu', password: 'parol12', groupId: g.id })
      expect(made.ok).toBe(true)
      const student = await signInAs('stu', 'parol12')
      const res = await createGroup(student, { name: 'Hack' })
      expect(res.ok).toBe(false)
      const { data } = await adminClient().from('groups').select('id').eq('name', 'Hack')
      expect(data).toEqual([])
    })

    it('guruh yaratadi', async () => {
      const res = await createGroup(teacher, { name: ' 7-A ', description: 'tavsif' })
      expect(res.ok).toBe(true)
      if (!res.ok) return
      const { data } = await adminClient().from('groups').select('name, description').eq('id', res.data.id).single()
      expect(data).toEqual({ name: '7-A', description: 'tavsif' })
    })
  })

  describe('assignGroupToCourse', () => {
    it('CS, so\'ng Frontend: tarixda 2 qator, CS yopilgan, Frontend ochiq', async () => {
      const g = await makeGroup('A')
      const cs = await newCourse('CS')
      const fe = await newCourse('Frontend')
      expect((await assignGroupToCourse(teacher, g.id, cs)).ok).toBe(true)
      expect((await assignGroupToCourse(teacher, g.id, fe)).ok).toBe(true)

      const history = await getGroupCourseHistory(teacher, g.id)
      expect(history).toHaveLength(2)
      expect(history[0]).toMatchObject({ courseId: cs, title: 'CS' })
      expect(history[0].endedAt).not.toBeNull()
      expect(history[1]).toMatchObject({ courseId: fe, title: 'Frontend', endedAt: null })
    })

    it('mavjud bo\'lmagan guruh yoki kurs: not_found', async () => {
      const g = await makeGroup('A')
      const cs = await newCourse('CS')
      expect(await assignGroupToCourse(teacher, MISSING_ID, cs)).toEqual({ ok: false, error: 'not_found' })
      expect(await assignGroupToCourse(teacher, g.id, MISSING_ID)).toEqual({ ok: false, error: 'not_found' })
      expect(await getGroupCourseHistory(teacher, g.id)).toEqual([])
    })
  })

  describe('moveStudent', () => {
    it('eski a\'zolikda left_at, yangi faol; o\'quvchi faqat o\'z qatorlarini ko\'radi', async () => {
      const g1 = await makeGroup('A')
      const g2 = await makeGroup('B')
      const s1 = await createStudent(adminClient(), { login: 'one', password: 'parol12', groupId: g1.id })
      const s2 = await createStudent(adminClient(), { login: 'two', password: 'parol12', groupId: g1.id })
      if (!s1.ok || !s2.ok) throw new Error('createStudent')

      expect((await moveStudent(teacher, s1.data.id, g2.id)).ok).toBe(true)
      // o'sha guruhga qayta: no-op
      expect((await moveStudent(teacher, s1.data.id, g2.id)).ok).toBe(true)

      const { data } = await adminClient()
        .from('group_memberships')
        .select('group_id, joined_at, left_at')
        .eq('student_id', s1.data.id)
        .order('joined_at')
      expect(data).toHaveLength(2)
      expect(data![0]).toMatchObject({ group_id: g1.id })
      expect(data![0].left_at).not.toBeNull()
      expect(data![1]).toMatchObject({ group_id: g2.id, left_at: null })

      const student = await signInAs('one', 'parol12')
      const { data: own } = await student.from('group_memberships').select('student_id')
      expect(own).toHaveLength(2)
      expect(own!.every((r) => r.student_id === s1.data.id)).toBe(true)
    })

    it('mavjud bo\'lmagan o\'quvchi/guruh yoki arxivlangan o\'quvchi: not_found', async () => {
      const g1 = await makeGroup('A')
      const g2 = await makeGroup('B')
      const s = await createStudent(adminClient(), { login: 'one', password: 'parol12', groupId: g1.id })
      if (!s.ok) throw new Error('createStudent')
      expect(await moveStudent(teacher, MISSING_ID, g2.id)).toEqual({ ok: false, error: 'not_found' })
      expect(await moveStudent(teacher, s.data.id, MISSING_ID)).toEqual({ ok: false, error: 'not_found' })
      await adminClient().from('profiles').update({ status: 'archived' }).eq('id', s.data.id)
      expect(await moveStudent(teacher, s.data.id, g2.id)).toEqual({ ok: false, error: 'not_found' })
    })
  })
})

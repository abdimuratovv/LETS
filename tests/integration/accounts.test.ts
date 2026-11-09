import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  archiveStudent,
  createStudent,
  resetStudentPassword,
  restoreStudent,
} from '@/modules/auth-accounts/service'
import {
  adminClient,
  authUserExists,
  makeGroup,
  makeTeacher,
  resetData,
  signInAs,
  type DbClient,
} from './helpers'

const MISSING_ID = '11111111-1111-4111-8111-111111111111'

describe('auth-accounts service', () => {
  let groupId: string

  beforeEach(async () => {
    await resetData()
    groupId = (await makeGroup('7-A')).id
  })

  afterAll(async () => {
    await resetData()
  })

  async function newStudent(login = 'ali.k', password = 'parol12'): Promise<string> {
    const res = await createStudent(adminClient(), { login, password, groupId })
    if (!res.ok) throw new Error(`createStudent: ${res.error}`)
    return res.data.id
  }

  describe('createStudent', () => {
    it('normallashtirilgan login bilan o\'quvchi, faol a\'zolik yaratadi; har qanday registrda kira oladi', async () => {
      const res = await createStudent(adminClient(), {
        login: ' Ali.K ',
        password: 'parol12',
        groupId,
      })
      expect(res.ok).toBe(true)
      if (!res.ok) return

      const { data: profile } = await adminClient()
        .from('profiles')
        .select('login, role, status, onboarding_done')
        .eq('id', res.data.id)
        .single()
      expect(profile).toEqual({
        login: 'ali.k',
        role: 'student',
        status: 'active',
        onboarding_done: false,
      })

      const { data: memberships } = await adminClient()
        .from('group_memberships')
        .select('group_id, left_at')
        .eq('student_id', res.data.id)
      expect(memberships).toEqual([{ group_id: groupId, left_at: null }])

      await expect(signInAs('ALI.K', 'parol12')).resolves.toBeDefined()
    })

    it('band login -> login_taken', async () => {
      await newStudent()
      const res = await createStudent(adminClient(), {
        login: 'ALI.K',
        password: 'boshqa12',
        groupId,
      })
      expect(res).toEqual({ ok: false, error: 'login_taken' })
    })

    it("o'qituvchi logini ham band hisoblanadi", async () => {
      await makeTeacher('ustoz')
      const res = await createStudent(adminClient(), {
        login: 'ustoz',
        password: 'parol12',
        groupId,
      })
      expect(res).toEqual({ ok: false, error: 'login_taken' })
    })

    it('noto\'g\'ri login va parol', async () => {
      expect(
        await createStudent(adminClient(), { login: 'a!', password: 'parol12', groupId }),
      ).toEqual({ ok: false, error: 'invalid_login' })
      expect(
        await createStudent(adminClient(), { login: 'ali.k', password: '123', groupId }),
      ).toEqual({ ok: false, error: 'invalid_password' })
    })

    it("mavjud bo'lmagan guruh -> group_not_found, auth foydalanuvchi qolmaydi", async () => {
      const res = await createStudent(adminClient(), {
        login: 'ali.x',
        password: 'parol12',
        groupId: MISSING_ID,
      })
      expect(res).toEqual({ ok: false, error: 'group_not_found' })
      expect(await authUserExists('ali.x@students.platforma.local')).toBe(false)

      expect(
        await createStudent(adminClient(), { login: 'ali.x', password: 'parol12', groupId: 'xyz' }),
      ).toEqual({ ok: false, error: 'group_not_found' })
    })

    it("a'zolik yozilmasa auth foydalanuvchi va profil o'chiriladi (rollback)", async () => {
      const real = adminClient()
      // a'zolik insert'ini majburan xato qiladigan o'ram
      const failing = new Proxy(real, {
        get(target, prop, receiver) {
          if (prop === 'from') {
            return (table: string) =>
              table === 'group_memberships'
                ? { insert: async () => ({ data: null, error: { code: 'XX000', message: 'forced' } }) }
                : target.from(table as 'profiles')
          }
          return Reflect.get(target, prop, receiver)
        },
      }) as DbClient

      await expect(
        createStudent(failing, { login: 'ali.r', password: 'parol12', groupId }),
      ).rejects.toThrow()
      expect(await authUserExists('ali.r@students.platforma.local')).toBe(false)
      const { data: profiles } = await real.from('profiles').select('id').eq('login', 'ali.r')
      expect(profiles).toEqual([])
    })
  })

  describe('resetStudentPassword', () => {
    it('eski parol ishlamaydi, yangisi ishlaydi', async () => {
      const id = await newStudent()
      expect(await resetStudentPassword(adminClient(), id, 'yangi123')).toEqual({
        ok: true,
        data: null,
      })
      await expect(signInAs('ali.k', 'parol12')).rejects.toThrow()
      await expect(signInAs('ali.k', 'yangi123')).resolves.toBeDefined()
    })

    it("noto'g'ri parol / noma'lum o'quvchi / o'qituvchi", async () => {
      const id = await newStudent()
      expect(await resetStudentPassword(adminClient(), id, '12')).toEqual({
        ok: false,
        error: 'invalid_password',
      })
      expect(await resetStudentPassword(adminClient(), MISSING_ID, 'yangi123')).toEqual({
        ok: false,
        error: 'not_found',
      })
      const teacher = await makeTeacher()
      expect(await resetStudentPassword(adminClient(), teacher.id, 'yangi123')).toEqual({
        ok: false,
        error: 'not_found',
      })
      await expect(signInAs(teacher.login, teacher.password)).resolves.toBeDefined()
    })
  })

  describe('archiveStudent / restoreStudent', () => {
    it("arxivlangan o'quvchi kira olmaydi, tiklangach kiradi; a'zolik saqlanadi", async () => {
      const id = await newStudent()

      expect(await archiveStudent(adminClient(), id)).toEqual({ ok: true, data: null })
      const { data: archived } = await adminClient()
        .from('profiles')
        .select('status')
        .eq('id', id)
        .single()
      expect(archived?.status).toBe('archived')
      await expect(signInAs('ali.k', 'parol12')).rejects.toThrow()

      const { data: memberships } = await adminClient()
        .from('group_memberships')
        .select('group_id, left_at')
        .eq('student_id', id)
      expect(memberships).toEqual([{ group_id: groupId, left_at: null }])

      expect(await restoreStudent(adminClient(), id)).toEqual({ ok: true, data: null })
      const { data: restored } = await adminClient()
        .from('profiles')
        .select('status')
        .eq('id', id)
        .single()
      expect(restored?.status).toBe('active')
      await expect(signInAs('ali.k', 'parol12')).resolves.toBeDefined()
    })

    it("noma'lum id va o'qituvchi -> not_found", async () => {
      const teacher = await makeTeacher()
      expect(await archiveStudent(adminClient(), MISSING_ID)).toEqual({
        ok: false,
        error: 'not_found',
      })
      expect(await archiveStudent(adminClient(), 'not-a-uuid')).toEqual({
        ok: false,
        error: 'not_found',
      })
      expect(await archiveStudent(adminClient(), teacher.id)).toEqual({
        ok: false,
        error: 'not_found',
      })
      expect(await restoreStudent(adminClient(), teacher.id)).toEqual({
        ok: false,
        error: 'not_found',
      })
      await expect(signInAs(teacher.login, teacher.password)).resolves.toBeDefined()
    })
  })
})

import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createStudent } from '@/modules/auth-accounts/service'
import {
  completeOnboarding,
  listNameChanges,
  revertNameChange,
  setBirthDate,
  setNameEditLock,
  updateAvatar,
  updateNames,
  updateOwnProfile,
} from '@/modules/profile/service'
import {
  adminClient,
  makeGroup,
  makeTeacher,
  resetData,
  signInAs,
  type DbClient,
} from './helpers'

const MISSING_ID = '11111111-1111-4111-8111-111111111111'

const valid = {
  fullName: "O'g'iloy Ne'matova",
  nickname: 'oggi' as string | null,
  birthDate: '2010-05-17',
  avatarBase: 'fox' as const,
}

describe('profile service', () => {
  let studentId: string
  let student: DbClient
  let teacher: DbClient

  beforeEach(async () => {
    await resetData()
    const groupId = (await makeGroup('7-A')).id
    const res = await createStudent(adminClient(), { login: 'ali.k', password: 'parol12', groupId })
    if (!res.ok) throw new Error(res.error)
    studentId = res.data.id
    await makeTeacher()
    student = await signInAs('ali.k', 'parol12')
    teacher = await signInAs('teacher', 'teacher123')
  })

  afterAll(async () => {
    await resetData()
  })

  async function profile() {
    const { data } = await adminClient().from('profiles').select('*').eq('id', studentId).single()
    return data!
  }

  describe('completeOnboarding', () => {
    it("to'g'ri ma'lumot bilan profilni to'ldiradi va tug'ilgan kunni qulflaydi", async () => {
      const res = await completeOnboarding(student, studentId, valid)
      expect(res).toEqual({ ok: true, data: null })
      const p = await profile()
      expect(p.onboarding_done).toBe(true)
      expect(p.birth_date_locked).toBe(true)
      expect(p.birth_date).toBe('2010-05-17')
      expect(p.full_name).toBe("O'g'iloy Ne'matova")
      expect(p.nickname).toBe('oggi')
      expect(p.avatar_config).toEqual({ base: 'fox' })
    })

    it("kelajak sanasi bilan invalid_birth_date; profil o'zgarmaydi", async () => {
      const before = await profile()
      const res = await completeOnboarding(student, studentId, { ...valid, birthDate: '2030-01-01' })
      expect(res).toEqual({ ok: false, error: 'invalid_birth_date' })
      expect(await profile()).toEqual(before)
    })

    it('zod xatolari DB ga bormasdan qaytariladi', async () => {
      const bad = await completeOnboarding(student, studentId, { ...valid, fullName: 'Ali' })
      expect(bad).toEqual({ ok: false, error: 'invalid_full_name' })
      const bad2 = await completeOnboarding(student, studentId, {
        ...valid,
        avatarBase: 'dragon' as never,
      })
      expect(bad2).toEqual({ ok: false, error: 'invalid_avatar' })
    })

    it("boshqa foydalanuvchi qatori uchun not_found (RLS)", async () => {
      const res = await completeOnboarding(student, MISSING_ID, valid)
      expect(res).toEqual({ ok: false, error: 'not_found' })
    })

    it("ikkinchi marta boshqa tug'ilgan kun bilan birth_date_locked", async () => {
      await completeOnboarding(student, studentId, valid)
      const res = await completeOnboarding(student, studentId, { ...valid, birthDate: '2011-01-01' })
      expect(res).toEqual({ ok: false, error: 'birth_date_locked' })
      expect((await profile()).birth_date).toBe('2010-05-17')
    })
  })

  describe('ism nazorati', () => {
    it("updateNames tarixga yozadi; revertNameChange eski ismni qaytaradi", async () => {
      await completeOnboarding(student, studentId, valid)
      const res = await updateNames(student, studentId, {
        fullName: 'Ali Karimov',
        nickname: 'oggi',
      })
      expect(res).toEqual({ ok: true, data: null })
      expect((await profile()).full_name).toBe('Ali Karimov')

      const changes = await listNameChanges(teacher, studentId)
      expect(changes.length).toBeGreaterThanOrEqual(2)
      const latest = changes[0]
      expect(latest).toMatchObject({
        field: 'full_name',
        old_value: "O'g'iloy Ne'matova",
        new_value: 'Ali Karimov',
      })

      expect(await revertNameChange(teacher, latest.id)).toEqual({ ok: true, data: null })
      expect((await profile()).full_name).toBe("O'g'iloy Ne'matova")
    })

    it('revertNameChange: mavjud bo\'lmagan yozuv uchun not_found', async () => {
      expect(await revertNameChange(teacher, MISSING_ID)).toEqual({ ok: false, error: 'not_found' })
    })

    it('setNameEditLock(true) dan keyin updateNames name_edit_locked qaytaradi', async () => {
      await completeOnboarding(student, studentId, valid)
      expect(await setNameEditLock(teacher, studentId, true)).toEqual({ ok: true, data: null })
      const res = await updateNames(student, studentId, { fullName: 'Ali Karimov', nickname: null })
      expect(res).toEqual({ ok: false, error: 'name_edit_locked' })
      expect((await profile()).full_name).toBe("O'g'iloy Ne'matova")

      await setNameEditLock(teacher, studentId, false)
      expect((await updateNames(student, studentId, { fullName: 'Ali Karimov', nickname: null })).ok).toBe(true)
    })

    it('setNameEditLock: mavjud bo\'lmagan o\'quvchi uchun not_found', async () => {
      expect(await setNameEditLock(teacher, MISSING_ID, true)).toEqual({ ok: false, error: 'not_found' })
    })
  })

  describe("tug'ilgan kun", () => {
    it("o'quvchi o'zgartira olmaydi, o'qituvchi setBirthDate bilan o'zgartiradi", async () => {
      await completeOnboarding(student, studentId, valid)
      const { error } = await student
        .from('profiles')
        .update({ birth_date: '2011-01-01' })
        .eq('id', studentId)
      expect(error?.message).toBe('birth_date_locked')

      expect(await setBirthDate(teacher, studentId, '2011-01-01')).toEqual({ ok: true, data: null })
      expect((await profile()).birth_date).toBe('2011-01-01')
    })

    it("setBirthDate noto'g'ri sanani rad etadi", async () => {
      expect(await setBirthDate(teacher, studentId, '2999-01-01')).toEqual({
        ok: false,
        error: 'invalid_birth_date',
      })
      expect(await setBirthDate(teacher, studentId, '1940-01-01')).toEqual({
        ok: false,
        error: 'invalid_birth_date',
      })
      expect(await setBirthDate(teacher, MISSING_ID, '2010-01-01')).toEqual({
        ok: false,
        error: 'not_found',
      })
    })

    it("o'qituvchi onboardingdan oldin kiritgan sana bilan onboarding o'tadi; boshqa sana birth_date_locked", async () => {
      expect(await setBirthDate(teacher, studentId, '2011-02-03')).toEqual({ ok: true, data: null })
      const locked = await profile()
      expect(locked.onboarding_done).toBe(false)
      expect(locked.birth_date_locked).toBe(true)

      // O'quvchi API orqali boshqa sana yuborsa - rad etiladi, profil o'zgarmaydi
      const other = await completeOnboarding(student, studentId, valid)
      expect(other).toEqual({ ok: false, error: 'birth_date_locked' })
      expect((await profile()).onboarding_done).toBe(false)

      // Forma saqlangan sanani yuboradi - onboarding muvaffaqiyatli
      const res = await completeOnboarding(student, studentId, { ...valid, birthDate: '2011-02-03' })
      expect(res).toEqual({ ok: true, data: null })
      const p = await profile()
      expect(p.onboarding_done).toBe(true)
      expect(p.birth_date).toBe('2011-02-03')
      expect(p.full_name).toBe("O'g'iloy Ne'matova")
    })
  })

  describe('1-ttuzatish', () => {
    it("ismi bloklangan o'quvchi avatarini o'zgartira oladi (ism yuborilmaydi)", async () => {
      await completeOnboarding(student, studentId, valid)
      await setNameEditLock(teacher, studentId, true)
      expect(await updateOwnProfile(student, studentId, { avatarBase: 'owl' })).toEqual({
        ok: true,
        data: null,
      })
      const p = await profile()
      expect(p.avatar_config).toEqual({ base: 'owl' })
      expect(p.full_name).toBe("O'g'iloy Ne'matova")
      expect(
        await updateOwnProfile(student, studentId, {
          names: { fullName: 'Ali Karimov', nickname: null },
          avatarBase: 'cat',
        }),
      ).toEqual({ ok: false, error: 'name_edit_locked' })
      expect((await profile()).avatar_config).toEqual({ base: 'owl' })
    })

    it("onboarding full_name qatorini qaytarib bo'lmaydi (cannot_revert)", async () => {
      await completeOnboarding(student, studentId, valid)
      const changes = await listNameChanges(teacher, studentId)
      const row = changes.filter((c) => c.field === 'full_name').at(-1)!
      expect(row.old_value).toBeNull()
      expect(await revertNameChange(teacher, row.id)).toEqual({ ok: false, error: 'cannot_revert' })
      expect((await profile()).full_name).toBe("O'g'iloy Ne'matova")
    })
  })

  describe('updateAvatar', () => {
    it('avatarni almashtiradi va noto\'g\'ri qiymatni rad etadi', async () => {
      expect(await updateAvatar(student, studentId, 'owl')).toEqual({ ok: true, data: null })
      expect((await profile()).avatar_config).toEqual({ base: 'owl' })
      expect(await updateAvatar(student, studentId, 'dragon' as never)).toEqual({
        ok: false,
        error: 'invalid_avatar',
      })
    })
  })
})

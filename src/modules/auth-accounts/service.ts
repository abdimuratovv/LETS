import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { loginSchema, loginToEmail, passwordSchema } from '@/lib/auth/login'
import { err, ok, type Result } from '@/lib/result'
import type { Database } from '@/types/database'

// R2: klient parametr sifatida keladi (service_role); bu modul admin.ts'ni import qilmaydi.

export type AccountError =
  | 'invalid_login'
  | 'invalid_password'
  | 'login_taken'
  | 'group_not_found'
  | 'not_found'

type Admin = SupabaseClient<Database>

// ~100 yil: Supabase'da "abadiy" ban yo'q.
const ARCHIVE_BAN = '876000h'
const uuidSchema = z.uuid()

type DbError = { code?: string; message: string }

function fail(what: string, error: DbError | null | undefined): never {
  throw new Error(`${what}: ${error?.message ?? "noma'lum xato"}`)
}

function isDuplicateEmail(error: { code?: string; status?: number; message: string }): boolean {
  return (
    error.code === 'email_exists' ||
    error.code === 'user_already_exists' ||
    /already (been )?registered|already exists/i.test(error.message)
  )
}

async function findStudent(admin: Admin, studentId: string): Promise<boolean> {
  if (!uuidSchema.safeParse(studentId).success) return false
  const { data, error } = await admin
    .from('profiles')
    .select('id')
    .eq('id', studentId)
    .eq('role', 'student')
    .maybeSingle()
  if (error) fail('profil o\'qilmadi', error)
  return data !== null
}

export async function createStudent(
  admin: Admin,
  input: { login: string; password: string; groupId: string },
): Promise<Result<{ id: string }, AccountError>> {
  const login = loginSchema.safeParse(input.login)
  if (!login.success) return err('invalid_login')
  const password = passwordSchema.safeParse(input.password)
  if (!password.success) return err('invalid_password')

  // Guruh auth foydalanuvchi yaratilishidan oldin tekshiriladi.
  if (!uuidSchema.safeParse(input.groupId).success) return err('group_not_found')
  const { data: group, error: groupError } = await admin
    .from('groups')
    .select('id')
    .eq('id', input.groupId)
    .maybeSingle()
  if (groupError) fail("guruh o'qilmadi", groupError)
  if (!group) return err('group_not_found')

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: loginToEmail(login.data),
    password: password.data,
    email_confirm: true,
  })
  if (authError) {
    if (isDuplicateEmail(authError)) return err('login_taken')
    fail('auth foydalanuvchi yaratilmadi', authError)
  }
  const userId = created.user.id

  // Shu nuqtadan keyingi har qanday xatoda auth foydalanuvchi (va profil) o'chiriladi.
  let profileInserted = false
  const rollback = async () => {
    if (profileInserted) await admin.from('profiles').delete().eq('id', userId)
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) fail('rollback: auth foydalanuvchi o\'chirilmadi', error)
  }

  try {
    const { error: profileError } = await admin.from('profiles').insert({
      id: userId,
      role: 'student',
      login: login.data,
      onboarding_done: false,
    })
    if (profileError) {
      await rollback()
      if (profileError.code === '23505') return err('login_taken')
      fail('profil yaratilmadi', profileError)
    }
    profileInserted = true

    const { error: memberError } = await admin
      .from('group_memberships')
      .insert({ student_id: userId, group_id: input.groupId })
    if (memberError) {
      await rollback()
      // Guruh tekshiruvdan keyin o'chirilgan bo'lsa (FK buzilishi)
      if (memberError.code === '23503') return err('group_not_found')
      fail("a'zolik yozilmadi", memberError)
    }
  } catch (e) {
    // Kutilmagan istisno (tarmoq va h.k.): rollback hali bajarilmagan bo'lishi mumkin.
    if (await userStillExists(admin, userId)) await rollback()
    throw e
  }

  return ok({ id: userId })
}

async function userStillExists(admin: Admin, userId: string): Promise<boolean> {
  const { data } = await admin.auth.admin.getUserById(userId)
  return Boolean(data?.user)
}

export async function resetStudentPassword(
  admin: Admin,
  studentId: string,
  password: string,
): Promise<Result<null, AccountError>> {
  const parsed = passwordSchema.safeParse(password)
  if (!parsed.success) return err('invalid_password')
  if (!(await findStudent(admin, studentId))) return err('not_found')

  const { error } = await admin.auth.admin.updateUserById(studentId, {
    password: parsed.data,
  })
  if (error) fail('parol yangilanmadi', error)
  return ok(null)
}

async function setBan(admin: Admin, studentId: string, banDuration: string): Promise<DbError | null> {
  const { error } = await admin.auth.admin.updateUserById(studentId, {
    ban_duration: banDuration,
  })
  return error
}

async function setStatus(
  admin: Admin,
  studentId: string,
  status: 'active' | 'archived',
): Promise<DbError | null> {
  const { error } = await admin.from('profiles').update({ status }).eq('id', studentId)
  return error
}

/**
 * Tartib: avval ban, keyin status. Status yozilmasa ban qaytariladi.
 * Qisman xatoda eng yomon holat - "bloklangan, lekin faol" (kira olmaydi), hech qachon
 * "arxivlangan, lekin kira oladi" emas.
 */
export async function archiveStudent(
  admin: Admin,
  studentId: string,
): Promise<Result<null, AccountError>> {
  if (!(await findStudent(admin, studentId))) return err('not_found')

  const banError = await setBan(admin, studentId, ARCHIVE_BAN)
  if (banError) fail('akkaunt bloklanmadi', banError)

  const statusError = await setStatus(admin, studentId, 'archived')
  if (statusError) {
    await setBan(admin, studentId, 'none')
    fail('status yozilmadi', statusError)
  }
  return ok(null)
}

/**
 * Tartib: avval status='active', keyin ban olib tashlanadi. Ban olinmasa status qaytariladi.
 * Qisman xatoda eng yomon holat - "faol, lekin bloklangan" (kira olmaydi).
 */
export async function restoreStudent(
  admin: Admin,
  studentId: string,
): Promise<Result<null, AccountError>> {
  if (!(await findStudent(admin, studentId))) return err('not_found')

  const statusError = await setStatus(admin, studentId, 'active')
  if (statusError) fail('status yozilmadi', statusError)

  const banError = await setBan(admin, studentId, 'none')
  if (banError) {
    await setStatus(admin, studentId, 'archived')
    fail('blok olib tashlanmadi', banError)
  }
  return ok(null)
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { loginToEmail } from '@/lib/auth/login'
import type { Database } from '@/types/database'

// R2: admin.ts `server-only` import qiladi - testlar o'z klientlarini env'dan quradi.

export type DbClient = SupabaseClient<Database>

const NIL_UUID = '00000000-0000-0000-0000-000000000000'

function env(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} .env.local da yo'q`)
  return value
}

const noSession = { auth: { autoRefreshToken: false, persistSession: false } }

let admin: DbClient | null = null

/** service_role klienti (RLS va guard cheklovlarisiz). */
export function adminClient(): DbClient {
  admin ??= createClient<Database>(
    env('NEXT_PUBLIC_SUPABASE_URL'),
    env('SUPABASE_SERVICE_ROLE_KEY'),
    noSession,
  )
  return admin
}

/** Yangi anon klient (har chaqiruvda alohida sessiya). */
export function anonClient(): DbClient {
  return createClient<Database>(
    env('NEXT_PUBLIC_SUPABASE_URL'),
    env('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    noSession,
  )
}

function check(error: { message: string } | null, what: string): void {
  if (error) throw new Error(`${what}: ${error.message}`)
}

/**
 * Barcha auth foydalanuvchilarini (o'qituvchilar ham), guruhlar, resurslar, mavzular va
 * kurslarni o'chiradi; `resources` bucket'ini bo'shatadi.
 */
export async function resetData(): Promise<void> {
  const db = adminClient()

  for (;;) {
    const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
    check(error, 'listUsers')
    if (data.users.length === 0) break
    for (const user of data.users) {
      const { error: delError } = await db.auth.admin.deleteUser(user.id)
      check(delError, 'deleteUser')
    }
  }

  // profiles -> auth.users ON DELETE CASCADE; a'zoliklar profil/guruh bilan birga ketadi.
  check((await db.from('profiles').delete().neq('id', NIL_UUID)).error, 'profiles')
  check((await db.from('groups').delete().neq('id', NIL_UUID)).error, 'groups')
  check((await db.from('resources').delete().neq('id', NIL_UUID)).error, 'resources')
  check((await db.from('topics').delete().neq('id', NIL_UUID)).error, 'topics')
  check((await db.from('courses').delete().neq('id', NIL_UUID)).error, 'courses')
  check((await db.storage.emptyBucket('resources')).error, 'resources bucket')
  await resetPrivacy()
}

/** Maxfiylik sozlamalarini boshlang'ich qiymatlarga qaytaradi va istisnolarni o'chiradi. */
export async function resetPrivacy(): Promise<void> {
  const db = adminClient()
  check(
    (await db.from('privacy_group_overrides').delete().neq('group_id', NIL_UUID)).error,
    'privacy_group_overrides',
  )
  check(
    (
      await db.from('privacy_settings').upsert([
        { item: 'avatar', scope: 'own_group' },
        { item: 'online_status', scope: 'own_group' },
        { item: 'stats', scope: 'own_group' },
        { item: 'badges', scope: 'everyone' },
        { item: 'birthday', scope: 'own_group' },
      ])
    ).error,
    'privacy_settings',
  )
}

export async function makeGroup(name: string): Promise<{ id: string; name: string }> {
  const { data, error } = await adminClient()
    .from('groups')
    .insert({ name })
    .select('id, name')
    .single()
  check(error, 'makeGroup')
  return data!
}

export type TestTeacher = { id: string; login: string; password: string }

export async function makeTeacher(
  login = 'teacher',
  password = 'teacher123',
): Promise<TestTeacher> {
  const db = adminClient()
  const { data, error } = await db.auth.admin.createUser({
    email: loginToEmail(login),
    password,
    email_confirm: true,
  })
  check(error, 'makeTeacher createUser')
  const id = data.user!.id

  const { error: profileError } = await db.from('profiles').insert({
    id,
    role: 'teacher',
    login,
    full_name: "Test O'qituvchi",
    onboarding_done: true,
  })
  if (profileError) {
    await db.auth.admin.deleteUser(id)
    check(profileError, 'makeTeacher profile')
  }
  return { id, login, password }
}

export async function makeCourse(title: string): Promise<{ id: string; title: string }> {
  const { data: last } = await adminClient()
    .from('courses')
    .select('position')
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  const { data, error } = await adminClient()
    .from('courses')
    .insert({ title, position: (last?.position ?? 0) + 1 })
    .select('id, title')
    .single()
  check(error, 'makeCourse')
  return data!
}

export type TestStudent = { id: string; login: string; password: string }

/** Faol o'quvchi: auth + profil (onboarding tugagan) + faol guruh a'zoligi. */
export async function makeStudent(
  groupId: string,
  login = 'student',
  password = 'student123',
): Promise<TestStudent> {
  const db = adminClient()
  const { data, error } = await db.auth.admin.createUser({
    email: loginToEmail(login),
    password,
    email_confirm: true,
  })
  check(error, 'makeStudent createUser')
  const id = data.user!.id

  const { error: profileError } = await db.from('profiles').insert({
    id,
    role: 'student',
    login,
    full_name: "Test O'quvchi",
    birth_date: '2010-01-01',
    onboarding_done: true,
  })
  if (profileError) {
    await db.auth.admin.deleteUser(id)
    check(profileError, 'makeStudent profile')
  }
  const { error: memberError } = await db
    .from('group_memberships')
    .insert({ student_id: id, group_id: groupId })
  check(memberError, 'makeStudent membership')
  return { id, login, password }
}

/** Login + parol bilan kiradi; muvaffaqiyatsiz bo'lsa xato tashlaydi. */
export async function signInAs(login: string, password: string): Promise<DbClient> {
  const client = anonClient()
  const { error } = await client.auth.signInWithPassword({
    email: loginToEmail(login),
    password,
  })
  if (error) throw new Error(`signInAs(${login}): ${error.message}`)
  return client
}

/** Berilgan email bilan auth foydalanuvchi bormi. */
export async function authUserExists(email: string): Promise<boolean> {
  const { data, error } = await adminClient().auth.admin.listUsers({ page: 1, perPage: 1000 })
  check(error, 'listUsers')
  return data.users.some((u) => u.email === email)
}

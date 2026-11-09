import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { err, ok, type Result } from '@/lib/result'
import type { Database } from '@/types/database'
import { AVATAR_BASES, type AvatarBase } from './avatars'
import {
  birthDateSchema,
  fullNameSchema,
  nicknameSchema,
  onboardingSchema,
  type OnboardingInput,
} from './validation'

export type ProfileError =
  | 'invalid_full_name'
  | 'invalid_nickname'
  | 'invalid_birth_date'
  | 'invalid_avatar'
  | 'name_edit_locked'
  | 'birth_date_locked'
  | 'forbidden'
  | 'not_found'

type Db = SupabaseClient<Database>
type DbError = { code?: string; message: string }

export type NameChange = Database['public']['Tables']['profile_name_changes']['Row']

const uuidSchema = z.uuid()

// DB guard trigger xabari = kod (SQLSTATE P0001).
const GUARD_CODES: Record<string, ProfileError> = {
  protected_column: 'forbidden',
  name_edit_locked: 'name_edit_locked',
  birth_date_locked: 'birth_date_locked',
  invalid_birth_date: 'invalid_birth_date',
  invalid_full_name: 'invalid_full_name',
  invalid_nickname: 'invalid_nickname',
  invalid_avatar: 'invalid_avatar',
}

function mapDbError(what: string, error: DbError): ProfileError {
  const mapped = GUARD_CODES[error.message]
  if (mapped) return mapped
  throw new Error(`${what}: ${error.message}`)
}

/** Bitta qatorni yangilaydi; RLS sababli 0 qator = not_found. */
async function updateProfile(
  db: Db,
  id: string,
  patch: Database['public']['Tables']['profiles']['Update'],
): Promise<Result<null, ProfileError>> {
  if (!uuidSchema.safeParse(id).success) return err('not_found')
  const { data, error } = await db.from('profiles').update(patch).eq('id', id).select('id')
  if (error) return err(mapDbError('profil yangilanmadi', error))
  if (!data || data.length === 0) return err('not_found')
  return ok(null)
}

function firstCode(error: z.ZodError): ProfileError {
  const msg = error.issues[0]?.message
  return msg && msg in GUARD_CODES ? GUARD_CODES[msg] : 'invalid_full_name'
}

export async function completeOnboarding(
  db: Db,
  userId: string,
  input: OnboardingInput,
): Promise<Result<null, ProfileError>> {
  const parsed = onboardingSchema.safeParse({ ...input, nickname: input.nickname ?? '' })
  if (!parsed.success) return err(firstCode(parsed.error))
  const v = parsed.data
  return updateProfile(db, userId, {
    full_name: v.fullName,
    nickname: v.nickname,
    birth_date: v.birthDate,
    avatar_config: { base: v.avatarBase },
    onboarding_done: true,
  })
}

export async function updateNames(
  db: Db,
  userId: string,
  input: { fullName: string; nickname: string | null },
): Promise<Result<null, ProfileError>> {
  const fullName = fullNameSchema.safeParse(input.fullName)
  if (!fullName.success) return err('invalid_full_name')
  const nickname = nicknameSchema.safeParse(input.nickname ?? '')
  if (!nickname.success) return err('invalid_nickname')
  return updateProfile(db, userId, { full_name: fullName.data, nickname: nickname.data })
}

export async function updateAvatar(
  db: Db,
  userId: string,
  base: AvatarBase,
): Promise<Result<null, ProfileError>> {
  if (!(AVATAR_BASES as readonly string[]).includes(base)) return err('invalid_avatar')
  return updateProfile(db, userId, { avatar_config: { base } })
}

// ===== O'qituvchi funksiyalari (o'qituvchi sessiyasi klienti) =====

export async function revertNameChange(
  db: Db,
  changeId: string,
): Promise<Result<null, ProfileError>> {
  if (!uuidSchema.safeParse(changeId).success) return err('not_found')
  const { data: change, error } = await db
    .from('profile_name_changes')
    .select('profile_id, field, old_value')
    .eq('id', changeId)
    .maybeSingle()
  if (error) throw new Error(`tarix o'qilmadi: ${error.message}`)
  if (!change) return err('not_found')

  if (change.field === 'full_name') {
    return updateProfile(db, change.profile_id, { full_name: change.old_value })
  }
  if (change.field === 'nickname') {
    return updateProfile(db, change.profile_id, { nickname: change.old_value })
  }
  return err('not_found')
}

export async function setNameEditLock(
  db: Db,
  studentId: string,
  locked: boolean,
): Promise<Result<null, ProfileError>> {
  return updateProfile(db, studentId, { name_edit_locked: locked })
}

export async function setBirthDate(
  db: Db,
  studentId: string,
  date: string,
): Promise<Result<null, ProfileError>> {
  // O'qituvchi uchun DB qiymat tekshiruvi o'tkazib yuboriladi: zod yagona to'siq.
  if (!birthDateSchema().safeParse(date).success) return err('invalid_birth_date')
  return updateProfile(db, studentId, { birth_date: date })
}

export async function listNameChanges(db: Db, studentId: string): Promise<NameChange[]> {
  if (!uuidSchema.safeParse(studentId).success) return []
  const { data, error } = await db
    .from('profile_name_changes')
    .select('*')
    .eq('profile_id', studentId)
    .order('changed_at', { ascending: false })
    .order('id', { ascending: false })
  if (error) throw new Error(`tarix o'qilmadi: ${error.message}`)
  return data
}

import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { err, ok, type Result } from '@/lib/result'
import { AVATAR_BASES, type AvatarBase } from '@/modules/profile/avatars'
import type { Database } from '@/types/database'
import {
  PRIVACY_ITEMS,
  PRIVACY_SCOPES,
  type PrivacyItem,
  type PrivacyScope,
} from './labels'
import { ONLINE_WINDOW_MS } from './presence'

// Yozuvchi funksiyalar o'qituvchi sessiyasi klientini oladi. RLS o'qituvchi bo'lmagan
// foydalanuvchining update/delete'ini xatosiz "0 qator" ga aylantiradi, shuning uchun
// natija `.select()` bilan tekshiriladi va 0 qator bo'lsa `is_teacher()` so'raladi.

export {
  PRIVACY_ITEMS,
  PRIVACY_LABELS,
  PRIVACY_SCOPES,
  SCOPE_LABELS,
  type PrivacyItem,
  type PrivacyScope,
} from './labels'

export type PrivacyError = 'invalid_privacy' | 'group_not_found' | 'forbidden'

export type PrivacyMatrix = {
  global: Record<PrivacyItem, PrivacyScope>
  overrides: { groupId: string; item: PrivacyItem; scope: PrivacyScope }[]
}

export type VisibleStudent = {
  id: string
  fullName: string
  nickname: string | null
  groupId: string
  sameGroup: boolean
  avatarConfig: { base: AvatarBase } | null
  lastSeenAt: string | null
  birthdayMd: string | null
}

type Db = SupabaseClient<Database>
type DbError = { code?: string; message: string }

const uuidSchema = z.uuid()

function fail(what: string, error: DbError | null | undefined): never {
  throw new Error(`${what}: ${error?.message ?? "noma'lum xato"}`)
}

function isItem(value: unknown): value is PrivacyItem {
  return (PRIVACY_ITEMS as readonly unknown[]).includes(value)
}

function isScope(value: unknown): value is PrivacyScope {
  return (PRIVACY_SCOPES as readonly unknown[]).includes(value)
}

/** 0 qatorli yozuv sababini aniqlaydi: o'qituvchi bo'lmasa `forbidden`. */
async function isTeacher(db: Db): Promise<boolean> {
  const { data, error } = await db.rpc('is_teacher')
  if (error) fail("rol tekshirilmadi", error)
  return data === true
}

export async function getPrivacyMatrix(db: Db): Promise<PrivacyMatrix> {
  const [settings, overrides] = await Promise.all([
    db.from('privacy_settings').select('item, scope'),
    db.from('privacy_group_overrides').select('group_id, item, scope').order('item'),
  ])
  if (settings.error) fail("maxfiylik sozlamalari o'qilmadi", settings.error)
  if (overrides.error) fail("guruh istisnolari o'qilmadi", overrides.error)

  // Jadvalda qator bo'lmasa can_view "nobody" deb hisoblaydi.
  const global = Object.fromEntries(PRIVACY_ITEMS.map((i) => [i, 'nobody'])) as Record<
    PrivacyItem,
    PrivacyScope
  >
  for (const row of settings.data ?? []) global[row.item] = row.scope

  return {
    global,
    overrides: (overrides.data ?? []).map((o) => ({
      groupId: o.group_id,
      item: o.item,
      scope: o.scope,
    })),
  }
}

export async function setGlobalScope(
  db: Db,
  item: PrivacyItem,
  scope: PrivacyScope,
): Promise<Result<null, PrivacyError>> {
  if (!isItem(item) || !isScope(scope)) return err('invalid_privacy')

  const { data, error } = await db
    .from('privacy_settings')
    .update({ scope })
    .eq('item', item)
    .select('item')
  if (error) {
    if (error.code === '42501') return err('forbidden')
    fail('maxfiylik sozlamasi yozilmadi', error)
  }
  if (data && data.length > 0) return ok(null)

  // Qator yo'q (o'chirilgan bo'lsa) yoki RLS filtrladi.
  if (!(await isTeacher(db))) return err('forbidden')
  const { error: insertError } = await db.from('privacy_settings').insert({ item, scope })
  if (insertError) {
    if (insertError.code === '42501') return err('forbidden')
    fail('maxfiylik sozlamasi yozilmadi', insertError)
  }
  return ok(null)
}

/** `scope = null` -> shu guruh uchun istisno o'chiriladi (umumiy qiymat amal qiladi). */
export async function setGroupOverride(
  db: Db,
  groupId: string,
  item: PrivacyItem,
  scope: PrivacyScope | null,
): Promise<Result<null, PrivacyError>> {
  if (!isItem(item) || (scope !== null && !isScope(scope))) return err('invalid_privacy')
  if (!uuidSchema.safeParse(groupId).success) return err('group_not_found')

  if (scope === null) {
    const { data, error } = await db
      .from('privacy_group_overrides')
      .delete()
      .eq('group_id', groupId)
      .eq('item', item)
      .select('item')
    if (error) {
      if (error.code === '42501') return err('forbidden')
      fail("istisno o'chirilmadi", error)
    }
    if (data && data.length > 0) return ok(null)
    // O'chiriladigan qator bo'lmagan (idempotent) yoki RLS filtrladi.
    return (await isTeacher(db)) ? ok(null) : err('forbidden')
  }

  const { error } = await db
    .from('privacy_group_overrides')
    .upsert({ group_id: groupId, item, scope }, { onConflict: 'item,group_id' })
  if (error) {
    if (error.code === '42501') return err('forbidden')
    if (error.code === '23503') return err('group_not_found')
    fail('istisno yozilmadi', error)
  }
  return ok(null)
}

// Generatsiya qilingan turlar RPC ustunlarini null emas deb belgilaydi, lekin ruxsatsiz
// ustunlar (va guruhsiz o'quvchining group_id) null qaytadi - shuning uchun lokal tur.
type VisibleRow = {
  id: string
  full_name: string | null
  nickname: string | null
  group_id: string | null
  same_group: boolean | null
  avatar_config: unknown
  last_seen_at: string | null
  birthday_md: string | null
}

function avatarOf(config: unknown): { base: AvatarBase } | null {
  if (config && typeof config === 'object' && 'base' in config) {
    const base = (config as { base: unknown }).base
    if ((AVATAR_BASES as readonly unknown[]).includes(base)) return { base: base as AvatarBase }
  }
  return null
}

export async function listVisibleStudents(db: Db): Promise<VisibleStudent[]> {
  const { data, error } = await db.rpc('list_visible_students')
  if (error) fail("o'quvchilar ro'yxati o'qilmadi", error)
  return ((data ?? []) as unknown as VisibleRow[]).map((r) => ({
    id: r.id,
    // RPC faqat onboardingni tugatganlarni qaytaradi (CHECK: full_name majburiy); `??` faqat tur uchun.
    fullName: r.full_name ?? '',
    nickname: r.nickname || null,
    groupId: r.group_id ?? '',
    sameGroup: r.same_group === true,
    avatarConfig: avatarOf(r.avatar_config),
    lastSeenAt: r.last_seen_at,
    birthdayMd: r.birthday_md,
  }))
}

/** `last_seen_at` ni faqat u bo'sh yoki 5 daqiqadan eski bo'lsa yangilaydi (bitta so'rov). */
export async function touchLastSeen(db: Db, userId: string): Promise<void> {
  if (!uuidSchema.safeParse(userId).success) return
  const now = new Date()
  const threshold = new Date(now.getTime() - ONLINE_WINDOW_MS).toISOString()
  const { error } = await db
    .from('profiles')
    .update({ last_seen_at: now.toISOString() })
    .eq('id', userId)
    .or(`last_seen_at.is.null,last_seen_at.lt.${threshold}`)
  if (error) fail('last_seen_at yangilanmadi', error)
}

import type { Database } from '@/types/database'

// Klient komponentlar ham ishlatadigan konstantalar (DB/zod importisiz).

export type PrivacyItem = Database['public']['Enums']['privacy_item']
export type PrivacyScope = Database['public']['Enums']['privacy_scope']

export const PRIVACY_ITEMS: readonly PrivacyItem[] = [
  'avatar',
  'online_status',
  'stats',
  'badges',
  'birthday',
]
export const PRIVACY_SCOPES: readonly PrivacyScope[] = ['everyone', 'own_group', 'nobody']

export const PRIVACY_LABELS: Record<PrivacyItem, string> = {
  avatar: 'Avatar',
  online_status: 'Online holati',
  stats: "Ko'rsatkichlar va reyting",
  badges: 'Nishonlar',
  birthday: "Tug'ilgan kun",
}

export const SCOPE_LABELS: Record<PrivacyScope, string> = {
  everyone: 'Hammaga',
  own_group: "Faqat o'z guruhiga",
  nobody: 'Hech kimga',
}

import { describe, expect, it } from 'vitest'
import {
  birthDateSchema,
  fullNameSchema,
  nicknameSchema,
  onboardingSchema,
} from '@/modules/profile/validation'
import { AVATAR_BASES, AVATAR_LABELS } from '@/modules/profile/avatars'

describe('fullNameSchema', () => {
  it('accepts Uzbek names', () => {
    for (const ok of ["O'g'iloy Ne'matova", 'Oʻgʻiloy Rahimova', 'Gʻayrat Sobirov', "Ma'mura-Xon Aliyeva", 'Шерзод Каримов'])
      expect(fullNameSchema.safeParse(ok).success).toBe(true)
  })
  it('rejects bad names', () => {
    for (const bad of ['Ali', 'Ali 2Karimov', '   ', 'A'.repeat(30) + ' ' + 'B'.repeat(31)])
      expect(fullNameSchema.safeParse(bad).success).toBe(false)
  })
  it('normalizes whitespace', () => {
    expect(fullNameSchema.parse('  Ali   Karimov ')).toBe('Ali Karimov')
  })
})

describe('nicknameSchema', () => {
  it('empty -> null', () => {
    expect(nicknameSchema.parse('')).toBeNull()
    expect(nicknameSchema.parse('   ')).toBeNull()
  })
  it('validates', () => {
    expect(nicknameSchema.safeParse('a').success).toBe(false)
    expect(nicknameSchema.parse(' Ali_1 ')).toBe('Ali_1')
    expect(nicknameSchema.safeParse('a'.repeat(21)).success).toBe(false)
    expect(nicknameSchema.safeParse('ali!').success).toBe(false)
  })
})

describe('birthDateSchema', () => {
  const s = birthDateSchema(new Date('2026-11-08T10:00:00+05:00'))
  it('bounds and validity', () => {
    expect(s.safeParse('2012-05-01').success).toBe(true)
    expect(s.safeParse('2026-11-08').success).toBe(true)
    expect(s.safeParse('1950-01-01').success).toBe(true)
    expect(s.safeParse('2026-11-09').success).toBe(false)
    expect(s.safeParse('1949-12-31').success).toBe(false)
    expect(s.safeParse('2012-02-30').success).toBe(false)
    expect(s.safeParse('2012-5-1').success).toBe(false)
  })
  it('uses Tashkent day', () => {
    // 2026-11-08T20:00Z is already 11-09 in Tashkent
    const t = birthDateSchema(new Date('2026-11-08T20:00:00Z'))
    expect(t.safeParse('2026-11-09').success).toBe(true)
  })
})

describe('onboardingSchema', () => {
  it('parses', () => {
    const r = onboardingSchema.safeParse({ fullName: ' Ali  Karimov', nickname: '', birthDate: '2012-05-01', avatarBase: 'wolf' })
    expect(r.success && r.data).toEqual({ fullName: 'Ali Karimov', nickname: null, birthDate: '2012-05-01', avatarBase: 'wolf' })
    expect(onboardingSchema.safeParse({ fullName: 'Ali Karimov', nickname: '', birthDate: '2012-05-01', avatarBase: 'dog' }).success).toBe(false)
  })
  it('avatars', () => {
    expect(AVATAR_BASES).toHaveLength(8)
    for (const a of AVATAR_BASES) expect(AVATAR_LABELS[a]).toBeTruthy()
  })
})

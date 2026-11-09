import { describe, expect, it } from 'vitest'
import { loginSchema, loginToEmail, normalizeLogin, passwordSchema } from '@/lib/auth/login'

describe('login', () => {
  it('normalizeLogin trim + lowercase', () => {
    expect(normalizeLogin(' Ali.Karimov ')).toBe('ali.karimov')
  })
  it('loginToEmail', () => {
    expect(loginToEmail('ALI_K')).toBe('ali_k@students.platforma.local')
  })
  it('loginSchema', () => {
    expect(loginSchema.safeParse('al').success).toBe(false)
    expect(loginSchema.safeParse('ali karimov').success).toBe(false)
    expect(loginSchema.safeParse('a'.repeat(21)).success).toBe(false)
    expect(loginSchema.safeParse(' Ali.K ').data).toBe('ali.k')
    const r = loginSchema.safeParse('al')
    expect(!r.success && r.error.issues[0].message).toBe('invalid_login')
  })
  it('passwordSchema 6-72', () => {
    expect(passwordSchema.safeParse('12345').success).toBe(false)
    expect(passwordSchema.safeParse('123456').success).toBe(true)
    expect(passwordSchema.safeParse('a'.repeat(72)).success).toBe(true)
    expect(passwordSchema.safeParse('a'.repeat(73)).success).toBe(false)
  })
})

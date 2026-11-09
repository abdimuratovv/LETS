import { describe, expect, it } from 'vitest'
import { err, errorMessage, ok } from '@/lib/result'

describe('result', () => {
  it('ok wraps data', () => {
    expect(ok(5)).toEqual({ ok: true, data: 5 })
  })

  it('err wraps an error code', () => {
    expect(err('login_taken')).toEqual({ ok: false, error: 'login_taken' })
  })

  it('errorMessage maps known codes', () => {
    expect(errorMessage('login_taken')).toBe('Bu login band')
  })

  it('errorMessage falls back for unknown codes', () => {
    expect(errorMessage('unknown_code_xyz')).toBe(
      "Kutilmagan xato. Qaytadan urinib ko'ring",
    )
  })
})

import { describe, expect, it } from 'vitest'
import {
  ALLOWED_EXTENSIONS,
  MAX_FILE_BYTES,
  noteBodySchema,
  titleSchema,
  urlSchema,
  validateUpload,
} from '@/modules/resources/validation'
import { buildStoragePath } from '@/modules/resources/path'

describe('constants', () => {
  it('has the agreed limits', () => {
    expect(MAX_FILE_BYTES).toBe(52428800)
    expect(ALLOWED_EXTENSIONS).toHaveLength(29)
    expect(ALLOWED_EXTENSIONS).toContain('pdf')
    expect(ALLOWED_EXTENSIONS).not.toContain('exe')
  })
})

describe('urlSchema', () => {
  it('trims and accepts http(s)', () => {
    expect(urlSchema.safeParse(' https://youtu.be/abc ').data).toBe('https://youtu.be/abc')
    expect(urlSchema.safeParse('http://a.uz').success).toBe(true)
  })
  it('rejects other schemes and junk', () => {
    for (const bad of ['javascript:alert(1)', 'ftp://x.uz/a', 'google.com', '', 'data:text/html,x'])
      expect(urlSchema.safeParse(bad).success).toBe(false)
  })
  it('rejects over 2000 chars', () => {
    expect(urlSchema.safeParse('https://a.uz/' + 'x'.repeat(2000)).success).toBe(false)
  })
})

describe('titleSchema', () => {
  it('validates length and trims', () => {
    expect(titleSchema.safeParse('a').success).toBe(false)
    expect(titleSchema.parse('  Python asoslari ')).toBe('Python asoslari')
    expect(titleSchema.safeParse('x'.repeat(121)).success).toBe(false)
  })
})

describe('noteBodySchema', () => {
  it('validates length', () => {
    expect(noteBodySchema.safeParse('').success).toBe(false)
    expect(noteBodySchema.safeParse('x'.repeat(50001)).success).toBe(false)
    expect(noteBodySchema.safeParse('x'.repeat(50000)).success).toBe(true)
  })
})

describe('validateUpload', () => {
  it('accepts allowed files, lowercases ext', () => {
    expect(validateUpload({ name: 'Dars1.PDF', size: 1000 })).toEqual({ ok: true, data: { ext: 'pdf' } })
  })
  it('rejects bad names', () => {
    for (const name of ['virus.exe', 'a.pdf.exe', 'noext', 'x.'])
      expect(validateUpload({ name, size: 10 })).toEqual({ ok: false, error: 'invalid_file' })
  })
  it('checks size', () => {
    expect(validateUpload({ name: 'a.pdf', size: 0 })).toEqual({ ok: false, error: 'invalid_file' })
    expect(validateUpload({ name: 'a.pdf', size: 52428801 })).toEqual({ ok: false, error: 'file_too_large' })
    expect(validateUpload({ name: 'a.pdf', size: 52428800 }).ok).toBe(true)
  })
})

describe('buildStoragePath', () => {
  it('builds topic/uuid.ext', () => {
    expect(buildStoragePath('t-1', 'pdf')).toMatch(/^t-1\/[0-9a-f-]{36}\.pdf$/)
  })
})

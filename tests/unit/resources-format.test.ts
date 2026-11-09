import { describe, expect, it } from 'vitest'
import { formatFileSize } from '@/modules/resources/format'

describe('formatFileSize', () => {
  it.each([
    [512, '512 B'],
    [1024, '1 KB'],
    [1536, '1.5 KB'],
    [52428800, '50 MB'],
    [1024 * 1024 * 123.4, '123 MB'],
  ])('%d -> %s', (bytes, expected) => {
    expect(formatFileSize(bytes)).toBe(expected)
  })
})

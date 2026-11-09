import { z } from 'zod'
import { err, ok, type Result } from '@/lib/result'

export const MAX_FILE_BYTES = 52428800

export const ALLOWED_EXTENSIONS: readonly string[] = [
  'pdf', 'ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'md', 'csv', 'json', 'zip',
  'py', 'js', 'ts', 'jsx', 'tsx', 'html', 'css', 'java', 'c', 'cpp', 'cs', 'sql',
  'png', 'jpg', 'jpeg', 'gif', 'webp',
]

export const titleSchema = z
  .string()
  .transform((s) => s.trim())
  .pipe(z.string().min(2, 'invalid_title').max(120, 'invalid_title'))

export const urlSchema = z
  .string()
  .transform((s) => s.trim())
  .pipe(
    z
      .string()
      .max(2000, 'invalid_url')
      .refine((s) => {
        try {
          const p = new URL(s).protocol
          return p === 'http:' || p === 'https:'
        } catch {
          return false
        }
      }, 'invalid_url'),
  )

export const noteBodySchema = z.string().min(1, 'invalid_body').max(50000, 'invalid_body')

export function validateUpload(input: {
  name: string
  size: number
}): Result<{ ext: string }, 'invalid_file' | 'file_too_large'> {
  const dot = input.name.lastIndexOf('.')
  const ext = dot >= 0 ? input.name.slice(dot + 1).toLowerCase() : ''
  if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) return err('invalid_file')
  if (!(input.size > 0)) return err('invalid_file')
  if (input.size > MAX_FILE_BYTES) return err('file_too_large')
  return ok({ ext })
}

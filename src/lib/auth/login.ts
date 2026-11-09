import { z } from 'zod'

export const EMAIL_DOMAIN = 'students.platforma.local'

export function normalizeLogin(raw: string): string {
  return raw.trim().toLowerCase()
}

export function loginToEmail(login: string): string {
  return `${normalizeLogin(login)}@${EMAIL_DOMAIN}`
}

export const loginSchema = z
  .string()
  .transform(normalizeLogin)
  .pipe(z.string().regex(/^[a-z0-9_.]{3,20}$/, 'invalid_login'))

export const passwordSchema = z
  .string()
  .min(6, 'invalid_password')
  .max(72, 'invalid_password')

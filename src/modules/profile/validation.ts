import { z } from 'zod'
import { AVATAR_BASES } from './avatars'

const NAME_CHARS = /^[\p{L}\- '\u02BB\u02BC\u2018\u2019`]+$/u

export const fullNameSchema = z
  .string()
  .transform((s) => s.trim().replace(/\s+/g, ' '))
  .pipe(
    z
      .string()
      .min(3, 'invalid_full_name')
      .max(60, 'invalid_full_name')
      .regex(NAME_CHARS, 'invalid_full_name')
      .refine((s) => s.split(' ').filter(Boolean).length >= 2, 'invalid_full_name'),
  )

export const nicknameSchema = z
  .string()
  .transform((s) => s.trim())
  .pipe(
    z.union([
      z.literal('').transform(() => null),
      z
        .string()
        .min(2, 'invalid_nickname')
        .max(20, 'invalid_nickname')
        .regex(/^[\p{L}\p{N}_.\- ]+$/u, 'invalid_nickname'),
    ]),
  )

const MIN_BIRTH_DATE = '1950-01-01'

function tashkentToday(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tashkent',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

function isRealDate(s: string): boolean {
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

export function birthDateSchema(now: Date = new Date()) {
  const today = tashkentToday(now)
  return z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'invalid_birth_date')
    .refine(isRealDate, 'invalid_birth_date')
    .refine((s) => s >= MIN_BIRTH_DATE && s <= today, 'invalid_birth_date')
}

export function makeOnboardingSchema(now?: Date) {
  return z.object({
    fullName: fullNameSchema,
    nickname: nicknameSchema,
    birthDate: birthDateSchema(now),
    avatarBase: z.enum(AVATAR_BASES, { error: 'invalid_avatar' }),
  })
}

export const onboardingSchema = makeOnboardingSchema()
export type OnboardingInput = z.infer<typeof onboardingSchema>

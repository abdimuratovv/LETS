export type Result<T, E extends string> =
  | { ok: true; data: T }
  | { ok: false; error: E }

export function ok<T>(data: T): { ok: true; data: T } {
  return { ok: true, data }
}

export function err<E extends string>(error: E): { ok: false; error: E } {
  return { ok: false, error }
}

const FALLBACK_MESSAGE = "Kutilmagan xato. Qaytadan urinib ko'ring"

// Foydalanuvchiga ko'rsatiladigan xato matnlari. Keyingi tasklar o'z kodlarini shu jadvalga qo'shadi.
const messages: Record<string, string> = {
  login_taken: 'Bu login band',
}

export function errorMessage(code: string): string {
  return messages[code] ?? FALLBACK_MESSAGE
}

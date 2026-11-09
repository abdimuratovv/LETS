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
  invalid_credentials: "Login yoki parol noto'g'ri",
  login_taken: 'Bu login band',
  group_not_found: 'Guruh topilmadi',
  not_found: "O'quvchi topilmadi",
  invalid_name: "Nom bo'sh bo'lmasin (60 belgigacha)",
  forbidden: "Bu amal uchun ruxsat yo'q",
  invalid_login: "Login 3–20 belgidan iborat bo'lsin: kichik lotin harflari, raqamlar, nuqta yoki pastki chiziq",
  invalid_password: "Parol 6–72 belgidan iborat bo'lsin",
  invalid_full_name: "Ism-familiyani to'liq kiriting (kamida 2 so'z, 3–60 belgi, faqat harflar, defis va apostrof)",
  invalid_nickname: "Nickname 2–20 belgidan iborat bo'lsin: harflar, raqamlar, nuqta, pastki chiziq yoki bo'sh joy",
  invalid_birth_date: "Tug'ilgan kun noto'g'ri (1950-yil 1-yanvardan bugungacha bo'lishi kerak)",
  invalid_avatar: "Avatarni ro'yxatdan tanlang",
  cannot_revert: "Bu o'zgarishni qaytarib bo'lmaydi (oldingi ism yo'q)",
  name_edit_locked: "Ismni o'zgartirish o'qituvchi tomonidan bloklangan",
  birth_date_locked: "Tug'ilgan kunni faqat o'qituvchi o'zgartira oladi",
  invalid_privacy: "Maxfiylik qiymati noto'g'ri",
  invalid_title: "Nom 2–120 belgidan iborat bo'lsin",
  invalid_url: "Havola http:// yoki https:// bilan boshlanishi kerak",
  invalid_body: "Konspekt matni bo'sh bo'lmasin (50 000 belgigacha)",
  invalid_file: 'Bu turdagi fayl ruxsat etilmagan',
  file_too_large: 'Fayl 50 MB dan katta',
  topic_not_empty: "Mavzuda resurslar bor. Avval ularni o'chiring",
  course_not_found: 'Kurs topilmadi',
  topic_not_found: 'Mavzu topilmadi',
  invalid_group: 'Tanlangan guruh topilmadi',
}

export function errorMessage(code: string): string {
  return messages[code] ?? FALLBACK_MESSAGE
}

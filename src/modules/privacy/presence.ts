// Sof (DB'siz) yordamchilar: online belgisi va "bugun tug'ilgan kun" belgisi.

export const ONLINE_WINDOW_MS = 5 * 60_000

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * `last_seen_at` oxirgi 5 daqiqa ichida -> "online"; aks holda "oxirgi faollik: N ... oldin".
 * `null` (yoki ko'rish ruxsati yo'q) -> null, ya'ni hech narsa ko'rsatilmaydi.
 */
export function presenceLabel(lastSeenAt: string | null, now: Date = new Date()): string | null {
  if (!lastSeenAt) return null
  const seen = new Date(lastSeenAt).getTime()
  if (Number.isNaN(seen)) return null
  const diff = now.getTime() - seen
  if (diff < ONLINE_WINDOW_MS) return 'online'
  if (diff < HOUR) return `oxirgi faollik: ${Math.floor(diff / MINUTE)} daqiqa oldin`
  if (diff < DAY) return `oxirgi faollik: ${Math.floor(diff / HOUR)} soat oldin`
  return `oxirgi faollik: ${Math.floor(diff / DAY)} kun oldin`
}

const tashkentMonthDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tashkent',
  month: '2-digit',
  day: '2-digit',
})

/** Toshkent vaqti bo'yicha bugungi sana `MM-DD`. */
export function todayMd(now: Date = new Date()): string {
  const parts = tashkentMonthDay.formatToParts(now)
  const month = parts.find((p) => p.type === 'month')?.value
  const day = parts.find((p) => p.type === 'day')?.value
  return `${month}-${day}`
}

export function isBirthdayToday(birthdayMd: string | null, now: Date = new Date()): boolean {
  return birthdayMd !== null && birthdayMd === todayMd(now)
}

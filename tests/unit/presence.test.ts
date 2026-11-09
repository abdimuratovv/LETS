import { describe, expect, it } from 'vitest'
import { isBirthdayToday, presenceLabel } from '@/modules/privacy/presence'

const NOW = new Date('2026-11-09T10:00:00Z')
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString()
const MIN = 60_000

describe('presenceLabel', () => {
  it("null -> hech narsa ko'rsatilmaydi", () => {
    expect(presenceLabel(null, NOW)).toBeNull()
  })

  it('oxirgi 5 daqiqa ichida -> online', () => {
    expect(presenceLabel(ago(0), NOW)).toBe('online')
    expect(presenceLabel(ago(4 * MIN + 59_000), NOW)).toBe('online')
    // soat farqi (kelajakdagi vaqt) ham online
    expect(presenceLabel(ago(-30_000), NOW)).toBe('online')
  })

  it('daqiqalar', () => {
    expect(presenceLabel(ago(5 * MIN), NOW)).toBe('oxirgi faollik: 5 daqiqa oldin')
    expect(presenceLabel(ago(59 * MIN), NOW)).toBe('oxirgi faollik: 59 daqiqa oldin')
  })

  it('soatlar', () => {
    expect(presenceLabel(ago(60 * MIN), NOW)).toBe('oxirgi faollik: 1 soat oldin')
    expect(presenceLabel(ago(2 * 60 * MIN + 10 * MIN), NOW)).toBe('oxirgi faollik: 2 soat oldin')
    expect(presenceLabel(ago(23 * 60 * MIN + 59 * MIN), NOW)).toBe(
      'oxirgi faollik: 23 soat oldin',
    )
  })

  it('kunlar', () => {
    expect(presenceLabel(ago(24 * 60 * MIN), NOW)).toBe('oxirgi faollik: 1 kun oldin')
    expect(presenceLabel(ago(3 * 24 * 60 * MIN + 5 * MIN), NOW)).toBe(
      'oxirgi faollik: 3 kun oldin',
    )
  })

  it("noto'g'ri sana -> null", () => {
    expect(presenceLabel('nonsense', NOW)).toBeNull()
  })
})

describe('isBirthdayToday', () => {
  it('Asia/Tashkent kuni bo`yicha solishtiradi', () => {
    // 2026-11-09T10:00Z = Toshkentda 09-noyabr 15:00
    expect(isBirthdayToday('11-09', NOW)).toBe(true)
    expect(isBirthdayToday('11-10', NOW)).toBe(false)
    // 2026-11-09T20:00Z = Toshkentda 10-noyabr 01:00
    expect(isBirthdayToday('11-10', new Date('2026-11-09T20:00:00Z'))).toBe(true)
    expect(isBirthdayToday('11-09', new Date('2026-11-09T20:00:00Z'))).toBe(false)
  })

  it("null -> false", () => {
    expect(isBirthdayToday(null, NOW)).toBe(false)
  })
})

import { AVATAR_BASES, AVATAR_LABELS, type AvatarBase } from '@/modules/profile/avatars'

function baseOf(config: unknown): AvatarBase | null {
  if (config && typeof config === 'object' && 'base' in config) {
    const base = (config as { base: unknown }).base
    if ((AVATAR_BASES as readonly unknown[]).includes(base)) return base as AvatarBase
  }
  return null
}

export function Avatar({ config, size = 64 }: { config: unknown; size?: number }) {
  const base = baseOf(config)
  if (!base) {
    return (
      <span
        aria-hidden="true"
        style={{ width: size, height: size }}
        className="inline-block rounded-full bg-gray-200"
      />
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/avatars/base/${base}.svg`}
      alt={AVATAR_LABELS[base]}
      width={size}
      height={size}
      className="inline-block rounded-full"
    />
  )
}

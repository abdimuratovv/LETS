'use client'

import { AVATAR_BASES, AVATAR_LABELS, type AvatarBase } from '@/modules/profile/avatars'

export function AvatarPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string
  onChange: (base: AvatarBase) => void
  disabled?: boolean
}) {
  return (
    <div role="group" aria-label="Avatar" className="grid grid-cols-4 gap-2">
      {AVATAR_BASES.map((base) => {
        const selected = value === base
        return (
          <button
            key={base}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            aria-label={AVATAR_LABELS[base]}
            onClick={() => onChange(base)}
            className={`flex min-h-12 min-w-12 items-center justify-center rounded-xl p-1 ring-2 disabled:opacity-60 ${
              selected ? 'bg-gray-100 ring-black' : 'ring-transparent hover:ring-gray-300'
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/avatars/base/${base}.svg`}
              alt=""
              width={64}
              height={64}
              className="h-auto w-full max-w-16 rounded-full"
            />
          </button>
        )
      })}
    </div>
  )
}

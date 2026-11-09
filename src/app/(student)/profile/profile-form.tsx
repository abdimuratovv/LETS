'use client'

import { useActionState, useState } from 'react'
import { AvatarPicker } from '@/components/AvatarPicker'
import { updateProfile, type ProfileFormState } from '@/modules/profile/actions'

const inputClass =
  'mt-1 block min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 disabled:bg-gray-100 disabled:text-gray-600'

export function ProfileForm({
  fullName,
  nickname,
  avatarBase,
  namesLocked,
}: {
  fullName: string
  nickname: string
  avatarBase: string
  namesLocked: boolean
}) {
  const initial: ProfileFormState = {
    error: null,
    success: null,
    fieldErrors: {},
    values: { fullName, nickname, birthDate: '', avatarBase },
  }
  const [state, action, pending] = useActionState(updateProfile, initial)
  const [avatar, setAvatar] = useState(avatarBase)
  const e = state.fieldErrors

  return (
    <form action={action} className="space-y-5">
      <label className="block text-sm font-medium">
        Ism-familiya
        <input
          name="fullName"
          type="text"
          required
          disabled={namesLocked}
          defaultValue={state.values.fullName}
          aria-invalid={!!e.fullName}
          className={inputClass}
        />
        {e.fullName && (
          <span role="alert" className="mt-1 block text-sm text-red-600">
            {e.fullName}
          </span>
        )}
      </label>

      <label className="block text-sm font-medium">
        Nickname
        <input
          name="nickname"
          type="text"
          disabled={namesLocked}
          defaultValue={state.values.nickname}
          aria-invalid={!!e.nickname}
          className={inputClass}
        />
        {e.nickname && (
          <span role="alert" className="mt-1 block text-sm text-red-600">
            {e.nickname}
          </span>
        )}
      </label>

      {namesLocked && (
        <p className="text-sm text-amber-800">
          Ismni o&apos;zgartirish o&apos;qituvchi tomonidan bloklangan.
        </p>
      )}

      <div>
        <p className="mb-2 text-sm font-medium">Avatar</p>
        <AvatarPicker value={avatar} onChange={setAvatar} />
        <input type="hidden" name="avatarBase" value={avatar} />
        {e.avatarBase && (
          <p role="alert" className="mt-1 text-sm text-red-600">
            {e.avatarBase}
          </p>
        )}
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm text-green-700">
          {state.success}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 w-full rounded-lg bg-black px-4 py-2.5 text-base font-medium text-white disabled:opacity-60 sm:w-auto"
      >
        Saqlash
      </button>
    </form>
  )
}

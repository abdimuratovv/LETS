'use client'

import { useActionState, useState } from 'react'
import { AvatarPicker } from '@/components/AvatarPicker'
import { completeOnboarding, type ProfileFormState } from '@/modules/profile/actions'

const initial: ProfileFormState = {
  error: null,
  success: null,
  fieldErrors: {},
  values: { fullName: '', nickname: '', birthDate: '', avatarBase: '' },
}

const inputClass =
  'mt-1 block min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900'

function FieldError({ message, id }: { message?: string; id: string }) {
  if (!message) return null
  return (
    <p id={id} role="alert" className="mt-1 text-sm text-red-600">
      {message}
    </p>
  )
}

export function OnboardingForm() {
  const [state, action, pending] = useActionState(completeOnboarding, initial)
  const [avatar, setAvatar] = useState('')
  const selected = avatar || state.values.avatarBase
  const e = state.fieldErrors

  return (
    <form action={action} className="space-y-5">
      <label className="block text-sm font-medium">
        Ism-familiya
        <input
          name="fullName"
          type="text"
          autoComplete="name"
          required
          defaultValue={state.values.fullName}
          aria-invalid={!!e.fullName}
          aria-describedby="fullName-error"
          className={inputClass}
        />
        <FieldError id="fullName-error" message={e.fullName} />
      </label>

      <label className="block text-sm font-medium">
        Tug&apos;ilgan kun
        <input
          name="birthDate"
          type="date"
          required
          defaultValue={state.values.birthDate}
          aria-invalid={!!e.birthDate}
          aria-describedby="birthDate-error"
          className={inputClass}
        />
        <FieldError id="birthDate-error" message={e.birthDate} />
        <span className="mt-1 block text-xs font-normal text-gray-600">
          Keyin faqat o&apos;qituvchi o&apos;zgartira oladi
        </span>
      </label>

      <label className="block text-sm font-medium">
        Nickname (ixtiyoriy)
        <input
          name="nickname"
          type="text"
          defaultValue={state.values.nickname}
          aria-invalid={!!e.nickname}
          aria-describedby="nickname-error"
          className={inputClass}
        />
        <FieldError id="nickname-error" message={e.nickname} />
      </label>

      <div>
        <p className="mb-2 text-sm font-medium">Avatar</p>
        <AvatarPicker value={selected} onChange={setAvatar} />
        <input type="hidden" name="avatarBase" value={selected} />
        <FieldError id="avatar-error" message={e.avatarBase} />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 w-full rounded-lg bg-black px-4 py-2.5 text-base font-medium text-white disabled:opacity-60"
      >
        Davom etish
      </button>
    </form>
  )
}

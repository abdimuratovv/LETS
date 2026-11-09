'use client'

import { useActionState } from 'react'
import {
  revertNameChange,
  setBirthDate,
  setNameEditLock,
  type SimpleFormState,
} from '@/modules/profile/actions'

const initial: SimpleFormState = { error: null, success: null }

const buttonBase = 'min-h-11 rounded-lg px-4 py-2.5 text-base font-medium disabled:opacity-60'

function Feedback({ state }: { state: SimpleFormState }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm text-red-600">
        {state.error}
      </p>
    )
  }
  if (state.success) {
    return (
      <p role="status" className="text-sm text-green-700">
        {state.success}
      </p>
    )
  }
  return null
}

export function RevertButton({ changeId, studentId }: { changeId: string; studentId: string }) {
  const [state, action, pending] = useActionState(revertNameChange, initial)
  return (
    <form action={action} className="flex flex-col items-start gap-1">
      <input type="hidden" name="changeId" value={changeId} />
      <input type="hidden" name="studentId" value={studentId} />
      <button
        type="submit"
        disabled={pending}
        className={`${buttonBase} border border-gray-300 bg-white`}
      >
        Qaytarish
      </button>
      <Feedback state={state} />
    </form>
  )
}

export function NameLockToggle({ studentId, locked }: { studentId: string; locked: boolean }) {
  const [state, action, pending] = useActionState(setNameEditLock, initial)
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="locked" value={String(!locked)} />
      <p className="text-sm">
        Holat: <strong>{locked ? 'Ism tahriri bloklangan' : 'Ism tahriri ochiq'}</strong>
      </p>
      <button
        type="submit"
        role="switch"
        aria-checked={locked}
        disabled={pending}
        className={`${buttonBase} ${locked ? 'bg-black text-white' : 'border border-gray-300 bg-white'}`}
      >
        {locked ? 'Tahrirni ochish' : 'Tahrirni bloklash'}
      </button>
      <Feedback state={state} />
    </form>
  )
}

export function BirthDateForm({
  studentId,
  birthDate,
}: {
  studentId: string
  birthDate: string | null
}) {
  const [state, action, pending] = useActionState(setBirthDate, initial)
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="studentId" value={studentId} />
      <label className="block text-sm font-medium">
        Tug&apos;ilgan kun
        <input
          name="birthDate"
          type="date"
          required
          defaultValue={birthDate ?? ''}
          className="mt-1 block min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900"
        />
      </label>
      <Feedback state={state} />
      <button
        type="submit"
        disabled={pending}
        className={`${buttonBase} w-full bg-black text-white sm:w-auto`}
      >
        Saqlash
      </button>
    </form>
  )
}

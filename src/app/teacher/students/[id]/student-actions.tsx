'use client'

import { useActionState, useState } from 'react'
import {
  archiveStudent,
  resetStudentPassword,
  restoreStudent,
  type AccountFormState,
} from '@/modules/auth-accounts/actions'

const initial: AccountFormState = { error: null, success: null }

const buttonBase = 'min-h-11 rounded-lg px-4 py-2.5 text-base font-medium disabled:opacity-60'

function Feedback({ state }: { state: AccountFormState }) {
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

export function ResetPasswordForm({ studentId }: { studentId: string }) {
  const [state, action, pending] = useActionState(resetStudentPassword, initial)

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="studentId" value={studentId} />
      <label className="block text-sm font-medium">
        Yangi parol
        <input
          name="password"
          type="text"
          autoComplete="new-password"
          required
          minLength={6}
          maxLength={72}
          className="mt-1 block min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-base"
        />
      </label>
      <Feedback state={state} />
      <button
        type="submit"
        disabled={pending}
        className={`${buttonBase} w-full bg-black text-white sm:w-auto`}
      >
        Parolni yangilash
      </button>
    </form>
  )
}

export function ArchiveControl({
  studentId,
  archived,
}: {
  studentId: string
  archived: boolean
}) {
  const [state, action, pending] = useActionState(
    archived ? restoreStudent : archiveStudent,
    initial,
  )
  const [confirming, setConfirming] = useState(false)

  const label = archived ? 'Arxivdan tiklash' : 'Arxivlash'
  const question = archived
    ? "O'quvchi yana tizimga kira oladi. Tiklaysizmi?"
    : "O'quvchi tizimga kira olmaydi, ma'lumotlari saqlanadi. Arxivlaysizmi?"

  return (
    <div className="space-y-3">
      {confirming ? (
        <form
          action={action}
          onSubmit={() => setConfirming(false)}
          role="alertdialog"
          aria-label={label}
          className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3"
        >
          <input type="hidden" name="studentId" value={studentId} />
          <p className="text-sm text-amber-900">{question}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="submit"
              disabled={pending}
              className={`${buttonBase} ${archived ? 'bg-black' : 'bg-red-600'} text-white`}
            >
              Ha, {label.toLowerCase()}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className={`${buttonBase} border border-gray-300 bg-white`}
            >
              Bekor qilish
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(true)}
          className={`${buttonBase} w-full border sm:w-auto ${
            archived ? 'border-gray-300' : 'border-red-300 text-red-700'
          }`}
        >
          {label}
        </button>
      )}
      <Feedback state={state} />
    </div>
  )
}

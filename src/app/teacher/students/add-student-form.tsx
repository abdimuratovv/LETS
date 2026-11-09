'use client'

import { useActionState } from 'react'
import { createStudent, type AccountFormState } from '@/modules/auth-accounts/actions'

const initial: AccountFormState = { error: null, success: null }

const inputClass =
  'mt-1 block min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base'

export function AddStudentForm({ groups }: { groups: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createStudent, initial)

  if (groups.length === 0) {
    return (
      <p className="text-sm text-gray-600">
        O&apos;quvchi qo&apos;shish uchun avval guruh yarating.
      </p>
    )
  }

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-3">
      <label className="block text-sm font-medium">
        Login
        <input
          name="login"
          type="text"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          required
          className={inputClass}
        />
      </label>
      <label className="block text-sm font-medium">
        Parol
        <input
          name="password"
          type="text"
          autoComplete="new-password"
          required
          minLength={6}
          maxLength={72}
          className={inputClass}
        />
      </label>
      <label className="block text-sm font-medium">
        Guruh
        <select name="groupId" required defaultValue="" className={inputClass}>
          <option value="" disabled>
            Tanlang
          </option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>
      <div className="sm:col-span-3">
        {state.error && (
          <p role="alert" className="mb-3 text-sm text-red-600">
            {state.error}
          </p>
        )}
        {state.success && (
          <p role="status" className="mb-3 text-sm text-green-700">
            {state.success}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 w-full rounded-lg bg-black px-4 py-2.5 text-base font-medium text-white disabled:opacity-60 sm:w-auto"
        >
          O&apos;quvchi qo&apos;shish
        </button>
      </div>
    </form>
  )
}

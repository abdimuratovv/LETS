'use client'

import { useActionState } from 'react'
import { updatePrivacy, type PrivacyFormState } from '@/modules/privacy/actions'
import {
  PRIVACY_SCOPES,
  SCOPE_LABELS,
  type PrivacyItem,
  type PrivacyScope,
} from '@/modules/privacy/labels'

const initial: PrivacyFormState = { error: null, success: null }

/** Bitta katak: tanlov o'zgarishi bilan forma yuboriladi. `groupId` bo'lsa "Umumiy" varianti bor. */
export function ScopeSelect({
  item,
  groupId,
  value,
  label,
}: {
  item: PrivacyItem
  groupId?: string
  value: PrivacyScope | ''
  label: string
}) {
  const [state, action, pending] = useActionState(updatePrivacy, initial)

  return (
    <form action={action} className="min-w-40 space-y-1">
      <input type="hidden" name="item" value={item} />
      {groupId && <input type="hidden" name="groupId" value={groupId} />}
      <select
        name="scope"
        aria-label={label}
        defaultValue={value}
        disabled={pending}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="block min-h-11 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-base disabled:opacity-60"
      >
        {groupId && <option value="">Umumiy</option>}
        {PRIVACY_SCOPES.map((s) => (
          <option key={s} value={s}>
            {SCOPE_LABELS[s]}
          </option>
        ))}
      </select>
      <p aria-live="polite" className="min-h-4 text-xs">
        {pending ? (
          <span className="text-gray-600">Saqlanmoqda…</span>
        ) : state.error ? (
          <span role="alert" className="text-red-600">
            {state.error}
          </span>
        ) : state.success ? (
          <span className="text-green-700">{state.success}</span>
        ) : null}
      </p>
    </form>
  )
}

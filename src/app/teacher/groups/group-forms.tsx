'use client'

import { useActionState } from 'react'
import {
  assignGroupToCourse,
  createGroup,
  type GroupFormState,
} from '@/modules/courses-groups/actions'

const initial: GroupFormState = { error: null, success: null }

const inputClass =
  'mt-1 block min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base'

export function AddGroupForm() {
  const [state, action, pending] = useActionState(createGroup, initial)
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm font-medium">
        Guruh nomi
        <input name="name" type="text" required maxLength={60} className={inputClass} />
      </label>
      <label className="block text-sm font-medium">
        Tavsif (ixtiyoriy)
        <input name="description" type="text" maxLength={200} className={inputClass} />
      </label>
      <div className="sm:col-span-2">
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
          Guruh qo&apos;shish
        </button>
      </div>
    </form>
  )
}

export function AssignCourseForm({
  groupId,
  currentCourseId,
  courses,
}: {
  groupId: string
  currentCourseId: string | null
  courses: { id: string; title: string }[]
}) {
  const [state, action, pending] = useActionState(assignGroupToCourse, initial)
  const options = courses.filter((c) => c.id !== currentCourseId)

  if (options.length === 0) {
    return <p className="text-sm text-gray-600">Boshqa faol kurs yo&apos;q.</p>
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="groupId" value={groupId} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          name="courseId"
          required
          defaultValue=""
          aria-label="Kurs"
          className="block min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base"
        >
          <option value="" disabled>
            Kursni tanlang
          </option>
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 shrink-0 rounded-lg bg-black px-4 py-2 text-base font-medium text-white disabled:opacity-60"
        >
          Keyingi kursga o&apos;tkazish
        </button>
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
    </form>
  )
}

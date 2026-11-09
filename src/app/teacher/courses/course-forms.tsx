'use client'

import { useActionState } from 'react'
import { createCourse, finishCourse, type GroupFormState } from '@/modules/courses-groups/actions'

const initial: GroupFormState = { error: null, success: null }

const inputClass =
  'mt-1 block min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base'

export function AddCourseForm() {
  const [state, action, pending] = useActionState(createCourse, initial)
  return (
    <form action={action} className="space-y-3">
      <label className="block text-sm font-medium">
        Kurs nomi
        <input name="title" type="text" required maxLength={60} className={inputClass} />
      </label>
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
        Kurs qo&apos;shish
      </button>
    </form>
  )
}

export function FinishCourseForm({ courseId }: { courseId: string }) {
  const [state, action, pending] = useActionState(finishCourse, initial)
  return (
    <form action={action} className="shrink-0">
      <input type="hidden" name="courseId" value={courseId} />
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-lg border border-gray-300 px-4 py-2 text-base font-medium disabled:opacity-60"
      >
        Tugatish
      </button>
      {state.error && (
        <p role="alert" className="mt-1 text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  )
}

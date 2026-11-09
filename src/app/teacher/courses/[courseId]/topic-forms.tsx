'use client'

import { useActionState, useState } from 'react'
import {
  createTopic,
  deleteTopic,
  moveTopic,
  renameTopic,
  type TopicFormState,
} from '@/modules/topics/actions'

const initial: TopicFormState = { error: null, success: null }

const inputClass =
  'mt-1 block min-h-12 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base'
const buttonClass =
  'min-h-12 min-w-12 rounded-lg border border-gray-300 px-4 py-2 text-base font-medium disabled:opacity-60'

function ErrorText({ state }: { state: TopicFormState }) {
  return state.error ? (
    <p role="alert" className="text-sm text-red-600">
      {state.error}
    </p>
  ) : null
}

export function AddTopicForm({ courseId }: { courseId: string }) {
  const [state, action, pending] = useActionState(createTopic, initial)
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="courseId" value={courseId} />
      <label className="block text-sm font-medium">
        Mavzu nomi
        <input name="title" type="text" required maxLength={120} className={inputClass} />
      </label>
      <ErrorText state={state} />
      {state.success && (
        <p role="status" className="text-sm text-green-700">
          {state.success}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 w-full rounded-lg bg-black px-4 py-2.5 text-base font-medium text-white disabled:opacity-60 sm:w-auto"
      >
        Mavzu qo&apos;shish
      </button>
    </form>
  )
}

export function MoveTopicForm({
  courseId,
  topicId,
  direction,
  disabled,
}: {
  courseId: string
  topicId: string
  direction: 'up' | 'down'
  disabled: boolean
}) {
  const [state, action, pending] = useActionState(moveTopic, initial)
  return (
    <form action={action}>
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="topicId" value={topicId} />
      <input type="hidden" name="direction" value={direction} />
      <button
        type="submit"
        disabled={pending || disabled}
        aria-label={direction === 'up' ? 'Yuqoriga' : 'Pastga'}
        className={buttonClass}
      >
        {direction === 'up' ? '↑' : '↓'}
      </button>
      <ErrorText state={state} />
    </form>
  )
}

export function RenameTopicForm({
  courseId,
  topicId,
  title,
}: {
  courseId: string
  topicId: string
  title: string
}) {
  const [state, action, pending] = useActionState(renameTopic, initial)
  const [editing, setEditing] = useState(false)

  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className={buttonClass}>
        Nomini o&apos;zgartirish
      </button>
    )
  }
  return (
    <form action={action} className="w-full space-y-2">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="topicId" value={topicId} />
      <input
        name="title"
        type="text"
        required
        maxLength={120}
        defaultValue={title}
        aria-label="Mavzu nomi"
        className={inputClass}
      />
      <ErrorText state={state} />
      {state.success && (
        <p role="status" className="text-sm text-green-700">
          {state.success}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={`${buttonClass} bg-black text-white`}>
          Saqlash
        </button>
        <button type="button" onClick={() => setEditing(false)} className={buttonClass}>
          Yopish
        </button>
      </div>
    </form>
  )
}

export function DeleteTopicForm({ courseId, topicId }: { courseId: string; topicId: string }) {
  const [state, action, pending] = useActionState(deleteTopic, initial)
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm("Mavzuni o'chirishni tasdiqlaysizmi?")) e.preventDefault()
      }}
    >
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="topicId" value={topicId} />
      <button
        type="submit"
        disabled={pending}
        className={`${buttonClass} border-red-300 text-red-700`}
      >
        O&apos;chirish
      </button>
      <ErrorText state={state} />
    </form>
  )
}

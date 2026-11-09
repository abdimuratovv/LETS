'use client'

import { useActionState, useState } from 'react'
import { GroupPicker, type GroupOption } from '@/components/GroupPicker'
import {
  createLinkResource,
  createNoteResource,
  deleteResource,
  moveResource,
  updateResource,
  type ResourceFormState,
} from '@/modules/resources/actions'
import type { ResourceType } from '@/modules/resources/service'

const initial: ResourceFormState = { error: null, success: null }

const inputClass =
  'mt-1 block min-h-12 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base'
const buttonClass =
  'min-h-12 min-w-12 rounded-lg border border-gray-300 px-4 py-2 text-base font-medium disabled:opacity-60'
const submitClass =
  'min-h-12 w-full rounded-lg bg-black px-4 py-2.5 text-base font-medium text-white disabled:opacity-60 sm:w-auto'

function StateText({ state }: { state: ResourceFormState }) {
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

function Ids({ courseId, topicId }: { courseId: string; topicId?: string }) {
  return (
    <>
      <input type="hidden" name="courseId" value={courseId} />
      {topicId && <input type="hidden" name="topicId" value={topicId} />}
    </>
  )
}

export function AddLinkForm({
  courseId,
  topicId,
  groups,
}: {
  courseId: string
  topicId: string
  groups: GroupOption[]
}) {
  const [state, action, pending] = useActionState(createLinkResource, initial)
  return (
    <form action={action} className="space-y-3">
      <Ids courseId={courseId} topicId={topicId} />
      <label className="block text-sm font-medium">
        Havola nomi
        <input name="title" type="text" required maxLength={120} className={inputClass} />
      </label>
      <label className="block text-sm font-medium">
        Manzil (URL)
        <input
          name="url"
          type="url"
          required
          maxLength={2000}
          placeholder="https://"
          className={inputClass}
        />
      </label>
      <GroupPicker groups={groups} />
      <StateText state={state} />
      <button type="submit" disabled={pending} className={submitClass}>
        Havolani qo&apos;shish
      </button>
    </form>
  )
}

export function AddNoteForm({
  courseId,
  topicId,
  groups,
}: {
  courseId: string
  topicId: string
  groups: GroupOption[]
}) {
  const [state, action, pending] = useActionState(createNoteResource, initial)
  return (
    <form action={action} className="space-y-3">
      <Ids courseId={courseId} topicId={topicId} />
      <label className="block text-sm font-medium">
        Konspekt nomi
        <input name="title" type="text" required maxLength={120} className={inputClass} />
      </label>
      <label className="block text-sm font-medium">
        Matn (Markdown)
        <textarea
          name="bodyMd"
          required
          rows={8}
          maxLength={50000}
          className={`${inputClass} font-mono`}
        />
      </label>
      <GroupPicker groups={groups} />
      <StateText state={state} />
      <button type="submit" disabled={pending} className={submitClass}>
        Konspektni qo&apos;shish
      </button>
    </form>
  )
}

export function EditResourceForm({
  courseId,
  resource,
  groups,
}: {
  courseId: string
  resource: {
    id: string
    type: ResourceType
    title: string
    url: string | null
    bodyMd: string | null
    groupIds: string[]
  }
  groups: GroupOption[]
}) {
  const [state, action, pending] = useActionState(updateResource, initial)
  const [editing, setEditing] = useState(false)

  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className={buttonClass}>
        Tahrirlash
      </button>
    )
  }
  return (
    <form action={action} className="w-full space-y-3 rounded-xl bg-gray-50 p-3">
      <Ids courseId={courseId} />
      <input type="hidden" name="resourceId" value={resource.id} />
      <label className="block text-sm font-medium">
        Nomi
        <input
          name="title"
          type="text"
          required
          maxLength={120}
          defaultValue={resource.title}
          className={inputClass}
        />
      </label>
      {resource.type === 'link' && (
        <label className="block text-sm font-medium">
          Manzil (URL)
          <input
            name="url"
            type="url"
            required
            maxLength={2000}
            defaultValue={resource.url ?? ''}
            className={inputClass}
          />
        </label>
      )}
      {resource.type === 'note' && (
        <label className="block text-sm font-medium">
          Matn (Markdown)
          <textarea
            name="bodyMd"
            required
            rows={10}
            maxLength={50000}
            defaultValue={resource.bodyMd ?? ''}
            className={`${inputClass} font-mono`}
          />
        </label>
      )}
      <GroupPicker groups={groups} defaultGroupIds={resource.groupIds} />
      <StateText state={state} />
      <div className="flex flex-wrap gap-2">
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

export function MoveResourceForm({
  courseId,
  resourceId,
  direction,
  disabled,
}: {
  courseId: string
  resourceId: string
  direction: 'up' | 'down'
  disabled: boolean
}) {
  const [state, action, pending] = useActionState(moveResource, initial)
  return (
    <form action={action}>
      <Ids courseId={courseId} />
      <input type="hidden" name="resourceId" value={resourceId} />
      <input type="hidden" name="direction" value={direction} />
      <button
        type="submit"
        disabled={pending || disabled}
        aria-label={direction === 'up' ? 'Resursni yuqoriga' : 'Resursni pastga'}
        className={buttonClass}
      >
        {direction === 'up' ? '↑' : '↓'}
      </button>
      {state.error && <StateText state={state} />}
    </form>
  )
}

export function DeleteResourceForm({
  courseId,
  resourceId,
}: {
  courseId: string
  resourceId: string
}) {
  const [state, action, pending] = useActionState(deleteResource, initial)
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm("Resursni o'chirishni tasdiqlaysizmi?")) e.preventDefault()
      }}
    >
      <Ids courseId={courseId} />
      <input type="hidden" name="resourceId" value={resourceId} />
      <button
        type="submit"
        disabled={pending}
        className={`${buttonClass} border-red-300 text-red-700`}
      >
        O&apos;chirish
      </button>
      {state.error && <StateText state={state} />}
    </form>
  )
}

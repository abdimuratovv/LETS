'use client'

import { useState } from 'react'
import { GroupPicker, type GroupOption } from '@/components/GroupPicker'
import { createBrowserClient } from '@/lib/supabase/browser'
import { errorMessage } from '@/lib/result'
import { discardUpload, prepareFileUpload, registerFileResource } from '@/modules/resources/actions'
import { ALLOWED_EXTENSIONS, titleSchema, validateUpload } from '@/modules/resources/validation'

type Status =
  | { kind: 'idle' }
  | { kind: 'uploading' }
  | { kind: 'error'; message: string }
  | { kind: 'success'; message: string }

const inputClass =
  'mt-1 block min-h-12 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base'

const ACCEPT = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',')

/**
 * Fayl brauzerdan to'g'ridan-to'g'ri Storage'ga yuklanadi (imzolangan havola orqali),
 * keyin resurs sifatida ro'yxatdan o'tadi. Ro'yxatdan o'tmasa yuklama o'chiriladi (R5).
 */
export function FileUploadForm({
  courseId,
  topicId,
  groups,
}: {
  courseId: string
  topicId: string
  groups: GroupOption[]
}) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const uploading = status.kind === 'uploading'

  function checkFile(file: File | null): string | null {
    if (!file || file.size === 0) return 'Faylni tanlang'
    const res = validateUpload({ name: file.name, size: file.size })
    return res.ok ? null : errorMessage(res.error)
  }

  async function upload(form: HTMLFormElement) {
    const data = new FormData(form)
    const file = data.get('file')
    const fileError = checkFile(file instanceof File ? file : null)
    if (fileError || !(file instanceof File)) {
      setStatus({ kind: 'error', message: fileError ?? 'Faylni tanlang' })
      return
    }
    const title = String(data.get('title') ?? '')
    if (!titleSchema.safeParse(title).success) {
      setStatus({ kind: 'error', message: errorMessage('invalid_title') })
      return
    }
    const groupIds =
      data.get('access') === 'groups'
        ? data.getAll('groupIds').filter((v): v is string => typeof v === 'string')
        : []
    if (data.get('access') === 'groups' && groupIds.length === 0) {
      setStatus({ kind: 'error', message: 'Kamida bitta guruhni tanlang' })
      return
    }

    setStatus({ kind: 'uploading' })
    try {
      const prep = await prepareFileUpload({ topicId, fileName: file.name, fileSize: file.size })
      if (!prep.ok) {
        setStatus({ kind: 'error', message: prep.error })
        return
      }

      const { error } = await createBrowserClient()
        .storage.from('resources')
        .uploadToSignedUrl(prep.path, prep.token, file, {
          contentType: file.type || 'application/octet-stream',
        })
      if (error) {
        setStatus({ kind: 'error', message: "Fayl yuklanmadi. Qaytadan urinib ko'ring" })
        return
      }

      const reg = await registerFileResource({
        courseId,
        topicId,
        title,
        path: prep.path,
        fileName: file.name,
        fileSize: file.size,
        groupIds,
      })
      if (reg.error) {
        await discardUpload({ topicId, path: prep.path }).catch(() => undefined)
        setStatus({ kind: 'error', message: reg.error })
        return
      }
      form.reset()
      setStatus({ kind: 'success', message: reg.success ?? "Fayl qo'shildi" })
    } catch {
      setStatus({ kind: 'error', message: errorMessage('unexpected') })
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!uploading) void upload(e.currentTarget)
      }}
      className="space-y-3"
    >
      <label className="block text-sm font-medium">
        Fayl nomi
        <input name="title" type="text" required maxLength={120} className={inputClass} />
      </label>
      <label className="block text-sm font-medium">
        Fayl (50 MB gacha)
        <input
          name="file"
          type="file"
          required
          accept={ACCEPT}
          onChange={(e) => {
            const error = checkFile(e.currentTarget.files?.[0] ?? null)
            setStatus(error ? { kind: 'error', message: error } : { kind: 'idle' })
          }}
          className="mt-1 block min-h-12 w-full max-w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base"
        />
      </label>
      <GroupPicker groups={groups} />
      {status.kind === 'error' && (
        <p role="alert" className="text-sm text-red-600">
          {status.message}
        </p>
      )}
      {status.kind === 'success' && (
        <p role="status" className="text-sm text-green-700">
          {status.message}
        </p>
      )}
      <button
        type="submit"
        disabled={uploading}
        aria-busy={uploading}
        className="min-h-12 w-full rounded-lg bg-black px-4 py-2.5 text-base font-medium text-white disabled:opacity-60 sm:w-auto"
      >
        {uploading ? 'Yuklanmoqda…' : 'Faylni yuklash'}
      </button>
    </form>
  )
}

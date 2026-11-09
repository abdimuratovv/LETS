'use server'

import { revalidatePath } from 'next/cache'
import { requireTeacher } from '@/lib/auth/guards'
import { errorMessage } from '@/lib/result'
import * as service from './service'

export type ResourceFormState = { error: string | null; success: string | null }

const NO_GROUP_SELECTED = 'Kamida bitta guruhni tanlang'

function field(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === 'string' ? value : ''
}

function optionalField(formData: FormData, name: string): string | undefined {
  return formData.has(name) ? field(formData, name) : undefined
}

// `not_found` umumiy matni "O'quvchi topilmadi" - bu yerda resurs (R3).
function message(code: string): string {
  return code === 'not_found' ? 'Resurs topilmadi' : errorMessage(code)
}

/** "Barcha guruhlar" -> []; "Tanlangan guruhlar" -> belgilangan id'lar (bo'sh bo'lsa null). */
function groupIdsFrom(formData: FormData): string[] | null {
  if (field(formData, 'access') !== 'groups') return []
  const ids = formData.getAll('groupIds').filter((v): v is string => typeof v === 'string')
  return ids.length > 0 ? ids : null
}

function coursePath(courseId: string): string {
  return `/teacher/courses/${courseId}`
}

async function run(
  action: () => Promise<{ ok: true } | { ok: false; error: string }>,
  success: string,
  courseId: string,
): Promise<ResourceFormState> {
  try {
    const res = await action()
    if (!res.ok) return { error: message(res.error), success: null }
  } catch (e) {
    console.error('[resources]', e)
    return { error: errorMessage('unexpected'), success: null }
  }
  revalidatePath(coursePath(courseId))
  return { error: null, success }
}

export async function createLinkResource(
  _prev: ResourceFormState,
  formData: FormData,
): Promise<ResourceFormState> {
  const { supabase } = await requireTeacher()
  const groupIds = groupIdsFrom(formData)
  if (!groupIds) return { error: NO_GROUP_SELECTED, success: null }
  return run(
    () =>
      service.createLinkResource(supabase, {
        topicId: field(formData, 'topicId'),
        title: field(formData, 'title'),
        url: field(formData, 'url'),
        groupIds,
      }),
    "Havola qo'shildi",
    field(formData, 'courseId'),
  )
}

export async function createNoteResource(
  _prev: ResourceFormState,
  formData: FormData,
): Promise<ResourceFormState> {
  const { supabase } = await requireTeacher()
  const groupIds = groupIdsFrom(formData)
  if (!groupIds) return { error: NO_GROUP_SELECTED, success: null }
  return run(
    () =>
      service.createNoteResource(supabase, {
        topicId: field(formData, 'topicId'),
        title: field(formData, 'title'),
        bodyMd: field(formData, 'bodyMd'),
        groupIds,
      }),
    "Konspekt qo'shildi",
    field(formData, 'courseId'),
  )
}

export async function updateResource(
  _prev: ResourceFormState,
  formData: FormData,
): Promise<ResourceFormState> {
  const { supabase } = await requireTeacher()
  const groupIds = groupIdsFrom(formData)
  if (!groupIds) return { error: NO_GROUP_SELECTED, success: null }
  return run(
    () =>
      service.updateResource(supabase, field(formData, 'resourceId'), {
        title: field(formData, 'title'),
        url: optionalField(formData, 'url'),
        bodyMd: optionalField(formData, 'bodyMd'),
        groupIds,
      }),
    'Saqlandi',
    field(formData, 'courseId'),
  )
}

export async function moveResource(
  _prev: ResourceFormState,
  formData: FormData,
): Promise<ResourceFormState> {
  const { supabase } = await requireTeacher()
  const direction = field(formData, 'direction') === 'up' ? 'up' : 'down'
  return run(
    () => service.moveResource(supabase, field(formData, 'resourceId'), direction),
    "Resurs ko'chirildi",
    field(formData, 'courseId'),
  )
}

export async function deleteResource(
  _prev: ResourceFormState,
  formData: FormData,
): Promise<ResourceFormState> {
  const { supabase } = await requireTeacher()
  return run(
    () => service.deleteResource(supabase, field(formData, 'resourceId')),
    "Resurs o'chirildi",
    field(formData, 'courseId'),
  )
}

// ===== Fayl yuklash (FileUploadForm dan to'g'ridan-to'g'ri chaqiriladi) =====

export type PrepareUploadResult =
  | { ok: true; path: string; token: string }
  | { ok: false; error: string }

export async function prepareFileUpload(input: {
  topicId: string
  fileName: string
  fileSize: number
}): Promise<PrepareUploadResult> {
  const { supabase } = await requireTeacher()
  try {
    const res = await service.prepareFileUpload(supabase, {
      topicId: String(input.topicId),
      fileName: String(input.fileName),
      fileSize: Number(input.fileSize),
    })
    if (!res.ok) return { ok: false, error: message(res.error) }
    return { ok: true, ...res.data }
  } catch (e) {
    console.error('[resources]', e)
    return { ok: false, error: errorMessage('unexpected') }
  }
}

export async function registerFileResource(input: {
  courseId: string
  topicId: string
  title: string
  path: string
  fileName: string
  fileSize: number
  groupIds: string[]
}): Promise<ResourceFormState> {
  const { supabase } = await requireTeacher()
  const groupIds = Array.isArray(input.groupIds) ? input.groupIds.map(String) : []
  return run(
    () =>
      service.registerFileResource(supabase, {
        topicId: String(input.topicId),
        title: String(input.title),
        path: String(input.path),
        fileName: String(input.fileName),
        fileSize: Number(input.fileSize),
        groupIds,
      }),
    "Fayl qo'shildi",
    String(input.courseId),
  )
}

/** R5: ro'yxatdan o'tmagan yuklamani o'chirish (xato bo'lsa faqat jurnalga). */
export async function discardUpload(input: { topicId: string; path: string }): Promise<void> {
  const { supabase } = await requireTeacher()
  try {
    const res = await service.discardUpload(supabase, {
      topicId: String(input.topicId),
      path: String(input.path),
    })
    if (!res.ok) console.error('[resources] yuklama o\'chirilmadi', res.error)
  } catch (e) {
    console.error('[resources]', e)
  }
}

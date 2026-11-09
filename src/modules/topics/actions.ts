'use server'

import { revalidatePath } from 'next/cache'
import { requireTeacher } from '@/lib/auth/guards'
import { errorMessage } from '@/lib/result'
import * as service from './service'

export type TopicFormState = { error: string | null; success: string | null }

function field(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === 'string' ? value : ''
}

// `not_found` umumiy matni "O'quvchi topilmadi" - bu yerda mavzu.
function message(code: string): string {
  return code === 'not_found' ? 'Mavzu topilmadi' : errorMessage(code)
}

async function run(
  action: () => Promise<{ ok: true } | { ok: false; error: string }>,
  success: string,
  courseId: string,
): Promise<TopicFormState> {
  try {
    const res = await action()
    if (!res.ok) return { error: message(res.error), success: null }
  } catch (e) {
    console.error('[topics]', e)
    return { error: errorMessage('unexpected'), success: null }
  }
  revalidatePath(`/teacher/courses/${courseId}`)
  return { error: null, success }
}

export async function createTopic(
  _prev: TopicFormState,
  formData: FormData,
): Promise<TopicFormState> {
  const { supabase } = await requireTeacher()
  const courseId = field(formData, 'courseId')
  return run(
    () => service.createTopic(supabase, { courseId, title: field(formData, 'title') }),
    "Mavzu qo'shildi",
    courseId,
  )
}

export async function renameTopic(
  _prev: TopicFormState,
  formData: FormData,
): Promise<TopicFormState> {
  const { supabase } = await requireTeacher()
  return run(
    () => service.renameTopic(supabase, field(formData, 'topicId'), field(formData, 'title')),
    'Nom saqlandi',
    field(formData, 'courseId'),
  )
}

export async function moveTopic(
  _prev: TopicFormState,
  formData: FormData,
): Promise<TopicFormState> {
  const { supabase } = await requireTeacher()
  const direction = field(formData, 'direction') === 'up' ? 'up' : 'down'
  return run(
    () => service.moveTopic(supabase, field(formData, 'topicId'), direction),
    "Mavzu ko'chirildi",
    field(formData, 'courseId'),
  )
}

export async function deleteTopic(
  _prev: TopicFormState,
  formData: FormData,
): Promise<TopicFormState> {
  const { supabase } = await requireTeacher()
  return run(
    () => service.deleteTopic(supabase, field(formData, 'topicId')),
    "Mavzu o'chirildi",
    field(formData, 'courseId'),
  )
}

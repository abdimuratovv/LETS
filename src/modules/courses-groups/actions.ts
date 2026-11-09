'use server'

import { revalidatePath } from 'next/cache'
import { requireTeacher } from '@/lib/auth/guards'
import { errorMessage } from '@/lib/result'
import * as service from './service'

export type GroupFormState = { error: string | null; success: string | null }

const COURSES_PATH = '/teacher/courses'
const GROUPS_PATH = '/teacher/groups'

function field(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === 'string' ? value : ''
}

// `not_found` umumiy matni "O'quvchi topilmadi" - bu yerda kurs/guruh bo'lishi mumkin.
function message(code: string): string {
  return code === 'not_found' ? 'Kurs, guruh yoki o\'quvchi topilmadi' : errorMessage(code)
}

async function run(
  action: () => Promise<{ ok: true } | { ok: false; error: string }>,
  success: string,
  paths: string[],
): Promise<GroupFormState> {
  try {
    const res = await action()
    if (!res.ok) return { error: message(res.error), success: null }
  } catch (e) {
    console.error('[courses-groups]', e)
    return { error: errorMessage('unexpected'), success: null }
  }
  paths.forEach((p) => revalidatePath(p))
  return { error: null, success }
}

export async function createCourse(
  _prev: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  const { supabase } = await requireTeacher()
  return run(
    () => service.createCourse(supabase, { title: field(formData, 'title') }),
    "Kurs qo'shildi",
    [COURSES_PATH, GROUPS_PATH],
  )
}

export async function finishCourse(
  _prev: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  const { supabase } = await requireTeacher()
  return run(
    () => service.finishCourse(supabase, field(formData, 'courseId')),
    'Kurs tugatildi',
    [COURSES_PATH, GROUPS_PATH],
  )
}

export async function createGroup(
  _prev: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  const { supabase } = await requireTeacher()
  return run(
    () =>
      service.createGroup(supabase, {
        name: field(formData, 'name'),
        description: field(formData, 'description'),
      }),
    "Guruh qo'shildi",
    [GROUPS_PATH, '/teacher/students'],
  )
}

export async function assignGroupToCourse(
  _prev: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  const { supabase } = await requireTeacher()
  return run(
    () =>
      service.assignGroupToCourse(supabase, field(formData, 'groupId'), field(formData, 'courseId')),
    "Guruh kursga o'tkazildi",
    [GROUPS_PATH],
  )
}

export async function moveStudent(
  _prev: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  const { supabase } = await requireTeacher()
  return run(
    () => service.moveStudent(supabase, field(formData, 'studentId'), field(formData, 'groupId')),
    "O'quvchi ko'chirildi",
    [GROUPS_PATH, '/teacher/students'],
  )
}

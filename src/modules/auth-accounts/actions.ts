'use server'

import { revalidatePath } from 'next/cache'
import { requireTeacher } from '@/lib/auth/guards'
import { errorMessage } from '@/lib/result'
import { createAdminClient } from '@/lib/supabase/admin'
import * as service from './service'

export type AccountFormState = { error: string | null; success: string | null }

const LIST_PATH = '/teacher/students'

function field(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === 'string' ? value : ''
}

async function run(
  action: () => Promise<{ ok: true } | { ok: false; error: string }>,
  success: string,
  paths: string[],
): Promise<AccountFormState> {
  try {
    const res = await action()
    if (!res.ok) return { error: errorMessage(res.error), success: null }
  } catch (e) {
    console.error('[auth-accounts]', e)
    return { error: errorMessage('unexpected'), success: null }
  }
  paths.forEach((p) => revalidatePath(p))
  return { error: null, success }
}

export async function createStudent(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  await requireTeacher()
  return run(
    () =>
      service.createStudent(createAdminClient(), {
        login: field(formData, 'login'),
        password: field(formData, 'password'),
        groupId: field(formData, 'groupId'),
      }),
    "O'quvchi qo'shildi",
    [LIST_PATH],
  )
}

export async function resetStudentPassword(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  await requireTeacher()
  const studentId = field(formData, 'studentId')
  return run(
    () => service.resetStudentPassword(createAdminClient(), studentId, field(formData, 'password')),
    'Parol yangilandi',
    [],
  )
}

export async function archiveStudent(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  await requireTeacher()
  const studentId = field(formData, 'studentId')
  return run(
    () => service.archiveStudent(createAdminClient(), studentId),
    "O'quvchi arxivlandi",
    [LIST_PATH, `${LIST_PATH}/${studentId}`],
  )
}

export async function restoreStudent(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  await requireTeacher()
  const studentId = field(formData, 'studentId')
  return run(
    () => service.restoreStudent(createAdminClient(), studentId),
    "O'quvchi tiklandi",
    [LIST_PATH, `${LIST_PATH}/${studentId}`],
  )
}

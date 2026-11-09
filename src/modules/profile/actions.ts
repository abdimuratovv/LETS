'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireTeacher, requireUser } from '@/lib/auth/guards'
import { errorMessage } from '@/lib/result'
import type { AvatarBase } from './avatars'
import * as service from './service'
import type { ProfileError } from './service'

export type ProfileField = 'fullName' | 'nickname' | 'birthDate' | 'avatarBase'

export type ProfileFormState = {
  error: string | null
  success: string | null
  fieldErrors: Partial<Record<ProfileField, string>>
  values: { fullName: string; nickname: string; birthDate: string; avatarBase: string }
}

export type SimpleFormState = { error: string | null; success: string | null }

const FIELD_OF: Partial<Record<ProfileError, ProfileField>> = {
  invalid_full_name: 'fullName',
  invalid_nickname: 'nickname',
  invalid_birth_date: 'birthDate',
  invalid_avatar: 'avatarBase',
}

function field(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === 'string' ? value : ''
}

function readValues(formData: FormData): ProfileFormState['values'] {
  return {
    fullName: field(formData, 'fullName'),
    nickname: field(formData, 'nickname'),
    birthDate: field(formData, 'birthDate'),
    avatarBase: field(formData, 'avatarBase'),
  }
}

function failed(values: ProfileFormState['values'], code: ProfileError): ProfileFormState {
  const f = FIELD_OF[code]
  const message = errorMessage(code)
  return {
    error: f ? null : message,
    success: null,
    fieldErrors: f ? { [f]: message } : {},
    values,
  }
}

function unexpected(values: ProfileFormState['values']): ProfileFormState {
  return { error: errorMessage('unexpected'), success: null, fieldErrors: {}, values }
}

export async function completeOnboarding(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const { supabase, userId, profile } = await requireUser()
  const values = readValues(formData)
  // Qulflangan (o'qituvchi oldindan kiritgan) sana: formadagi qiymat o'rniga saqlangani yuboriladi,
  // aks holda DB `birth_date_locked` bilan rad etadi.
  if (profile.birth_date_locked && profile.birth_date) values.birthDate = profile.birth_date
  try {
    const res = await service.completeOnboarding(supabase, userId, {
      fullName: values.fullName,
      nickname: values.nickname as string | null,
      birthDate: values.birthDate,
      avatarBase: values.avatarBase as AvatarBase,
    })
    if (!res.ok) return failed(values, res.error)
  } catch (e) {
    console.error('[profile]', e)
    return unexpected(values)
  }
  redirect('/home')
}

export async function updateProfile(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const { supabase, userId } = await requireUser()
  const values = readValues(formData)
  try {
    const res = await service.updateOwnProfile(supabase, userId, {
      names: formData.has('fullName')
        ? { fullName: values.fullName, nickname: values.nickname }
        : undefined,
      avatarBase: values.avatarBase ? (values.avatarBase as AvatarBase) : undefined,
    })
    if (!res.ok) return failed(values, res.error)
  } catch (e) {
    console.error('[profile]', e)
    return unexpected(values)
  }
  revalidatePath('/profile')
  return { error: null, success: 'Saqlandi', fieldErrors: {}, values }
}

// ===== O'qituvchi =====

async function teacherRun(
  action: (db: Awaited<ReturnType<typeof requireTeacher>>['supabase']) => Promise<
    { ok: true } | { ok: false; error: string }
  >,
  success: string,
  studentId: string,
): Promise<SimpleFormState> {
  const { supabase } = await requireTeacher()
  try {
    const res = await action(supabase)
    if (!res.ok) return { error: errorMessage(res.error), success: null }
  } catch (e) {
    console.error('[profile]', e)
    return { error: errorMessage('unexpected'), success: null }
  }
  revalidatePath(`/teacher/students/${studentId}`)
  return { error: null, success }
}

export async function revertNameChange(
  _prev: SimpleFormState,
  formData: FormData,
): Promise<SimpleFormState> {
  return teacherRun(
    (db) => service.revertNameChange(db, field(formData, 'changeId')),
    'Qaytarildi',
    field(formData, 'studentId'),
  )
}

export async function setNameEditLock(
  _prev: SimpleFormState,
  formData: FormData,
): Promise<SimpleFormState> {
  const locked = field(formData, 'locked') === 'true'
  return teacherRun(
    (db) => service.setNameEditLock(db, field(formData, 'studentId'), locked),
    locked ? 'Tahrir bloklandi' : 'Tahrir ochildi',
    field(formData, 'studentId'),
  )
}

export async function setBirthDate(
  _prev: SimpleFormState,
  formData: FormData,
): Promise<SimpleFormState> {
  return teacherRun(
    (db) => service.setBirthDate(db, field(formData, 'studentId'), field(formData, 'birthDate')),
    "Tug'ilgan kun yangilandi",
    field(formData, 'studentId'),
  )
}

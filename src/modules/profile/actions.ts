'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireTeacher, requireUser } from '@/lib/auth/guards'
import { errorMessage } from '@/lib/result'
import { AVATAR_BASES, type AvatarBase } from './avatars'
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
  const { supabase, userId } = await requireUser()
  const values = readValues(formData)
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
    const avatar = values.avatarBase
    if (avatar && !(AVATAR_BASES as readonly string[]).includes(avatar)) {
      return failed(values, 'invalid_avatar')
    }
    const names = await service.updateNames(supabase, userId, {
      fullName: values.fullName,
      nickname: values.nickname,
    })
    if (!names.ok) return failed(values, names.error)
    if (avatar) {
      const res = await service.updateAvatar(supabase, userId, avatar as AvatarBase)
      if (!res.ok) return failed(values, res.error)
    }
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

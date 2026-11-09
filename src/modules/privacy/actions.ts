'use server'

import { revalidatePath } from 'next/cache'
import { requireTeacher } from '@/lib/auth/guards'
import { errorMessage } from '@/lib/result'
import * as service from './service'

export type PrivacyFormState = { error: string | null; success: string | null }

function field(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === 'string' ? value : ''
}

/**
 * Bitta katak: `groupId` bo'sh bo'lsa umumiy qiymat, aks holda guruh istisnosi
 * (`scope = ''` -> istisno o'chiriladi, "Umumiy").
 */
export async function updatePrivacy(
  _prev: PrivacyFormState,
  formData: FormData,
): Promise<PrivacyFormState> {
  const { supabase } = await requireTeacher()
  const item = field(formData, 'item') as service.PrivacyItem
  const scope = field(formData, 'scope')
  const groupId = field(formData, 'groupId')

  try {
    const res = groupId
      ? await service.setGroupOverride(
          supabase,
          groupId,
          item,
          scope === '' ? null : (scope as service.PrivacyScope),
        )
      : await service.setGlobalScope(supabase, item, scope as service.PrivacyScope)
    if (!res.ok) return { error: errorMessage(res.error), success: null }
  } catch (e) {
    console.error('[privacy]', e)
    return { error: errorMessage('unexpected'), success: null }
  }
  revalidatePath('/teacher/privacy')
  revalidatePath('/home')
  return { error: null, success: 'Saqlandi' }
}

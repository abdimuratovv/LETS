'use server'

import { redirect } from 'next/navigation'
import { loginSchema, loginToEmail, passwordSchema } from '@/lib/auth/login'
import { resolveRoute } from '@/lib/auth/routing'
import { errorMessage } from '@/lib/result'
import { createServerClient } from '@/lib/supabase/server'

export type SignInState = { error: string | null }

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const invalid = { error: errorMessage('invalid_credentials') }

  const login = loginSchema.safeParse(formData.get('login'))
  const password = passwordSchema.safeParse(formData.get('password'))
  if (!login.success || !password.success) return invalid

  const supabase = await createServerClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: loginToEmail(login.data),
    password: password.data,
  })
  if (error) return invalid

  // To'g'ridan-to'g'ri yakuniy sahifaga: '/' ga yo'naltirilsa, proxy redirect'i server action
  // navigatsiyasida ichkarida bajariladi va manzil satri '/' bo'lib qoladi.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, status, onboarding_done')
    .eq('id', data.user.id)
    .maybeSingle()
  const decision = profile
    ? resolveRoute('/', {
        role: profile.role,
        status: profile.status,
        onboardingDone: profile.onboarding_done,
      })
    : ({ type: 'redirect', to: '/login', signOut: true } as const)
  if (decision.type === 'redirect' && decision.signOut) await supabase.auth.signOut()
  redirect(decision.type === 'redirect' ? decision.to : '/')
}

export async function signOut() {
  const supabase = await createServerClient()
  await supabase.auth.signOut()
  redirect('/login')
}

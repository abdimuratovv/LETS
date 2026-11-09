'use server'

import { redirect } from 'next/navigation'
import { loginSchema, loginToEmail, passwordSchema } from '@/lib/auth/login'
import { errorMessage } from '@/lib/result'
import { createServerClient } from '@/lib/supabase/server'

export type SignInState = { error: string | null }

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const invalid = { error: errorMessage('invalid_credentials') }

  const login = loginSchema.safeParse(formData.get('login'))
  const password = passwordSchema.safeParse(formData.get('password'))
  if (!login.success || !password.success) return invalid

  const supabase = await createServerClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: loginToEmail(login.data),
    password: password.data,
  })
  if (error) return invalid

  redirect('/')
}

export async function signOut() {
  const supabase = await createServerClient()
  await supabase.auth.signOut()
  redirect('/login')
}

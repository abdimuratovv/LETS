import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'

export async function requireUser() {
  const supabase = await createServerClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (!userId) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (!profile || profile.status !== 'active') redirect('/login')

  return { supabase, userId, profile }
}

export async function requireTeacher() {
  const { supabase, userId } = await requireUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()
  if (profile?.role !== 'teacher') redirect('/login')
  return { supabase, userId }
}

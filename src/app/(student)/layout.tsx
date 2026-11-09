import { redirect } from 'next/navigation'
import { AppNav } from '@/components/AppNav'
import { requireUser } from '@/lib/auth/guards'
import { touchLastSeen } from '@/modules/privacy/service'

const LINKS = [
  { href: '/home', label: 'Guruhim' },
  { href: '/profile', label: 'Profil' },
]

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const { supabase, userId, profile } = await requireUser()
  if (profile.role === 'teacher') redirect('/teacher')

  try {
    await touchLastSeen(supabase, userId)
  } catch (e) {
    // Faollik vaqti yozilmasa ham sahifa ochilaveradi.
    console.error('[last_seen]', e)
  }

  return (
    <div className="flex min-h-dvh flex-col bg-gray-50 text-gray-900">
      <AppNav links={LINKS} />
      {children}
    </div>
  )
}

import Link from 'next/link'
import { requireTeacher } from '@/lib/auth/guards'

export default async function TeacherHomePage() {
  const { supabase } = await requireTeacher()

  const [groupsRes, activeRes, pendingRes] = await Promise.all([
    supabase.from('groups').select('id', { count: 'exact', head: true }),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'student')
      .eq('status', 'active'),
    supabase
      .from('profiles')
      .select('id, login, full_name')
      .eq('role', 'student')
      .eq('status', 'active')
      .eq('onboarding_done', false)
      .order('login'),
  ])

  const pending = pendingRes.data ?? []

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">Bosh sahifa</h1>

      <section aria-label="Umumiy ko'rsatkichlar" className="grid grid-cols-2 gap-3">
        <Stat label="Guruhlar" value={groupsRes.count ?? 0} href="/teacher/groups" />
        <Stat label="Faol o'quvchilar" value={activeRes.count ?? 0} href="/teacher/students" />
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <h2 className="mb-1 text-lg font-medium">Onboardingni tugatmaganlar</h2>
        <p className="mb-4 text-sm text-gray-600">
          Bu o&apos;quvchilar hali birinchi marta kirib, profilini to&apos;ldirmagan.
        </p>
        {pending.length === 0 ? (
          <p className="text-sm text-gray-600">Hamma profilini to&apos;ldirgan.</p>
        ) : (
          <ul aria-label="Onboardingni tugatmaganlar" className="divide-y divide-gray-200">
            {pending.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/teacher/students/${s.id}`}
                  className="flex min-h-11 items-center justify-between gap-3 py-2"
                >
                  <span className="truncate font-medium">{s.login}</span>
                  {s.full_name && (
                    <span className="truncate text-sm text-gray-600">{s.full_name}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="block rounded-2xl bg-white p-4 shadow-sm">
      <span className="block text-3xl font-semibold tabular-nums">{value}</span>
      <span className="mt-1 block text-sm text-gray-600">{label}</span>
    </Link>
  )
}

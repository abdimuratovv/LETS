import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { requireTeacher } from '@/lib/auth/guards'
import { ArchiveControl, ResetPasswordForm } from './student-actions'

export default async function StudentPage({ params }: PageProps<'/teacher/students/[id]'>) {
  const { supabase } = await requireTeacher()
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()

  const { data: student } = await supabase
    .from('profiles')
    .select('id, login, full_name, status')
    .eq('id', id)
    .eq('role', 'student')
    .maybeSingle()
  if (!student) notFound()

  const { data: membership } = await supabase
    .from('group_memberships')
    .select('group_id')
    .eq('student_id', id)
    .is('left_at', null)
    .maybeSingle()
  const { data: group } = membership
    ? await supabase.from('groups').select('name').eq('id', membership.group_id).maybeSingle()
    : { data: null }

  const archived = student.status === 'archived'

  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl space-y-6 bg-gray-50 p-4 text-gray-900 sm:p-6">
      <Link
        href="/teacher/students"
        className="inline-flex min-h-11 items-center text-sm font-medium text-gray-700 underline"
      >
        ← O&apos;quvchilar ro&apos;yxati
      </Link>

      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <h1 className="text-2xl font-semibold">{student.full_name ?? student.login}</h1>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-gray-600">Login</dt>
          <dd>{student.login}</dd>
          <dt className="text-gray-600">Guruh</dt>
          <dd>{group?.name ?? 'Guruhsiz'}</dd>
          <dt className="text-gray-600">Holat</dt>
          <dd>{archived ? 'Arxiv' : 'Faol'}</dd>
        </dl>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <h2 className="mb-4 text-lg font-medium">Parolni tiklash</h2>
        <ResetPasswordForm studentId={student.id} />
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <h2 className="mb-4 text-lg font-medium">{archived ? 'Arxivdan tiklash' : 'Arxivlash'}</h2>
        <ArchiveControl key={student.status} studentId={student.id} archived={archived} />
      </section>
    </main>
  )
}

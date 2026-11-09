import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { requireTeacher } from '@/lib/auth/guards'
import { listNameChanges } from '@/modules/profile/service'
import { ArchiveControl, MoveStudentForm, ResetPasswordForm } from './student-actions'
import { BirthDateForm, NameLockToggle, RevertButton } from './profile-controls'

export default async function StudentPage({ params }: PageProps<'/teacher/students/[id]'>) {
  const { supabase } = await requireTeacher()
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()

  const { data: student } = await supabase
    .from('profiles')
    .select('id, login, full_name, status, birth_date, name_edit_locked')
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
  const { data: groups } = await supabase.from('groups').select('id, name').order('name')
  const group = membership ? (groups ?? []).find((g) => g.id === membership.group_id) : undefined

  const changes = await listNameChanges(supabase, id)
  const archived = student.status === 'archived'

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 bg-gray-50 p-4 text-gray-900 sm:p-6">
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
        <h2 className="mb-4 text-lg font-medium">Ism nazorati</h2>
        <NameLockToggle key={String(student.name_edit_locked)} studentId={student.id} locked={student.name_edit_locked} />
        <h3 className="mb-2 mt-6 text-base font-medium">Ism o&apos;zgarishlari tarixi</h3>
        {changes.length === 0 ? (
          <p className="text-sm text-gray-600">O&apos;zgarishlar yo&apos;q</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {changes.map((c) => (
              <li key={c.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                  <p className="text-xs text-gray-600">
                    {new Date(c.changed_at).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })} ·{' '}
                    {c.field === 'full_name' ? 'Ism-familiya' : 'Nickname'}
                  </p>
                  <p>
                    {c.old_value ?? '—'} → <strong>{c.new_value ?? '—'}</strong>
                  </p>
                </div>
                {!(c.field === 'full_name' && c.old_value === null) && (
                  <RevertButton changeId={c.id} studentId={student.id} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <h2 className="mb-4 text-lg font-medium">Tug&apos;ilgan kunni o&apos;zgartirish</h2>
        <BirthDateForm key={student.birth_date ?? ''} studentId={student.id} birthDate={student.birth_date} />
      </section>

      {!archived && (
        <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
          <h2 className="mb-1 text-lg font-medium">Boshqa guruhga ko&apos;chirish</h2>
          <p className="mb-4 text-sm text-gray-600">
            Hozirgi guruh: <strong>{group?.name ?? 'Guruhsiz'}</strong>
          </p>
          <MoveStudentForm
            studentId={student.id}
            currentGroupId={membership?.group_id ?? null}
            groups={groups ?? []}
          />
        </section>
      )}

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

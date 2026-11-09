import Link from 'next/link'
import { requireTeacher } from '@/lib/auth/guards'
import { AddStudentForm } from './add-student-form'

type StatusFilter = 'active' | 'archived' | 'all'

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'active', label: 'Faol' },
  { value: 'archived', label: 'Arxiv' },
  { value: 'all', label: 'Hammasi' },
]

const controlClass =
  'mt-1 block min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base'

export default async function StudentsPage({ searchParams }: PageProps<'/teacher/students'>) {
  const { supabase } = await requireTeacher()
  const params = await searchParams
  const groupFilter = typeof params.group === 'string' ? params.group : ''
  const statusFilter: StatusFilter =
    params.status === 'archived' || params.status === 'all' ? params.status : 'active'

  const [groupsRes, studentsRes, membershipsRes] = await Promise.all([
    supabase.from('groups').select('id, name').order('name'),
    supabase
      .from('profiles')
      .select('id, login, full_name, status')
      .eq('role', 'student')
      .order('login'),
    supabase.from('group_memberships').select('student_id, group_id').is('left_at', null),
  ])

  const groups = groupsRes.data ?? []
  const groupName = new Map(groups.map((g) => [g.id, g.name]))
  const groupOf = new Map((membershipsRes.data ?? []).map((m) => [m.student_id, m.group_id]))

  const students = (studentsRes.data ?? []).filter(
    (s) =>
      (statusFilter === 'all' || s.status === statusFilter) &&
      (!groupFilter || groupOf.get(s.id) === groupFilter),
  )

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 bg-gray-50 p-4 text-gray-900 sm:p-6">
      <h1 className="text-2xl font-semibold">O&apos;quvchilar</h1>

      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <h2 className="mb-4 text-lg font-medium">O&apos;quvchi qo&apos;shish</h2>
        <AddStudentForm groups={groups} />
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <form method="get" className="mb-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="block text-sm font-medium">
            Guruh
            <select name="group" defaultValue={groupFilter} className={controlClass}>
              <option value="">Barcha guruhlar</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            Holat
            <select name="status" defaultValue={statusFilter} className={controlClass}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="min-h-11 rounded-lg border border-gray-300 px-4 py-2 text-base font-medium"
          >
            Ko&apos;rsatish
          </button>
        </form>

        {students.length === 0 ? (
          <p className="text-sm text-gray-600">O&apos;quvchi topilmadi.</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {students.map((s) => {
              const gid = groupOf.get(s.id)
              return (
                <li key={s.id}>
                  <Link
                    href={`/teacher/students/${s.id}`}
                    className="flex min-h-11 items-center justify-between gap-3 py-3"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{s.full_name ?? s.login}</span>
                      <span className="block truncate text-sm text-gray-600">
                        {s.login} · {gid ? (groupName.get(gid) ?? '—') : 'Guruhsiz'}
                      </span>
                    </span>
                    <StatusTag status={s.status} />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </main>
  )
}

function StatusTag({ status }: { status: 'active' | 'archived' }) {
  return status === 'active' ? (
    <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800">
      Faol
    </span>
  ) : (
    <span className="shrink-0 rounded-full bg-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700">
      Arxiv
    </span>
  )
}

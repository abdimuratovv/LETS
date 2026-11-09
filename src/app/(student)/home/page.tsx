import { Avatar } from '@/components/Avatar'
import { requireUser } from '@/lib/auth/guards'
import { isBirthdayToday, presenceLabel } from '@/modules/privacy/presence'
import { listVisibleStudents, type VisibleStudent } from '@/modules/privacy/service'

export default async function HomePage() {
  const { supabase, userId } = await requireUser()

  const [students, membershipRes] = await Promise.all([
    listVisibleStudents(supabase),
    supabase
      .from('group_memberships')
      .select('group_id, groups(name)')
      .eq('student_id', userId)
      .is('left_at', null)
      .maybeSingle(),
  ])

  const groupName = membershipRes.data?.groups?.name ?? null
  const mates = students.filter((s) => s.sameGroup)
  const others = students.filter((s) => !s.sameGroup)
  const now = new Date()

  return (
    <main className="mx-auto w-full max-w-md space-y-6 p-4 sm:p-6">
      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <h1 className="text-2xl font-semibold">Guruhim</h1>
        {groupName && <p className="mt-1 text-sm text-gray-600">{groupName}</p>}

        {!membershipRes.data ? (
          <p className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
            Siz hali guruhga qo&apos;shilmagansiz. O&apos;qituvchingiz sizni guruhga qo&apos;shgach,
            guruhdoshlaringiz shu yerda ko&apos;rinadi.
          </p>
        ) : mates.length === 0 ? (
          <p className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
            Guruhingizda hozircha boshqa o&apos;quvchi yo&apos;q.
          </p>
        ) : (
          <StudentList students={mates} now={now} label="Guruhdoshlar ro'yxati" />
        )}
      </section>

      {others.length > 0 && (
        <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-medium">Boshqa guruhlar</h2>
          <StudentList students={others} now={now} label="Boshqa guruh o'quvchilari" />
        </section>
      )}
    </main>
  )
}

function StudentList({
  students,
  now,
  label,
}: {
  students: VisibleStudent[]
  now: Date
  label: string
}) {
  return (
    <ul aria-label={label} className="mt-4 divide-y divide-gray-100">
      {students.map((s) => {
        const presence = presenceLabel(s.lastSeenAt, now)
        return (
          <li key={s.id} className="flex items-center gap-3 py-3">
            <Avatar config={s.avatarConfig} size={48} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{s.fullName}</p>
              {s.nickname && <p className="truncate text-sm text-gray-600">@{s.nickname}</p>}
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                {presence === 'online' ? (
                  <span className="inline-flex items-center gap-1 text-green-700">
                    <span aria-hidden="true" className="size-2 rounded-full bg-green-500" />
                    online
                  </span>
                ) : presence ? (
                  <span className="text-gray-600">{presence}</span>
                ) : null}
                {isBirthdayToday(s.birthdayMd, now) && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-900">
                    Bugun tug&apos;ilgan kuni
                  </span>
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

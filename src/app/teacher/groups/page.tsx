import { requireTeacher } from '@/lib/auth/guards'
import { AddGroupForm, AssignCourseForm } from './group-forms'

export default async function GroupsPage() {
  const { supabase } = await requireTeacher()

  const [groupsRes, coursesRes, activeCoursesRes, membersRes] = await Promise.all([
    supabase.from('groups').select('id, name, description').order('name'),
    supabase.from('courses').select('id, title').eq('status', 'active').order('position'),
    supabase.from('group_courses').select('group_id, course_id, courses(title)').is('ended_at', null),
    supabase
      .from('group_memberships')
      .select('group_id, profiles!inner(status)')
      .is('left_at', null)
      .eq('profiles.status', 'active'),
  ])

  const groups = groupsRes.data ?? []
  const activeCourses = coursesRes.data ?? []
  const currentCourse = new Map(
    (activeCoursesRes.data ?? []).map((r) => [
      r.group_id,
      { id: r.course_id, title: r.courses?.title ?? '' },
    ]),
  )
  const memberCount = new Map<string, number>()
  for (const m of membersRes.data ?? []) {
    memberCount.set(m.group_id, (memberCount.get(m.group_id) ?? 0) + 1)
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 bg-gray-50 p-4 text-gray-900 sm:p-6">
      <h1 className="text-2xl font-semibold">Guruhlar</h1>

      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <h2 className="mb-4 text-lg font-medium">Guruh qo&apos;shish</h2>
        <AddGroupForm />
      </section>

      <section className="space-y-4">
        {groups.length === 0 ? (
          <p className="rounded-2xl bg-white p-4 text-sm text-gray-600 shadow-sm">
            Hali guruh yo&apos;q.
          </p>
        ) : (
          groups.map((g) => {
            const course = currentCourse.get(g.id)
            return (
              <article key={g.id} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm sm:p-6">
                <div>
                  <h2 className="text-lg font-medium">{g.name}</h2>
                  {g.description && <p className="text-sm text-gray-600">{g.description}</p>}
                  <p className="mt-1 text-sm text-gray-700">
                    Joriy kurs: {course ? course.title : 'biriktirilmagan'} · O&apos;quvchilar:{' '}
                    {memberCount.get(g.id) ?? 0}
                  </p>
                </div>
                <AssignCourseForm
                  groupId={g.id}
                  currentCourseId={course?.id ?? null}
                  courses={activeCourses}
                />
              </article>
            )
          })
        )}
      </section>
    </main>
  )
}

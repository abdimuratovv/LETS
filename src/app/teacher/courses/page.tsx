import Link from 'next/link'
import { requireTeacher } from '@/lib/auth/guards'
import { AddCourseForm, FinishCourseForm } from './course-forms'

export default async function CoursesPage() {
  const { supabase } = await requireTeacher()
  const { data } = await supabase
    .from('courses')
    .select('id, title, position, status')
    .order('position')
  const courses = data ?? []

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 bg-gray-50 p-4 text-gray-900 sm:p-6">
      <h1 className="text-2xl font-semibold">Kurslar</h1>

      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <h2 className="mb-4 text-lg font-medium">Kurs qo&apos;shish</h2>
        <AddCourseForm />
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        {courses.length === 0 ? (
          <p className="text-sm text-gray-600">Hali kurs yo&apos;q.</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {courses.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{c.title}</span>
                  {c.status === 'active' ? (
                    <span className="text-sm text-green-800">Faol</span>
                  ) : (
                    <span className="text-sm text-gray-600">Tugagan</span>
                  )}
                </span>
                <span className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <Link
                    href={`/teacher/courses/${c.id}`}
                    className="inline-flex min-h-12 items-center rounded-lg border border-gray-300 px-4 py-2 text-base font-medium"
                  >
                    Mavzular va resurslar
                  </Link>
                  {c.status === 'active' && <FinishCourseForm courseId={c.id} />}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

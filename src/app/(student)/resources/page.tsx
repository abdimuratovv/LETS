import Link from 'next/link'
import { requireUser } from '@/lib/auth/guards'
import { TYPE_ICON, TYPE_LABEL, formatFileSize } from '@/modules/resources/format'
import {
  listCourseResources,
  listMyCourses,
  type StudentResource,
} from '@/modules/resources/service'

export default async function ResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string | string[] }>
}) {
  const { supabase } = await requireUser()
  const courses = await listMyCourses(supabase)

  if (courses.length === 0) {
    return (
      <main className="mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-6">
        <h1 className="text-2xl font-semibold">Resurslar</h1>
        <p className="rounded-2xl bg-white p-4 text-sm text-gray-700 shadow-sm">
          Guruhingizga hali kurs biriktirilmagan
        </p>
      </main>
    )
  }

  const { course: param } = await searchParams
  const selected = courses.find((c) => c.id === param) ?? courses[0]
  const topics = await listCourseResources(supabase, selected.id)

  return (
    <main className="mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Resurslar</h1>
        <p className="mt-1 break-words text-sm text-gray-600">
          {selected.title}
          {selected.current ? ' · joriy kurs' : ' · oldingi kurs'}
        </p>
      </div>

      {courses.length > 1 && (
        <nav aria-label="Kurslar" className="flex flex-wrap gap-2">
          {courses.map((c) => (
            <Link
              key={c.id}
              href={`/resources?course=${c.id}`}
              aria-current={c.id === selected.id ? 'page' : undefined}
              className={`flex min-h-12 max-w-full items-center rounded-lg border px-4 text-sm font-medium ${
                c.id === selected.id
                  ? 'border-black bg-black text-white'
                  : 'border-gray-300 bg-white text-gray-800'
              }`}
            >
              <span className="truncate">{c.title}</span>
            </Link>
          ))}
        </nav>
      )}

      {topics.length === 0 ? (
        <p className="rounded-2xl bg-white p-4 text-sm text-gray-700 shadow-sm">
          Bu kursda hali resurs yo&apos;q.
        </p>
      ) : (
        topics.map((topic) => (
          <section key={topic.id} className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
            <h2 className="break-words text-lg font-medium">{topic.title}</h2>
            {topic.resources.length === 0 ? (
              <p className="mt-2 text-sm text-gray-600">Hozircha resurs yo&apos;q.</p>
            ) : (
              <ul className="mt-2 divide-y divide-gray-100">
                {topic.resources.map((r) => (
                  <li key={r.id}>
                    <ResourceLink resource={r} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))
      )}
    </main>
  )
}

function ResourceLink({ resource: r }: { resource: StudentResource }) {
  return (
    // Oddiy <a>: ochish yo'li route handler, prefetch qilinmasin (ko'rish yozilib qolmasin).
    <a
      href={`/resources/${r.id}/open`}
      {...(r.type === 'link' ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="flex min-h-12 items-center gap-3 py-2 hover:bg-gray-50"
    >
      <span aria-hidden="true" className="text-xl">
        {TYPE_ICON[r.type]}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block break-words font-medium text-blue-700">{r.title}</span>
        <span className="block text-xs text-gray-600">
          {TYPE_LABEL[r.type]}
          {r.type === 'file' && r.fileSize !== null && ` · ${formatFileSize(r.fileSize)}`}
        </span>
      </span>
      {!r.viewed && (
        <span className="flex shrink-0 items-center">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-blue-600" />
          <span className="sr-only">Ko&apos;rilmagan</span>
        </span>
      )}
    </a>
  )
}

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { requireTeacher } from '@/lib/auth/guards'
import { listTopics } from '@/modules/topics/service'
import { AddTopicForm, DeleteTopicForm, MoveTopicForm, RenameTopicForm } from './topic-forms'

export default async function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { supabase } = await requireTeacher()
  const { courseId } = await params
  if (!z.uuid().safeParse(courseId).success) notFound()

  const { data: course } = await supabase
    .from('courses')
    .select('id, title')
    .eq('id', courseId)
    .maybeSingle()
  if (!course) notFound()

  const topics = await listTopics(supabase, courseId)

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 bg-gray-50 p-4 text-gray-900 sm:p-6">
      <div>
        <Link href="/teacher/courses" className="text-sm text-gray-600 underline">
          ← Kurslar
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{course.title}</h1>
      </div>

      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <h2 className="mb-4 text-lg font-medium">Mavzu qo&apos;shish</h2>
        <AddTopicForm courseId={course.id} />
      </section>

      <section className="space-y-4">
        {topics.length === 0 && (
          <p className="rounded-2xl bg-white p-4 text-sm text-gray-600 shadow-sm">
            Hali mavzu yo&apos;q.
          </p>
        )}
        {topics.map((topic, i) => (
          <article key={topic.id} className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
            <h2 className="break-words text-lg font-medium">{topic.title}</h2>
            <div className="mt-3 flex flex-wrap items-start gap-2">
              <MoveTopicForm
                courseId={course.id}
                topicId={topic.id}
                direction="up"
                disabled={i === 0}
              />
              <MoveTopicForm
                courseId={course.id}
                topicId={topic.id}
                direction="down"
                disabled={i === topics.length - 1}
              />
              <RenameTopicForm courseId={course.id} topicId={topic.id} title={topic.title} />
              <DeleteTopicForm courseId={course.id} topicId={topic.id} />
            </div>
            {/* Resurslar bo'limi (4-task) shu yerga qo'shiladi. */}
          </article>
        ))}
      </section>
    </main>
  )
}

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { requireTeacher } from '@/lib/auth/guards'
import { listResourcesForTopic, listResourceViewStats } from '@/modules/resources/service'
import { listTopics } from '@/modules/topics/service'
import { TopicResources } from './resource-section'
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

  const [topics, groupsRes, courseGroupsRes] = await Promise.all([
    listTopics(supabase, courseId),
    supabase.from('groups').select('id, name').order('name'),
    supabase.from('group_courses').select('group_id').eq('course_id', courseId),
  ])
  if (groupsRes.error) throw new Error(`guruhlar o'qilmadi: ${groupsRes.error.message}`)
  if (courseGroupsRes.error) {
    throw new Error(`kurs guruhlari o'qilmadi: ${courseGroupsRes.error.message}`)
  }
  const groupNames = new Map(groupsRes.data.map((g) => [g.id, g.name]))
  const courseGroupIds = new Set(courseGroupsRes.data.map((g) => g.group_id))
  const courseGroups = groupsRes.data.filter((g) => courseGroupIds.has(g.id))

  const resourcesByTopic = await Promise.all(
    topics.map((t) => listResourcesForTopic(supabase, t.id)),
  )
  const stats = await listResourceViewStats(supabase, courseId, resourcesByTopic.flat())

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
            <TopicResources
              courseId={course.id}
              topicId={topic.id}
              resources={resourcesByTopic[i]}
              stats={stats}
              groups={courseGroups}
              groupNames={groupNames}
            />
          </article>
        ))}
      </section>
    </main>
  )
}

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { NoteMarkdown } from '@/components/NoteMarkdown'
import { requireUser } from '@/lib/auth/guards'
import { getResourceForViewing, recordView } from '@/modules/resources/service'

export default async function ResourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, profile } = await requireUser()
  const { id } = await params

  const res = await getResourceForViewing(supabase, id)
  if (!res.ok) notFound()
  const resource = res.data
  // Havola va fayl ochish yo'li orqali (ko'rish o'sha yerda yoziladi).
  if (resource.type !== 'note' || resource.bodyMd === null) {
    redirect(`/resources/${resource.id}/open`)
  }

  if (profile.role === 'student') {
    try {
      await recordView(supabase, resource.id)
    } catch (e) {
      console.error('[resources] recordView', e)
    }
  }

  const { data: topic } = await supabase
    .from('topics')
    .select('title, course_id')
    .eq('id', resource.topicId)
    .maybeSingle()
  const back = topic ? `/resources?course=${topic.course_id}` : '/resources'

  return (
    <main className="mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-6">
      <Link
        href={back}
        className="inline-flex min-h-12 items-center text-sm text-gray-600 underline"
      >
        ← Resurslar
      </Link>
      <article className="min-w-0 rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        {topic && <p className="text-sm text-gray-600">{topic.title}</p>}
        <h1 className="mb-4 break-words text-2xl font-semibold">{resource.title}</h1>
        <NoteMarkdown source={resource.bodyMd} />
      </article>
    </main>
  )
}

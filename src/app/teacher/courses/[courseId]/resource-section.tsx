import { FileUploadForm } from '@/components/FileUploadForm'
import type { GroupOption } from '@/components/GroupPicker'
import { NoteMarkdown } from '@/components/NoteMarkdown'
import { TYPE_ICON, TYPE_LABEL, formatFileSize } from '@/modules/resources/format'
import type { Resource, ViewStats } from '@/modules/resources/service'
import {
  AddLinkForm,
  AddNoteForm,
  DeleteResourceForm,
  EditResourceForm,
  MoveResourceForm,
} from './resource-forms'

const EMPTY_STATS: ViewStats = { viewed: 0, total: 0, notViewed: [] }

/** Mavzu ichidagi resurslar ro'yxati va qo'shish formalari (o'qituvchi). */
export function TopicResources({
  courseId,
  topicId,
  resources,
  stats,
  groups,
  groupNames,
}: {
  courseId: string
  topicId: string
  resources: Resource[]
  stats: Map<string, ViewStats>
  /** Kursni o'tgan guruhlar (cheklov uchun tanlov). */
  groups: GroupOption[]
  /** Barcha guruhlar nomi (id -> nom). */
  groupNames: Map<string, string>
}) {

  return (
    <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
      <h3 className="text-base font-medium">Resurslar</h3>
      {resources.length === 0 ? (
        <p className="text-sm text-gray-600">Hali resurs yo&apos;q.</p>
      ) : (
        <ul className="space-y-3" aria-label="Resurslar">
          {resources.map((r, i) => (
            <ResourceItem
              key={r.id}
              courseId={courseId}
              resource={r}
              stats={stats.get(r.id) ?? EMPTY_STATS}
              groups={groups}
              groupNames={groupNames}
              first={i === 0}
              last={i === resources.length - 1}
            />
          ))}
        </ul>
      )}

      <div className="space-y-2">
        <AddBlock title="Havola qo'shish">
          <AddLinkForm courseId={courseId} topicId={topicId} groups={groups} />
        </AddBlock>
        <AddBlock title="Konspekt qo'shish">
          <AddNoteForm courseId={courseId} topicId={topicId} groups={groups} />
        </AddBlock>
        <AddBlock title="Fayl qo'shish">
          <FileUploadForm courseId={courseId} topicId={topicId} groups={groups} />
        </AddBlock>
      </div>
    </div>
  )
}

function AddBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="rounded-xl border border-gray-200">
      <summary className="flex min-h-12 cursor-pointer items-center px-3 text-base font-medium">
        {title}
      </summary>
      <div className="border-t border-gray-100 p-3">{children}</div>
    </details>
  )
}

function ResourceItem({
  courseId,
  resource: r,
  stats,
  groups,
  groupNames,
  first,
  last,
}: {
  courseId: string
  resource: Resource
  stats: ViewStats
  groups: GroupOption[]
  groupNames: Map<string, string>
  first: boolean
  last: boolean
}) {
  const name = (id: string) => groupNames.get(id) ?? 'Guruh'
  // Kursni o'tmagan, lekin cheklovda turgan guruh ham tahrirlash formasida ko'rinsin.
  const editGroups = [
    ...groups,
    ...r.groupIds.filter((id) => !groups.some((g) => g.id === id)).map((id) => ({ id, name: name(id) })),
  ]
  const access =
    r.groupIds.length === 0 ? 'Barcha guruhlar' : `Faqat: ${r.groupIds.map(name).join(', ')}`

  return (
    <li className="rounded-xl border border-gray-200 p-3">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="text-xl leading-7">
          {TYPE_ICON[r.type]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-gray-600">{TYPE_LABEL[r.type]}</p>
          {r.type === 'note' ? (
            <p className="break-words font-medium">{r.title}</p>
          ) : (
            // Oddiy <a>: prefetch bo'lmasin; R1 - o'qituvchi uchun ko'rish yozilmaydi.
            <a
              href={`/resources/${r.id}/open`}
              {...(r.type === 'link' ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className="break-words font-medium text-blue-700 underline"
            >
              {r.title}
            </a>
          )}
          {r.type === 'file' && r.fileName && (
            <p className="break-all text-sm text-gray-600">
              {r.fileName}
              {r.fileSize !== null && ` · ${formatFileSize(r.fileSize)}`}
            </p>
          )}
          {r.type === 'link' && r.url && (
            <p className="break-all text-sm text-gray-600">{r.url}</p>
          )}
          <p className="text-sm text-gray-600">{access}</p>
        </div>
        <p className="shrink-0 text-sm text-gray-700">
          <span className="sr-only">Ko&apos;rganlar: </span>
          <span aria-hidden="true">👁 </span>
          <span className="font-medium">
            {stats.viewed}/{stats.total}
          </span>
        </p>
      </div>

      {r.type === 'note' && r.bodyMd && (
        <details className="mt-2">
          <summary className="flex min-h-12 cursor-pointer items-center text-sm font-medium">
            Konspekt matni
          </summary>
          <div className="rounded-lg bg-gray-50 p-3">
            <NoteMarkdown source={r.bodyMd} />
          </div>
        </details>
      )}

      {stats.total > 0 && (
        <details className="mt-1">
          <summary className="flex min-h-12 cursor-pointer items-center text-sm font-medium">
            Ko&apos;rmaganlar ({stats.notViewed.length})
          </summary>
          {stats.notViewed.length === 0 ? (
            <p className="text-sm text-gray-600">Hamma ko&apos;rgan.</p>
          ) : (
            <ul aria-label="Ko'rmaganlar" className="list-disc space-y-1 pl-6 text-sm">
              {stats.notViewed.map((s) => (
                <li key={s.id} className="break-words">
                  {s.fullName}
                </li>
              ))}
            </ul>
          )}
        </details>
      )}

      <div className="mt-2 flex flex-wrap items-start gap-2">
        <MoveResourceForm courseId={courseId} resourceId={r.id} direction="up" disabled={first} />
        <MoveResourceForm courseId={courseId} resourceId={r.id} direction="down" disabled={last} />
        <EditResourceForm
          courseId={courseId}
          resource={{
            id: r.id,
            type: r.type,
            title: r.title,
            url: r.url,
            bodyMd: r.bodyMd,
            groupIds: r.groupIds,
          }}
          groups={editGroups}
        />
        <DeleteResourceForm courseId={courseId} resourceId={r.id} />
      </div>
    </li>
  )
}

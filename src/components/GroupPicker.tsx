'use client'

import { useState } from 'react'

export type GroupOption = { id: string; name: string }

/**
 * Resurs kimga ochiq: "Barcha guruhlar" (boshlang'ich) yoki tanlangan guruhlar.
 * Forma maydonlari: `access` = 'all' | 'groups', `groupIds` (bir nechta).
 */
export function GroupPicker({
  groups,
  defaultGroupIds = [],
}: {
  groups: GroupOption[]
  defaultGroupIds?: string[]
}) {
  const [mode, setMode] = useState<'all' | 'groups'>(
    defaultGroupIds.length > 0 ? 'groups' : 'all',
  )

  if (groups.length === 0) {
    return (
      <div>
        <input type="hidden" name="access" value="all" />
        <p className="text-sm text-gray-600">
          Kursga hali guruh biriktirilmagan: resurs kursni o&apos;tadigan barcha guruhlarga ochiq
          bo&apos;ladi.
        </p>
      </div>
    )
  }

  return (
    <fieldset className="space-y-1">
      <legend className="text-sm font-medium">Kimlar ko&apos;radi</legend>
      <label className="flex min-h-12 items-center gap-3 text-base">
        <input
          type="radio"
          name="access"
          value="all"
          checked={mode === 'all'}
          onChange={() => setMode('all')}
          className="size-5"
        />
        Barcha guruhlar
      </label>
      <label className="flex min-h-12 items-center gap-3 text-base">
        <input
          type="radio"
          name="access"
          value="groups"
          checked={mode === 'groups'}
          onChange={() => setMode('groups')}
          className="size-5"
        />
        Faqat tanlangan guruhlar
      </label>
      {mode === 'groups' && (
        <div className="ml-8 flex flex-wrap gap-x-4">
          {groups.map((g) => (
            <label key={g.id} className="flex min-h-12 items-center gap-2 text-base">
              <input
                type="checkbox"
                name="groupIds"
                value={g.id}
                defaultChecked={defaultGroupIds.includes(g.id)}
                className="size-5"
              />
              <span className="break-words">{g.name}</span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  )
}

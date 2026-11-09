import { requireTeacher } from '@/lib/auth/guards'
import {
  getPrivacyMatrix,
  PRIVACY_ITEMS,
  PRIVACY_LABELS,
  SCOPE_LABELS,
} from '@/modules/privacy/service'
import { ScopeSelect } from './scope-select'

export default async function PrivacyPage() {
  const { supabase } = await requireTeacher()
  const [matrix, groupsRes] = await Promise.all([
    getPrivacyMatrix(supabase),
    supabase.from('groups').select('id, name').order('name'),
  ])
  const groups = groupsRes.data ?? []
  const override = new Map(matrix.overrides.map((o) => [`${o.groupId}:${o.item}`, o.scope]))

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Maxfiylik</h1>
        <p className="mt-1 text-sm text-gray-600">
          O&apos;quvchilar bir-birining qaysi ma&apos;lumotlarini ko&apos;rishini belgilang.
          Guruh ustunidagi qiymat shu guruh o&apos;quvchilari uchun umumiy qiymat o&apos;rniga
          ishlaydi. Ism-familiya o&apos;z guruhiga doim ko&apos;rinadi.
        </p>
        <p className="mt-2 text-xs text-gray-600">
          {Object.values(SCOPE_LABELS).join(' · ')} — tanlash bilan darhol saqlanadi.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full min-w-max border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th scope="col" className="sticky left-0 bg-white p-3 font-medium">
                Element
              </th>
              <th scope="col" className="p-3 font-medium">
                Umumiy
              </th>
              {groups.map((g) => (
                <th key={g.id} scope="col" className="p-3 font-medium">
                  {g.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PRIVACY_ITEMS.map((item) => (
              <tr key={item} className="border-b border-gray-100 last:border-0 align-top">
                <th scope="row" className="sticky left-0 bg-white p-3 font-medium">
                  {PRIVACY_LABELS[item]}
                </th>
                <td className="p-3">
                  <ScopeSelect
                    item={item}
                    value={matrix.global[item]}
                    label={`${PRIVACY_LABELS[item]} — Umumiy`}
                  />
                </td>
                {groups.map((g) => (
                  <td key={g.id} className="p-3">
                    <ScopeSelect
                      item={item}
                      groupId={g.id}
                      value={override.get(`${g.id}:${item}`) ?? ''}
                      label={`${PRIVACY_LABELS[item]} — ${g.name}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {groups.length === 0 && (
        <p className="text-sm text-gray-600">
          Guruh istisnolari guruh yaratilgandan keyin shu jadvalda paydo bo&apos;ladi.
        </p>
      )}
    </main>
  )
}

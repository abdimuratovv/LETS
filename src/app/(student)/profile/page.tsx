import { Avatar } from '@/components/Avatar'
import { requireUser } from '@/lib/auth/guards'
import { ProfileForm } from './profile-form'

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

export default async function ProfilePage() {
  const { profile } = await requireUser()
  const avatar = profile.avatar_config as { base?: string } | null

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md space-y-6 bg-gray-50 p-4 text-gray-900 sm:p-6">
      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-5 flex items-center gap-4">
          <Avatar config={profile.avatar_config} size={72} />
          <h1 className="text-2xl font-semibold">Profil</h1>
        </div>

        <div className="mb-5 text-sm">
          <p className="font-medium">Tug&apos;ilgan kun</p>
          <p className="mt-1 text-base">{profile.birth_date ? formatDate(profile.birth_date) : '—'}</p>
          <p className="mt-1 text-xs text-gray-600">
            O&apos;zgartirish uchun o&apos;qituvchingizga murojaat qiling
          </p>
        </div>

        <ProfileForm
          fullName={profile.full_name ?? ''}
          nickname={profile.nickname ?? ''}
          avatarBase={avatar?.base ?? ''}
          namesLocked={profile.name_edit_locked}
        />
      </section>
    </main>
  )
}

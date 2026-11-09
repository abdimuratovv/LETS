import { AppNav } from '@/components/AppNav'
import { requireTeacher } from '@/lib/auth/guards'

const LINKS = [
  { href: '/teacher', label: 'Bosh sahifa' },
  { href: '/teacher/students', label: "O'quvchilar" },
  { href: '/teacher/groups', label: 'Guruhlar' },
  { href: '/teacher/courses', label: 'Kurslar' },
  { href: '/teacher/privacy', label: 'Maxfiylik' },
]

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  await requireTeacher()
  return (
    <div className="flex min-h-dvh flex-col bg-gray-50 text-gray-900">
      <AppNav links={LINKS} />
      {children}
    </div>
  )
}

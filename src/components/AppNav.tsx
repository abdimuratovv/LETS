import Link from 'next/link'
import { signOut } from '@/app/login/actions'

/** Yuqori navigatsiya: havolalar + "Chiqish" (server action). */
export function AppNav({ links }: { links: { href: string; label: string }[] }) {
  return (
    <header className="border-b border-gray-200 bg-white">
      <nav
        aria-label="Asosiy menyu"
        className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-0 px-1 py-2 sm:gap-1 sm:px-4"
      >
        <span className="mr-1 shrink-0 px-2 text-base sm:mr-2 font-semibold">LETS</span>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="flex min-h-12 shrink-0 items-center rounded-lg px-2 text-sm sm:px-3 font-medium text-gray-700 hover:bg-gray-100"
          >
            {l.label}
          </Link>
        ))}
        <form action={signOut} className="ml-auto shrink-0">
          <button
            type="submit"
            className="min-h-12 rounded-lg px-2 text-sm sm:px-3 font-medium text-gray-700 hover:bg-gray-100"
          >
            Chiqish
          </button>
        </form>
      </nav>
    </header>
  )
}

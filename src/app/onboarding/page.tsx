import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/guards'
import { OnboardingForm } from './onboarding-form'

export default async function OnboardingPage() {
  const { profile } = await requireUser()
  if (profile.role === 'teacher') redirect('/teacher')
  if (profile.onboarding_done) redirect('/home')

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md bg-gray-50 p-4 text-gray-900 sm:p-6">
      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <h1 className="text-2xl font-semibold">Xush kelibsiz!</h1>
        <p className="mb-5 mt-1 text-sm text-gray-600">Profilingizni to&apos;ldiring.</p>
        <OnboardingForm />
      </section>
    </main>
  )
}

import { LoginForm } from './login-form'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>
}) {
  const { archived } = await searchParams

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm sm:p-8">
        <h1 className="mb-6 text-center text-2xl font-semibold">LETS</h1>
        {archived === '1' && (
          <p
            role="alert"
            className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
          >
            Akkauntingiz arxivlangan. O&apos;qituvchingizga murojaat qiling
          </p>
        )}
        <LoginForm />
      </div>
    </main>
  )
}

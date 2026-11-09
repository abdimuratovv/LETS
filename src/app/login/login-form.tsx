'use client'

import { useActionState } from 'react'
import { signIn, type SignInState } from './actions'

const initial: SignInState = { error: null }

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, initial)

  return (
    <form action={action} className="space-y-4">
      <label className="block text-sm font-medium">
        Login
        <input
          name="login"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          required
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-base"
        />
      </label>
      <label className="block text-sm font-medium">
        Parol
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-base"
        />
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-black px-4 py-2.5 text-base font-medium text-white disabled:opacity-60"
      >
        Kirish
      </button>
    </form>
  )
}

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { resolveRoute, type RouteDecision, type RouteUser } from '@/lib/auth/routing'

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> }

export async function proxy(request: NextRequest) {
  const pending: CookieToSet[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach((c) => {
            request.cookies.set(c.name, c.value)
            pending.push(c)
          })
        },
      },
    },
  )

  // Shaxs JWT'dan aniqlanadi (R5): bloklangan o'quvchining hali amaldagi tokeni ham
  // "arxivlangan" xabarini berishi uchun getUser() emas, getClaims() ishlatiladi.
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub

  let user: RouteUser | null = null
  if (userId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, status, onboarding_done')
      .eq('id', userId)
      .maybeSingle()
    if (profile) {
      user = {
        role: profile.role,
        status: profile.status,
        onboardingDone: profile.onboarding_done,
      }
    }
  }

  const path = request.nextUrl.pathname
  // Profili yo'q foydalanuvchi: sessiyani tozalab, kirish sahifasiga.
  const decision: RouteDecision =
    userId && !user
      ? { type: 'redirect', to: '/login', signOut: true }
      : resolveRoute(path, user)

  const applyCookies = (response: NextResponse) => {
    pending.forEach(({ name, value, options }) =>
      response.cookies.set(name, value, options),
    )
    return response
  }

  if (decision.type === 'next') {
    return applyCookies(NextResponse.next({ request }))
  }

  const response = NextResponse.redirect(new URL(decision.to, request.url))

  if (decision.signOut) {
    try {
      await supabase.auth.signOut()
    } catch {
      // Tarmoq xatosi bo'lsa ham lokal cookie'lar quyida tozalanadi.
    }
    applyCookies(response)
    request.cookies
      .getAll()
      .filter((c) => c.name.startsWith('sb-'))
      .forEach((c) => response.cookies.set(c.name, '', { maxAge: 0, path: '/' }))
    return response
  }

  return applyCookies(response)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|avatars/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}

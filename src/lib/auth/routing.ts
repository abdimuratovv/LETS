export type RouteUser = {
  role: 'teacher' | 'student'
  status: 'active' | 'archived'
  onboardingDone: boolean
}

export type RouteDecision =
  | { type: 'next' }
  | { type: 'redirect'; to: string; signOut?: boolean }

const redirect = (to: string): RouteDecision => ({ type: 'redirect', to })
const NEXT: RouteDecision = { type: 'next' }

function isTeacherArea(path: string): boolean {
  return path === '/teacher' || path.startsWith('/teacher/')
}

// R1: o'qituvchi kurs sahifasidan havola/faylni shu yo'l orqali ochadi (ko'rish yozilmaydi).
const RESOURCE_OPEN = /^\/resources\/[^/]+\/open$/

export function resolveRoute(path: string, user: RouteUser | null): RouteDecision {
  if (!user) {
    return path === '/login' ? NEXT : redirect('/login')
  }

  if (user.status === 'archived') {
    return { type: 'redirect', to: '/login?archived=1', signOut: true }
  }

  if (user.role === 'teacher') {
    if (isTeacherArea(path) || RESOURCE_OPEN.test(path)) return NEXT
    return redirect('/teacher')
  }

  // student
  if (!user.onboardingDone) {
    return path === '/onboarding' ? NEXT : redirect('/onboarding')
  }
  if (path === '/login' || path === '/onboarding' || path === '/' || isTeacherArea(path)) {
    return redirect('/home')
  }
  return NEXT
}

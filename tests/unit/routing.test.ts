import { describe, expect, it } from 'vitest'
import { resolveRoute, type RouteUser } from '@/lib/auth/routing'

const teacher: RouteUser = { role: 'teacher', status: 'active', onboardingDone: true }
const student: RouteUser = { role: 'student', status: 'active', onboardingDone: true }
const newStudent: RouteUser = { role: 'student', status: 'active', onboardingDone: false }
const archived: RouteUser = { role: 'student', status: 'archived', onboardingDone: true }

const next = { type: 'next' }
const to = (path: string) => ({ type: 'redirect', to: path })

describe('resolveRoute', () => {
  const cases: Array<[string, string, RouteUser | null, unknown]> = [
    ['anonim /teacher', '/teacher', null, to('/login')],
    ['anonim /login', '/login', null, next],
    ['anonim /home', '/home', null, to('/login')],
    ['anonim /', '/', null, to('/login')],
    ['anonim /onboarding', '/onboarding', null, to('/login')],
    ['arxivlangan /home', '/home', archived, { type: 'redirect', to: '/login?archived=1', signOut: true }],
    ['arxivlangan /login', '/login', archived, { type: 'redirect', to: '/login?archived=1', signOut: true }],
    ['teacher /login', '/login', teacher, to('/teacher')],
    ['student /login', '/login', student, to('/home')],
    ['yangi student /login', '/login', newStudent, to('/onboarding')],
    ['yangi student /home', '/home', newStudent, to('/onboarding')],
    ['yangi student /onboarding', '/onboarding', newStudent, next],
    ['student /onboarding', '/onboarding', student, to('/home')],
    ['student /teacher/students', '/teacher/students', student, to('/home')],
    ['yangi student /teacher', '/teacher', newStudent, to('/onboarding')],
    ['teacher /home', '/home', teacher, to('/teacher')],
    ['teacher /onboarding', '/onboarding', teacher, to('/teacher')],
    ['teacher /teacher', '/teacher', teacher, next],
    ['teacher /teacher/students', '/teacher/students', teacher, next],
    ['student /home', '/home', student, next],
    ['student /groups/1', '/groups/1', student, next],
    ['teacher /', '/', teacher, to('/teacher')],
    ['student /', '/', student, to('/home')],
    ['yangi student /', '/', newStudent, to('/onboarding')],
    ['/teacherx student', '/teacherx', student, next],
    ['student /resources', '/resources', student, next],
    ['teacher /resources', '/resources', teacher, to('/teacher')],
    ['anonim /resources', '/resources', null, to('/login')],
    ['student /resources/1', '/resources/1', student, next],
    ['student /resources/1/open', '/resources/1/open', student, next],
    // R1: o'qituvchi faqat /resources/<id>/open orqali havola/faylni ocha oladi
    ['teacher /resources/1/open', '/resources/1/open', teacher, next],
    ['teacher /resources/1', '/resources/1', teacher, to('/teacher')],
    ['teacher /resources/1/open/x', '/resources/1/open/x', teacher, to('/teacher')],
    ['teacher /resources//open', '/resources//open', teacher, to('/teacher')],
    ['anonim /resources/1/open', '/resources/1/open', null, to('/login')],
  ]

  it.each(cases)('%s', (_name, path, user, expected) => {
    expect(resolveRoute(path, user)).toEqual(expected)
  })
})

import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { adminClient, makeTeacher, resetData } from '../integration/helpers'

// Bitta to'liq ssenariy: o'qituvchi va o'quvchi ikki alohida brauzer kontekstida.
test.describe.configure({ mode: 'serial' })

const TEACHER = { login: 'teacher', password: 'teacher123' }
const STUDENT = { login: 'ali.k', password: 'parol123' }
const CLASSMATE = { login: 'vali.s', password: 'parol123' }

test.beforeAll(async () => {
  await resetData()
  await makeTeacher(TEACHER.login, TEACHER.password)
})

test.afterAll(async () => {
  await resetData()
})

function nav(page: Page, name: string) {
  return page.getByRole('navigation', { name: 'Asosiy menyu' }).getByRole('link', { name, exact: true })
}

async function signIn(page: Page, login: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Login').fill(login)
  await page.getByLabel('Parol').fill(password)
  await page.getByRole('button', { name: 'Kirish' }).click()
}

/** @supabase/ssr sessiya cookie'sidan (bo'laklangan bo'lishi mumkin) access tokenni oladi. */
async function accessToken(context: BrowserContext): Promise<string> {
  const parts = (await context.cookies())
    .filter((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name))
    .sort((a, b) => {
      const n = (name: string) => Number(name.match(/\.(\d+)$/)?.[1] ?? -1)
      return n(a.name) - n(b.name)
    })
  if (parts.length === 0) throw new Error("sessiya cookie'si topilmadi")
  const raw = parts.map((c) => c.value).join('')
  const json = raw.startsWith('base64-')
    ? Buffer.from(raw.slice('base64-'.length), 'base64url').toString('utf8')
    : decodeURIComponent(raw)
  const token = (JSON.parse(json) as { access_token?: string }).access_token
  if (!token) throw new Error("access_token yo'q")
  return token
}

async function studentIdByLogin(login: string): Promise<string> {
  const { data, error } = await adminClient()
    .from('profiles')
    .select('id')
    .eq('login', login)
    .single()
  if (error) throw new Error(error.message)
  return data.id
}

test("asos: o'qituvchi, onboarding, Guruhim, API hiylasi va arxiv", async ({ browser }) => {
  const teacherContext = await browser.newContext()
  const studentContext = await browser.newContext()
  const teacher = await teacherContext.newPage()
  const student = await studentContext.newPage()

  // --- O'qituvchi: kirish, guruh, o'quvchilar ---
  await signIn(teacher, TEACHER.login, TEACHER.password)
  await expect(teacher).toHaveURL(/\/teacher$/)
  await expect(teacher.getByRole('heading', { name: 'Bosh sahifa' })).toBeVisible()

  await nav(teacher, 'Guruhlar').click()
  await expect(teacher).toHaveURL(/\/teacher\/groups$/)
  for (const name of ['7-A', '7-B']) {
    await teacher.getByLabel('Guruh nomi').fill(name)
    await teacher.getByRole('button', { name: "Guruh qo'shish" }).click()
    await expect(teacher.getByRole('status')).toHaveText("Guruh qo'shildi")
    await expect(teacher.getByText(name, { exact: true }).first()).toBeVisible()
  }

  await nav(teacher, "O'quvchilar").click()
  await expect(teacher).toHaveURL(/\/teacher\/students$/)
  for (const s of [STUDENT, CLASSMATE]) {
    await teacher.getByLabel('Login').fill(s.login)
    await teacher.getByLabel('Parol').fill(s.password)
    await teacher.getByLabel('Guruh').first().selectOption({ label: '7-A' })
    await teacher.getByRole('button', { name: "O'quvchi qo'shish" }).click()
    await expect(teacher.getByRole('status')).toBeVisible()
    await expect(teacher.getByRole('link', { name: new RegExp(s.login) })).toBeVisible()
  }

  // Bosh sahifada onboardingni tugatmaganlar ko'rinadi
  await nav(teacher, 'Bosh sahifa').click()
  await expect(teacher).toHaveURL(/\/teacher$/)
  const pendingList = teacher.getByRole('list', { name: 'Onboardingni tugatmaganlar' })
  await expect(pendingList.getByText(STUDENT.login, { exact: true })).toBeVisible()
  await expect(pendingList.getByText(CLASSMATE.login, { exact: true })).toBeVisible()

  // Guruhdosh onboardingni (ma'lumotlar bazasi orqali) tugatgan bo'lsin
  const classmateId = await studentIdByLogin(CLASSMATE.login)
  const { error: mateError } = await adminClient()
    .from('profiles')
    .update({
      full_name: 'Vali Saidov',
      nickname: 'vali',
      birth_date: '2010-03-02',
      avatar_config: { base: 'owl' },
      onboarding_done: true,
    })
    .eq('id', classmateId)
  expect(mateError).toBeNull()

  // --- O'quvchi: kirish -> onboarding -> Guruhim ---
  await signIn(student, STUDENT.login, STUDENT.password)
  await expect(student).toHaveURL(/\/onboarding$/)
  await student.getByLabel('Ism-familiya').fill('Ali Karimov')
  await student.getByLabel("Tug'ilgan kun").fill('2010-05-17')
  await student.getByLabel('Nickname (ixtiyoriy)').fill('ali')
  await student.getByRole('button', { name: 'Tulki' }).click()
  await student.getByRole('button', { name: 'Davom etish' }).click()

  await expect(student).toHaveURL(/\/home$/)
  await expect(student.getByRole('heading', { name: 'Guruhim' })).toBeVisible()
  const mates = student.getByRole('list', { name: "Guruhdoshlar ro'yxati" })
  await expect(mates.getByText('Vali Saidov')).toBeVisible()
  await expect(mates.getByText('@vali')).toBeVisible()

  // --- "Konsol hiylasi" (R7): o'quvchi o'z JWT'i bilan PostgREST'ga to'g'ridan-to'g'ri ---
  const studentId = await studentIdByLogin(STUDENT.login)
  const token = await accessToken(studentContext)
  const attack = await student.evaluate(
    async ({ url, anonKey, token, id }) => {
      const res = await fetch(`${url}/rest/v1/profiles?id=eq.${id}`, {
        method: 'PATCH',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ role: 'teacher' }),
      })
      return { status: res.status, body: await res.text() }
    },
    {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      token,
      id: studentId,
    },
  )
  expect(attack.status).toBeGreaterThanOrEqual(400)
  expect(attack.body).toContain('protected_column')

  const { data: after } = await adminClient()
    .from('profiles')
    .select('role')
    .eq('id', studentId)
    .single()
  expect(after?.role).toBe('student')

  await student.reload()
  await student.goto('/teacher')
  await expect(student).toHaveURL(/\/home$/)
  await student.goto('/teacher/privacy')
  await expect(student).toHaveURL(/\/home$/)

  // --- O'qituvchi: maxfiylik sahifasi ishlaydi ---
  await nav(teacher, 'Maxfiylik').click()
  await expect(teacher).toHaveURL(/\/teacher\/privacy$/)
  await teacher.getByLabel('Avatar — Umumiy').selectOption('nobody')
  await expect(teacher.getByText('Saqlandi').first()).toBeVisible()
  await student.reload()
  await expect(mates.getByText('Vali Saidov')).toBeVisible()
  await expect(mates.getByRole('img', { name: 'Boyo\'g\'li' })).toHaveCount(0)

  // --- O'qituvchi o'quvchini arxivlaydi -> o'quvchi chiqarib yuboriladi ---
  await nav(teacher, "O'quvchilar").click()
  await teacher.getByRole('link', { name: /Ali Karimov/ }).click()
  await expect(teacher).toHaveURL(/\/teacher\/students\/[0-9a-f-]+$/)

  // --- O'qituvchi o'quvchini boshqa guruhga ko'chiradi (spec 5.1) ---
  await teacher.getByLabel('Yangi guruh').selectOption({ label: '7-B' })
  await teacher.getByRole('button', { name: "Ko'chirish" }).click()
  await expect(teacher.getByRole('status').filter({ hasText: "O'quvchi ko'chirildi" })).toBeVisible()
  await expect(teacher.getByText('Hozirgi guruh: 7-B')).toBeVisible()
  const { data: moved } = await adminClient()
    .from('group_memberships')
    .select('groups(name)')
    .eq('student_id', studentId)
    .is('left_at', null)
    .single()
  expect(moved?.groups?.name).toBe('7-B')

  await teacher.getByRole('button', { name: 'Arxivlash' }).click()
  await teacher.getByRole('button', { name: 'Ha, arxivlash' }).click()
  await expect(teacher.getByRole('button', { name: 'Arxivdan tiklash' })).toBeVisible()

  await student.reload()
  await expect(student).toHaveURL(/\/login\?archived=1$/)
  await expect(
    student.getByRole('alert').filter({ hasText: 'Akkauntingiz arxivlangan' }),
  ).toBeVisible()

  await teacherContext.close()
  await studentContext.close()
})

import { expect, test, type Page } from '@playwright/test'
import {
  adminClient,
  makeCourse,
  makeGroup,
  makeStudent,
  makeTeacher,
  resetData,
} from '../integration/helpers'

// Ikki o'quvchi (A, B), bitta kurs: resurs ko'rinishi, yuklab olish va ko'rganlar hisobi.
test.describe.configure({ mode: 'serial' })

const TEACHER = { login: 'teacher', password: 'teacher123' }
const A = { login: 'ali.a', password: 'parol123' }
const B = { login: 'vali.b', password: 'parol123' }

let courseId = ''

test.beforeAll(async () => {
  await resetData()
  await makeTeacher(TEACHER.login, TEACHER.password)
  const course = await makeCourse('Python asoslari')
  courseId = course.id
  const groupA = await makeGroup('7-A')
  const groupB = await makeGroup('7-B')
  await makeStudent(groupA.id, A.login, A.password)
  const b = await makeStudent(groupB.id, B.login, B.password)
  const { error: nameError } = await adminClient()
    .from('profiles')
    .update({ full_name: 'Vali Bobur' })
    .eq('id', b.id)
  if (nameError) throw new Error(nameError.message)
  for (const g of [groupA, groupB]) {
    const { error } = await adminClient()
      .from('group_courses')
      .insert({ group_id: g.id, course_id: course.id })
    if (error) throw new Error(error.message)
  }
})

test.afterAll(async () => {
  await resetData()
})

async function signIn(page: Page, login: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Login').fill(login)
  await page.getByLabel('Parol').fill(password)
  await page.getByRole('button', { name: 'Kirish' }).click()
}

/** Kichik PDF (xotirada, diskka yozilmaydi). */
function tinyPdf(): Buffer {
  return Buffer.from(
    '%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
      '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
  )
}

/** Menyudagi barcha elementlar bir qatorda (bir xil y-chizig'ida). */
async function expectNavOneRow(page: Page) {
  const nav = page.getByRole('navigation', { name: 'Asosiy menyu' })
  const tops = await nav
    .locator('a, button')
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().top))
  expect(tops.length).toBeGreaterThan(2)
  const minTop = Math.min(...tops)
  for (const t of tops) expect(Math.abs(t - minTop)).toBeLessThanOrEqual(8)
}

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)

test("resurslar: o'qituvchi qo'shadi, o'quvchilar ko'radi, hisob yuritiladi", async ({
  browser,
}) => {
  const teacherContext = await browser.newContext()
  const contextA = await browser.newContext()
  const contextB = await browser.newContext()
  const teacher = await teacherContext.newPage()
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()

  // --- O'qituvchi: mavzu va uchta resurs ---
  await signIn(teacher, TEACHER.login, TEACHER.password)
  await expect(teacher).toHaveURL(/\/teacher$/)
  await teacher.goto(`/teacher/courses/${courseId}`)
  await teacher.getByLabel('Mavzu nomi').fill('Kirish darsi')
  await teacher.getByRole('button', { name: "Mavzu qo'shish" }).click()
  await expect(teacher.getByRole('heading', { name: 'Kirish darsi' })).toBeVisible()

  // <summary> yonida ochilish belgisi ko'rinadi
  const marker = await teacher
    .locator('summary', { hasText: "Havola qo'shish" })
    .evaluate((el) => getComputedStyle(el, '::before').content)
  expect(marker).not.toBe('none')
  expect(marker).not.toBe('normal')

  // Hamma uchun havola
  await teacher.locator('summary', { hasText: "Havola qo'shish" }).click()
  await teacher.getByLabel('Havola nomi').fill('Python hujjatlari')
  await teacher.getByLabel('Manzil (URL)').fill('https://docs.python.org/3/')
  await teacher.getByRole('button', { name: "Havolani qo'shish" }).click()
  await expect(teacher.getByText("Havola qo'shildi")).toBeVisible()

  // Faqat 7-A ga konspekt
  await teacher.locator('summary', { hasText: "Konspekt qo'shish" }).click()
  const noteForm = teacher.locator('form', { has: teacher.getByLabel('Konspekt nomi') })
  await noteForm.getByLabel('Konspekt nomi').fill('Birinchi konspekt')
  await noteForm
    .getByLabel('Matn (Markdown)')
    .fill('# Salom dunyo\n\n```python\nprint("salom")\n```\n')
  await noteForm.getByLabel('Faqat tanlangan guruhlar').check()
  await noteForm.getByLabel('7-A').check()
  await noteForm.getByRole('button', { name: "Konspektni qo'shish" }).click()
  await expect(teacher.getByText("Konspekt qo'shildi")).toBeVisible()

  // Faqat 7-A ga PDF
  await teacher.locator('summary', { hasText: "Fayl qo'shish" }).click()
  const fileForm = teacher.locator('form', { has: teacher.getByLabel('Fayl nomi') })
  await fileForm.getByLabel('Fayl nomi').fill('Dars PDF')
  await fileForm.getByLabel('Fayl (50 MB gacha)').setInputFiles({
    name: 'dars.pdf',
    mimeType: 'application/pdf',
    buffer: tinyPdf(),
  })
  await fileForm.getByLabel('Faqat tanlangan guruhlar').check()
  await fileForm.getByLabel('7-A').check()
  await fileForm.getByRole('button', { name: 'Faylni yuklash' }).click()
  await expect(teacher.getByText("Fayl qo'shildi")).toBeVisible()

  // --- O'quvchi A: uchala resurs ---
  await signIn(pageA, A.login, A.password)
  await expect(pageA).toHaveURL(/\/home$/)
  await expectNavOneRow(pageA)
  await pageA.getByRole('link', { name: 'Resurslar', exact: true }).click()
  await expect(pageA).toHaveURL(/\/resources/)
  await expect(pageA.getByRole('link', { name: /Python hujjatlari/ })).toBeVisible()
  await expect(pageA.getByRole('link', { name: /Birinchi konspekt/ })).toBeVisible()
  await expect(pageA.getByRole('link', { name: /Dars PDF/ })).toBeVisible()
  expect(await noHorizontalScroll(pageA)).toBe(true)

  // --- O'quvchi B: faqat havola ---
  await signIn(pageB, B.login, B.password)
  await expect(pageB).toHaveURL(/\/home$/)
  await pageB.goto('/resources')
  await expect(pageB.getByRole('link', { name: /Python hujjatlari/ })).toBeVisible()
  await expect(pageB.getByRole('link', { name: /Birinchi konspekt/ })).toHaveCount(0)
  await expect(pageB.getByRole('link', { name: /Dars PDF/ })).toHaveCount(0)

  // --- A konspektni ochadi ---
  await pageA.getByRole('link', { name: /Birinchi konspekt/ }).click()
  await expect(pageA.getByRole('heading', { name: 'Salom dunyo' })).toBeVisible()
  await expect(pageA.locator('pre code')).toContainText('print("salom")')
  expect(await noHorizontalScroll(pageA)).toBe(true)

  // --- A PDF ni yuklab oladi ---
  await pageA.goto('/resources')
  const [download] = await Promise.all([
    pageA.waitForEvent('download'),
    pageA.getByRole('link', { name: /Dars PDF/ }).click(),
  ])
  expect(download.suggestedFilename()).toBe('dars.pdf')
  await download.cancel().catch(() => {})

  // --- A havolani ochadi (tashqi saytga o'tmasdan: yo'naltirishni to'xtatamiz) ---
  const linkHref = await pageA
    .getByRole('link', { name: /Python hujjatlari/ })
    .getAttribute('href')
  const opened = await pageA.request.get(linkHref!, { maxRedirects: 0 })
  expect(opened.status()).toBeGreaterThanOrEqual(300)
  expect(opened.status()).toBeLessThan(400)

  // --- O'qituvchi: hisob va "Ko'rmaganlar" ---
  await teacher.goto(`/teacher/courses/${courseId}`)
  const pdfItem = teacher.getByRole('listitem').filter({ hasText: 'Dars PDF' })
  await expect(pdfItem.getByText('1/1', { exact: true })).toBeVisible()

  const linkItem = teacher.getByRole('listitem').filter({ hasText: 'Python hujjatlari' })
  await expect(linkItem.getByText('1/2', { exact: true })).toBeVisible()
  await linkItem.locator('summary', { hasText: /Ko'rmaganlar/ }).click()
  await expect(linkItem.getByRole('list', { name: "Ko'rmaganlar" })).toContainText('Vali Bobur')

  await teacherContext.close()
  await contextA.close()
  await contextB.close()
})

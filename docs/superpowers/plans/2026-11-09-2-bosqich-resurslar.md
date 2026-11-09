# 2-bosqich (Resurslar) — amalga oshirish rejasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Maqsad:** o'qituvchi kurs mavzulariga havola, fayl va konspekt resurslarini qo'shadi; o'quvchi o'z guruhi uchun ochiq resurslarni ko'radi va ochadi; o'qituvchi kim ko'rganini biladi.

**Arxitektura:** 1-bosqichdagi naqsh davom etadi: har bir modulda `service.ts` (klientni parametr sifatida oladi, `Result` qaytaradi) va `actions.ts` (ruxsatni tekshiradigan yupqa qatlam). Resursga kirish qoidasi ma'lumotlar bazasida (`can_access_resource` + RLS) turadi va Storage siyosatlari ham shu funksiyadan foydalanadi. Fayllar brauzerdan to'g'ridan-to'g'ri Storage'ga imzolangan havola orqali yuklanadi.

**Texnologiyalar:** mavjud stek + `react-markdown`, `remark-gfm`. Yangi `admin` klient ishlatilmaydi.

**Spec:** `docs/superpowers/specs/2026-11-08-oquv-platformasi-design.md` (4.1 resurslar jadvallari, 5.4)

**Oldingi bosqichdan foydalaniladigan narsalar:** `requireUser()`, `requireTeacher()` (`src/lib/auth/guards.ts`), `Result`/`ok`/`err`/`errorMessage` (`src/lib/result.ts`), `createServerClient()`, `createBrowserClient()`, `is_teacher()`, `active_group_id()`, `AppNav`, `tests/integration/helpers.ts` (`adminClient`, `resetData`, `makeGroup`, `makeTeacher`, `signInAs`), pgTAP `tests.create_user/authenticate_as/clear_auth`, `createCourse`, `assignGroupToCourse`, `moveStudent`, `createStudent`.

## Global cheklovlar

- Interfeys tili o'zbek (lotin); telefon va noutbukda bir xil qulay; tugmalar telefonda kamida 48 px.
- Har bir yangi jadvalda RLS yoqilgan; siyosatlar jadval bilan bir migratsiyada.
- Fayl hajmi 50 MB gacha (`52428800` bayt). Ruxsat etilgan kengaytmalar: `pdf ppt pptx doc docx xls xlsx txt md csv json zip py js ts jsx tsx html css java c cpp cs sql png jpg jpeg gif webp` (katta-kichik harf farq qilmaydi). Boshqalari rad etiladi.
- Havola faqat `http:` yoki `https:`. Konspektda xom HTML ishlamaydi (`rehype-raw` ishlatilmaydi).
- Storage yo'li: `<topic_id>/<uuid>.<kengaytma>`; foydalanuvchi fayl nomi yo'lga kirmaydi.
- Yuklab olish havolasi 60 soniyalik, `download` rejimida (brauzer faylni ochmaydi, saqlaydi).
- Resurs odatda kursning barcha guruhlariga ochiq; `resource_groups` bo'sh bo'lmasa faqat shu guruhlarga.
- Mavzu faqat bo'sh bo'lsa o'chiriladi. Resurs o'chirilganda uning Storage fayli ham o'chadi.
- O'quvchi ko'rishlari: resursni birinchi ochganda yoziladi, takror ochish hech narsani o'zgartirmaydi.
- `devIndicators: false` saqlanadi.

## Review Focus

1. **Cheklangan resurs oqishi:** A guruhiga cheklangan resurs B guruhi o'quvchisiga ro'yxatda, to'g'ridan-to'g'ri so'rovda ham, Storage'dan imzolangan havola olishda ham ko'rinmaydi (Task 1, Task 3).
2. **Zararli kirish:** konspektda `<script>`, `javascript:` havola; havola sifatida `javascript:alert(1)` yoki `ftp://` rad etiladi (Task 2).
3. **Fayl turi va hajmi:** `Dars.PDF` qabul qilinadi; `virus.exe`, `a.pdf.exe`, kengaytmasiz fayl, 0 bayt va 50 MB dan katta fayl rad etiladi (Task 2).
4. **Resurs bor mavzuni o'chirish** rad etiladi va resurs hamda fayl yo'qolmaydi (Task 3).
5. **Takror ochish:** bir resursni ikki marta ochish bitta ko'rish yozuvi qoldiradi va `first_viewed_at` o'zgarmaydi; o'qituvchi hisobi to'g'ri (Task 4).

---

## Fayllar tuzilmasi

```
supabase/migrations/20261109000004_resources.sql        # jadvallar, can_access_*, RLS
supabase/migrations/20261109000005_resources_storage.sql # bucket va storage siyosatlari
supabase/tests/05_resources.test.sql                    # mavjud tartib raqamidan keyingisi
src/modules/resources/{validation.ts, service.ts, actions.ts, path.ts}
src/modules/topics/{service.ts, actions.ts}
src/components/{NoteMarkdown.tsx, FileUploadForm.tsx}
src/app/teacher/courses/[courseId]/page.tsx              # mavzular va resurslar boshqaruvi
src/app/(student)/resources/page.tsx
src/app/(student)/resources/[id]/page.tsx                # konspekt
src/app/(student)/resources/[id]/open/route.ts           # havola va fayl uchun
tests/unit/resources-validation.test.ts, tests/unit/note-markdown.test.ts
tests/integration/{topics,resources,resource-access}.test.ts
tests/e2e/resources.spec.ts
```

---

### Task 1: Resurslar sxemasi, kirish qoidalari va Storage (DB)

**Files:**
- Create: `supabase/migrations/20261109000004_resources.sql`, `supabase/migrations/20261109000005_resources_storage.sql`, `supabase/tests/05_resources.test.sql`
- Modify: `src/types/database.ts` (`npm run db:types`)

**Interfaces:**
- Consumes: `courses`, `groups`, `group_courses`, `group_memberships`, `profiles`, `is_teacher()`, `active_group_id(uid)`
- Produces (SQL):
  - Enum `resource_type ('link','file','note')`
  - `topics` (`id`, `course_id` → `courses` on delete restrict, `title` check 2–120 belgi, `position int`, `created_at`); indeks `course_id`
  - `resources` (`id`, `topic_id` → `topics` on delete restrict, `type resource_type`, `title` check 2–120, `url`, `storage_path` unique, `file_name`, `file_size bigint`, `body_md`, `position int`, `created_at`, `updated_at`); check: `link` → faqat `url`; `file` → faqat `storage_path`, `file_name`, `file_size`; `note` → faqat `body_md`
  - `resource_groups` (`resource_id` → on delete cascade, `group_id` → on delete cascade, PK ikkalasi)
  - `resource_views` (`student_id` → `profiles` on delete cascade, `resource_id` → on delete cascade, `first_viewed_at timestamptz default now()`, PK `(student_id, resource_id)`)
  - `can_access_course(uid uuid, cid uuid) returns boolean` — `active_group_id(uid)` guruhi shu kursni `group_courses` da (tarix ham) o'tgan bo'lsa true; security definer, stable
  - `can_access_resource(uid uuid, rid uuid) returns boolean` — `can_access_course` va (`resource_groups` bo'sh yoki `active_group_id(uid)` ularda); security definer, stable
  - Ikkala funksiyaga `authenticated` roliga execute huquqi beriladi
  - RLS: `topics` select — `is_teacher() or can_access_course(auth.uid(), course_id)`; `resources` select — `is_teacher() or can_access_resource(auth.uid(), id)`; ikkalasida yozish — `is_teacher()`. `resource_groups` — hamma amal faqat `is_teacher()`. `resource_views` select — `student_id = auth.uid() or is_teacher()`; insert — `student_id = auth.uid() and can_access_resource(auth.uid(), resource_id)`; update/delete siyosati yo'q.
  - Bucket `resources` (private, `file_size_limit = 52428800`); `storage.objects` siyosatlari: insert va delete — `bucket_id = 'resources' and is_teacher()`; select — `bucket_id = 'resources'` va (`is_teacher()` yoki `name` bo'yicha `resources.storage_path` topilib `can_access_resource(auth.uid(), id)` true)

- [ ] **Step 1: Failing pgTAP test yozing** — `05_resources.test.sql`. Ma'lumot: kurs `CS` (mavzu `T1`), guruh A va B ikkalasi `CS` ga biriktirilgan, kurs `FE` (mavzu `T2`) hech bir guruhga biriktirilmagan, o'quvchilar `a1` (A), `b1` (B), o'qituvchi `t`. Resurslar: `r_open` (hamma uchun, `T1`), `r_a` (faqat A, `T1`), `r_fe` (`T2`), fayl resursi `r_file` (`storage_path = 'T1/x.pdf'`, `objects` ga qator qo'shilgan, faqat A).
  - `a1` ko'radi: `r_open`, `r_a`, `r_file` (3 qator); `b1` faqat `r_open` (1 qator); ikkalasi ham `r_fe` va `T2` ni ko'rmaydi (0 qator).
  - `t` hammasini ko'radi.
  - `b1` `storage.objects` dan `T1/x.pdf` ni ko'rmaydi (0 qator); `a1` ko'radi (1); `t` ko'radi.
  - `a1` `resources` ga insert qila olmaydi (RLS xatosi); `a1` `storage.objects` ga insert qila olmaydi.
  - `b1` `r_a` uchun `resource_views` insert qila olmaydi (xato); `b1` `r_open` uchun qila oladi; `a1` nomidan `b1` uchun insert (`student_id = b1`) xato.
  - `moveStudent` analogi: `a1` ning faol a'zoligini B ga o'zgartirgach (`left_at`, yangi a'zolik) `r_a` ko'rinmay qoladi, `r_open` qoladi.
  - Check: `link` turida `storage_path` berilsa xato; `note` turida `body_md = null` xato; `title = 'a'` xato.
  - Mavzusida resursi bor `topics` qatorini o'chirish xato (`restrict`).
  - `resource_views` ikkinchi insert (`on conflict do nothing`) qator sonini oshirmaydi.
- [ ] **Step 2:** `npx supabase test db` — FAIL.
- [ ] **Step 3:** Ikkala migratsiyani yozing.
- [ ] **Step 4:** `npx supabase db reset && npx supabase test db` — hammasi PASS (oldingi 101 ta ham); `npm run db:types`.
- [ ] **Step 5:** Commit: `feat(db): resurslar sxemasi, kirish qoidalari va storage`

---

### Task 2: Validatsiya, yo'l yordamchisi va xavfsiz Markdown

**Files:**
- Create: `src/modules/resources/validation.ts`, `src/modules/resources/path.ts`, `src/components/NoteMarkdown.tsx`
- Test: `tests/unit/resources-validation.test.ts`, `tests/unit/note-markdown.test.ts`

**Interfaces:**
- Produces:
  - `MAX_FILE_BYTES = 52428800`, `ALLOWED_EXTENSIONS: readonly string[]` (global cheklovlardagi ro'yxat)
  - `titleSchema` (trim, 2–120), `urlSchema` (trim, faqat `http:`/`https:`, ko'pi bilan 2000 belgi), `noteBodySchema` (1–50000 belgi)
  - `validateUpload(input: { name: string; size: number }): Result<{ ext: string }, 'invalid_file' | 'file_too_large'>` — kengaytma faqat oxirgi nuqtadan keyingisi, kichik harfga keltiriladi
  - `buildStoragePath(topicId: string, ext: string): string` → `` `${topicId}/${crypto.randomUUID()}.${ext}` ``
  - `<NoteMarkdown source={string} />` — `react-markdown` + `remark-gfm`, xom HTML yo'q; havolalar `target="_blank" rel="noopener noreferrer"`; kod bloklari `<pre><code>` ichida gorizontal aylanadigan
  - Xato kodlari `result.ts` ga o'zbekcha matn bilan: `invalid_title`, `invalid_url`, `invalid_body`, `invalid_file` ("Bu turdagi fayl ruxsat etilmagan"), `file_too_large` ("Fayl 50 MB dan katta")

- [ ] **Step 1: Failing testlar yozing**

```ts
// resources-validation.test.ts
expect(urlSchema.safeParse(' https://youtu.be/abc ').data).toBe('https://youtu.be/abc')
for (const bad of ['javascript:alert(1)', 'ftp://x.uz/a', 'google.com', '', 'data:text/html,x'])
  expect(urlSchema.safeParse(bad).success).toBe(false)
expect(titleSchema.safeParse('a').success).toBe(false)
expect(titleSchema.parse('  Python asoslari ')).toBe('Python asoslari')
expect(titleSchema.safeParse('x'.repeat(121)).success).toBe(false)
expect(noteBodySchema.safeParse('').success).toBe(false)
expect(noteBodySchema.safeParse('x'.repeat(50001)).success).toBe(false)
expect(validateUpload({ name: 'Dars1.PDF', size: 1000 })).toEqual({ ok: true, data: { ext: 'pdf' } })
for (const name of ['virus.exe', 'a.pdf.exe', 'noext', 'x.'])
  expect(validateUpload({ name, size: 10 })).toEqual({ ok: false, error: 'invalid_file' })
expect(validateUpload({ name: 'a.pdf', size: 0 })).toEqual({ ok: false, error: 'invalid_file' })
expect(validateUpload({ name: 'a.pdf', size: 52428801 })).toEqual({ ok: false, error: 'file_too_large' })
expect(buildStoragePath('t-1', 'pdf')).toMatch(/^t-1\/[0-9a-f-]{36}\.pdf$/)

// note-markdown.test.ts  (renderToStaticMarkup, vitest muhiti node)
expect(html('<script>alert(1)</script>')).not.toContain('<script')
expect(html('[x](javascript:alert(1))')).not.toContain('javascript:')
expect(html('**a**')).toContain('<strong>a</strong>')
expect(html('```py\nprint(1)\n```')).toContain('<pre')
expect(html('[x](https://a.uz)')).toContain('rel="noopener noreferrer"')
```

- [ ] **Step 2:** `npm test` — FAIL.
- [ ] **Step 3:** `npm i react-markdown remark-gfm`; fayllarni yozing.
- [ ] **Step 4:** `npm test` — PASS.
- [ ] **Step 5:** Commit: `feat: resurs validatsiyasi va xavfsiz Markdown`

---

### Task 3: Mavzular (o'qituvchi)

**Files:**
- Create: `src/modules/topics/service.ts`, `src/modules/topics/actions.ts`, `src/app/teacher/courses/[courseId]/page.tsx`
- Modify: `src/app/teacher/courses/page.tsx` (har bir kurs "Mavzular va resurslar" havolasi), `tests/integration/helpers.ts` (`makeCourse(title)`, `makeStudent(groupId): Promise<{ id; login; password }>` — mavjud bo'lmasa)
- Test: `tests/integration/topics.test.ts`

**Interfaces:**
- Consumes: `requireTeacher`, `Result`
- Produces:
  - `type TopicError = 'invalid_title' | 'course_not_found' | 'not_found' | 'topic_not_empty' | 'forbidden'`
  - `type Topic = { id: string; courseId: string; title: string; position: number }`
  - `listTopics(db, courseId: string): Promise<Topic[]>` (`position` bo'yicha)
  - `createTopic(db, { courseId: string; title: string }): Promise<Result<{ id: string }, TopicError>>` — `position` = oxirgi + 1
  - `renameTopic(db, topicId: string, title: string): Promise<Result<null, TopicError>>`
  - `moveTopic(db, topicId: string, direction: 'up' | 'down'): Promise<Result<null, TopicError>>` — qo'shni bilan `position` almashadi; chetda bo'lsa hech narsa o'zgarmaydi va `ok`
  - `deleteTopic(db, topicId: string): Promise<Result<null, TopicError>>` — resursi bo'lsa `topic_not_empty`
  - RLS rad etishi (`42501`) `forbidden` ga aylantiriladi
  - Xato matnlari: `topic_not_empty` → "Mavzuda resurslar bor. Avval ularni o'chiring", `course_not_found` → "Kurs topilmadi"

- [ ] **Step 1: Failing integratsion testlar yozing:** ikki mavzu yaratilganda `position` 1 va 2; `moveTopic(second,'up')` dan keyin tartib almashgan, birinchini `'up'` qilish hech narsani o'zgartirmaydi; `renameTopic` bo'sh nom (`' '`) → `invalid_title`; bo'sh mavzu o'chadi; ichida resurs (admin klient bilan to'g'ridan-to'g'ri qo'shilgan) bo'lgan mavzu → `topic_not_empty` va mavzu saqlanib qoladi; o'quvchi sessiyasi bilan `createTopic` → `{ ok: false, error: 'forbidden' }`; mavjud bo'lmagan `courseId` → `course_not_found`.
- [ ] **Step 2:** `npm run test:int` — FAIL.
- [ ] **Step 3:** Service va actions (`requireTeacher()` → service → `revalidatePath`).
- [ ] **Step 4:** Sahifa `/teacher/courses/[courseId]`: kurs nomi, mavzular ro'yxati (yuqoriga/pastga, nomini o'zgartirish, o'chirish tugmalari), "Mavzu qo'shish" formasi. O'chirish tasdiqlash oynasi bilan.
- [ ] **Step 5:** `npm run test:int` — PASS.
- [ ] **Step 6:** Commit: `feat: kurs mavzularini boshqarish`

---

### Task 4: Resurslar (o'qituvchi) va o'quvchi tomoni

**Files:**
- Create: `src/modules/resources/service.ts`, `src/modules/resources/actions.ts`, `src/components/FileUploadForm.tsx`, `src/app/(student)/resources/page.tsx`, `src/app/(student)/resources/[id]/page.tsx`, `src/app/(student)/resources/[id]/open/route.ts`
- Modify: `src/app/teacher/courses/[courseId]/page.tsx` (har bir mavzu ostida resurslar), `src/components/AppNav.tsx` (o'quvchi uchun "Resurslar"), `src/lib/auth/routing.ts` testi (`tests/unit/routing.test.ts` ga qatorlar)
- Test: `tests/integration/resources.test.ts`, `tests/integration/resource-access.test.ts`

**Interfaces:**
- Consumes: Task 1 jadvallari, Task 2 validatsiyasi va `buildStoragePath`, Task 3 `Topic`, `requireUser`, `requireTeacher`
- Produces:
  - `type ResourceError = 'invalid_title' | 'invalid_url' | 'invalid_body' | 'invalid_file' | 'file_too_large' | 'invalid_group' | 'topic_not_found' | 'not_found' | 'forbidden'`
  - `type Resource = { id: string; topicId: string; type: 'link' | 'file' | 'note'; title: string; url: string | null; fileName: string | null; fileSize: number | null; bodyMd: string | null; position: number; groupIds: string[] }`
  - O'qituvchi (o'qituvchi sessiyasi bilan):
    - `createLinkResource(db, { topicId, title, url, groupIds?: string[] }): Promise<Result<{ id: string }, ResourceError>>`
    - `createNoteResource(db, { topicId, title, bodyMd, groupIds?: string[] }): Promise<Result<{ id: string }, ResourceError>>`
    - `prepareFileUpload(db, { topicId, fileName, fileSize }): Promise<Result<{ path: string; token: string }, ResourceError>>` — `validateUpload`, `buildStoragePath`, `db.storage.from('resources').createSignedUploadUrl(path)`
    - `registerFileResource(db, { topicId, title, path, fileName, fileSize, groupIds?: string[] }): Promise<Result<{ id: string }, ResourceError>>` — `path` `topicId + '/'` bilan boshlanishi va Storage'da mavjud bo'lishi shart, aks holda `invalid_file`
    - `updateResource(db, id, patch: { title?: string; url?: string; bodyMd?: string; groupIds?: string[] }): Promise<Result<null, ResourceError>>`
    - `moveResource(db, id, direction: 'up' | 'down')`, `deleteResource(db, id)` — fayl bo'lsa Storage obyekti ham o'chadi
    - `listResourcesForTopic(db, topicId: string): Promise<Resource[]>`
    - `getResourceViewStats(db, resourceId: string): Promise<Result<{ viewed: number; total: number; notViewed: { id: string; fullName: string }[] }, 'not_found'>>` — `total` = resursga ruxsatli guruhlarning (`resource_groups` bor bo'lsa shular, aks holda kursni o'tgan guruhlar) faol o'quvchilari soni
  - O'quvchi (o'quvchi sessiyasi bilan):
    - `listMyCourses(db): Promise<{ id: string; title: string; current: boolean }[]>` — faol guruhning `group_courses` kurslari, `current` = `ended_at` null
    - `listCourseResources(db, courseId: string): Promise<{ id: string; title: string; resources: { id: string; type: 'link' | 'file' | 'note'; title: string; fileName: string | null; fileSize: number | null; viewed: boolean }[] }[]>`
    - `getResourceForViewing(db, id: string): Promise<Result<Resource, 'not_found'>>`
    - `recordView(db, resourceId: string): Promise<void>` — `insert ... on conflict do nothing`
    - `getFileDownloadUrl(db, resourceId: string): Promise<Result<{ url: string }, 'not_found'>>` — `createSignedUrl(path, 60, { download: fileName })`
  - `GET /resources/[id]/open`: `requireUser()`; resurs ko'rinmasa 404; `link` → `recordView` va `redirect(url)`; `file` → `recordView` va imzolangan havolaga redirect; `note` → `/resources/[id]` ga redirect. O'qituvchi roli uchun `recordView` chaqirilmaydi.
  - `groupIds` tekshiruvi: har biri `groups` da bo'lishi shart, aks holda `invalid_group`

- [ ] **Step 1: Failing integratsion testlar yozing** (`resources.test.ts`, o'qituvchi sessiyasi):
  - `createLinkResource` to'g'ri URL → ok; `'javascript:alert(1)'` → `invalid_url`; bo'sh nom → `invalid_title`; mavjud bo'lmagan `groupId` → `invalid_group`.
  - `createNoteResource` bo'sh matn → `invalid_body`.
  - `prepareFileUpload({ fileName: 'a.exe' })` → `invalid_file`; `'a.pdf'` + 52428801 bayt → `file_too_large`; to'g'ri holatda `path` `topicId/…​.pdf` ko'rinishida. Qaytgan `token` bilan 1 KB test fayli `uploadToSignedUrl` orqali yuklanadi, so'ng `registerFileResource` ok va `listResourcesForTopic` da `fileName = 'a.pdf'`.
  - `registerFileResource` yuklanmagan yo'l bilan → `invalid_file`; boshqa mavzu yo'li bilan → `invalid_file`.
  - `moveResource` tartibni almashtiradi; `deleteResource` (fayl) dan keyin Storage'da obyekt yo'q.

  `resource-access.test.ts` (A va B guruhlari bitta kursda, `makeStudent`):
  - Hamma uchun ochiq resurs ikkala o'quvchiga ko'rinadi; A ga cheklangan resurs B ga `listCourseResources` va `getResourceForViewing` (`not_found`) da ko'rinmaydi.
  - B o'quvchisi A ga cheklangan fayl uchun `getFileDownloadUrl` → `not_found`; A o'quvchisi → ok va olingan URL `fetch` qilinganda 200.
  - Kursga hech qachon biriktirilmagan guruh o'quvchisi resursni ko'rmaydi; `listMyCourses` uning uchun bo'sh.
  - `recordView` ikki marta chaqirilsa `resource_views` da bitta qator va `first_viewed_at` o'zgarmagan; `listCourseResources` da `viewed: true`.
  - `getResourceViewStats`: 2 ta o'quvchidan 1 tasi ko'rgan → `{ viewed: 1, total: 2, notViewed: [ikkinchisi] }`; resurs A ga cheklangan bo'lsa `total` faqat A o'quvchilari; arxivlangan o'quvchi hisobga kirmaydi.
  - O'quvchi guruhi o'zgartirilgach (`moveStudent` B ga) A ga cheklangan resursni ko'rmay qoladi.
  - O'quvchi sessiyasi bilan `createLinkResource` → `forbidden`.

  `tests/unit/routing.test.ts` ga: `/resources` — faol o'quvchi → `next`; o'qituvchi → redirect `/teacher`; sessiyasiz → redirect `/login`.
- [ ] **Step 2:** `npm run test:int && npm test` — FAIL.
- [ ] **Step 3:** `service.ts` va `actions.ts` (`prepareFileUpload`, `registerFileResource` va boshqa o'qituvchi actionlari `requireTeacher()` bilan; `revalidatePath`). `FileUploadForm` (client): fayl tanlanganda `validateUpload` bilan darhol tekshiradi → `prepareFileUpload` → `createBrowserClient().storage.from('resources').uploadToSignedUrl(path, token, file)` → `registerFileResource`; yuklash jarayoni foizi yoki "Yuklanmoqda…" ko'rsatiladi; xatoda matn.
- [ ] **Step 4:** O'qituvchi sahifasi (`/teacher/courses/[courseId]`) kengaytiriladi: har bir mavzu ostida resurslar (tur belgisi, nom, ko'rganlar "5/14", yuqoriga/pastga, tahrirlash, o'chirish), "Havola / Konspekt / Fayl qo'shish" formalari, guruh cheklovi: "Barcha guruhlar" (boshlang'ich) yoki tanlangan guruhlar katakchalari. Konspekt matni `<details>` ichida `NoteMarkdown` bilan ko'rinadi. "Ko'rmaganlar" ro'yxati ochiladigan blokda.
- [ ] **Step 5:** O'quvchi sahifalari: `/resources` — joriy kurs mavzulari va resurslari (tur belgisi, ko'rilmaganlari nuqta bilan), kurslar bir nechta bo'lsa `?course=` orqali oldingi kurslarga o'tish; kursi yo'q bo'lsa "Guruhingizga hali kurs biriktirilmagan". Har bir resurs `/resources/[id]/open` ga havola; `/resources/[id]` konspektni `NoteMarkdown` bilan ko'rsatadi va `recordView` chaqiradi, resurs ko'rinmasa `notFound()`. `AppNav` ga "Resurslar".
- [ ] **Step 6:** `npm run test:int && npm test` — PASS.
- [ ] **Step 7:** Commit: `feat: resurslar (havola, fayl, konspekt) va o'quvchi ko'rinishi`

---

### Task 5: E2E va yakuniy tekshiruv

**Files:**
- Create: `tests/e2e/resources.spec.ts`

- [ ] **Step 1: Failing E2E yozing** (ikki o'quvchi konteksti A va B, bitta kurs; mobil viewport 390×844 ham):
  - O'qituvchi mavzu yaratadi, "Hamma uchun" havola, faqat A ga cheklangan konspekt va kichik PDF faylni (`setInputFiles`) qo'shadi.
  - O'quvchi A `/resources` da uchala resursni ko'radi; B faqat havolani.
  - A konspektni ochadi (sarlavha va kod bloki ko'rinadi), PDF ni bosganda yuklab olish (`download` hodisasi) boshlanadi.
  - O'qituvchi sahifasida PDF yonida "1/…" ko'rinadi va "Ko'rmaganlar" ro'yxatida B turadi.
  - Telefon o'lchamida `/resources` da gorizontal aylantirish paydo bo'lmaydi (`document.documentElement.scrollWidth <= innerWidth`).
- [ ] **Step 2:** `npm run test:e2e` — FAIL, keyin kerakli tuzatishlar (faqat test topgan kamchiliklar).
- [ ] **Step 3:** To'liq tekshiruv: `npx supabase db reset`, `npx supabase test db`, `npm test`, `npm run test:int`, `npm run test:e2e`, `npx tsc --noEmit`, `npm run lint`, `npm run build` — hammasi toza.
- [ ] **Step 4:** Commit: `test: resurslar E2E`

---

## Hozircha kiritilmaydi

- Yuklangan, lekin ro'yxatdan o'tmagan (yetim) fayllarni avtomatik tozalash.
- Konspekt uchun jonli ko'rinish (preview) va kod sintaksisini bo'yash.
- Resurslarni sudrab tartiblash (hozir yuqoriga/pastga tugmalari).
- YouTube videolarni sahifa ichiga joylash (hozir oddiy havola).
- Resursni boshqa mavzuga ko'chirish.

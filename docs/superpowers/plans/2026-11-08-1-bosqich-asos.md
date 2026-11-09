# 1-bosqich (Asos) — amalga oshirish rejasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Maqsad:** o'qituvchi kurs, guruh va o'quvchi akkauntlarini boshqaradigan, o'quvchi birinchi kirishda profilini to'ldiradigan va maxfiylik sozlamalari ma'lumotlar bazasi darajasida ishlaydigan platforma asosini qurish.

**Arxitektura:** Next.js (App Router) server actions orqali Supabase bilan ishlaydi. Ma'lumotlar xavfsizligi Postgres RLS, triggerlar va `security definer` funksiyalar bilan ta'minlanadi; maxfiy amallar (akkaunt yaratish, arxivlash) faqat serverda `service_role` kaliti bilan. Har bir modulda `service.ts` (Supabase klientini parametr sifatida oladigan, test qilinadigan mantiq) va `actions.ts` (ruxsatni tekshirib, service'ni chaqiradigan yupqa qatlam) bor.

**Texnologiyalar:** Next.js 16, TypeScript, Tailwind CSS, `@supabase/ssr`, `@supabase/supabase-js`, zod, Vitest (unit va integratsion), Supabase CLI + pgTAP (`supabase test db`), Playwright (E2E). Lokal Supabase uchun Docker kerak.

**Spec:** `docs/superpowers/specs/2026-11-08-oquv-platformasi-design.md` (2, 3, 4.1, 5.1–5.3, 6, 7-bo'limlar)

## Global cheklovlar

- Interfeys tili: o'zbek (lotin). Telefon va noutbukda bir xil qulay (responsive).
- `next.config.ts` da `devIndicators: false`.
- Har bir jadvalda RLS yoqilgan. `service_role` kaliti faqat serverda (`src/lib/supabase/admin.ts`), hech qachon `NEXT_PUBLIC_` o'zgaruvchida emas.
- Ikki rol: `teacher`, `student`. Ro'yxatdan o'tish sahifasi va "parolni unutdim" yo'q.
- Texnik email: `<login>@students.platforma.local`. O'quvchi uni hech qayerda ko'rmaydi.
- Arxivlangan o'quvchi kira olmaydi; ma'lumotlari saqlanadi; ro'yxatlarda ko'rinmaydi.
- Onboarding: ism-familiya (majburiy), tug'ilgan kun (majburiy), nickname (ixtiyoriy), avatar (hayvonlar to'plamidan). Rasm yuklash yo'q.
- Tug'ilgan kunni o'quvchi bir marta kiritadi, keyin faqat o'qituvchi o'zgartiradi. Boshqalarga faqat kun va oy ko'rinadi.
- Ism/nickname o'zgarishlari tarixga yoziladi; o'qituvchi qaytaradi yoki tahrirni bloklaydi.
- Maxfiylik elementlari: `avatar`, `online_status`, `stats`, `badges`, `birthday`. Qiymatlar: `everyone` / `own_group` / `nobody`. Boshlang'ich: `badges` → `everyone`, qolganlari → `own_group`. Guruh bo'yicha istisno target o'quvchining guruhiga qo'llanadi.
- Ism-familiya o'z guruhiga doim ko'rinadi; boshqa guruhga faqat kamida bitta element ko'rinadigan bo'lsa.
- Bir o'quvchida bir vaqtda bitta faol guruh a'zoligi; bir guruhda bir vaqtda bitta faol kurs.

## Review Focus

1. **Login yozilishi:** o'qituvchi `" Ali.Karimov "` deb kiritsa, login `ali.karimov` sifatida saqlanadi va o'quvchi `ALI.karimov` bilan ham kira oladi (Task 4, Task 6).
2. **O'zbekcha ismlar:** `O'g'iloy Ne'matova`, `Oʻgʻiloy`, `Gʻayrat`, `Ma'mura-Xon` kabi ismlar (turli apostroflar, defis) qabul qilinadi; bitta so'z, raqam yoki 60 belgidan uzun ism rad etiladi (Task 4).
3. **To'g'ridan-to'g'ri API orqali hiyla:** o'quvchi brauzer konsolidan Supabase klienti bilan `role`, `status`, `name_edit_locked` yoki qulflangan tug'ilgan kunni o'zgartira olmaydi (Task 2).
4. **Sessiyasi ochiq paytda arxivlangan o'quvchi:** keyingi sahifa ochilishida tizimdan chiqariladi va "Akkauntingiz arxivlangan" xabarini ko'radi (Task 5, Task 9).
5. **Mantiqsiz tug'ilgan kun:** kelajakdagi sana yoki 1950-01-01 dan oldingi sana rad etiladi (Task 4).

---

## Fayllar tuzilmasi

```
next.config.ts, package.json, vitest.config.ts, vitest.integration.config.ts, playwright.config.ts, .env.example
supabase/
  config.toml
  migrations/20261108000001_core.sql        # jadvallar, enumlar, indekslar
  migrations/20261108000002_profile_guards.sql  # profil triggerlari
  migrations/20261108000003_privacy_rls.sql  # is_teacher, can_view, list_visible_students, RLS
  seed.sql                                   # faqat lokal: tests sxemasidagi yordamchi funksiyalar
  tests/01_core.test.sql
  tests/02_profile_guards.test.sql
  tests/03_privacy.test.sql
scripts/create-teacher.ts
src/
  proxy.ts                                   # Next 16 (oldingi middleware.ts)
  types/database.ts                          # supabase gen types orqali
  lib/supabase/{server.ts, browser.ts, admin.ts}
  lib/result.ts                              # Result<T, E> turi va o'zbekcha xato matnlari
  lib/auth/{login.ts, routing.ts, guards.ts}
  modules/auth-accounts/{service.ts, actions.ts}
  modules/courses-groups/{service.ts, actions.ts}
  modules/profile/{validation.ts, avatars.ts, service.ts, actions.ts}
  modules/privacy/{service.ts, actions.ts}
  app/login/page.tsx
  app/onboarding/page.tsx
  app/(student)/home/page.tsx, app/(student)/profile/page.tsx
  app/teacher/{page.tsx, students/page.tsx, students/[id]/page.tsx, groups/page.tsx, courses/page.tsx, privacy/page.tsx}
  components/Avatar.tsx, components/AvatarPicker.tsx
public/avatars/base/{wolf,fox,deer,bear,cat,owl,rabbit,panda}.svg
tests/unit/…, tests/integration/…, tests/e2e/…
```

---

### Task 1: Loyiha skeleti va infratuzilma

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `vitest.config.ts`, `vitest.integration.config.ts`, `playwright.config.ts`, `.env.example`, `supabase/config.toml`, `src/lib/supabase/{server.ts,browser.ts,admin.ts}`, `src/lib/result.ts`, `src/app/layout.tsx`, `src/app/page.tsx`
- Test: `tests/unit/result.test.ts`

**Interfaces:**
- Produces:
  - `createServerClient(): Promise<SupabaseClient<Database>>` (`server.ts`, cookie asosida, foydalanuvchi sessiyasi bilan)
  - `createBrowserClient(): SupabaseClient<Database>` (`browser.ts`)
  - `createAdminClient(): SupabaseClient<Database>` (`admin.ts`, `SUPABASE_SERVICE_ROLE_KEY`, fayl boshida `import 'server-only'`)
  - `type Result<T, E extends string> = { ok: true; data: T } | { ok: false; error: E }`, `ok<T>(data: T)`, `err<E>(error: E)`, `errorMessage(code: string): string` (`result.ts`)
  - npm skriptlari: `dev`, `build`, `test` (unit), `test:int` (integratsion), `test:db` (`supabase test db`), `test:e2e`, `db:types` (`supabase gen types typescript --local > src/types/database.ts`)

- [ ] **Step 1:** `create-next-app` (TypeScript, App Router, Tailwind, `src/` papka, ESLint) bilan loyihani repo ildizida yarating; `@supabase/ssr @supabase/supabase-js zod server-only` va dev: `supabase vitest @playwright/test tsx` o'rnating (Supabase CLI global emas, loyiha dev-paketi sifatida: `npx supabase …`); `npx supabase init`.
- [ ] **Step 2:** `next.config.ts` ga `devIndicators: false` qo'ying. `.env.example`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. `vitest.config.ts` faqat `tests/unit/**`, `vitest.integration.config.ts` faqat `tests/integration/**` (`fileParallelism: false`).
- [ ] **Step 3: Failing test yozing** — `tests/unit/result.test.ts`:

```ts
expect(ok(5)).toEqual({ ok: true, data: 5 })
expect(err('login_taken')).toEqual({ ok: false, error: 'login_taken' })
expect(errorMessage('login_taken')).toBe('Bu login band')
expect(errorMessage('unknown_code_xyz')).toBe("Kutilmagan xato. Qaytadan urinib ko'ring")
```

- [ ] **Step 4:** `npm test` — FAIL (modul yo'q).
- [ ] **Step 5:** `src/lib/result.ts` ni yozing. Xato matnlari jadvali shu faylda; keyingi tasklar o'z kodlarini shu jadvalga qo'shadi.
- [ ] **Step 6:** `npm test` — PASS; `npm run build` — muvaffaqiyatli.
- [ ] **Step 7:** Commit: `chore: Next.js + Supabase loyiha skeleti`

---

### Task 2: Asosiy sxema va profil himoyasi (DB)

**Files:**
- Create: `supabase/migrations/20261108000001_core.sql`, `supabase/migrations/20261108000002_profile_guards.sql`, `supabase/seed.sql`, `supabase/tests/01_core.test.sql`, `supabase/tests/02_profile_guards.test.sql`, `src/types/database.ts`

**Interfaces:**
- Produces (SQL):
  - Enumlar: `user_role ('teacher','student')`, `user_status ('active','archived')`, `course_status ('active','finished')`, `privacy_item ('avatar','online_status','stats','badges','birthday')`, `privacy_scope ('everyone','own_group','nobody')`
  - Jadvallar (spec 4.1 dagi ustunlar bilan): `profiles`, `profile_name_changes` (`id, profile_id, field text check in ('full_name','nickname'), old_value, new_value, changed_by, changed_at`), `courses`, `groups`, `group_courses`, `group_memberships`, `privacy_settings` (PK `item`), `privacy_group_overrides` (PK `(item, group_id)`)
  - `profiles.avatar_config jsonb not null default '{"base":"wolf"}'`, check: `avatar_config->>'base' in ('wolf','fox','deer','bear','cat','owl','rabbit','panda')`
  - Check: `onboarding_done = false or (full_name is not null and birth_date is not null)`
  - `profiles.login` unique, check `login ~ '^[a-z0-9_.]{3,20}$'`
  - Partial unique indekslar: `group_memberships(student_id) where left_at is null`, `group_courses(group_id) where ended_at is null`
  - `privacy_settings` boshlang'ich qatorlari: `badges=everyone`, qolgan to'rttasi `own_group`
  - Har bir jadvalda shu migratsiyaning o'zida `enable row level security` (siyosatlar Task 3 da qo'shilguncha hamma narsa yopiq)
  - `is_teacher() returns boolean` (security definer, `auth.uid()` profilining roli)
  - Trigger `profiles_guard` (before update): `auth.uid()` null bo'lmasa va `is_teacher()` false bo'lsa:
    - `role`, `login`, `status`, `name_edit_locked`, `birth_date_locked` o'zgarsa → `raise exception 'protected_column'`
    - `name_edit_locked` true va `full_name`/`nickname` o'zgarsa → `'name_edit_locked'`
    - `birth_date_locked` true va `birth_date` o'zgarsa → `'birth_date_locked'`
    - `birth_date` null'dan qiymatga o'tsa → `new.birth_date_locked := true`
  - Trigger `profiles_log_names` (after update, security definer): `full_name` yoki `nickname` o'zgarsa `profile_name_changes` ga qator, `changed_by = auth.uid()`
  - `seed.sql` (faqat lokal testlar uchun): `tests.create_user(login text, role user_role, group_id uuid default null) returns uuid` (`auth.users` + `profiles` + a'zolik), `tests.authenticate_as(uid uuid)` (`set local role authenticated` va `request.jwt.claims` ga `sub`), `tests.clear_auth()`

- [ ] **Step 1: Failing pgTAP testlar yozing**

`01_core.test.sql`:
- `throws_ok`: bitta o'quvchiga ikkinchi faol a'zolik qo'shish (`left_at is null`) → unique violation; birinchisiga `left_at` qo'yilgach ikkinchisi muvaffaqiyatli.
- Bir guruhga ikkinchi faol `group_courses` → unique violation.
- `throws_ok`: `login = 'Ali'` (katta harf) → check violation.
- `results_eq`: `select item, scope from privacy_settings order by item` = 5 qator, `badges` → `everyone`, qolganlar `own_group`.
- `throws_ok`: `onboarding_done = true`, `birth_date = null` → check violation.
- `throws_ok`: `avatar_config = '{"base":"dragon"}'` → check violation.

`02_profile_guards.test.sql` (o'quvchi sifatida `tests.authenticate_as`):
- O'z `role` ini `'teacher'` ga o'zgartirish → `'protected_column'`; `status`, `name_edit_locked` uchun ham.
- `full_name` o'zgartirish → muvaffaqiyatli va `profile_name_changes` da 1 qator (`field='full_name'`, eski va yangi qiymat).
- O'qituvchi `name_edit_locked = true` qilgach, o'quvchi `nickname` o'zgartirsa → `'name_edit_locked'`.
- `birth_date` birinchi marta qo'yilsa → muvaffaqiyatli va `birth_date_locked = true`; ikkinchi marta → `'birth_date_locked'`.
- O'qituvchi sifatida qulflangan `birth_date` ni o'zgartirish → muvaffaqiyatli.

- [ ] **Step 2:** `supabase start && supabase test db` — FAIL.
- [ ] **Step 3:** Ikkala migratsiya va `seed.sql` ni yozing.
- [ ] **Step 4:** `supabase db reset && supabase test db` — PASS.
- [ ] **Step 5:** `npm run db:types` — `src/types/database.ts` hosil bo'ladi.
- [ ] **Step 6:** Commit: `feat(db): asosiy sxema va profil himoyasi`

---

### Task 3: Maxfiylik funksiyalari va RLS

**Files:**
- Create: `supabase/migrations/20261108000003_privacy_rls.sql`, `supabase/tests/03_privacy.test.sql`

**Interfaces:**
- Consumes: Task 2 dagi jadvallar, `is_teacher()`
- Produces (SQL):
  - `active_group_id(uid uuid) returns uuid` (security definer; faol a'zolikdagi guruh)
  - `can_view(viewer uuid, target uuid, item privacy_item) returns boolean` (security definer, stable). Tartib: viewer o'qituvchi → true; `viewer = target` → true; target arxivda → false; `scope = coalesce(override for (item, active_group_id(target)), global)`; `everyone` → true; `own_group` → ikkalasining faol guruhi bir xil va null emas; `nobody` → false.
  - `list_visible_students() returns table(id uuid, full_name text, nickname text, group_id uuid, same_group boolean, avatar_config jsonb, last_seen_at timestamptz, birthday_md text)` (security definer). Faqat `active` o'quvchilar, chaqiruvchining o'zi chiqmaydi. Qator chiqadi agar: chaqiruvchi o'qituvchi, yoki bir guruhda, yoki beshta elementdan kamida biri `can_view` bo'yicha true. Ruxsat bo'lmagan ustunlar null: `avatar_config` (`avatar`), `last_seen_at` (`online_status`), `birthday_md` = `to_char(birth_date,'MM-DD')` (`birthday`).
  - RLS siyosatlari:
    - `profiles`: select — o'zi yoki o'qituvchi; update — o'zi yoki o'qituvchi; insert/delete siyosati yo'q.
    - `profile_name_changes`: select — o'z profili yoki o'qituvchi.
    - `courses`, `groups`, `group_courses`, `privacy_settings`, `privacy_group_overrides`: select — har qanday authenticated; insert/update/delete — `is_teacher()`.
    - `group_memberships`: select — o'zi yoki o'qituvchi; yozish — `is_teacher()`.

- [ ] **Step 1: Failing pgTAP testlar yozing** — `03_privacy.test.sql`. Ma'lumot: guruh A (`a1`, `a2`), guruh B (`b1`), arxivdagi `a3` (A guruhida), o'qituvchi `t`.
  - Boshlang'ich sozlamada: `can_view(a1, a2, 'avatar')` = true; `can_view(a1, b1, 'avatar')` = false; `can_view(a1, b1, 'badges')` = true.
  - `avatar` → `nobody`: `can_view(a1, a2, 'avatar')` = false; `can_view(t, a2, 'avatar')` = true; `can_view(a2, a2, 'avatar')` = true.
  - `stats` → `everyone`, B uchun override `nobody`: `can_view(a1, b1, 'stats')` = false; `can_view(b1, a1, 'stats')` = true.
  - `can_view(a1, a3, 'badges')` = false (arxiv).
  - `a1` sifatida `list_visible_students()`: `a2` (`same_group = true`) va `b1` (`badges` hammaga ochiq) bor, `a3` va `a1` yo'q; `b1` qatorida `avatar_config` va `birthday_md` null.
  - Barcha elementlar `own_group` qilinganda `a1` uchun `b1` chiqmaydi.
  - `a2` ning `birth_date = 2012-03-15`: `a1` uchun `birthday_md = '03-15'`.
  - `a1` sifatida `select * from profiles where id = a2` → 0 qator; `select * from group_memberships` → faqat o'z qatori.
  - `a1` sifatida `insert into groups` → RLS xatosi; `update privacy_settings` → 0 qator ta'sirlanadi.

- [ ] **Step 2:** `supabase test db` — FAIL.
- [ ] **Step 3:** Migratsiyani yozing.
- [ ] **Step 4:** `supabase db reset && supabase test db` — barcha testlar PASS; `npm run db:types`.
- [ ] **Step 5:** Commit: `feat(db): maxfiylik qoidalari va RLS`

---

### Task 4: Login va profil validatsiyasi

**Files:**
- Create: `src/lib/auth/login.ts`, `src/modules/profile/validation.ts`, `src/modules/profile/avatars.ts`
- Test: `tests/unit/login.test.ts`, `tests/unit/profile-validation.test.ts`

**Interfaces:**
- Produces:
  - `normalizeLogin(raw: string): string` (trim + lowercase)
  - `loginToEmail(login: string): string` → `` `${normalizeLogin(login)}@students.platforma.local` ``
  - `loginSchema` (zod, normalizatsiyadan keyin `/^[a-z0-9_.]{3,20}$/`), `passwordSchema` (6–72 belgi)
  - `fullNameSchema`: trim, ichki bo'shliqlarni bittaga qisqartirish; 3–60 belgi; kamida 2 so'z; faqat `\p{L}`, bo'sh joy, `-` va apostroflar `' ʻ ʼ ‘ ’ \``
  - `nicknameSchema`: ixtiyoriy (bo'sh satr → `null`); trim; 2–20 belgi; `/^[\p{L}\p{N}_.\- ]+$/u`
  - `birthDateSchema`: `YYYY-MM-DD`, `1950-01-01` ≤ sana ≤ bugun (`Asia/Tashkent` vaqt zonasi bo'yicha); `birthDateSchema(now?: Date)` factory ko'rinishida, testda sana berish uchun
  - `onboardingSchema`: `{ fullName, nickname, birthDate, avatarBase }`, `type OnboardingInput = z.infer<typeof onboardingSchema>`
  - `AVATAR_BASES = ['wolf','fox','deer','bear','cat','owl','rabbit','panda'] as const`, `type AvatarBase`, `AVATAR_LABELS: Record<AvatarBase, string>` (Bo'ri, Tulki, Kiyik, Ayiq, Mushuk, Boyo'g'li, Quyon, Panda)
  - Xato kodlari `result.ts` ga: `invalid_login`, `invalid_password`, `invalid_full_name`, `invalid_nickname`, `invalid_birth_date`, `invalid_avatar` (o'zbekcha matnlar bilan)

- [ ] **Step 1: Failing testlar yozing**

```ts
// login.test.ts
expect(normalizeLogin(' Ali.Karimov ')).toBe('ali.karimov')
expect(loginToEmail('ALI_K')).toBe('ali_k@students.platforma.local')
expect(loginSchema.safeParse('al').success).toBe(false)
expect(loginSchema.safeParse('ali karimov').success).toBe(false)
expect(loginSchema.safeParse(' Ali.K ').data).toBe('ali.k')

// profile-validation.test.ts
for (const ok of ["O'g'iloy Ne'matova", 'Oʻgʻiloy Rahimova', 'Gʻayrat Sobirov', "Ma'mura-Xon Aliyeva", 'Шерзод Каримов'])
  expect(fullNameSchema.safeParse(ok).success).toBe(true)
for (const bad of ['Ali', 'Ali 2Karimov', '   ', 'A'.repeat(30) + ' ' + 'B'.repeat(31)])
  expect(fullNameSchema.safeParse(bad).success).toBe(false)
expect(fullNameSchema.parse('  Ali   Karimov ')).toBe('Ali Karimov')
expect(nicknameSchema.parse('')).toBeNull()
expect(nicknameSchema.safeParse('a').success).toBe(false)
const s = birthDateSchema(new Date('2026-11-08T10:00:00+05:00'))
expect(s.safeParse('2012-05-01').success).toBe(true)
expect(s.safeParse('2026-11-09').success).toBe(false)
expect(s.safeParse('1949-12-31').success).toBe(false)
expect(s.safeParse('2012-02-30').success).toBe(false)
```

- [ ] **Step 2:** `npm test` — FAIL.
- [ ] **Step 3:** Fayllarni yozing.
- [ ] **Step 4:** `npm test` — PASS.
- [ ] **Step 5:** Commit: `feat: login va profil validatsiyasi`

---

### Task 5: Marshrut qoidalari, kirish va o'qituvchi akkaunti

**Files:**
- Create: `src/lib/auth/routing.ts`, `src/lib/auth/guards.ts`, `src/proxy.ts`, `src/app/login/page.tsx`, `src/app/login/actions.ts`, `scripts/create-teacher.ts`
- Test: `tests/unit/routing.test.ts`

**Interfaces:**
- Consumes: `loginToEmail`, `loginSchema` (Task 4), Supabase klientlari (Task 1)
- Produces:
  - `type RouteUser = { role: 'teacher' | 'student'; status: 'active' | 'archived'; onboardingDone: boolean }`
  - `resolveRoute(path: string, user: RouteUser | null): { type: 'next' } | { type: 'redirect'; to: string; signOut?: boolean }`
  - `requireUser(): Promise<{ supabase; userId: string; profile }>`, `requireTeacher(): Promise<{ supabase; userId: string }>` (`guards.ts`; ruxsat bo'lmasa `redirect('/login')`)
  - `signIn(formData)` server action: login va parol → `supabase.auth.signInWithPassword({ email: loginToEmail(login), password })`; xatoda doim bir xil `invalid_credentials` ("Login yoki parol noto'g'ri")
  - `signOut()` server action
  - `npm run create-teacher -- <login> <parol> "<Ism Familiya>"` → auth foydalanuvchi va `profiles` (`role='teacher'`, `onboarding_done=true`)

- [ ] **Step 1: Failing test yozing** — `routing.test.ts`, jadval ko'rinishida:

| path | user | natija |
|---|---|---|
| `/teacher` | null | redirect `/login` |
| `/login` | null | next |
| `/home` | student, archived | redirect `/login?archived=1`, `signOut: true` |
| `/login` | teacher | redirect `/teacher` |
| `/login` | student, onboarding tugagan | redirect `/home` |
| `/home` | student, onboarding tugamagan | redirect `/onboarding` |
| `/onboarding` | student, onboarding tugamagan | next |
| `/onboarding` | student, onboarding tugagan | redirect `/home` |
| `/teacher/students` | student, onboarding tugagan | redirect `/home` |
| `/home` | teacher | redirect `/teacher` |
| `/` | teacher / student | redirect `/teacher` / `/home` |

- [ ] **Step 2:** `npm test` — FAIL.
- [ ] **Step 3:** `resolveRoute` ni yozing; `proxy.ts` sessiyani yangilaydi, `profiles` dan `role, status, onboarding_done` ni o'qib `resolveRoute` ni qo'llaydi, `signOut` bo'lsa sessiyani tozalaydi. Statik fayllar va `_next` matcher'dan chiqarib tashlanadi.
- [ ] **Step 4:** Login sahifasi: login, parol, "Kirish" tugmasi; `?archived=1` bo'lsa "Akkauntingiz arxivlangan. O'qituvchingizga murojaat qiling" xabari. `create-teacher` skripti.
- [ ] **Step 5:** `npm test` — PASS. Qo'lda: `npm run create-teacher -- ustoz parol123 "Test Ustoz"`, `/login` da kirish → `/teacher`.
- [ ] **Step 6:** Commit: `feat: kirish, marshrut qoidalari, o'qituvchi akkaunti skripti`

---

### Task 6: O'quvchi akkauntlarini boshqarish

**Files:**
- Create: `src/modules/auth-accounts/service.ts`, `src/modules/auth-accounts/actions.ts`, `src/app/teacher/students/page.tsx`, `src/app/teacher/students/[id]/page.tsx`
- Test: `tests/integration/accounts.test.ts`, `tests/integration/helpers.ts`

**Interfaces:**
- Consumes: `createAdminClient`, `requireTeacher`, `loginSchema`, `passwordSchema`, `loginToEmail`, `Result`
- Produces:
  - `type AccountError = 'invalid_login' | 'invalid_password' | 'login_taken' | 'group_not_found' | 'not_found'`
  - `createStudent(admin, input: { login: string; password: string; groupId: string }): Promise<Result<{ id: string }, AccountError>>` — auth foydalanuvchi (`email_confirm: true`) → `profiles` (`role='student'`, `onboarding_done=false`) → `group_memberships`. Profil yoki a'zolik yozilmasa yaratilgan auth foydalanuvchi o'chiriladi.
  - `resetStudentPassword(admin, studentId: string, password: string): Promise<Result<null, AccountError>>`
  - `archiveStudent(admin, studentId: string): Promise<Result<null, AccountError>>` — `status='archived'`, auth foydalanuvchiga `ban_duration: '876000h'`. A'zolik o'zgarmaydi.
  - `restoreStudent(admin, studentId: string)` — `status='active'`, `ban_duration: 'none'`
  - `actions.ts` dagi bir xil nomli server actionlar: `requireTeacher()` → service → `revalidatePath`
  - `tests/integration/helpers.ts`: `adminClient()`, `resetData()` (o'quvchilar, guruhlar, kurslarni tozalaydi), `makeGroup(name)`, `signInAs(login, password): Promise<SupabaseClient>`
- Xato matnlari: `login_taken` → "Bu login band", `group_not_found` → "Guruh topilmadi", `not_found` → "O'quvchi topilmadi"

- [ ] **Step 1: Failing integratsion testlar yozing** (lokal Supabase'ga qarshi):
  - `createStudent({ login: ' Ali.K ', password: 'parol12', groupId })` → ok; `profiles.login = 'ali.k'`; faol a'zolik bor; `signInAs('ALI.K', 'parol12')` muvaffaqiyatli.
  - Xuddi shu login bilan ikkinchi marta → `{ ok: false, error: 'login_taken' }`.
  - Mavjud bo'lmagan `groupId` → `group_not_found` va `auth.users` da `ali.x@…` email qolmagan (rollback).
  - `resetStudentPassword` dan keyin eski parol bilan kirish xato, yangisi bilan muvaffaqiyatli.
  - `archiveStudent` dan keyin `signInAs` xato; `restoreStudent` dan keyin muvaffaqiyatli; arxivlash davomida `group_memberships` qatori saqlanib qolgan.
- [ ] **Step 2:** `npm run test:int` — FAIL.
- [ ] **Step 3:** `service.ts` va `actions.ts` ni yozing.
- [ ] **Step 4:** Sahifalar: `/teacher/students` — guruh filtri, faol/arxiv yorlig'i, "O'quvchi qo'shish" formasi (login, parol, guruh); `/teacher/students/[id]` — parol tiklash, arxivlash/tiklash (tasdiqlash oynasi bilan).
- [ ] **Step 5:** `npm run test:int` — PASS.
- [ ] **Step 6:** Commit: `feat: o'quvchi akkauntlarini boshqarish`

---

### Task 7: Kurslar va guruhlar

**Files:**
- Create: `src/modules/courses-groups/service.ts`, `src/modules/courses-groups/actions.ts`, `src/app/teacher/courses/page.tsx`, `src/app/teacher/groups/page.tsx`
- Test: `tests/integration/courses-groups.test.ts`

**Interfaces:**
- Consumes: Task 6 dagi test helperlari, `Result`
- Produces:
  - `type GroupError = 'invalid_name' | 'not_found'`
  - `createCourse(db, { title: string }): Promise<Result<{ id: string }, GroupError>>` (`position` = oxirgi + 1), `finishCourse(db, courseId)`
  - `createGroup(db, { name: string; description?: string })`
  - `assignGroupToCourse(db, groupId: string, courseId: string): Promise<Result<null, GroupError>>` — faol `group_courses` qatoriga `ended_at = now()`, keyin yangi qator
  - `moveStudent(db, studentId: string, toGroupId: string): Promise<Result<null, GroupError>>` — faol a'zolikka `left_at = now()`, yangi a'zolik `joined_at = now()`
  - `getGroupCourseHistory(db, groupId): Promise<{ courseId; title; startedAt; endedAt }[]>`
  - Bu funksiyalar o'qituvchi sessiyasidagi klient bilan ishlaydi (RLS `is_teacher()` ruxsat beradi); `admin` kerak emas.

- [ ] **Step 1: Failing integratsion testlar yozing:**
  - Guruh CS kursiga, so'ng Frontend kursiga biriktiriladi → tarixda 2 qator, CS qatorida `endedAt` bor, Frontend'da null.
  - `moveStudent` → eski a'zolikda `left_at`, yangi faol a'zolik; o'quvchi sessiyasi bilan `group_memberships` faqat o'z qatorlarini ko'radi.
  - Bo'sh nomli guruh (`'  '`) → `invalid_name`.
  - O'quvchi sessiyasidagi klient bilan `createGroup` → `ok: false` (RLS rad etadi).
- [ ] **Step 2:** `npm run test:int` — FAIL.
- [ ] **Step 3:** Service, actions va sahifalarni yozing (`/teacher/courses`: kurslar ro'yxati, qo'shish, tugatish; `/teacher/groups`: guruhlar, joriy kurs, "Keyingi kursga o'tkazish", a'zolar soni).
- [ ] **Step 4:** `npm run test:int` — PASS.
- [ ] **Step 5:** Commit: `feat: kurslar va guruhlar`

---

### Task 8: Onboarding, profil va ism nazorati

**Files:**
- Create: `src/modules/profile/service.ts`, `src/modules/profile/actions.ts`, `src/components/Avatar.tsx`, `src/components/AvatarPicker.tsx`, `public/avatars/base/*.svg`, `src/app/onboarding/page.tsx`, `src/app/(student)/profile/page.tsx`
- Modify: `src/app/teacher/students/[id]/page.tsx` (ism tarixi, qulf, tug'ilgan kun)
- Test: `tests/integration/profile.test.ts`

**Interfaces:**
- Consumes: `onboardingSchema`, `fullNameSchema`, `nicknameSchema`, `birthDateSchema`, `AVATAR_BASES` (Task 4); `requireUser`, `requireTeacher` (Task 5); test helperlari (Task 6)
- Produces:
  - `type ProfileError = 'invalid_full_name' | 'invalid_nickname' | 'invalid_birth_date' | 'invalid_avatar' | 'name_edit_locked' | 'birth_date_locked' | 'not_found'`
  - `completeOnboarding(db, userId, input: OnboardingInput): Promise<Result<null, ProfileError>>` — bitta update bilan `full_name, nickname, birth_date, avatar_config, onboarding_done=true`
  - `updateNames(db, userId, { fullName, nickname })`, `updateAvatar(db, userId, base: AvatarBase)`
  - O'qituvchi uchun: `revertNameChange(db, changeId)`, `setNameEditLock(db, studentId, locked: boolean)`, `setBirthDate(db, studentId, date: string)`, `listNameChanges(db, studentId)`
  - DB xatolari (`name_edit_locked`, `birth_date_locked`) shu nomdagi `ProfileError` ga aylantiriladi
  - `<Avatar config={…} size={…} />`, `<AvatarPicker value onChange />` (8 ta tugma, telefonda 4×2, kamida 48 px)
  - SVG avatarlar: 512×512 `viewBox`, oddiy yassi uslub, har bir hayvon o'z rangida; 2-versiyadagi qatlamlar uchun bosh markazi taxminan (256, 200) da joylashadi

- [ ] **Step 1: Failing integratsion testlar yozing** (o'quvchi sessiyasi bilan):
  - `completeOnboarding` (to'g'ri ma'lumot) → ok; profilda `onboarding_done = true`, `birth_date_locked = true`.
  - `completeOnboarding` `birthDate: '2030-01-01'` bilan → `invalid_birth_date`, profil o'zgarmagan.
  - `updateNames` → ok; `listNameChanges` (o'qituvchi) 1 ta yozuv qaytaradi; `revertNameChange` dan keyin `full_name` eski qiymatda.
  - `setNameEditLock(true)` dan keyin `updateNames` → `name_edit_locked`.
  - Onboardingdan keyin o'quvchi `birth_date` ni o'zgartirmoqchi bo'lsa → `birth_date_locked`; o'qituvchi `setBirthDate` → ok.
- [ ] **Step 2:** `npm run test:int` — FAIL.
- [ ] **Step 3:** Service va actionlarni yozing.
- [ ] **Step 4:** Sahifalar:
  - `/onboarding`: bitta forma (ism-familiya, tug'ilgan kun, nickname, avatar tanlash), maydon ostida xato matni, "Davom etish".
  - `/profile`: ism, nickname, avatar tahriri; tug'ilgan kun faqat ko'rinadi ("O'zgartirish uchun o'qituvchingizga murojaat qiling"); tahrir bloklangan bo'lsa maydonlar o'chirilgan va izoh.
  - `/teacher/students/[id]`: ism o'zgarishlari tarixi ("Qaytarish" tugmasi), "Tahrirni bloklash" kaliti, tug'ilgan kunni o'zgartirish.
- [ ] **Step 5:** `npm run test:int` — PASS.
- [ ] **Step 6:** Commit: `feat: onboarding, profil va ism nazorati`

---

### Task 9: Maxfiylik sozlamalari, "Guruhim" sahifasi va E2E

**Files:**
- Create: `src/modules/privacy/service.ts`, `src/modules/privacy/actions.ts`, `src/app/teacher/privacy/page.tsx`, `src/app/teacher/page.tsx`, `src/app/(student)/home/page.tsx`, `src/app/(student)/layout.tsx`
- Test: `tests/integration/privacy.test.ts`, `tests/e2e/foundation.spec.ts`

**Interfaces:**
- Consumes: `list_visible_students()`, `can_view` (Task 3); `createStudent`, `archiveStudent` (Task 6); `<Avatar>` (Task 8)
- Produces:
  - `type PrivacyItem = 'avatar' | 'online_status' | 'stats' | 'badges' | 'birthday'`, `type PrivacyScope = 'everyone' | 'own_group' | 'nobody'`
  - `PRIVACY_LABELS: Record<PrivacyItem, string>` (Avatar, Online holati, Ko'rsatkichlar va reyting, Nishonlar, Tug'ilgan kun), `SCOPE_LABELS` (Hammaga, Faqat o'z guruhiga, Hech kimga)
  - `getPrivacyMatrix(db): Promise<{ global: Record<PrivacyItem, PrivacyScope>; overrides: { groupId: string; item: PrivacyItem; scope: PrivacyScope }[] }>`
  - `setGlobalScope(db, item, scope)`, `setGroupOverride(db, groupId, item, scope | null)` (`null` → istisnoni o'chirish)
  - `type VisibleStudent = { id: string; fullName: string; nickname: string | null; groupId: string; sameGroup: boolean; avatarConfig: { base: AvatarBase } | null; lastSeenAt: string | null; birthdayMd: string | null }`
  - `listVisibleStudents(db): Promise<VisibleStudent[]>` (`list_visible_students()` RPC natijasini shu turga o'giradi)
  - `touchLastSeen(db, userId)` — `last_seen_at` 5 daqiqadan eski bo'lsa yangilaydi; `(student)/layout.tsx` da chaqiriladi
  - Online belgisi: `last_seen_at` oxirgi 5 daqiqa ichida bo'lsa "online", aks holda "oxirgi faollik: …" (ruxsat bo'lmasa hech narsa ko'rsatilmaydi)

- [ ] **Step 1: Failing integratsion testlar yozing:**
  - O'qituvchi `setGlobalScope('avatar', 'nobody')` → o'quvchi `listVisibleStudents` da guruhdoshining `avatarConfig` i null, ismi bor.
  - `setGroupOverride(B, 'stats', 'everyone')`, global `stats = own_group` → A guruhidagi o'quvchi B o'quvchilarini ro'yxatda ko'radi; `setGroupOverride(B, 'stats', null)` va `badges = own_group` dan keyin ko'rmaydi.
  - O'quvchi sessiyasi bilan `setGlobalScope` → `ok: false`.
- [ ] **Step 2: Failing E2E yozing** — `foundation.spec.ts` (ikki brauzer konteksti, mobil viewport 390×844 bilan bitta loyiha):
  - O'qituvchi kiradi → guruh yaratadi → `ali.k` o'quvchini qo'shadi.
  - O'quvchi kiradi → `/onboarding` ga yo'naltiriladi → formani to'ldiradi → `/home` da "Guruhim" ro'yxatini ko'radi.
  - O'quvchi brauzer konsolidan (`page.evaluate`, Supabase browser klient) `profiles` da `role='teacher'` qilib yangilashga urinadi → xato qaytadi, sahifani yangilaganda `/teacher` ochilmaydi.
  - O'qituvchi o'quvchini arxivlaydi → o'quvchi sahifani yangilaydi → `/login?archived=1` va arxiv xabari.
- [ ] **Step 3:** `npm run test:int && npm run test:e2e` — FAIL.
- [ ] **Step 4:** Service, actions va sahifalar:
  - `/teacher/privacy`: 5 element × umumiy qiymat jadvali, ostida har bir guruh uchun istisno ustunlari ("Umumiy" / qiymat).
  - `/teacher` (bosh sahifa): guruhlar soni, faol o'quvchilar, onboardingni tugatmaganlar ro'yxati.
  - `/home`: "Guruhim" (avatar, ism, nickname, online holati, tug'ilgan kuni bugun bo'lsa belgi) va ko'rinadigan boshqa guruh o'quvchilari alohida bo'limda.
- [ ] **Step 5:** `npm run test:int && npm run test:e2e` — PASS; `npm run build` muvaffaqiyatli.
- [ ] **Step 6:** Commit: `feat: maxfiylik sozlamalari va o'quvchi bosh sahifasi`

---

### Task 10: Joylashtirish (deploy)

Bu taskdagi tashqi amallar (Supabase loyihasi yaratish, Vercel loyihasi, maxfiy kalitlarni kiritish) foydalanuvchining aniq roziligi bilan bajariladi.

**Files:**
- Create: `docs/deploy.md` (qadamlar va muhit o'zgaruvchilari ro'yxati)

- [ ] **Step 1:** Foydalanuvchi bilan Supabase loyihasi nomi va hududini kelishing (yaqin hudud, masalan Frankfurt); narx bepul tarifda ekanini tasdiqlang; loyihani yarating.
- [ ] **Step 2:** `supabase link` va `supabase db push` — 3 ta migratsiya qo'llanadi. `seed.sql` masofaviy bazaga qo'llanmaydi.
- [ ] **Step 3:** Supabase Auth sozlamalari: ro'yxatdan o'tish (`Enable signups`) o'chiriladi, email tasdiqlash o'chiriladi.
- [ ] **Step 4:** Vercel loyihasi, muhit o'zgaruvchilari (`SUPABASE_SERVICE_ROLE_KEY` faqat server muhitiga), deploy.
- [ ] **Step 5:** `create-teacher` skriptini production URL va kalitlar bilan ishga tushiring (o'qituvchi login va parolini foydalanuvchi o'zi kiritadi).
- [ ] **Step 6: Tekshirish:** production'da kirish, bitta test o'quvchi yaratish, onboarding, arxivlash; Supabase Advisors'da RLS ogohlantirishlari yo'qligini tekshiring.
- [ ] **Step 7:** Commit: `docs: deploy qo'llanmasi`

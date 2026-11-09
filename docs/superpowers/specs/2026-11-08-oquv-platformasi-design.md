# O'quv platformasi — dizayn spetsifikatsiyasi

- **Sana:** 2026-11-08
- **Holat:** tasdiqlangan; 2026-11-09 da aldashga qarshi choralar qo'shildi (5.13)
- **Keyingi qadam:** tasdiqlangach, 1-bosqich (Asos) uchun amalga oshirish rejasi yoziladi

---

## 1. Maqsad va kontekst

O'qituvchi o'z kurslaridagi o'quvchilar uchun yopiq onlayn platforma quradi.

- **Foydalanuvchilar:** bitta o'qituvchi (u admin ham), 3 ta guruh, jami taxminan 40 o'quvchi (8-sinf, voyaga yetmaganlar).
- **Kurslar ketma-ket o'tadi:** hozir Computer Science, keyin Frontend, so'ng Backend. Odatda o'sha guruhlar keyingi kursga o'tadi; o'quvchilar qo'shilishi yoki muddatidan oldin ketishi mumkin.
- **Qurilmalar:** darsda noutbuk, uyda telefon. Interfeys ikkalasida bir xil qulay bo'lishi shart (responsive).

**Muvaffaqiyat mezonlari:**
1. O'qituvchi darsda jonli test o'tkazadi va har bir o'quvchining holatini real vaqtda ko'radi.
2. O'qituvchi testni guruhga uyga vazifa sifatida muddat bilan beradi.
3. O'quvchi adashib bosgan javobini savol yopilguncha tuzata oladi.
4. O'quvchi o'z natijalari, kuchli va zaif mavzularini ko'radi.
5. O'quvchi ma'lumotlari faqat o'qituvchi belgilagan doirada ko'rinadi.
6. (2–3-versiya) Nishonlar, tangalar, avatar bezaklari va eventlar o'quvchini muntazam qatnashishga undaydi.

---

## 2. Rollar va kirish

- Ikki rol: `teacher` (o'qituvchi = admin) va `student`.
- Ro'yxatdan o'tish sahifasi yo'q. O'quvchi akkauntini faqat o'qituvchi yaratadi: login va parol.
- Supabase Auth email talab qiladi, shuning uchun har bir login uchun ko'rinmas texnik email yaratiladi (`<login>@students.platforma.local`). O'quvchi uni ko'rmaydi, faqat login bilan kiradi.
- Parolni faqat o'qituvchi tiklaydi. "Parolni unutdim" funksiyasi yo'q.
- Arxivlangan o'quvchi tizimga kira olmaydi.

---

## 3. Texnologiya va arxitektura

- **Frontend va server:** Next.js (App Router, TypeScript), Vercel'da joylashadi. `next.config.ts` da `devIndicators: false` qo'yiladi: lokal ishlab chiqishda ekran burchagidagi Next.js belgisi ko'rinmaydi (xato xabarlari saqlanadi).
- **Supabase:** Auth (kirish), PostgreSQL (ma'lumotlar), Storage (fayllar, avatar qatlamlari), Realtime (jonli rejim), `pg_cron` (rejalashtirilgan ishlar).

**Asosiy xavfsizlik qoidalari:**
1. Har bir jadvalda Row Level Security (RLS) yoqilgan. Brauzer faqat RLS ruxsat bergan qatorlarni o'qiydi.
2. Quyidagilar faqat serverda (Next.js server actions / route handlers, `service_role` kaliti bilan) bajariladi:
   - akkaunt yaratish, parol tiklash, arxivlash;
   - javobni qabul qilish va baholash;
   - tanga yozuvlari va nishon berish (2-versiya).
3. To'g'ri javoblar alohida jadvalda (`question_answer_keys`) saqlanadi; o'quvchi roli uchun unga hech qanday RLS ruxsati yo'q.
4. Barcha vaqt hisoblari (taymer, muddat, savolning yopilishi) server vaqti bo'yicha.

**Modullar (har biri aniq vazifali, alohida test qilinadi):**

| Modul | Vazifasi |
|---|---|
| `auth-accounts` | Akkaunt yaratish, kirish, arxivlash, parol tiklash |
| `courses-groups` | Kurslar, guruhlar, a'zolik tarixi |
| `profile` | Onboarding, profil tahriri, avatar konfiguratsiyasi |
| `privacy` | "Kim kimni ko'radi" qoidalari (SQL funksiya + RLS) |
| `resources` | Resurslar, fayl yuklash, ko'rishlarni qayd etish |
| `question-bank` | Savollar, variantlar, javob kalitlari |
| `testing-engine` | Urinishlar, javoblarni saqlash, baholash, taymer |
| `assignments` | Uyga vazifa rejimi |
| `live` | Jonli sessiyalar, real vaqt holati, kuzatuv paneli, proyektor |
| `analytics` | Ko'rsatkichlar (SQL view'lar) |
| `notifications` | Platforma ichidagi bildirishnomalar |
| `gamification` (v2) | Nishonlar, tangalar, do'kon, sovg'alar, tug'ilgan kun |
| `events` (v3) | Eventlar va sayt bezaklari |

`testing-engine` ikki rejim (`assignments` va `live`) uchun umumiy: baholash va javob saqlash bir joyda.

---

## 4. Ma'lumotlar modeli

Barcha bosqichlar boshidan hisobga olingan; 2–3-versiya jadvallari kerak bo'lganda qo'shiladi, lekin 1-versiya jadvallarini o'zgartirishni talab qilmaydi.

### 4.1. 1-versiya

**Foydalanuvchilar va tuzilma**
- `profiles` — `id` (auth.users), `role`, `login`, `full_name`, `nickname`, `birth_date`, `birth_date_locked`, `avatar_config` (jsonb), `status` (`active` / `archived`), `onboarding_done`, `name_edit_locked`, `last_seen_at`.
- `profile_name_changes` — ism yoki nickname o'zgarishlari tarixi (`field`, `old_value`, `new_value`, `changed_at`).
- `courses` — `title`, `position`, `status` (`active` / `finished`).
- `groups` — `name`, `description`.
- `group_courses` — guruh qaysi kursni qachon o'tgan: `group_id`, `course_id`, `started_at`, `ended_at`.
- `group_memberships` — `student_id`, `group_id`, `joined_at`, `left_at`. Bir vaqtda o'quvchining faqat bitta faol a'zoligi bo'ladi.

**Resurslar**
- `topics` — `course_id`, `title`, `position`.
- `resources` — `topic_id`, `type` (`link` / `file` / `note`), `title`, `url`, `storage_path`, `body_md`, `position`.
- `resource_groups` — resurs cheklangan guruhlar. Bo'sh bo'lsa resurs kursning barcha guruhlariga ochiq.
- `resource_views` — `student_id`, `resource_id`, `first_viewed_at`.

**Savollar va testlar**
- `questions` — `topic_id`, `type` (`single` / `multiple` / `true_false`; keyin yangi turlar qo'shiladi), `text`, `explanation`.
- `question_options` — `question_id`, `text`, `position`.
- `question_answer_keys` — `question_id`, `option_id`. O'quvchiga yopiq.
- `tests` — `topic_id`, `title`, `time_limit_minutes` (ixtiyoriy), `seconds_per_question` (jonli savol-ma-savol uchun, boshlang'ich 30), `shuffle_questions`, `shuffle_options`, `results_visibility` (`immediately` / `after_due` / `manual`), `questions_per_attempt` (ixtiyoriy; bo'sh bo'lsa barcha savollar), `strict_mode` (boshlang'ich false), `strict_max_exits` (boshlang'ich 3), `strict_min_exit_seconds` (boshlang'ich 3).
- `test_questions` — `test_id`, `question_id`, `position`.

**Rejimlar va urinishlar**
- `assignments` — `test_id`, `group_id`, `opens_at`, `due_at`, `max_attempts` (boshlang'ich 1), `results_released` (manual rejim uchun).
- `live_sessions` — `test_id`, `group_id`, `mode` (`question_by_question` / `self_paced`), `status` (`lobby` / `running` / `finished`), `current_position`, `question_opened_at`, `question_closes_at`, `question_revealed`, `ends_at`.
- `attempts` — `student_id`, `assignment_id` yoki `live_session_id` (aniq bittasi), `question_order` (jsonb, aralashtirilgan tartib), `started_at`, `deadline_at`, `submitted_at`, `submit_reason` (`manual` / `deadline` / `strict_exits` / `teacher_ended`), `score`, `max_score`.
- `attempt_answers` — `attempt_id`, `question_id`, `selected_option_ids`, `is_correct`, `shown_at` (savol birinchi marta ko'rsatilgan vaqt), `first_answered_at`, `updated_at`.
- `attempt_exits` — `attempt_id`, `left_at`, `returned_at`, `duration_seconds`, `counted` (qat'iy rejim bo'yicha hisobga olinganmi).
- `assignment_extra_attempts` — `assignment_id`, `student_id`, `extra`, `granted_at`.

**Maxfiylik va bildirishnomalar**
- `privacy_settings` — `item`, `scope` (`everyone` / `own_group` / `nobody`).
- `privacy_group_overrides` — `item`, `group_id`, `scope`. Shu guruh o'quvchilari ma'lumotiga umumiy sozlama o'rniga shu qiymat qo'llanadi.
- `notifications` — `user_id`, `type`, `payload` (jsonb), `created_at`, `read_at`.

### 4.2. 2-versiya (gamification)

- `badges` — `name`, `description`, `image_path`, `kind` (`auto` / `manual`), `rule_template`, `rule_params` (jsonb), `event_id`.
- `student_badges` — `student_id`, `badge_id`, `awarded_at`, `awarded_by`, `note`.
- `coin_rules` — `key`, `amount` (o'qituvchi tahrirlaydi).
- `coin_transactions` — `student_id`, `amount` (+/−), `reason`, `ref_type`, `ref_id`, `created_by`, `created_at`. Balans = yig'indi.
- `shop_items` — `type` (`frame`, `background`, `name_color`, `avatar_base`, `head`, `body`, `hand`, `skin`, `gift`), `name`, `image_path`, `price`, `active`, `event_id`.
- `inventory` — `student_id`, `item_id`, `acquired_at`.
- `gifts` — `from_student_id`, `to_student_id`, `item_id`, `created_at`.
- `birthday_reactions` — `birthday_student_id`, `year`, `reactor_id`, `emoji` (har kishidan bitta).
- `banner_dismissals` — `user_id`, `banner_key`, `dismissed_at`.

### 4.3. 3-versiya (eventlar)

- `events` — `name`, `starts_on`, `ends_on`, `effect` (`snow`, `petals`, `rain_storm`, `clouds`, `leaves_halloween` …), `repeats_yearly`.
- `shop_items.event_id` va `badges.event_id` orqali bog'lanadi.

---

## 5. Funksional talablar

### 5.1. Kurslar, guruhlar va o'quvchilar

- O'qituvchi kurs, mavzu va guruh yaratadi, guruhni kursga biriktiradi va kurs tugagach keyingisiga o'tkazadi. Oldingi kurs tarixi saqlanadi.
- O'quvchini istalgan payt qo'shish, boshqa guruhga ko'chirish, arxivlash va tiklash mumkin.
- **Yangi qo'shilgan o'quvchi:** `joined_at` dan oldin `opens_at` bo'lgan vazifalar unga "topshirilmadi" deb hisoblanmaydi va ko'rsatkichlariga kirmaydi.
- **Arxivlangan o'quvchi:** kira olmaydi; natijalari, nishonlari, tangalari saqlanadi; guruh reytingi va ro'yxatlarida ko'rinmaydi.

### 5.2. Profil

- O'qituvchi akkauntni faqat login va parol bilan yaratadi.
- Birinchi kirishda majburiy onboarding: ism-familiya (majburiy), tug'ilgan kun (majburiy), nickname (ixtiyoriy), avatar (hayvonlar to'plamidan). Onboarding tugamaguncha boshqa sahifalar ochilmaydi.
- Rasm yuklash yo'q, faqat avatarlar.
- Ism va nicknameni o'quvchi istalgan payt tahrirlaydi. Har bir o'zgarish `profile_name_changes` ga yoziladi; o'qituvchi tarixni ko'radi, eski qiymatni qaytaradi yoki o'quvchi uchun tahrirni bloklaydi.
- Tug'ilgan kun faqat bir marta kiritiladi; keyin faqat o'qituvchi o'zgartiradi. Boshqalarga faqat kun va oy ko'rinadi; yil faqat o'qituvchiga.
- `avatar_config` 1-versiyada faqat `base` (hayvon) ni saqlaydi; 2-versiyada qatlamlar (`head`, `body`, `hand`, `frame`, `background`, `name_color`) qo'shiladi.

### 5.3. Maxfiylik

Sozlanadigan elementlar: `avatar`, `online_status` (online va oxirgi faollik), `stats` (ko'rsatkichlar va reyting), `badges`, `birthday`.

- Har bir element uchun umumiy `scope`: `everyone` / `own_group` / `nobody`. Boshlang'ich qiymatlar: `badges` → `everyone`, qolganlari → `own_group`.
- Har bir element uchun guruh bo'yicha istisno (`privacy_group_overrides`).
- Ism-familiya va nickname o'z guruhiga doim ko'rinadi. Boshqa guruh o'quvchisiga ism faqat shu o'quvchining kamida bitta elementi unga ko'rinadigan bo'lsa ko'rsatiladi.
- O'qituvchi hammasini doim ko'radi. O'quvchi o'z ma'lumotini doim ko'radi.
- Qoida bitta SQL funksiyada (`can_view(viewer_id, target_id, item)`) amalga oshiriladi va RLS siyosatlari hamda view'lar shu funksiyadan foydalanadi.

### 5.4. Resurslar

- Har bir resurs bitta mavzuga tegishli, uch turdan biri: havola, fayl (PDF, PPTX, kod fayli; Supabase Storage, maksimal 50 MB), konspekt (Markdown: sarlavha, ro'yxat, kod bloki, rasm havolasi).
- Boshlang'ich holatda kursning barcha guruhlariga ochiq; ixtiyoriy ravishda tanlangan guruhlarga cheklanadi.
- O'quvchi resursni birinchi ochganida `resource_views` ga yoziladi.

### 5.5. Savollar va testlar

- Savol turlari: bitta to'g'ri javobli, bir nechta to'g'ri javobli, to'g'ri/noto'g'ri. Hammasi avtomatik baholanadi.
- Har savol 1 ball. Bir nechta to'g'ri javobli savolda faqat to'g'ri variantlar to'plami aynan tanlanganda 1 ball, aks holda 0.
- Savol bir nechta testda qayta ishlatiladi.
- Test sozlamalari: vaqt chegarasi, savol va variantlarni aralashtirish, natija ko'rinishi (`immediately` / `after_due` / `manual`).
- Aralashtirilgan tartib urinish boshida `attempts.question_order` ga yoziladi va qayta yuklashda o'zgarmaydi.
- Savollar havzasi, qat'iy rejim va nusxalashni cheklash: 5.13.
- Savol izohi va to'g'ri javob faqat natija ko'rsatilganda (`results_visibility`) ochiladi, test topshirilishidan oldin hech qachon.

### 5.6. Javob berish (ikkala rejim uchun)

- Variantni bosish uni faqat **belgilaydi**; javob alohida **"Javob berish"** tugmasi bilan yuboriladi.
- Yuborilgan javobni savol yopilguncha o'zgartirish mumkin (uyga vazifa va o'z tempida: test topshirilguncha; savol-ma-savol: savol yopilguncha). Hisobga oxirgi javob olinadi.
- Uyga vazifa va o'z tempida rejimida oxirida ko'rib chiqish sahifasi: barcha javoblar, javobsiz savollar ajratib ko'rsatiladi; so'ng "Testni topshirish" va tasdiqlash oynasi.
- Variant tugmalari katta va oraliqli (telefonda kamida 48 px balandlik); tanlangan holat rang va belgi bilan aniq ko'rinadi; noutbukda 1–4 klavishlari variantni belgilaydi, Enter yuboradi.

### 5.7. Uyga vazifa rejimi

- O'qituvchi testni bir yoki bir nechta guruhga biriktiradi: `opens_at`, `due_at`, `max_attempts`.
- Urinish muddati: `deadline_at = min(started_at + time_limit, due_at)`.
- Javoblar har bir "Javob berish" bosilganda serverga saqlanadi; internet uzilsa yoki sahifa yangilansa o'quvchi joyidan davom etadi.
- `deadline_at` o'tgan, topshirilmagan urinish avtomatik topshiriladi (serverda: keyingi so'rovda va har daqiqada ishlaydigan `pg_cron` vazifasi orqali).
- `due_at` gacha urinish boshlamagan o'quvchi "topshirilmadi" deb belgilanadi.
- Bir nechta urinishda ko'rsatkichlarga eng yaxshi natija olinadi.

### 5.8. Jonli rejim

**Boshlash.** O'qituvchi test, guruh va uslubni tanlaydi. O'quvchilarning bosh sahifasida "Jonli test boshlandi — qo'shilish" chiqadi (PIN yo'q). Kutish xonasida o'qituvchi qo'shilganlarni ko'radi va "Boshlash" ni bosadi. Kech qolgan o'quvchi istalgan payt qo'shiladi; o'tkazib yuborgan savollari javobsiz hisoblanadi.

**Savol-ma-savol uslubi:**
- Hamma bir vaqtda bitta savolni ko'radi; taymer `seconds_per_question`.
- Taymer tugaganda savol avtomatik yopiladi; o'qituvchi oldinroq yopishi ham mumkin.
- Yopilgach o'qituvchi ekranida va proyektorda javoblar taqsimoti va to'g'ri javob; har bir o'quvchi o'z ekranida to'g'ri yoki noto'g'ri javob berganini ko'radi.
- O'qituvchi "Keyingisi" bilan keyingi savolga o'tadi.

**O'z tempida uslubi:**
- Hamma testni bir vaqtda boshlaydi, umumiy taymer (`time_limit_minutes`) ichida erkin harakatlanadi; mexanizm uyga vazifa bilan bir xil (5.6, 5.7).
- O'qituvchi testni istalgan payt hamma uchun tugatadi.

**Kuzatuv paneli (faqat o'qituvchi):**
- Umumiy hisob: "12/15 javob berdi".
- Har bir o'quvchi holati: `offline`, `o'qiyapti` (hech narsa belgilamagan), `belgilagan, yubormagan`, `javob bergan`.
- Har bir variantni nechta va aynan kimlar tanlagani.
- O'z tempida uslubida: qatorlar o'quvchilar, ustunlar savollar jadvali; har bir katakda javob holati, o'quvchining hozirgi savoli belgilanadi.

**Proyektor ekrani:** alohida sahifa (o'qituvchi akkaunti bilan ochiladi): savol matni va "nechta javob berdi" hisobi; ismlar va taqsimot o'qituvchi savolni yopmaguncha yashirin.

**Real vaqt mexanizmi:**
- `online` va `o'qiyapti / belgilagan` holatlari Supabase Realtime Presence orqali (ma'lumotlar bazasiga yozilmaydi).
- Yuborilgan javoblar server orqali `attempt_answers` ga yoziladi; o'qituvchi paneli o'zgarishlarga Realtime orqali obuna bo'ladi.
- Sessiya holati (`current_position`, `question_closes_at`, `question_revealed`) `live_sessions` da; o'quvchi ekrani shunga obuna bo'ladi.

**Ball va reyting:** ball faqat to'g'rilik uchun, tezlik bonusi yo'q. O'quvchilar test davomida boshqalarning javobi yoki reytingini ko'rmaydi; yakuniy natija va reyting test tugagach (maxfiylik sozlamasiga ko'ra) ko'rsatiladi. Jonli natijalar ko'rsatkichlarda "Darsdagi testlar" sifatida ko'rsatiladi va reyting hamda mavzu tahlilining asosi bo'ladi (5.13).

### 5.9. Ko'rsatkichlar

Barchasi `attempts`, `attempt_answers`, `resource_views` dan SQL view'lar orqali hisoblanadi, alohida saqlanmaydi. Ko'rsatkichlar kurs bo'yicha alohida; o'quvchi oldingi kurslarini ham ko'radi.

**O'quvchi sahifasi:**
- Ikki alohida bo'lim: "Darsdagi testlar" (jonli) va "Mashqlar" (uyga vazifa); har birida test ballari, o'rtacha va vaqt bo'yicha o'sish grafigi.
- Mavzular bo'yicha to'g'ri javoblar foizi: ≥ 80% — "kuchli", < 50% — "zaif"; zaif mavzu yonida shu mavzu resurslariga havola. Hisob jonli testlardagi javoblardan; mavzu bo'yicha jonli javob bo'lmasa uyga vazifa javoblaridan, "faqat mashq asosida" belgisi bilan.
- Faollik: topshirilmagan vazifalar, qatnashilmagan jonli testlar, ko'rilgan resurslar soni, oxirgi faollik.

**O'qituvchi uchun qo'shimcha:**
- Guruh jadvali (o'quvchilar × testlar).
- Savollar tahlili: har bir savol bo'yicha xato foizi, eng ko'p tanlangan noto'g'ri variant.

**Reyting:** guruh ichida, joriy kurs bo'yicha, jonli test ballari yig'indisi; uyga vazifa reytingga kirmaydi.

**Aldash signallari:** 5.13 dagi signallar o'qituvchi ko'rinishida o'quvchi sahifasi va guruh jadvalida belgi sifatida chiqadi. Arxivdagilar kirmaydi. Ko'rinishi `stats` maxfiylik elementiga bog'liq.

### 5.10. Bildirishnomalar

Faqat platforma ichida (bildirishnomalar markazi, o'qilmaganlar soni).
- 1-versiya: yangi vazifa berildi; muddatga 24 soat qoldi (`pg_cron`); natijalar ochildi; jonli test boshlandi.
- 2-versiya: nishon olindi; sovg'a keldi; guruhdoshning tug'ilgan kuni.

### 5.11. Gamification (2-versiya)

**Nishonlar:**
- Avtomatik nishonlar shablonlardan tuziladi; o'qituvchi raqam va mavzuni kiritadi:
  - `tests_above` — "___ ta testda ___% va undan yuqori";
  - `streak_above` — "ketma-ket ___ ta testda ___% va undan yuqori";
  - `topic_mastery` — "___ mavzusi bo'yicha ___%";
  - `topic_growth` — "zaif mavzuni kuchliga aylantirish";
  - `on_time_streak` — "ketma-ket ___ ta vazifani o'z vaqtida topshirish";
  - `live_first_place` — "jonli testda guruhda 1-o'rin";
  - `event_tests` — "event davomida ___ ta test topshirish" (3-versiya).
- Shartlar urinish topshirilganda serverda tekshiriladi.
- Qo'lda beriladigan nishonlar: o'qituvchi nom, tavsif va rasm yuklab cheksiz yaratadi va izoh bilan beradi.
- Nishonni boshqaga berib yoki sotib bo'lmaydi.
- Tayyor boshlang'ich katalog: "Birinchi 100%", "Beshlik seriya" (5 ketma-ket 90%+), "Mavzu ustasi" (mavzuda 90%+), "O'sish" (topic_growth), "Intizom" (10 ketma-ket o'z vaqtida), "Jonli chempion".

**Tangalar** (`coin_rules` dagi boshlang'ich qiymatlar, o'qituvchi tahrirlaydi):
- Test topshirish: +5 (har testga bir marta).
- Har to'g'ri javob: +1. Qayta urinishda faqat oldingi eng yaxshi natijadan oshgan to'g'ri javoblar uchun.
- Nishon olish: +20.
- Jonli testda qatnashish: +3.
- Tug'ilgan kun: +20 tizimdan.
- Resurs ko'rish uchun tanga berilmaydi. Tangani boshqa o'quvchiga o'tkazib bo'lmaydi.
- Uyga vazifadan olinadigan tangalar (topshirish va to'g'ri javoblar) kuniga `homework_daily_cap` bilan cheklanadi (boshlang'ich 30).
- O'qituvchi izoh bilan tanga qo'shadi yoki ayiradi.
- Har harakat `coin_transactions` ga faqat server orqali yoziladi; balans yig'indidan hisoblanadi; manfiy balansga tushadigan xarid rad etiladi.

**Do'kon:**
- Mahsulot turlari: ramka, fon, nickname rangi, qo'shimcha hayvon, bosh kiyim, kiyim, qo'lidagi narsa, noyob to'liq skin, sovg'a.
- Asosiy hayvonlar to'plami bepul.
- O'qituvchi admin bo'limida mahsulot yuklaydi (shaffof PNG yoki SVG), turi, narxi, eventi va faolligini belgilaydi.

**Qatlamli avatarlar:**
- Avatar quyidagi tartibda yig'iladi: fon → hayvon → kiyim → bosh kiyim → qo'lidagi narsa → ramka.
- Barcha hayvon rasmlari bir xil o'lchamda (512×512) va bosh/tana/qo'l joylashuvi bir shablonga mos chiziladi; aksessuarlar ham shu shablon bo'yicha, shuning uchun bitta aksessuar barcha hayvonga mos tushadi.
- Noyob skin to'liq rasm bo'lib, hayvon qatlamini almashtiradi.

**Sovg'alar:** do'kondan sotib olinib, o'quvchiga ko'rinadigan istalgan o'quvchiga yuboriladi; oluvchi profilidagi "sovg'alar vitrinasi"da ko'rinadi; tangaga qaytarilmaydi.

**Tug'ilgan kun:** o'sha kuni boshqalarning bosh sahifasida banner (`birthday` maxfiylik sozlamasiga ko'ra), har kim o'zi yopguncha ko'rinadi; egasining avatarida bezak; har kishi tayyor to'plamdan bitta reaksiya qoldiradi (🎉 🎂 🥳 🎁 ❤️ 👏); sovg'a yuborish mumkin. Erkin matnli xabar yo'q.

### 5.12. Eventlar (3-versiya)

- O'qituvchi event yaratadi: nom, boshlanish va tugash sanasi, sayt effekti, har yili takrorlanishi.
- Event davomida: sayt effekti (qor, gul barglari, yomg'ir va chaqmoq, bulutlar, kuz barglari), faqat shu event davomida sotiladigan mahsulotlar, event nishonlari.
- Event mahsulotlari keyingi yili shu event qaytganda yana sotuvga chiqadi.
- Sotib olingan mahsulot event tugagach ham o'quvchida qoladi.
- Platformada haqiqiy pul hech qachon ishlatilmaydi.

### 5.13. Aldashga qarshi choralar

Uyda AI yoki ikkinchi qurilmadan foydalanishni to'liq to'xtatib bo'lmaydi. Maqsad: aldashdan foydani kamaytirish, to'siq qo'yish va o'qituvchiga signal berish. Qat'iy rejimdagi avtomatik topshirishdan tashqari hech bir signal avtomatik jazoga aylanmaydi.

**Uyga vazifa — mashq** (3, 5-bosqich; tangalar 2-versiyada):
- Reyting va mavzu tahlili jonli testlarga tayanadi (5.9); uyga vazifa "Mashqlar" bo'limida alohida ko'rsatiladi.
- Izoh va to'g'ri javob test topshirilgandan keyin ochiladi (5.5), shunda javobni o'zgartirish imkoniyati to'g'ri javobni bilib olishga aylanmaydi.
- Uyga vazifa tangalari kunlik chek bilan (5.11).

**Texnik to'siqlar** (3-bosqich):
- **Savollar havzasi:** `questions_per_attempt` berilgan bo'lsa, urinish boshida testdagi savollardan shuncha tasi tasodifiy tanlanib `question_order` ga yoziladi. Savol-ma-savol jonli uslubida tanlov sessiya boshida bir marta, hamma uchun bir xil bo'ladi.
- **Nusxalashni cheklash:** test sahifasida matnni belgilash, nusxalash va kontekst menyusi o'chiriladi (`user-select: none`, `copy` va `contextmenu` hodisalari bloklanadi). Bu kuchsiz to'siq, telefon kamerasini to'xtatmaydi.
- **Vaqt chegarasi:** mavjud sozlama (5.5); test formasida "savol boshiga taxminan 1 daqiqa" maslahati ko'rsatiladi.

**Qat'iy rejim** (`strict_mode`, har bir test uchun alohida; uyga vazifa 3-bosqichda, jonli uslublar 4-bosqichda):
- Brauzer sahifaning yashirilishi yoki fokus yo'qolishini (`visibilitychange`, `blur`) va qaytishni serverga yuboradi; server `attempt_exits` ga yozadi.
- `duration_seconds < strict_min_exit_seconds` bo'lgan chiqish hisobga olinmaydi (`counted = false`), shunda bildirishnomaga tasodifan tegish jazolanmaydi.
- Hisoblangan chiqishdan qaytganda ogohlantirish: "Testdan chiqdingiz (k/N). Yana N−k marta chiqsangiz, test avtomatik topshiriladi."
- N-hisoblangan chiqishda server urinishni o'sha paytdagi javoblar bilan topshiradi (`submit_reason = 'strict_exits'`). Javoblar o'chirilmaydi, yangidan boshlash yo'q.
- Tab yopilib qayta ochilsa: chiqish vaqti oxirgi qayd etilgan hodisa, qaytish vaqti urinish qayta ochilgan payt.
- Savol-ma-savol jonli uslubida N-chiqishdan keyin o'quvchining keyingi javoblari qabul qilinmaydi.
- O'qituvchi o'quvchiga qo'shimcha urinish beradi (`assignment_extra_attempts`).
- Cheklov: chiqish hodisalarini brauzer yuboradi, texnik bilimli o'quvchi ularni to'sishi mumkin. Rejim kafolat emas, to'xtatuvchi vosita.

**O'qituvchi uchun signallar** (barcha testlarda qayd etiladi, qat'iy rejim o'chiq bo'lsa ham; jonli rejimda kuzatuv panelida real vaqtda, qolganlari 5-bosqichda ko'rsatkichlarda):
- **Ekrandan chiqishlar:** urinish bo'yicha soni va jami davomiyligi.
- **Tez javob:** `first_answered_at − shown_at < 3` soniya bo'lgan savollar; urinishda 3 ta va undan ko'p bo'lsa belgi.
- **Natijalar farqi:** joriy kursda kamida 3 ta uyga vazifa va 3 ta jonli testi bor o'quvchining uyga vazifa o'rtachasi jonli o'rtachasidan 30 foiz punkt va undan ko'proq yuqori bo'lsa ogohlantirish.
- Signallar faqat o'qituvchiga ko'rinadi.

---

## 6. Xatoliklar va chekka holatlar

- **Internet uzilishi:** yuborilgan javoblar serverda; qayta ulanganda o'quvchi hozirgi savolga yoki yechayotgan joyiga qaytadi. Yuborilmagan belgi saqlanmaydi va bu o'quvchiga "yuborilmagan" belgisi bilan ko'rsatiladi.
- **Kech kelgan javob:** server savol yoki urinish yopilgan vaqtni tekshiradi; 2 soniyagacha tarmoq kechikishi qabul qilinadi, undan keyingisi rad etiladi va o'quvchiga xabar ko'rsatiladi.
- **Ikki marta bosish / qayta yuborish:** javob `(attempt_id, question_id)` bo'yicha upsert, takror yozuv bo'lmaydi.
- **Ikki qurilmadan kirish:** bir urinish ikkala qurilmada bir xil holatni ko'rsatadi (oxirgi yuborilgan javob amal qiladi).
- **O'qituvchi brauzeri yopilsa:** jonli sessiya holati ma'lumotlar bazasida; taymer bo'yicha savol avtomatik yopiladi, o'qituvchi qaytib kelib davom ettiradi.
- **Fayl yuklash xatosi:** hajm yoki tur mos kelmasa aniq xabar; yarim yuklangan fayl saqlanmaydi.
- **Tanga yetishmasligi:** xarid tranzaksiya ichida tekshiriladi va rad etiladi.
- **Qat'iy rejimda internet uzilishi:** internet yo'qolishi sahifani yashirmaydi, shuning uchun chiqish hisoblanmaydi; uzilish paytidagi chiqish hodisalari qayta ulanganda yuboriladi.
- **Qat'iy rejimda sahifani yangilash:** odatda `strict_min_exit_seconds` dan qisqa bo'lgani uchun hisobga olinmaydi.

---

## 7. Test qilish strategiyasi

- **Unit testlar:** baholash (har bir savol turi, bir nechta to'g'ri javob), `deadline_at` hisobi, ko'rsatkich chegaralari (80/50), tanga qoidalari (qayta urinish faqat o'sish uchun, kunlik chek), nishon shablonlari, savollar havzasidan tanlash, chiqishlarni hisoblash (minimal davomiylik, N-chiqishda topshirish), tez javob va natijalar farqi signallari.
- **Ma'lumotlar bazasi testlari:** Supabase lokal muhitida RLS va `can_view` uchun har bir maxfiylik kombinatsiyasi (`everyone` / `own_group` / `nobody`, guruh istisnosi, arxivlangan o'quvchi) va "o'quvchi `question_answer_keys` ni o'qiy olmaydi" tekshiruvi.
- **E2E (Playwright):** o'qituvchi akkaunt yaratadi → o'quvchi onboarding; uyga vazifa to'liq oqimi (javobni o'zgartirish, ko'rib chiqish, topshirish, muddat o'tishi); bir nechta o'quvchi brauzeri bilan jonli sessiya (holatlar paneli, savolni yopish, natija); qat'iy rejim (tabdan chiqish → ogohlantirish → N-chiqishda avtomatik topshirish); telefon o'lchamidagi ekranda asosiy oqimlar.

---

## 8. Bosqichlar

Har bir bosqich alohida amalga oshirish rejasi bilan quriladi va ishlaydigan holda topshiriladi.

**1-versiya — darsda ishlatsa bo'ladigan asosiy platforma**
1. **Asos:** loyiha sozlamalari, kurslar, guruhlar, akkauntlar, onboarding (oddiy avatar), maxfiylik.
2. **Resurslar.**
3. **Testlar:** savollar bazasi, testlar, uyga vazifa rejimi, javob berish qoidalari, savollar havzasi, nusxalashni cheklash, qat'iy rejim va chiqishlarni qayd etish.
4. **Jonli rejim:** ikkala uslub, kuzatuv paneli (chiqishlar bilan), proyektor ekrani, jonli uslublarda qat'iy rejim.
5. **Ko'rsatkichlar va bildirishnomalar:** "Darsdagi testlar" va "Mashqlar" bo'linishi, aldash signallari.

**2-versiya — gamification**
6. Nishonlar (konstruktor bilan), tangalar, do'kon, qatlamli avatarlar, sovg'alar, tug'ilgan kun, reyting.

**3-versiya — eventlar**
7. Event tizimi, sayt effektlari, event mahsulotlari va nishonlari.

---

## 9. Hozircha kiritilmaydi (keyingi g'oyalar)

- Kod yozish va qisqa matnli javobli savollar (Frontend va Backend kurslari uchun). `questions.type` va baholash moduli yangi turni qo'shishga tayyor qilib loyihalanadi.
- Savollarga turli ball og'irligi, qisman ball.
- Telefon push-bildirishnomalari, Telegram bot.
- O'quvchilar dizayn tanlovi (o'quvchi skin yuklaydi, o'qituvchi tasdiqlaydi, sotilganda muallif tanga oladi, "Dizayner" nishoni).
- Bir nechta o'qituvchi.
- Veb-kamera orqali kuzatish va "qulflangan brauzer" (voyaga yetmaganlar shaxsiy hayotiga ortiqcha aralashuv, telefonda ishlamaydi).
- O'quvchi o'z parolini mustaqil tiklashi.

import { createClient } from '@supabase/supabase-js'
import { loginSchema, loginToEmail, passwordSchema } from '../src/lib/auth/login'

// R2: admin.ts `server-only` import qiladi, tsx ostida ishlamaydi - o'z klientimiz.
async function main() {
  const [rawLogin, rawPassword, fullName] = process.argv.slice(2)
  if (!rawLogin || !rawPassword || !fullName?.trim()) {
    console.error('Foydalanish: npm run create-teacher -- <login> <parol> "<Ism Familiya>"')
    process.exit(1)
  }

  const login = loginSchema.safeParse(rawLogin)
  if (!login.success) {
    console.error('Xato: login 3-20 belgi bo\'lsin: kichik lotin harflari, raqamlar, nuqta yoki pastki chiziq')
    process.exit(1)
  }
  const password = passwordSchema.safeParse(rawPassword)
  if (!password.success) {
    console.error("Xato: parol 6-72 belgidan iborat bo'lsin")
    process.exit(1)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error("Xato: NEXT_PUBLIC_SUPABASE_URL va SUPABASE_SERVICE_ROLE_KEY .env.local da bo'lishi kerak")
    process.exit(1)
  }

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await admin.auth.admin.createUser({
    email: loginToEmail(login.data),
    password: password.data,
    email_confirm: true,
  })
  if (error || !data.user) {
    console.error(`Xato: akkaunt yaratilmadi (${error?.message ?? "noma'lum xato"})`)
    process.exit(1)
  }

  const { error: profileError } = await admin.from('profiles').insert({
    id: data.user.id,
    role: 'teacher',
    login: login.data,
    full_name: fullName.trim(),
    onboarding_done: true,
  })
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id)
    console.error(`Xato: profil yaratilmadi, akkaunt bekor qilindi (${profileError.message})`)
    process.exit(1)
  }

  console.log(`O'qituvchi yaratildi: ${login.data}`)
}

main().catch((e) => {
  console.error('Xato:', e instanceof Error ? e.message : e)
  process.exit(1)
})

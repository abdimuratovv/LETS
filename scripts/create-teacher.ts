import readline from 'node:readline'
import { createClient } from '@supabase/supabase-js'
import { loginSchema, loginToEmail, passwordSchema } from '../src/lib/auth/login'

const PROD_URL_DEFAULT = 'https://rjerkcgsxvbjoicdnyer.supabase.co'

// Terminalda so'rash; hidden=true bo'lsa kiritilgan belgilar ko'rinmaydi (parol, kalit).
function ask(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    let muted = false
    ;(rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s) => {
      if (!muted) process.stdout.write(s)
    }
    rl.question(question, (answer) => {
      rl.close()
      if (hidden) process.stdout.write('\n')
      resolve(answer)
    })
    muted = hidden
  })
}

// R2: admin.ts `server-only` import qiladi, tsx ostida ishlamaydi - o'z klientimiz.
// Foydalanish:
//   npm run create-teacher -- <login> <parol> "<Ism Familiya>"   (.env.local dagi baza)
//   npm run create-teacher -- --prod                              (interaktiv, production; .env.local e'tiborsiz)
async function main() {
  const args = process.argv.slice(2)
  const prod = args.includes('--prod')
  const positional = args.filter((a) => a !== '--prod')

  let url = process.env.NEXT_PUBLIC_SUPABASE_URL
  let key = process.env.SUPABASE_SERVICE_ROLE_KEY
  let [rawLogin, rawPassword, fullName] = positional

  if (prod) {
    url = (await ask(`Production URL [${PROD_URL_DEFAULT}]: `)).trim() || PROD_URL_DEFAULT
    key = (await ask('Service role kalit (ko\'rinmaydi): ', true)).trim()
  }
  if (prod || !rawLogin || !rawPassword || !fullName?.trim()) {
    rawLogin = rawLogin || (await ask('Login: ')).trim()
    rawPassword = rawPassword || (await ask('Parol (ko\'rinmaydi): ', true))
    fullName = fullName || (await ask('Ism Familiya: '))
  }
  if (!rawLogin || !rawPassword || !fullName?.trim()) {
    console.error('Foydalanish: npm run create-teacher -- <login> <parol> "<Ism Familiya>"  yoki  -- --prod')
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

  if (!url || !key) {
    console.error("Xato: NEXT_PUBLIC_SUPABASE_URL va SUPABASE_SERVICE_ROLE_KEY .env.local da bo'lishi kerak")
    process.exit(1)
  }

  if (prod) {
    const host = new URL(url).host
    const ok = (await ask(`${host} ga "${login.data}" o'qituvchisi yaratiladi. Davom etish uchun "ha" yozing: `))
      .trim()
      .toLowerCase()
    if (ok !== 'ha') {
      console.error('Bekor qilindi.')
      process.exit(1)
    }
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

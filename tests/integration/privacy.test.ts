import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createStudent } from '@/modules/auth-accounts/service'
import {
  getPrivacyMatrix,
  listVisibleStudents,
  setGlobalScope,
  setGroupOverride,
  touchLastSeen,
} from '@/modules/privacy/service'
import {
  adminClient,
  makeGroup,
  makeTeacher,
  resetData,
  signInAs,
  type DbClient,
} from './helpers'

const MISSING_GROUP = '11111111-1111-4111-8111-111111111111'

async function makeStudent(
  login: string,
  groupId: string,
  fullName: string,
): Promise<{ id: string; client: DbClient }> {
  const res = await createStudent(adminClient(), { login, password: 'parol12', groupId })
  if (!res.ok) throw new Error(res.error)
  const { error } = await adminClient()
    .from('profiles')
    .update({
      full_name: fullName,
      birth_date: '2010-05-17',
      avatar_config: { base: 'fox' },
      onboarding_done: true,
    })
    .eq('id', res.data.id)
  if (error) throw new Error(error.message)
  return { id: res.data.id, client: await signInAs(login, 'parol12') }
}

describe('privacy service', () => {
  let groupA: string
  let groupB: string
  let a1: { id: string; client: DbClient }
  let a2: { id: string; client: DbClient }
  let b1: { id: string; client: DbClient }
  let teacher: DbClient

  beforeEach(async () => {
    await resetData()
    groupA = (await makeGroup('7-A')).id
    groupB = (await makeGroup('7-B')).id
    a1 = await makeStudent('ali.k', groupA, 'Ali Karimov')
    a2 = await makeStudent('vali.s', groupA, 'Vali Saidov')
    b1 = await makeStudent('gayrat.n', groupB, "G'ayrat Nazarov")
    await makeTeacher()
    teacher = await signInAs('teacher', 'teacher123')
  })

  afterAll(async () => {
    await resetData()
  })

  it("boshlang'ich matritsa: badges hammaga, qolganlari o'z guruhiga, istisno yo'q", async () => {
    const m = await getPrivacyMatrix(teacher)
    expect(m.global).toEqual({
      avatar: 'own_group',
      online_status: 'own_group',
      stats: 'own_group',
      badges: 'everyone',
      birthday: 'own_group',
    })
    expect(m.overrides).toEqual([])
  })

  it("avatar = nobody: guruhdoshning avatari null, ismi ko'rinadi", async () => {
    const before = await listVisibleStudents(a1.client)
    expect(before.find((s) => s.id === a2.id)?.avatarConfig).toEqual({ base: 'fox' })

    expect(await setGlobalScope(teacher, 'avatar', 'nobody')).toEqual({ ok: true, data: null })
    expect((await getPrivacyMatrix(teacher)).global.avatar).toBe('nobody')

    const list = await listVisibleStudents(a1.client)
    const mate = list.find((s) => s.id === a2.id)
    expect(mate).toMatchObject({
      fullName: 'Vali Saidov',
      groupId: groupA,
      sameGroup: true,
      avatarConfig: null,
    })
    // o'zi ro'yxatda yo'q
    expect(list.some((s) => s.id === a1.id)).toBe(false)
  })

  it("guruh istisnosi B guruhi o'quvchilarini boshqa guruhga ochadi va o'chirilganda yopadi", async () => {
    expect((await setGlobalScope(teacher, 'badges', 'own_group')).ok).toBe(true)
    // stats global = own_group (boshlang'ich) -> B ko'rinmaydi
    expect((await listVisibleStudents(a1.client)).some((s) => s.id === b1.id)).toBe(false)

    expect(await setGroupOverride(teacher, groupB, 'stats', 'everyone')).toEqual({
      ok: true,
      data: null,
    })
    expect((await getPrivacyMatrix(teacher)).overrides).toEqual([
      { groupId: groupB, item: 'stats', scope: 'everyone' },
    ])
    const visible = await listVisibleStudents(a1.client)
    const other = visible.find((s) => s.id === b1.id)
    expect(other).toMatchObject({ fullName: "G'ayrat Nazarov", sameGroup: false, groupId: groupB })
    // avatar faqat o'z guruhiga -> boshqa guruh o'quvchisiga null
    expect(other?.avatarConfig).toBeNull()

    expect(await setGroupOverride(teacher, groupB, 'stats', null)).toEqual({ ok: true, data: null })
    expect((await getPrivacyMatrix(teacher)).overrides).toEqual([])
    expect((await listVisibleStudents(a1.client)).some((s) => s.id === b1.id)).toBe(false)
  })

  it("istisnoni qayta yozish bitta qator qoldiradi; yo'q istisnoni o'chirish ok", async () => {
    await setGroupOverride(teacher, groupB, 'avatar', 'everyone')
    await setGroupOverride(teacher, groupB, 'avatar', 'nobody')
    expect((await getPrivacyMatrix(teacher)).overrides).toEqual([
      { groupId: groupB, item: 'avatar', scope: 'nobody' },
    ])
    expect(await setGroupOverride(teacher, groupA, 'birthday', null)).toEqual({
      ok: true,
      data: null,
    })
  })

  it("noto'g'ri qiymatlar va yo'q guruh rad etiladi", async () => {
    expect(await setGlobalScope(teacher, 'nope' as never, 'everyone')).toEqual({
      ok: false,
      error: 'invalid_privacy',
    })
    expect(await setGlobalScope(teacher, 'avatar', 'all' as never)).toEqual({
      ok: false,
      error: 'invalid_privacy',
    })
    expect(await setGroupOverride(teacher, MISSING_GROUP, 'avatar', 'everyone')).toEqual({
      ok: false,
      error: 'group_not_found',
    })
    expect(await setGroupOverride(teacher, 'not-a-uuid', 'avatar', 'everyone')).toEqual({
      ok: false,
      error: 'group_not_found',
    })
  })

  it("o'quvchi sessiyasi bilan sozlamalarni o'zgartirib bo'lmaydi", async () => {
    expect(await setGlobalScope(a1.client, 'avatar', 'everyone')).toEqual({
      ok: false,
      error: 'forbidden',
    })
    expect(await setGroupOverride(a1.client, groupB, 'stats', 'everyone')).toEqual({
      ok: false,
      error: 'forbidden',
    })
    await setGroupOverride(teacher, groupB, 'stats', 'everyone')
    expect(await setGroupOverride(a1.client, groupB, 'stats', null)).toEqual({
      ok: false,
      error: 'forbidden',
    })
    const m = await getPrivacyMatrix(teacher)
    expect(m.global.avatar).toBe('own_group')
    expect(m.overrides).toHaveLength(1)
  })

  it("online holati: guruhdoshning last_seen_at ko'rinadi, nobody bo'lsa null", async () => {
    await touchLastSeen(a2.client, a2.id)
    const mate = (await listVisibleStudents(a1.client)).find((s) => s.id === a2.id)
    expect(mate?.lastSeenAt).not.toBeNull()
    expect(mate?.birthdayMd).toBe('05-17')

    await setGlobalScope(teacher, 'online_status', 'nobody')
    const hidden = (await listVisibleStudents(a1.client)).find((s) => s.id === a2.id)
    expect(hidden?.lastSeenAt).toBeNull()
  })

  it("touchLastSeen 5 daqiqa ichida qayta yozmaydi, eski bo'lsa yangilaydi", async () => {
    const read = async () =>
      (await adminClient().from('profiles').select('last_seen_at').eq('id', a1.id).single()).data!
        .last_seen_at

    expect(await read()).toBeNull()
    await touchLastSeen(a1.client, a1.id)
    const first = await read()
    expect(first).not.toBeNull()

    await touchLastSeen(a1.client, a1.id)
    expect(await read()).toBe(first)

    const old = new Date(Date.now() - 10 * 60_000).toISOString()
    await adminClient().from('profiles').update({ last_seen_at: old }).eq('id', a1.id)
    await touchLastSeen(a1.client, a1.id)
    const updated = await read()
    expect(new Date(updated!).getTime()).toBeGreaterThan(Date.now() - 60_000)
  })
})

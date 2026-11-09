import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  createLinkResource,
  createNoteResource,
  deleteResource,
  discardUpload,
  listResourcesForTopic,
  moveResource,
  prepareFileUpload,
  registerFileResource,
  updateResource,
} from '@/modules/resources/service'
import { createTopic } from '@/modules/topics/service'
import {
  adminClient,
  makeCourse,
  makeGroup,
  makeTeacher,
  resetData,
  signInAs,
  type DbClient,
} from './helpers'

const MISSING_ID = '11111111-1111-4111-8111-111111111111'

function pdfBlob(bytes = 1024): Blob {
  return new Blob([new Uint8Array(bytes).fill(65)], { type: 'application/pdf' })
}

async function objectExists(path: string): Promise<boolean> {
  const { data } = await adminClient().storage.from('resources').exists(path)
  return data
}

describe('resources service (o\'qituvchi)', () => {
  let teacher: DbClient
  let courseId: string
  let topicId: string

  beforeEach(async () => {
    await resetData()
    const t = await makeTeacher()
    teacher = await signInAs(t.login, t.password)
    courseId = (await makeCourse('CS')).id
    topicId = await newTopic('Kirish')
  })

  afterAll(async () => {
    await resetData()
  })

  async function newTopic(title: string): Promise<string> {
    const res = await createTopic(teacher, { courseId, title })
    if (!res.ok) throw new Error(res.error)
    return res.data.id
  }

  async function uploadPdf(forTopic: string): Promise<string> {
    const prep = await prepareFileUpload(teacher, {
      topicId: forTopic,
      fileName: 'a.pdf',
      fileSize: 1024,
    })
    if (!prep.ok) throw new Error(prep.error)
    const { error } = await teacher.storage
      .from('resources')
      .uploadToSignedUrl(prep.data.path, prep.data.token, pdfBlob())
    expect(error).toBeNull()
    return prep.data.path
  }

  describe('createLinkResource', () => {
    it("to'g'ri URL -> ok va ro'yxatda ko'rinadi", async () => {
      const res = await createLinkResource(teacher, {
        topicId,
        title: ' Python hujjatlari ',
        url: 'https://docs.python.org',
      })
      expect(res.ok).toBe(true)
      const list = await listResourcesForTopic(teacher, topicId)
      expect(list).toHaveLength(1)
      expect(list[0]).toMatchObject({
        topicId,
        type: 'link',
        title: 'Python hujjatlari',
        url: 'https://docs.python.org',
        fileName: null,
        bodyMd: null,
        groupIds: [],
      })
    })

    it("javascript: URL -> invalid_url", async () => {
      expect(
        await createLinkResource(teacher, { topicId, title: 'Havola', url: 'javascript:alert(1)' }),
      ).toEqual({ ok: false, error: 'invalid_url' })
    })

    it("bo'sh nom -> invalid_title", async () => {
      expect(
        await createLinkResource(teacher, { topicId, title: ' ', url: 'https://a.uz' }),
      ).toEqual({ ok: false, error: 'invalid_title' })
    })

    it("mavjud bo'lmagan groupId -> invalid_group", async () => {
      expect(
        await createLinkResource(teacher, {
          topicId,
          title: 'Havola',
          url: 'https://a.uz',
          groupIds: [MISSING_ID],
        }),
      ).toEqual({ ok: false, error: 'invalid_group' })
      expect(
        await createLinkResource(teacher, {
          topicId,
          title: 'Havola',
          url: 'https://a.uz',
          groupIds: ['abc'],
        }),
      ).toEqual({ ok: false, error: 'invalid_group' })
      expect(await listResourcesForTopic(teacher, topicId)).toEqual([])
    })

    it('guruh cheklovi saqlanadi', async () => {
      const g = await makeGroup('A')
      const res = await createLinkResource(teacher, {
        topicId,
        title: 'Havola',
        url: 'https://a.uz',
        groupIds: [g.id],
      })
      expect(res.ok).toBe(true)
      expect((await listResourcesForTopic(teacher, topicId))[0].groupIds).toEqual([g.id])
    })

    it("mavjud bo'lmagan mavzu -> topic_not_found", async () => {
      expect(
        await createLinkResource(teacher, { topicId: MISSING_ID, title: 'Havola', url: 'https://a.uz' }),
      ).toEqual({ ok: false, error: 'topic_not_found' })
    })
  })

  describe('createNoteResource', () => {
    it("bo'sh matn -> invalid_body", async () => {
      expect(
        await createNoteResource(teacher, { topicId, title: 'Konspekt', bodyMd: '' }),
      ).toEqual({ ok: false, error: 'invalid_body' })
      expect(
        await createNoteResource(teacher, { topicId, title: 'Konspekt', bodyMd: '  \n ' }),
      ).toEqual({ ok: false, error: 'invalid_body' })
    })

    it('matn saqlanadi', async () => {
      const res = await createNoteResource(teacher, {
        topicId,
        title: 'Konspekt',
        bodyMd: '# Sarlavha\n\n- a',
      })
      expect(res.ok).toBe(true)
      const [note] = await listResourcesForTopic(teacher, topicId)
      expect(note).toMatchObject({ type: 'note', bodyMd: '# Sarlavha\n\n- a', url: null })
    })
  })

  describe('fayl yuklash', () => {
    it('ruxsat etilmagan kengaytma -> invalid_file', async () => {
      expect(
        await prepareFileUpload(teacher, { topicId, fileName: 'a.exe', fileSize: 1024 }),
      ).toEqual({ ok: false, error: 'invalid_file' })
    })

    it('50 MB dan katta -> file_too_large', async () => {
      expect(
        await prepareFileUpload(teacher, { topicId, fileName: 'a.pdf', fileSize: 52428801 }),
      ).toEqual({ ok: false, error: 'file_too_large' })
    })

    it("mavjud bo'lmagan mavzu -> topic_not_found", async () => {
      expect(
        await prepareFileUpload(teacher, { topicId: MISSING_ID, fileName: 'a.pdf', fileSize: 10 }),
      ).toEqual({ ok: false, error: 'topic_not_found' })
    })

    it("to'g'ri holatda yo'l topicId/<uuid>.pdf; yuklab ro'yxatdan o'tkaziladi", async () => {
      const prep = await prepareFileUpload(teacher, { topicId, fileName: 'a.pdf', fileSize: 1024 })
      if (!prep.ok) throw new Error(prep.error)
      expect(prep.data.path).toMatch(
        new RegExp(`^${topicId}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.pdf$`),
      )
      expect(prep.data.token).toBeTruthy()

      const { error } = await teacher.storage
        .from('resources')
        .uploadToSignedUrl(prep.data.path, prep.data.token, pdfBlob())
      expect(error).toBeNull()

      const reg = await registerFileResource(teacher, {
        topicId,
        title: 'Taqdimot',
        path: prep.data.path,
        fileName: 'a.pdf',
        fileSize: 1024,
      })
      expect(reg.ok).toBe(true)

      const [file] = await listResourcesForTopic(teacher, topicId)
      expect(file).toMatchObject({
        type: 'file',
        title: 'Taqdimot',
        fileName: 'a.pdf',
        fileSize: 1024,
        url: null,
        bodyMd: null,
      })
    })

    it("yuklanmagan yo'l -> invalid_file", async () => {
      const prep = await prepareFileUpload(teacher, { topicId, fileName: 'a.pdf', fileSize: 1024 })
      if (!prep.ok) throw new Error(prep.error)
      expect(
        await registerFileResource(teacher, {
          topicId,
          title: 'Taqdimot',
          path: prep.data.path,
          fileName: 'a.pdf',
          fileSize: 1024,
        }),
      ).toEqual({ ok: false, error: 'invalid_file' })
      expect(await listResourcesForTopic(teacher, topicId)).toEqual([])
    })

    it("boshqa mavzu yo'li -> invalid_file", async () => {
      const otherTopic = await newTopic('Boshqa')
      const path = await uploadPdf(otherTopic)
      expect(
        await registerFileResource(teacher, {
          topicId,
          title: 'Taqdimot',
          path,
          fileName: 'a.pdf',
          fileSize: 1024,
        }),
      ).toEqual({ ok: false, error: 'invalid_file' })
    })

    it("bir yo'l ikki marta ro'yxatdan o'tmaydi -> invalid_file", async () => {
      const path = await uploadPdf(topicId)
      const input = { topicId, title: 'Taqdimot', path, fileName: 'a.pdf', fileSize: 1024 }
      expect((await registerFileResource(teacher, input)).ok).toBe(true)
      expect(await registerFileResource(teacher, input)).toEqual({ ok: false, error: 'invalid_file' })
    })
  })

  it("discardUpload ro'yxatdan o'tmagan yuklamani o'chiradi, resurs faylini emas", async () => {
    const orphan = await uploadPdf(topicId)
    expect(await discardUpload(teacher, { topicId, path: orphan })).toEqual({ ok: true, data: null })
    expect(await objectExists(orphan)).toBe(false)

    const path = await uploadPdf(topicId)
    const reg = await registerFileResource(teacher, {
      topicId,
      title: 'Taqdimot',
      path,
      fileName: 'a.pdf',
      fileSize: 1024,
    })
    expect(reg.ok).toBe(true)
    expect(await discardUpload(teacher, { topicId, path })).toEqual({
      ok: false,
      error: 'invalid_file',
    })
    expect(await objectExists(path)).toBe(true)
    expect(await discardUpload(teacher, { topicId, path: 'boshqa/joy.pdf' })).toEqual({
      ok: false,
      error: 'invalid_file',
    })
  })

  it("moveResource tartibni almashtiradi", async () => {
    const a = await createLinkResource(teacher, { topicId, title: 'Aaa', url: 'https://a.uz' })
    const b = await createNoteResource(teacher, { topicId, title: 'Bbb', bodyMd: 'matn' })
    if (!a.ok || !b.ok) throw new Error('setup')
    const titles = async () => (await listResourcesForTopic(teacher, topicId)).map((r) => r.title)

    expect(await titles()).toEqual(['Aaa', 'Bbb'])
    expect(await moveResource(teacher, a.data.id, 'up')).toEqual({ ok: true, data: null })
    expect(await titles()).toEqual(['Aaa', 'Bbb'])
    expect(await moveResource(teacher, b.data.id, 'up')).toEqual({ ok: true, data: null })
    expect(await titles()).toEqual(['Bbb', 'Aaa'])
    expect(await moveResource(teacher, b.data.id, 'down')).toEqual({ ok: true, data: null })
    expect(await titles()).toEqual(['Aaa', 'Bbb'])
    expect(await moveResource(teacher, MISSING_ID, 'up')).toEqual({ ok: false, error: 'not_found' })
  })

  it("deleteResource (fayl) Storage obyektini ham o'chiradi", async () => {
    const path = await uploadPdf(topicId)
    const reg = await registerFileResource(teacher, {
      topicId,
      title: 'Taqdimot',
      path,
      fileName: 'a.pdf',
      fileSize: 1024,
    })
    if (!reg.ok) throw new Error(reg.error)
    expect(await objectExists(path)).toBe(true)

    expect(await deleteResource(teacher, reg.data.id)).toEqual({ ok: true, data: null })
    expect(await listResourcesForTopic(teacher, topicId)).toEqual([])
    expect(await objectExists(path)).toBe(false)
    expect(await deleteResource(teacher, reg.data.id)).toEqual({ ok: false, error: 'not_found' })
  })

  describe('updateResource', () => {
    it("nom, URL va guruhlarni o'zgartiradi; updated_at yangilanadi", async () => {
      const g = await makeGroup('A')
      const res = await createLinkResource(teacher, { topicId, title: 'Eski', url: 'https://a.uz' })
      if (!res.ok) throw new Error(res.error)
      // Eski vaqt qo'yiladi: host va DB soatlari farqiga bog'liq bo'lmasin.
      const old = '2020-01-01T00:00:00Z'
      await adminClient().from('resources').update({ updated_at: old }).eq('id', res.data.id)

      expect(
        await updateResource(teacher, res.data.id, {
          title: 'Yangi',
          url: 'https://b.uz',
          groupIds: [g.id],
        }),
      ).toEqual({ ok: true, data: null })
      let [r] = await listResourcesForTopic(teacher, topicId)
      expect(r).toMatchObject({ title: 'Yangi', url: 'https://b.uz', groupIds: [g.id] })

      const { data: after } = await adminClient()
        .from('resources')
        .select('updated_at')
        .eq('id', res.data.id)
        .single()
      expect(new Date(after!.updated_at).getTime()).toBeGreaterThan(new Date(old).getTime())

      // Bo'sh ro'yxat - yana barcha guruhlarga ochiq
      expect(await updateResource(teacher, res.data.id, { groupIds: [] })).toEqual({
        ok: true,
        data: null,
      })
      ;[r] = await listResourcesForTopic(teacher, topicId)
      expect(r.groupIds).toEqual([])
    })

    async function storedGroups(resourceId: string): Promise<string[]> {
      const { data } = await adminClient()
        .from('resource_groups')
        .select('group_id')
        .eq('resource_id', resourceId)
      return (data ?? []).map((r) => r.group_id)
    }

    it('guruhlar {A} -> {B}: faqat B qoladi', async () => {
      const a = await makeGroup('A')
      const b = await makeGroup('B')
      const res = await createLinkResource(teacher, {
        topicId,
        title: 'Havola',
        url: 'https://a.uz',
        groupIds: [a.id],
      })
      if (!res.ok) throw new Error(res.error)
      expect(await updateResource(teacher, res.data.id, { groupIds: [b.id] })).toEqual({
        ok: true,
        data: null,
      })
      expect(await storedGroups(res.data.id)).toEqual([b.id])
    })

    it("faqat nom o'zgarsa cheklov saqlanadi", async () => {
      const a = await makeGroup('A')
      const res = await createLinkResource(teacher, {
        topicId,
        title: 'Havola',
        url: 'https://a.uz',
        groupIds: [a.id],
      })
      if (!res.ok) throw new Error(res.error)
      expect(
        await updateResource(teacher, res.data.id, { title: 'Yangi nom', groupIds: [a.id] }),
      ).toEqual({ ok: true, data: null })
      expect(await storedGroups(res.data.id)).toEqual([a.id])
      expect(await updateResource(teacher, res.data.id, { title: 'Yana nom' })).toEqual({
        ok: true,
        data: null,
      })
      expect(await storedGroups(res.data.id)).toEqual([a.id])
    })

    it("guruhlar {A} -> {}: hammaga ochiladi", async () => {
      const a = await makeGroup('A')
      const res = await createLinkResource(teacher, {
        topicId,
        title: 'Havola',
        url: 'https://a.uz',
        groupIds: [a.id],
      })
      if (!res.ok) throw new Error(res.error)
      expect(await updateResource(teacher, res.data.id, { groupIds: [] })).toEqual({
        ok: true,
        data: null,
      })
      expect(await storedGroups(res.data.id)).toEqual([])
    })

    it("noto'g'ri qiymatlar va mavjud bo'lmagan resurs", async () => {
      const res = await createNoteResource(teacher, { topicId, title: 'Konspekt', bodyMd: 'a' })
      if (!res.ok) throw new Error(res.error)
      expect(await updateResource(teacher, res.data.id, { title: 'x' })).toEqual({
        ok: false,
        error: 'invalid_title',
      })
      expect(await updateResource(teacher, res.data.id, { bodyMd: '' })).toEqual({
        ok: false,
        error: 'invalid_body',
      })
      expect(await updateResource(teacher, res.data.id, { groupIds: [MISSING_ID] })).toEqual({
        ok: false,
        error: 'invalid_group',
      })
      expect(await updateResource(teacher, MISSING_ID, { title: 'Yangi' })).toEqual({
        ok: false,
        error: 'not_found',
      })
      expect(await updateResource(teacher, res.data.id, { bodyMd: '**b**' })).toEqual({
        ok: true,
        data: null,
      })
      expect((await listResourcesForTopic(teacher, topicId))[0].bodyMd).toBe('**b**')
    })
  })
})

import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth/guards'
import {
  getFileDownloadUrl,
  getResourceForViewing,
  recordView,
} from '@/modules/resources/service'
import { urlSchema } from '@/modules/resources/validation'

function notFound(): Response {
  return new Response('Resurs topilmadi', {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}

/**
 * Resursni ochish: havola -> tashqi manzil, fayl -> 60 soniyalik yuklab olish havolasi,
 * konspekt -> /resources/<id>. O'quvchi uchun birinchi ochilish yoziladi; o'qituvchi (R1)
 * ham shu yo'l bilan ochadi, lekin uning ko'rishi yozilmaydi.
 */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { supabase, profile } = await requireUser()
  const { id } = await ctx.params

  const res = await getResourceForViewing(supabase, id)
  if (!res.ok) return notFound()
  const resource = res.data

  if (resource.type === 'note') redirect(`/resources/${resource.id}`)

  let target: string
  if (resource.type === 'link') {
    // Bazadagi qiymat ham qayta tekshiriladi: faqat http/https.
    const url = urlSchema.safeParse(resource.url ?? '')
    if (!url.success) return notFound()
    target = url.data
  } else {
    const download = await getFileDownloadUrl(supabase, resource.id)
    if (!download.ok) return notFound()
    target = download.data.url
  }

  if (profile.role === 'student') {
    try {
      await recordView(supabase, resource.id)
    } catch (e) {
      // Ko'rish yozilmasa ham resurs ochilaveradi.
      console.error('[resources] recordView', e)
    }
  }
  redirect(target)
}

import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { headers } from 'next/headers'

export async function POST(request: Request) {
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'
  if (!rateLimit(`newsletter:${ip}`, 5, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const form = await request.formData()
  const email = String(form.get('email') || '')
  if (!email.includes('@')) {
    return NextResponse.json({ error: 'Geçersiz e-posta' }, { status: 400 })
  }
  return NextResponse.redirect(new URL('/?newsletter=1', request.url))
}

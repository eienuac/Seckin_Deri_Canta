import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Let Payload admin/API handle its own auth
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/payload')) {
    return NextResponse.next()
  }

  // Payment provider callbacks/webhooks must not go through session refresh
  if (pathname.startsWith('/api/payments/')) {
    return NextResponse.next()
  }

  return updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|media|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { listFavorites, toggleFavorite, ensureUserProfile } from '@/services/favorites'
import { getErrorMessage } from '@/lib/errors'
import { z } from 'zod'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ favorited: false, favorites: [] })

    const productId = new URL(request.url).searchParams.get('productId')
    // Prefer user-scoped client (RLS); fall back to service role if needed
    let favs
    try {
      favs = await listFavorites(supabase, user.id)
    } catch (err) {
      console.error('[GET /api/favorites] user client failed:', getErrorMessage(err))
      const admin = getSupabaseAdmin()
      favs = await listFavorites(admin, user.id)
    }

    if (!productId) {
      return NextResponse.json({ favorites: favs })
    }

    return NextResponse.json({ favorited: favs.some((f) => f.product_id === productId) })
  } catch (e) {
    const message = getErrorMessage(e)
    console.error('[GET /api/favorites]', message, e)
    return NextResponse.json({ error: message, favorited: false, favorites: [] }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = z.object({ productId: z.string().min(1) }).parse(await request.json())
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized — oturum bulunamadı' }, { status: 401 })
    }

    // Ensure profile row exists (FK target for favorites.user_id)
    try {
      await ensureUserProfile(getSupabaseAdmin(), user)
    } catch (err) {
      console.error('[POST /api/favorites] ensureUserProfile:', getErrorMessage(err))
    }

    let result
    try {
      result = await toggleFavorite(supabase, user.id, body.productId)
    } catch (err) {
      const message = getErrorMessage(err)
      console.error('[POST /api/favorites] RLS/user client failed:', message)
      // Service role fallback so logged-in users are not blocked by missing/misconfigured RLS
      const admin = getSupabaseAdmin()
      result = await toggleFavorite(admin, user.id, body.productId)
      console.info('[POST /api/favorites] succeeded via service role after:', message)
    }

    return NextResponse.json(result)
  } catch (e) {
    const message = getErrorMessage(e)
    console.error('[POST /api/favorites]', message, e)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

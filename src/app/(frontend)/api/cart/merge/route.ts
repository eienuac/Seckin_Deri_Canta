import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { mergeGuestCartIntoUser } from '@/services/cart'
import { ensureUserProfile, mergeGuestFavorites } from '@/services/favorites'
import { getErrorMessage } from '@/lib/errors'
import type { Database } from '@/types/database'

async function resolveAuthUser(request: Request) {
  const authHeader = request.headers.get('authorization')
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null

  if (bearer) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (url && anon) {
      const client = createSupabaseClient<Database>(url, anon, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${bearer}` } },
      })
      const { data } = await client.auth.getUser(bearer)
      if (data.user) return data.user
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export async function POST(request: Request) {
  try {
    const body = z
      .object({
        guestToken: z.string().min(8).optional(),
        favoriteIds: z.array(z.string()).optional(),
      })
      .parse(await request.json())

    const user = await resolveAuthUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
      await ensureUserProfile(getSupabaseAdmin(), user)
    } catch (err) {
      console.error('[cart/merge] ensureUserProfile:', getErrorMessage(err))
    }

    if (body.guestToken) {
      await mergeGuestCartIntoUser(body.guestToken, user.id)
    }

    if (body.favoriteIds?.length) {
      try {
        const cookieClient = await createClient()
        await mergeGuestFavorites(cookieClient, user.id, body.favoriteIds)
      } catch (err) {
        console.error('[cart/merge] favorites RLS failed:', getErrorMessage(err))
        await mergeGuestFavorites(getSupabaseAdmin(), user.id, body.favoriteIds)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = getErrorMessage(e, 'Merge failed')
    console.error('[POST /api/cart/merge]', message, e)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

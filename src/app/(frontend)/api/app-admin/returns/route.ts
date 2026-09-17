import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAppAdmin } from '@/lib/admin'
import { updateReturnStatus } from '@/services/returns'

export async function PATCH(request: Request) {
  const admin = await requireAppAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = z
    .object({ returnId: z.string().uuid(), status: z.string(), adminNotes: z.string().optional() })
    .parse(await request.json())

  await updateReturnStatus(body.returnId, body.status, body.adminNotes)
  return NextResponse.json({ ok: true })
}

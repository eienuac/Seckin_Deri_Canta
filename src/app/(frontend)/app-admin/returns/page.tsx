import { redirect } from 'next/navigation'
import { requireAppAdmin } from '@/lib/admin'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { RETURN_STATUS_LABELS } from '@/lib/labels'
import { ReturnAdminActions } from '@/components/admin/return-actions'

export default async function AdminReturnsPage() {
  const admin = await requireAppAdmin()
  if (!admin) redirect('/auth/login')

  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('return_requests')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="container-page py-10">
      <h1 className="font-display text-3xl">İadeler</h1>
      <ul className="mt-8 space-y-4">
        {(data || []).map((r) => (
          <li key={r.id} className="border border-border p-4">
            <p className="text-sm text-espresso">
              {RETURN_STATUS_LABELS[r.status] || r.status} — {r.reason}
            </p>
            <ReturnAdminActions returnId={r.id} status={r.status} />
          </li>
        ))}
      </ul>
    </div>
  )
}

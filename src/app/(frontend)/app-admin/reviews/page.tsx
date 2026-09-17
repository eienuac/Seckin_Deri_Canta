import { redirect } from 'next/navigation'
import { requireAppAdmin } from '@/lib/admin'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { ReviewAdminActions } from '@/components/admin/review-actions'

export default async function AdminReviewsPage() {
  const admin = await requireAppAdmin()
  if (!admin) redirect('/auth/login')

  const supabase = getSupabaseAdmin()
  const { data } = await supabase.from('reviews').select('*').order('created_at', { ascending: false })

  return (
    <div className="container-page py-10">
      <h1 className="font-display text-3xl">Yorumlar</h1>
      <ul className="mt-8 space-y-4">
        {(data || []).map((r) => (
          <li key={r.id} className="border border-border p-4 text-sm">
            <p>
              {r.rating}/5 — {r.title || 'Başlıksız'} {r.is_approved ? '(onaylı)' : '(bekliyor)'}
            </p>
            <p className="text-muted">{r.comment}</p>
            <ReviewAdminActions reviewId={r.id} approved={r.is_approved} />
          </li>
        ))}
      </ul>
    </div>
  )
}

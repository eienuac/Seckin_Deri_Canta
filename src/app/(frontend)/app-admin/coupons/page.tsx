import { redirect } from 'next/navigation'
import { requireAppAdmin } from '@/lib/admin'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { CouponAdminForm } from '@/components/admin/coupon-form'

export default async function AdminCouponsPage() {
  const admin = await requireAppAdmin()
  if (!admin) redirect('/auth/login')

  const supabase = getSupabaseAdmin()
  const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false })

  return (
    <div className="container-page py-10">
      <h1 className="font-display text-3xl">Kuponlar</h1>
      <ul className="mt-6 space-y-2 text-sm">
        {(data || []).map((c) => (
          <li key={c.id} className="border border-border p-3">
            <strong>{c.code}</strong> — {c.type} {c.value} · {c.is_active ? 'aktif' : 'pasif'}
          </li>
        ))}
      </ul>
      <CouponAdminForm />
    </div>
  )
}

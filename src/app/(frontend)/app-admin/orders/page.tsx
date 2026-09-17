import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireAppAdmin } from '@/lib/admin'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { formatPrice } from '@/lib/utils'
import { ORDER_STATUS_LABELS } from '@/lib/labels'

export default async function AdminOrdersPage() {
  const admin = await requireAppAdmin()
  if (!admin) redirect('/auth/login')

  const supabase = getSupabaseAdmin()
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div className="container-page py-10">
      <h1 className="font-display text-3xl text-espresso">Siparişler</h1>
      <ul className="mt-8 divide-y divide-border border-y border-border">
        {(orders || []).map((o) => (
          <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm">
            <div>
              <Link href={`/app-admin/orders/${o.id}`} className="text-espresso">
                {o.order_number}
              </Link>
              <p className="text-xs text-muted">
                {ORDER_STATUS_LABELS[o.status] || o.status} · {o.payment_status}
              </p>
            </div>
            <span>{formatPrice(Number(o.total))}</span>
          </li>
        ))}
        {!orders?.length && <li className="py-6 text-sm text-muted">Sipariş yok.</li>}
      </ul>
    </div>
  )
}

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireAppAdmin } from '@/lib/admin'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { formatPrice } from '@/lib/utils'
import { ORDER_STATUS_LABELS } from '@/lib/labels'

export default async function AppAdminPage() {
  const admin = await requireAppAdmin()
  if (!admin) redirect('/auth/login?next=/app-admin')

  const supabase = getSupabaseAdmin()
  const [
    { count: orderCount },
    { count: userCount },
    { count: pendingReturns },
    { count: pendingReviews },
    { data: recentOrders },
    { data: lowStock },
    { data: sales },
  ] = await Promise.all([
    supabase.from('orders').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase
      .from('return_requests')
      .select('*', { count: 'exact', head: true })
      .in('status', ['requested', 'reviewing']),
    supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('is_approved', false),
    supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(8),
    supabase.from('inventory').select('*').lt('quantity', 5).limit(10),
    supabase.from('orders').select('total').eq('payment_status', 'paid'),
  ])

  const totalSales = (sales || []).reduce((s, o) => s + Number(o.total), 0)

  return (
    <div className="container-page py-10">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Toplam satış" value={formatPrice(totalSales)} />
        <Stat label="Sipariş" value={String(orderCount ?? 0)} />
        <Stat label="Kullanıcı" value={String(userCount ?? 0)} />
        <Stat label="Düşük stok SKU" value={String(lowStock?.length ?? 0)} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Link
          href="/app-admin/returns"
          className="border border-border bg-ivory px-4 py-3 text-sm hover:border-espresso"
        >
          Bekleyen iade: <strong>{pendingReturns ?? 0}</strong>
        </Link>
        <Link
          href="/app-admin/reviews"
          className="border border-border bg-ivory px-4 py-3 text-sm hover:border-espresso"
        >
          Onay bekleyen yorum: <strong>{pendingReviews ?? 0}</strong>
        </Link>
      </div>

      <div className="mt-12 grid gap-10 lg:grid-cols-2">
        <section>
          <div className="flex items-end justify-between">
            <h2 className="font-display text-2xl">Son siparişler</h2>
            <Link href="/app-admin/orders" className="text-xs uppercase tracking-widest text-muted">
              Tümü
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {(recentOrders || []).map((o) => (
              <li key={o.id} className="flex justify-between gap-3 py-3 text-sm">
                <div>
                  <Link href={`/app-admin/orders/${o.id}`} className="text-espresso">
                    {o.order_number}
                  </Link>
                  <p className="text-xs text-muted">
                    {ORDER_STATUS_LABELS[o.status] || o.status}
                  </p>
                </div>
                <span>{formatPrice(Number(o.total))}</span>
              </li>
            ))}
            {!recentOrders?.length && (
              <li className="py-6 text-sm text-muted">Henüz sipariş yok.</li>
            )}
          </ul>
        </section>
        <section>
          <div className="flex items-end justify-between">
            <h2 className="font-display text-2xl">Düşük stok</h2>
            <Link
              href="/app-admin/inventory"
              className="text-xs uppercase tracking-widest text-muted"
            >
              Stok
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {(lowStock || []).map((row) => (
              <li key={row.id} className="flex justify-between py-3 text-sm">
                <span>{row.sku}</span>
                <span>{row.quantity} adet</span>
              </li>
            ))}
            {!lowStock?.length && (
              <li className="py-6 text-sm text-muted">Kritik stok uyarısı yok.</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-ivory px-4 py-5">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-2 font-display text-2xl text-espresso">{value}</p>
    </div>
  )
}

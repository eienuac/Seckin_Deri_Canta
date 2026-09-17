import { redirect } from 'next/navigation'
import { requireAppAdmin } from '@/lib/admin'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { InventoryManager } from '@/components/admin/inventory-manager'

export default async function AdminInventoryPage() {
  const admin = await requireAppAdmin()
  if (!admin) redirect('/auth/login')

  const supabase = getSupabaseAdmin()
  const { data } = await supabase.from('inventory').select('*').order('sku').limit(200)

  return (
    <div className="container-page py-10">
      <h1 className="font-display text-3xl">Stok</h1>
      <InventoryManager rows={data || []} />
    </div>
  )
}

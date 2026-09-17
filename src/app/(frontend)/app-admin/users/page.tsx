import { redirect } from 'next/navigation'
import { requireAppAdmin } from '@/lib/admin'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { UserRoleActions } from '@/components/admin/user-role-actions'

export default async function AdminUsersPage() {
  const admin = await requireAppAdmin()
  if (!admin) redirect('/auth/login?next=/app-admin/users')

  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  return (
    <div className="container-page py-10">
      <h1 className="font-display text-3xl text-espresso">Kullanıcılar</h1>
      <p className="mt-2 text-sm text-muted">Rol ataması ve hesap listesi.</p>
      <ul className="mt-8 divide-y divide-border border-y border-border">
        {(data || []).map((u) => (
          <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
            <div>
              <p className="text-espresso">
                {u.first_name} {u.last_name}
              </p>
              <p className="text-xs text-muted">{u.email}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase tracking-widest text-muted">{u.role}</span>
              <UserRoleActions userId={u.id} role={u.role} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

'use client'

import Link from 'next/link'

/** Payload CMS sidebar link → operations dashboard (orders, returns, etc.) */
export function AdminAppLink() {
  return (
    <div className="nav-group" style={{ marginTop: '0.75rem', padding: '0 0.5rem' }}>
      <Link
        href="/app-admin"
        style={{
          display: 'block',
          padding: '0.4rem 0.75rem',
          fontSize: '0.875rem',
          fontWeight: 600,
          color: 'var(--theme-elevation-800)',
          textDecoration: 'none',
        }}
      >
        → Operasyon / Siparişler
      </Link>
      <p
        style={{
          margin: '0.15rem 0.75rem 0',
          fontSize: '0.7rem',
          color: 'var(--theme-elevation-500)',
        }}
      >
        Sipariş, stok, kupon, iade, yorum
      </p>
    </div>
  )
}

export default AdminAppLink

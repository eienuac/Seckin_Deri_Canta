'use client'

import { useEffect, useState } from 'react'
import { RETURN_STATUS_LABELS } from '@/lib/labels'

export default function ReturnsPage() {
  const [items, setItems] = useState<Array<{ id: string; status: string; reason: string; created_at: string }>>([])

  useEffect(() => {
    fetch('/api/account/returns')
      .then((r) => r.json())
      .then((d) => setItems(d.returns || []))
  }, [])

  return (
    <div>
      <h2 className="font-display text-3xl text-espresso">İadeler</h2>
      {items.length === 0 ? (
        <p className="mt-6 text-muted">İade talebiniz yok.</p>
      ) : (
        <ul className="mt-6 divide-y divide-border border-y border-border">
          {items.map((r) => (
            <li key={r.id} className="py-4 text-sm">
              <p className="text-espresso">{RETURN_STATUS_LABELS[r.status] || r.status}</p>
              <p className="text-muted">{r.reason}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

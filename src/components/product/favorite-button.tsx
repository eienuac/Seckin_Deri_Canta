'use client'

import { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { useGuestFavorites } from '@/hooks/use-guest-favorites'

export function FavoriteButton({
  productId,
  className,
}: {
  productId: string
  className?: string
}) {
  const { user } = useAuth()
  const guest = useGuestFavorites()
  const [active, setActive] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) {
      setActive(guest.has(productId))
      return
    }
    fetch(`/api/favorites?productId=${productId}`)
      .then((r) => r.json())
      .then((d) => setActive(Boolean(d.favorited)))
      .catch(() => null)
  }, [user, productId, guest])

  async function toggle() {
    if (loading) return
    setLoading(true)
    try {
      if (!user) {
        const next = guest.toggle(productId)
        setActive(next)
        toast.success(next ? 'Favorilere eklendi' : 'Favorilerden çıkarıldı')
        return
      }
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg =
          (typeof data.error === 'string' && data.error) ||
          `Favori işlemi başarısız (HTTP ${res.status})`
        console.error('[FavoriteButton]', msg, data)
        throw new Error(msg)
      }
      setActive(Boolean(data.favorited))
      toast.success(data.favorited ? 'Favorilere eklendi' : 'Favorilerden çıkarıldı')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Bir hata oluştu'
      console.error('[FavoriteButton]', msg, e)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      aria-label={active ? 'Favorilerden çıkar' : 'Favorilere ekle'}
      onClick={toggle}
      disabled={loading}
      className={cn(
        'flex h-9 w-9 items-center justify-center bg-ivory/90 text-espresso backdrop-blur transition hover:bg-ivory',
        className
      )}
    >
      <Heart className={cn('h-4 w-4', active && 'fill-espresso')} strokeWidth={1.5} />
    </button>
  )
}

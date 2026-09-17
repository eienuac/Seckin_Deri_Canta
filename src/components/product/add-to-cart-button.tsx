'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button, type ButtonProps } from '@/components/ui/button'
import { useCart } from '@/hooks/use-cart'

export function AddToCartButton({
  productId,
  sku,
  variantId,
  quantity = 1,
  disabled,
  className,
  size = 'default',
  label = 'Sepete Ekle',
}: {
  productId: string
  sku: string
  variantId?: string
  quantity?: number
  disabled?: boolean
  className?: string
  size?: ButtonProps['size']
  label?: string
}) {
  const { addItem } = useCart()
  const [loading, setLoading] = useState(false)

  async function onClick() {
    if (disabled || loading) return
    setLoading(true)
    try {
      await addItem({ productId, sku, variantId, quantity })
      toast.success('Ürün sepete eklendi')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sepete eklenemedi')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      type="button"
      size={size}
      className={className}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading ? 'Ekleniyor…' : label}
    </Button>
  )
}

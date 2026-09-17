'use client'

import { useEffect, useState } from 'react'
import { nanoid } from 'nanoid'
import { toast } from 'sonner'
import Link from 'next/link'
import { useCart } from '@/hooks/use-cart'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { formatPrice } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'

const STEPS = ['Teslimat', 'Adres', 'Kargo', 'Ödeme', 'Özet'] as const
const GUEST_KEY = 'sc_guest_token'

export default function CheckoutPage() {
  const {
    cartId,
    items,
    subtotal,
    discount,
    couponCode,
    itemCount,
    checkoutBlocked,
    hasStockIssues,
    loading: cartLoading,
    refresh,
  } = useCart()
  const { user, loading: authLoading } = useAuth()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [shippingMethod, setShippingMethod] = useState<'standard' | 'express'>('standard')
  const [shippingQuotes, setShippingQuotes] = useState<
    Array<{ method: 'standard' | 'express'; label: string; cost: number; eta: string }>
  >([])
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: user?.email || '',
    phone: '',
    city: '',
    district: '',
    neighborhood: '',
    addressLine: '',
    postalCode: '',
  })

  useEffect(() => {
    if (user?.email && !form.email) {
      setForm((f) => ({ ...f, email: user.email || '' }))
    }
  }, [user?.email, form.email])

  useEffect(() => {
    const payable = Math.max(0, subtotal - discount)
    fetch(`/api/shipping/quote?subtotal=${payable}`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.methods)) setShippingQuotes(d.methods)
      })
      .catch(() => null)
  }, [subtotal, discount])

  // Do NOT call refresh() on mount — CartProvider already owns cart state.
  // A remount refresh was wiping a full cart with an empty user cart (~2s later).

  const selectedShipping =
    shippingQuotes.find((m) => m.method === shippingMethod) ||
    (shippingMethod === 'express'
      ? { cost: 149.9, label: 'Hızlı Kargo', eta: '1-2 iş günü' }
      : {
          cost: Math.max(0, subtotal - discount) >= 3000 ? 0 : 79.9,
          label: 'Standart Kargo',
          eta: '2-4 iş günü',
        })
  const shippingCost = selectedShipping.cost
  const total = Math.max(0, subtotal - discount + shippingCost)
  const bootstrapping = authLoading || cartLoading

  function validateStep(current: number): string | null {
    if (current <= 1) {
      if (form.firstName.trim().length < 2) return 'Ad gerekli'
      if (form.lastName.trim().length < 2) return 'Soyad gerekli'
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Geçerli e-posta girin'
      if (form.phone.replace(/\D/g, '').length < 10) return 'Geçerli telefon girin'
      if (form.city.trim().length < 2) return 'Şehir gerekli'
      if (form.addressLine.trim().length < 5) return 'Adres gerekli'
    }
    return null
  }

  function nextStep() {
    const err = validateStep(step)
    if (err) {
      toast.error(err)
      return
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  async function placeOrder() {
    const err = validateStep(1)
    if (err) {
      toast.error(err)
      setStep(1)
      return
    }
    if (!cartId) {
      toast.error('Sepet bulunamadı')
      return
    }
    if (checkoutBlocked || hasStockIssues) {
      toast.error('Sepetinizde stok sorunu var. Sepete dönüp güncelleyin.')
      return
    }
    setSubmitting(true)
    try {
      await refresh()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      try {
        const supabase = createClient()
        const { data } = await supabase.auth.getSession()
        if (data.session?.access_token) {
          headers.Authorization = `Bearer ${data.session.access_token}`
        }
      } catch {
        // guest checkout
      }

      const guestToken =
        typeof window !== 'undefined' ? localStorage.getItem(GUEST_KEY) : null

      const res = await fetch('/api/checkout', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          cartId,
          guestToken: user ? undefined : guestToken || undefined,
          shippingMethod,
          address: form,
          couponCode: couponCode || undefined,
          idempotencyKey: nanoid(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Sipariş oluşturulamadı')
      if (data.paymentPageUrl) {
        window.location.href = data.paymentPageUrl
        return
      }
      toast.error('Ödeme sağlayıcısı yapılandırılmamış (PAYMENT_API_KEY / PAYMENT_SECRET_KEY)')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hata')
    } finally {
      setSubmitting(false)
    }
  }

  if (bootstrapping) {
    return (
      <div className="container-page py-16">
        <div className="skeleton h-10 w-48" />
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <div className="skeleton h-12 w-full" />
            <div className="skeleton h-12 w-full" />
            <div className="skeleton h-12 w-full" />
          </div>
          <div className="skeleton h-64 w-full" />
        </div>
      </div>
    )
  }

  if (!itemCount) {
    return (
      <div className="container-page py-20 text-center">
        <h1 className="font-display text-3xl">Checkout için sepetiniz boş</h1>
        <div className="mt-8">
          <Link href="/products">
            <Button>Alışverişe Dön</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (checkoutBlocked || hasStockIssues) {
    return (
      <div className="container-page py-20 text-center">
        <h1 className="font-display text-3xl text-espresso">Stok sorunu</h1>
        <p className="mt-3 text-muted">
          Sepetinizde stokta olmayan ürünler var. Ödemeye devam etmek için sepeti güncelleyin.
        </p>
        <div className="mt-8">
          <Link href="/cart">
            <Button>Sepete Dön</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container-page py-10 md:py-14">
      <h1 className="font-display text-4xl text-espresso">Ödeme</h1>
      {!user && (
        <p className="mt-3 text-sm text-muted">
          Misafir olarak devam ediyorsunuz. Sipariş bilgilendirmesi e-posta adresinize gönderilir.{' '}
          <Link href="/auth/login?next=/checkout" className="underline text-espresso">
            Giriş yap
          </Link>
        </p>
      )}
      <ol className="mt-8 flex flex-wrap gap-3 text-[11px] uppercase tracking-[0.16em] text-muted">
        {STEPS.map((s, i) => (
          <li key={s} className={i === step ? 'text-espresso' : ''}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {(step === 0 || step === 1) && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Ad" value={form.firstName} onChange={(v) => setForm({ ...form, firstName: v })} />
              <Field label="Soyad" value={form.lastName} onChange={(v) => setForm({ ...form, lastName: v })} />
              <Field label="E-posta" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
              <Field label="Telefon" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
              <Field label="Şehir" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
              <Field label="İlçe" value={form.district} onChange={(v) => setForm({ ...form, district: v })} />
              <div className="sm:col-span-2">
                <Field label="Adres" value={form.addressLine} onChange={(v) => setForm({ ...form, addressLine: v })} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              {(shippingQuotes.length
                ? shippingQuotes
                : [
                    {
                      method: 'standard' as const,
                      label: 'Standart Kargo',
                      cost: Math.max(0, subtotal - discount) >= 3000 ? 0 : 79.9,
                      eta: '2-4 iş günü',
                    },
                    {
                      method: 'express' as const,
                      label: 'Hızlı Kargo',
                      cost: 149.9,
                      eta: '1-2 iş günü',
                    },
                  ]
              ).map((m) => (
                <button
                  key={m.method}
                  type="button"
                  onClick={() => setShippingMethod(m.method)}
                  className={`flex w-full items-center justify-between border px-4 py-4 text-left ${
                    shippingMethod === m.method ? 'border-espresso bg-ivory' : 'border-border'
                  }`}
                >
                  <span>
                    <span className="block text-sm text-espresso">{m.label}</span>
                    <span className="text-xs text-muted">{m.eta}</span>
                  </span>
                  <span className="text-sm">
                    {m.cost === 0 ? 'Ücretsiz' : formatPrice(m.cost)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {step >= 3 && (
            <div className="space-y-3 border border-border bg-ivory p-6 text-sm text-muted">
              <p>
                Kart bilgileri ödeme sağlayıcısı (iyzico) sayfasında güvenle alınır. Bu sitede kart
                saklanmaz. Ödeme yalnızca provider doğrulaması sonrası tamamlanır.
              </p>
              <p className="text-xs">
                Sandbox test (başarılı):{' '}
                <span className="font-mono text-espresso">5528790000000008</span> — SKT gelecek tarih,
                CVC 123. <span className="font-mono">4111…</span> kartları bilerek hata üretir.
              </p>
            </div>
          )}

          <div className="flex gap-3">
            {step > 0 && (
              <Button type="button" variant="secondary" onClick={() => setStep((s) => s - 1)}>
                Geri
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={nextStep}>
                Devam
              </Button>
            ) : (
              <Button
                type="button"
                onClick={placeOrder}
                disabled={submitting || checkoutBlocked || hasStockIssues}
              >
                {submitting ? 'İşleniyor…' : 'Ödemeye Geç'}
              </Button>
            )}
          </div>
        </div>

        <aside className="h-fit border border-border p-6">
          <h2 className="font-display text-2xl">Sipariş özeti</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {items.map((row) => (
              <li key={row.id} className="flex justify-between gap-3">
                <span>
                  {row.name} × {row.quantity}
                  {row.stockStatus !== 'ok' && (
                    <span className="ml-2 text-danger">
                      {row.stockStatus === 'out_of_stock' ? '(Stokta Yok)' : '(Yetersiz)'}
                    </span>
                  )}
                </span>
                <span>{formatPrice(row.lineTotal ?? row.unitPrice * row.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
            <div className="flex justify-between">
              <span>Ara toplam</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-muted">
                <span>İndirim{couponCode ? ` (${couponCode})` : ''}</span>
                <span>−{formatPrice(discount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Kargo</span>
              <span>{shippingCost === 0 ? 'Ücretsiz' : formatPrice(shippingCost)}</span>
            </div>
            <div className="flex justify-between text-base text-espresso">
              <span>Toplam</span>
              <span>{formatPrice(total)}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

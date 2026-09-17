'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'
import { nanoid } from 'nanoid'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'

const GUEST_KEY = 'sc_guest_token'
const FAVORITES_KEY = 'sc_guest_favorites'

export type CartItem = {
  id: string
  name: string
  slug: string
  imageUrl?: string | null
  unitPrice: number
  quantity: number
  available: number
  inStock: boolean
  stockStatus: 'ok' | 'insufficient' | 'out_of_stock'
  sku?: string
  cart_id?: string
  variant?: { color?: string | null; size?: string | null; sku: string }
  lineTotal?: number
}

type CartState = {
  cartId: string | null
  itemCount: number
  subtotal: number
  discount: number
  couponCode: string | null
  items: CartItem[]
  loading: boolean
  hasStockIssues: boolean
  checkoutBlocked: boolean
}

type CartContextValue = CartState & {
  refresh: () => Promise<void>
  mergeGuestData: () => Promise<boolean>
  addItem: (input: {
    productId: string
    sku: string
    variantId?: string
    quantity: number
  }) => Promise<void>
  updateQuantity: (itemId: string, quantity: number) => Promise<void>
  removeItem: (itemId: string) => Promise<void>
  applyCoupon: (code: string) => Promise<void>
}

const CartContext = createContext<CartContextValue | null>(null)

function peekGuestToken() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(GUEST_KEY)
}

function getOrCreateGuestToken() {
  if (typeof window === 'undefined') return null
  let token = localStorage.getItem(GUEST_KEY)
  if (!token) {
    token = nanoid(24)
    localStorage.setItem(GUEST_KEY, token)
  }
  return token
}

function readGuestFavorites(): string[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]') as string[]
  } catch {
    return []
  }
}

async function getAccessToken(): Promise<string | null> {
  try {
    const supabase = createClient()
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  } catch {
    return null
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = await getAccessToken()
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

function applyCartPayload(
  data: {
    cart?: { id?: string; coupon_code?: string | null } | null
    itemCount?: number
    subtotal?: number
    discount?: number
    couponCode?: string | null
    items?: CartItem[]
    hasStockIssues?: boolean
    checkoutBlocked?: boolean
  },
  setState: Dispatch<SetStateAction<CartState>>
) {
  setState({
    cartId: data.cart?.id ?? null,
    itemCount: data.itemCount ?? 0,
    subtotal: data.subtotal ?? 0,
    discount: data.discount ?? 0,
    couponCode: data.couponCode ?? data.cart?.coupon_code ?? null,
    items: (data.items ?? []) as CartItem[],
    loading: false,
    hasStockIssues: Boolean(data.hasStockIssues),
    checkoutBlocked: Boolean(data.checkoutBlocked ?? data.hasStockIssues),
  })
}

async function postMerge(guestToken: string | null, favoriteIds: string[]) {
  return fetch('/api/cart/merge', {
    method: 'POST',
    credentials: 'include',
    headers: await authHeaders(),
    body: JSON.stringify({
      guestToken: guestToken || undefined,
      favoriteIds,
    }),
  })
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const mergingRef = useRef(false)
  const mergedForUserRef = useRef<string | null>(null)
  const bootIdRef = useRef(0)

  const [state, setState] = useState<CartState>({
    cartId: null,
    itemCount: 0,
    subtotal: 0,
    discount: 0,
    couponCode: null,
    items: [],
    loading: true,
    hasStockIssues: false,
    checkoutBlocked: true,
  })

  const refresh = useCallback(async () => {
    const qs = new URLSearchParams()
    // Prefer existing guest token always (even when logged in) so server can merge.
    // Only mint a new token when logged out and none exists.
    let guestToken = peekGuestToken()
    if (!guestToken && !userId) {
      guestToken = getOrCreateGuestToken()
    }
    if (guestToken) qs.set('guestToken', guestToken)

    const res = await fetch(`/api/cart?${qs.toString()}`, {
      credentials: 'include',
      headers: await authHeaders(),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      // Keep existing items on transient/auth errors — never invent a new empty guest cart
      setState((s) => ({ ...s, loading: false }))
      console.error('[useCart.refresh]', data.error || res.status)
      return
    }

    // Server merged guest → user: drop local guest token
    if (userId && guestToken && (data.itemCount ?? 0) >= 0 && data.mergedGuest) {
      localStorage.removeItem(GUEST_KEY)
    } else if (userId && guestToken && data.cart?.user_id === userId) {
      localStorage.removeItem(GUEST_KEY)
    }

    setState((s) => {
      const nextCount = data.itemCount ?? 0
      // Guard: a later empty refresh must not wipe items just added (duplicate-cart / auth race)
      if (nextCount === 0 && s.itemCount > 0) {
        console.warn('[useCart.refresh] ignored empty cart overwrite', {
          prevCartId: s.cartId,
          nextCartId: data.cart?.id ?? null,
          prevCount: s.itemCount,
        })
        return { ...s, loading: false }
      }
      return {
        cartId: data.cart?.id ?? null,
        itemCount: nextCount,
        subtotal: data.subtotal ?? 0,
        discount: data.discount ?? 0,
        couponCode: data.couponCode ?? null,
        items: (data.items ?? []) as CartItem[],
        loading: false,
        hasStockIssues: Boolean(data.hasStockIssues),
        checkoutBlocked: Boolean(data.checkoutBlocked ?? data.hasStockIssues),
      }
    })
  }, [userId])

  const mergeGuestData = useCallback(async () => {
    if (!userId || mergingRef.current) return false
    const guestToken = peekGuestToken()
    const favoriteIds = readGuestFavorites()
    if (!guestToken && favoriteIds.length === 0) return false

    mergingRef.current = true
    try {
      let res = await postMerge(guestToken, favoriteIds)
      if (res.status === 401) {
        await new Promise((r) => setTimeout(r, 150))
        res = await postMerge(guestToken, favoriteIds)
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        console.error('[useCart.mergeGuestData]', data.error || res.status)
        return false
      }
      if (guestToken) localStorage.removeItem(GUEST_KEY)
      localStorage.removeItem(FAVORITES_KEY)
      return true
    } finally {
      mergingRef.current = false
    }
  }, [userId])

  useEffect(() => {
    const bootId = ++bootIdRef.current
    let cancelled = false

    async function boot() {
      if (authLoading) return

      // Don't flash-empty UI when we already have cart lines
      setState((s) => (s.itemCount > 0 ? { ...s, loading: false } : { ...s, loading: true }))

      if (userId) {
        if (mergedForUserRef.current !== userId) {
          await mergeGuestData()
          if (!cancelled && bootId === bootIdRef.current) {
            mergedForUserRef.current = userId
          }
        }
      } else {
        mergedForUserRef.current = null
      }

      if (!cancelled && bootId === bootIdRef.current) {
        await refresh()
      }
    }

    boot()
    return () => {
      cancelled = true
    }
  }, [userId, authLoading, mergeGuestData, refresh])

  const addItem = useCallback(
    async (input: { productId: string; sku: string; variantId?: string; quantity: number }) => {
      // Prefer guest token while logged out; keep existing token if present while logged in (pre-merge)
      const guestToken = userId
        ? peekGuestToken() || undefined
        : getOrCreateGuestToken() || undefined

      const res = await fetch('/api/cart', {
        method: 'POST',
        credentials: 'include',
        headers: await authHeaders(),
        body: JSON.stringify({ ...input, guestToken }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg =
          (typeof data.error === 'string' && data.error) || `Sepete eklenemedi (HTTP ${res.status})`
        console.error('[useCart.addItem]', msg, data)
        throw new Error(msg)
      }

      // Apply cart snapshot from POST — avoids a second GET race that showed an empty cart
      if (Array.isArray(data.items)) {
        applyCartPayload(data, setState)
        if (userId && guestToken) localStorage.removeItem(GUEST_KEY)
      } else {
        await refresh()
      }
    },
    [userId, refresh]
  )

  const updateQuantity = useCallback(
    async (itemId: string, quantity: number) => {
      const res = await fetch('/api/cart', {
        method: 'PATCH',
        credentials: 'include',
        headers: await authHeaders(),
        body: JSON.stringify({ itemId, quantity }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Güncellenemedi')
      if (Array.isArray(data.items)) {
        applyCartPayload(data, setState)
      } else {
        await refresh()
      }
    },
    [refresh]
  )

  const removeItem = useCallback(
    async (itemId: string) => {
      const res = await fetch('/api/cart', {
        method: 'DELETE',
        credentials: 'include',
        headers: await authHeaders(),
        body: JSON.stringify({ itemId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Silinemedi')
      if (Array.isArray(data.items)) {
        applyCartPayload(data, setState)
      } else {
        await refresh()
      }
    },
    [refresh]
  )

  const applyCoupon = useCallback(
    async (code: string) => {
      const res = await fetch('/api/cart/coupon', {
        method: 'POST',
        credentials: 'include',
        headers: await authHeaders(),
        body: JSON.stringify({ code, cartId: state.cartId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Kupon uygulanamadı')
      setState((s) => ({
        ...s,
        discount: Number(data.discount) || 0,
        couponCode: data.code || code.toUpperCase(),
      }))
      await refresh()
    },
    [refresh, state.cartId]
  )

  const value = useMemo(
    () => ({
      ...state,
      refresh,
      mergeGuestData,
      addItem,
      updateQuantity,
      removeItem,
      applyCoupon,
    }),
    [state, refresh, mergeGuestData, addItem, updateQuantity, removeItem, applyCoupon]
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}

/** Call after login/register so merge runs even before CartProvider re-boots. */
export async function mergeGuestCartAfterAuth() {
  if (typeof window === 'undefined') return false
  const guestToken = localStorage.getItem(GUEST_KEY)
  let favoriteIds: string[] = []
  try {
    favoriteIds = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]') as string[]
  } catch {
    favoriteIds = []
  }
  if (!guestToken && favoriteIds.length === 0) return false

  let res = await postMerge(guestToken, favoriteIds)
  if (res.status === 401) {
    await new Promise((r) => setTimeout(r, 150))
    res = await postMerge(guestToken, favoriteIds)
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    console.error('[mergeGuestCartAfterAuth]', data.error || res.status)
    return false
  }
  if (guestToken) localStorage.removeItem(GUEST_KEY)
  localStorage.removeItem(FAVORITES_KEY)
  return true
}

'use client'

import { useCallback, useEffect, useState } from 'react'

const KEY = 'sc_guest_favorites'

function read(): string[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]') as string[]
  } catch {
    return []
  }
}

function write(ids: string[]) {
  localStorage.setItem(KEY, JSON.stringify(ids))
}

export function useGuestFavorites() {
  const [ids, setIds] = useState<string[]>([])

  useEffect(() => {
    setIds(read())
  }, [])

  const has = useCallback((productId: string) => ids.includes(productId), [ids])

  const toggle = useCallback((productId: string) => {
    const current = read()
    const next = current.includes(productId)
      ? current.filter((id) => id !== productId)
      : [...current, productId]
    write(next)
    setIds(next)
    return next.includes(productId)
  }, [])

  const clear = useCallback(() => {
    write([])
    setIds([])
  }, [])

  return { ids, has, toggle, clear }
}

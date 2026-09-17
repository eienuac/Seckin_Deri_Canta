'use client'

import { Toaster } from 'sonner'

export function ToastProvider() {
  return (
    <Toaster
      position="top-center"
      toastOptions={{
        style: {
          background: '#2c1e16',
          color: '#f7f3ec',
          border: 'none',
          borderRadius: 0,
        },
      }}
    />
  )
}

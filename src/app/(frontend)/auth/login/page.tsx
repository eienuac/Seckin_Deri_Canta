'use client'

import { Suspense } from 'react'
import LoginForm from './login-form'

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="container-page flex justify-center py-20">
          <div className="skeleton h-80 w-full max-w-md" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}

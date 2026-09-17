import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="container-page flex flex-col items-center py-24 text-center">
      <h1 className="font-display text-5xl text-espresso">404</h1>
      <p className="mt-3 text-muted">Aradığınız sayfa bulunamadı.</p>
      <Link href="/" className="mt-8">
        <Button>Ana sayfaya dön</Button>
      </Link>
    </div>
  )
}

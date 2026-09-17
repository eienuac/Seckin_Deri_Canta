import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function CheckoutFailurePage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>
}) {
  const { reason } = await searchParams

  return (
    <div className="container-page py-24 text-center">
      <h1 className="font-display text-4xl text-espresso">Ödeme tamamlanamadı</h1>
      <p className="mx-auto mt-4 max-w-md text-muted">
        Ödeme doğrulanamadı. Sandbox’ta başarı için iyzico’nun başarılı test kartlarını kullanın
        (ör. <span className="font-mono text-espresso">5528790000000008</span>).{' '}
        <span className="font-mono">4111…</span> kartları bilerek hata üretir.
      </p>
      {reason && (
        <p className="mt-2 text-xs text-muted">Kod: {reason}</p>
      )}
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/checkout">
          <Button>Tekrar dene</Button>
        </Link>
        <Link href="/cart">
          <Button variant="secondary">Sepete dön</Button>
        </Link>
      </div>
    </div>
  )
}

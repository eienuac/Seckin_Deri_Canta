'use client'

import Image from 'next/image'
import { useState } from 'react'
import { cn } from '@/lib/utils'

export function ProductGallery({
  images,
  name,
}: {
  images: Array<{ url: string; alt: string; isPrimary: boolean }>
  name: string
}) {
  const [active, setActive] = useState(0)
  const [zoom, setZoom] = useState(false)
  const current = images[active] || images[0]

  if (!current) {
    return <div className="aspect-[4/5] bg-sand" />
  }

  return (
    <div>
      <button
        type="button"
        className="relative aspect-[4/5] w-full overflow-hidden bg-sand"
        onClick={() => setZoom((z) => !z)}
        aria-label="Yakınlaştır"
      >
        <Image
          src={current.url}
          alt={current.alt || name}
          fill
          priority
          sizes="(max-width:1024px) 100vw, 50vw"
          className={cn('object-cover transition-transform duration-500', zoom && 'scale-150')}
        />
      </button>
      {images.length > 1 && (
        <div className="mt-3 grid grid-cols-5 gap-2">
          {images.map((img, i) => (
            <button
              key={img.url + i}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                'relative aspect-square overflow-hidden border',
                i === active ? 'border-espresso' : 'border-transparent'
              )}
            >
              <Image src={img.url} alt="" fill className="object-cover" sizes="80px" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

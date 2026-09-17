import { NextResponse } from 'next/server'
import { searchSuggestions } from '@/services/products'

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('q') || ''
  try {
    const data = await searchSuggestions(q)
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ products: [], categories: [] })
  }
}

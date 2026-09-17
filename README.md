# Seçkin Çanta

Premium deri çanta ve cüzdan e-ticaret platformu.

## Mimari

| Katman | Teknoloji | Sorumluluk |
|--------|-----------|------------|
| Storefront + App Admin | Next.js App Router | UI, API routes, checkout |
| Headless CMS | Payload CMS 3 (`/admin`) | Ürün, kategori, görsel, homepage, SEO |
| Ops DB / Auth | Supabase Postgres + Auth | Kullanıcı, sepet, sipariş, stok, ödeme, iade, kupon, yorum |
| Ödeme | iyzico (PaymentService) | Kart ödemesi — kart saklanmaz |

**Source of truth:** Katalog/içerik → Payload. Stok/sipariş/kullanıcı → Supabase. Senkron yalnızca SKU inventory satırları.

## Kurulum

1. `cp .env.example .env`
2. Supabase projesi oluştur, `supabase/migrations/001_initial_schema.sql` çalıştır
3. Payload için `DATABASE_URL` (Supabase connection string veya ayrı Postgres)
4. `npm install`
5. `npm run dev`
6. CMS: http://localhost:3000/admin
7. Mağaza: http://localhost:3000
8. Operasyon paneli: http://localhost:3000/app-admin

## Scriptler

- `npm run dev` — geliştirme
- `npm run build` — production build
- `npm run payload` — Payload CLI
- `npm run generate:types` — Payload types

## Güvenlik notları

- `SUPABASE_SERVICE_ROLE_KEY`, `PAYMENT_SECRET_KEY`, `PAYLOAD_SECRET` asla client bundle’a konmaz
- Fiyat/stok/kupon doğrulaması server-side
- Ödeme yalnızca provider webhook/callback doğrulaması sonrası finalize edilir (idempotent)
- App admin yetkisi `profiles.role = admin` veya `ADMIN_EMAILS` ile server-side kontrol edilir

## Marka

**Seçkin Çanta** — zamansız deri.

import fs from 'node:fs'
import { createHmac } from 'crypto'

for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([^#=]+)=(.*)$/)
  if (!m) continue
  const key = m[1].trim()
  const val = m[2].trim().replace(/^["']|["']$/g, '')
  if (!process.env[key]) process.env[key] = val
}

const apiKey = process.env.PAYMENT_API_KEY!.trim()
const secretKey = process.env.PAYMENT_SECRET_KEY!.trim()
const baseUrl = process.env.IYZICO_BASE_URL!.replace(/\/$/, '')
const path = '/payment/bin/check'
const body = JSON.stringify({ locale: 'tr', binNumber: '589004', conversationId: 'sig-test' })
const randomKey = `${Date.now()}123456789`

const badB64 = createHmac('sha256', secretKey).update(randomKey + path + body, 'utf8').digest('base64')
const goodHex = createHmac('sha256', secretKey).update(randomKey + path + body, 'utf8').digest('hex')

async function call(signature: string, label: string) {
  const auth =
    'IYZWSv2 ' +
    Buffer.from(`apiKey:${apiKey}&randomKey:${randomKey}&signature:${signature}`, 'utf8').toString(
      'base64'
    )
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      Authorization: auth,
      'x-iyzi-rnd': randomKey,
      'Content-Type': 'application/json',
    },
    body,
  })
  const raw = await res.json()
  console.log(label, {
    http: res.status,
    status: raw.status,
    errorCode: raw.errorCode,
    errorMessage: raw.errorMessage,
    cardType: raw.cardType,
  })
}

await call(badB64, 'BASE64_SIG')
await call(goodHex, 'HEX_SIG')

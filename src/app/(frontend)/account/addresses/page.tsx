'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { toast } from 'sonner'

type Address = {
  id: string
  title: string | null
  first_name: string
  last_name: string
  phone: string
  city: string
  address_line: string
  is_default: boolean
}

export default function AddressesPage() {
  const { user } = useAuth()
  const [addresses, setAddresses] = useState<Address[]>([])
  const [form, setForm] = useState({
    title: 'Ev',
    first_name: '',
    last_name: '',
    phone: '',
    city: '',
    address_line: '',
  })

  async function load() {
    if (!user) return
    const supabase = createClient()
    const { data } = await supabase.from('addresses').select('*').eq('user_id', user.id)
    setAddresses((data as Address[]) || [])
  }

  useEffect(() => {
    load()
  }, [user])

  async function add() {
    if (!user) return
    const supabase = createClient()
    const { error } = await supabase.from('addresses').insert({
      user_id: user.id,
      ...form,
      is_default: addresses.length === 0,
    })
    if (error) toast.error(error.message)
    else {
      toast.success('Adres eklendi')
      load()
    }
  }

  return (
    <div>
      <h2 className="font-display text-3xl text-espresso">Adresler</h2>
      <ul className="mt-6 space-y-3">
        {addresses.map((a) => (
          <li key={a.id} className="border border-border p-4 text-sm">
            <p className="font-medium">
              {a.title} — {a.first_name} {a.last_name}
            </p>
            <p className="text-muted">
              {a.address_line}, {a.city} · {a.phone}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-10 max-w-md space-y-3">
        <h3 className="font-display text-xl">Yeni adres</h3>
        {Object.entries(form).map(([k, v]) => (
          <div key={k}>
            <Label>{k}</Label>
            <Input
              value={v}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
            />
          </div>
        ))}
        <Button type="button" onClick={add}>
          Kaydet
        </Button>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { toast } from 'sonner'

export default function AccountProfilePage() {
  const { user } = useAuth()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')

  useEffect(() => {
    if (!user) return
    const supabase = createClient()
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        setFirstName(data.first_name || '')
        setLastName(data.last_name || '')
        setPhone(data.phone || '')
      })
  }, [user])

  async function save() {
    if (!user) return
    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: firstName,
        last_name: lastName,
        phone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
    if (error) toast.error(error.message)
    else toast.success('Profil güncellendi')
  }

  return (
    <div>
      <h2 className="font-display text-3xl text-espresso">Profil</h2>
      <div className="mt-8 max-w-md space-y-4">
        <div>
          <Label>E-posta</Label>
          <Input value={user?.email || ''} disabled />
        </div>
        <div>
          <Label>Ad</Label>
          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <div>
          <Label>Soyad</Label>
          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <div>
          <Label>Telefon</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <Button type="button" onClick={save}>
          Kaydet
        </Button>
      </div>
    </div>
  )
}

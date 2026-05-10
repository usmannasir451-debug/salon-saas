import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const body = await request.json() as {
    name?: string
    phone?: string
    salon_name?: string
    branches?: string
    city?: string
    source?: string
    message?: string
  }

  const { name, phone, salon_name, branches, city, source, message } = body

  if (!name?.trim() || !phone?.trim() || !salon_name?.trim() || !branches || !city?.trim() || !source) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { error } = await supabase.from('leads').insert({
    name: name.trim(),
    phone: phone.trim(),
    salon_name: salon_name.trim(),
    branches,
    city: city.trim(),
    source,
    message: message?.trim() || null,
    status: 'new',
  })

  if (error) {
    console.error('[POST /api/leads]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

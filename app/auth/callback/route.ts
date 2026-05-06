import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)

    // Link invited user to their pending salon membership
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email) {
      await supabase
        .from('salon_members')
        .update({
          member_user_id: user.id,
          status: 'active',
          joined_at: new Date().toISOString(),
        })
        .eq('email', user.email)
        .eq('status', 'pending')
        .is('member_user_id', null)
    }
  }

  return NextResponse.redirect(`${origin}${next}`)
}

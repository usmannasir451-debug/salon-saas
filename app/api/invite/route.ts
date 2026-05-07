import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only salon owners (not team members themselves) can invite
  const { data: ownMembership } = await supabase
    .from('salon_members')
    .select('id')
    .eq('member_user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (ownMembership) {
    return NextResponse.json({ error: 'Only salon owners can invite team members' }, { status: 403 })
  }

  const body = await request.json() as { email?: string; role?: string; staff_id?: string }
  const { email, role, staff_id } = body

  if (!email || !role) {
    return NextResponse.json({ error: 'Email and role are required' }, { status: 400 })
  }

  const validRoles = ['regional_manager', 'manager', 'receptionist', 'cashier', 'staff']
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  // Check for duplicate invite
  const { data: existing } = await supabase
    .from('salon_members')
    .select('id')
    .eq('owner_id', user.id)
    .eq('email', email)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'This email has already been invited to your team' }, { status: 409 })
  }

  // Insert pending membership
  const { error: insertErr } = await supabase.from('salon_members').insert({
    owner_id: user.id,
    email,
    role,
    staff_id: staff_id || null,
    status: 'pending',
  })

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  // Send invite email via admin client
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({
      success: true,
      warning: 'SUPABASE_SERVICE_ROLE_KEY not configured — membership created but invite email was not sent.',
    })
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const { error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { owner_id: user.id, invited_role: role },
    redirectTo: `${siteUrl}/auth/callback?next=/dashboard`,
  })

  if (inviteErr) {
    // User already has an account — link them directly without re-inviting
    const alreadyExists =
      inviteErr.message.toLowerCase().includes('already registered') ||
      inviteErr.message.toLowerCase().includes('already been invited')

    if (alreadyExists) {
      const { data: usersPage } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
      const existingUser = usersPage?.users?.find((u) => u.email === email)
      if (existingUser) {
        await supabase
          .from('salon_members')
          .update({ member_user_id: existingUser.id, status: 'active', joined_at: new Date().toISOString() })
          .eq('owner_id', user.id)
          .eq('email', email)
        return NextResponse.json({ success: true })
      }
    }
    // Rollback insert on real failure
    await supabase.from('salon_members').delete().eq('owner_id', user.id).eq('email', email)
    return NextResponse.json({ error: inviteErr.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}

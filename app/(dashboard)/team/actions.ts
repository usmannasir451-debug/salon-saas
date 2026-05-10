'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function getOwnerUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Confirm caller is an owner (not a team member)
  const { data: ownMembership } = await supabase
    .from('salon_members')
    .select('id')
    .eq('member_user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (ownMembership) return null // team member, not owner
  return user
}

export async function createTeamMember(
  displayName: string,
  email: string,
  password: string,
  permissions: string[]
) {
  const user = await getOwnerUser()
  if (!user) return { error: 'Only salon owners can create team members' }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'SUPABASE_SERVICE_ROLE_KEY is required to create team members' }
  }

  const supabase = await createClient()

  // Check for duplicate
  const { data: existing } = await supabase
    .from('salon_members')
    .select('id')
    .eq('owner_id', user.id)
    .eq('email', email.toLowerCase())
    .maybeSingle()

  if (existing) return { error: 'This email already exists in your team' }

  const admin = createAdminClient()

  // Check if auth user already exists
  const { data: usersPage } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const existingAuth = usersPage?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase())

  let memberUserId: string
  let storedPassword: string | null = null

  if (existingAuth) {
    memberUserId = existingAuth.id
  } else {
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: email.toLowerCase(),
      password,
      email_confirm: true,
    })
    if (authError) return { error: authError.message }
    memberUserId = authData.user.id
    storedPassword = password
  }

  const { error: insertError } = await supabase.from('salon_members').insert({
    owner_id: user.id,
    member_user_id: memberUserId,
    email: email.toLowerCase(),
    role: 'staff',
    display_name: displayName.trim(),
    permissions,
    last_set_password: storedPassword,
    status: 'active',
    joined_at: new Date().toISOString(),
  })

  if (insertError) return { error: insertError.message }

  revalidatePath('/team')
  return { success: true, email: email.toLowerCase(), password: storedPassword ?? password }
}

export async function updateTeamMember(
  memberId: string,
  displayName: string,
  permissions: string[]
) {
  const user = await getOwnerUser()
  if (!user) return { error: 'Only salon owners can edit team members' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('salon_members')
    .update({ display_name: displayName.trim(), permissions })
    .eq('id', memberId)
    .eq('owner_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/team')
  return { success: true }
}

export async function resetTeamMemberPassword(
  memberId: string,
  memberUserId: string,
  newPassword: string
) {
  const user = await getOwnerUser()
  if (!user) return { error: 'Only salon owners can reset passwords' }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'SUPABASE_SERVICE_ROLE_KEY is required' }
  }

  const admin = createAdminClient()
  const { error: authError } = await admin.auth.admin.updateUserById(memberUserId, {
    password: newPassword,
  })
  if (authError) return { error: authError.message }

  const supabase = await createClient()
  await supabase
    .from('salon_members')
    .update({ last_set_password: newPassword })
    .eq('id', memberId)
    .eq('owner_id', user.id)

  return { success: true }
}

export async function toggleTeamMemberStatus(memberId: string, newStatus: 'active' | 'inactive') {
  const user = await getOwnerUser()
  if (!user) return { error: 'Only salon owners can update team members' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('salon_members')
    .update({ status: newStatus })
    .eq('id', memberId)
    .eq('owner_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/team')
  return { success: true }
}

export async function deleteTeamMember(memberId: string) {
  const user = await getOwnerUser()
  if (!user) return { error: 'Only salon owners can remove team members' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('salon_members')
    .delete()
    .eq('id', memberId)
    .eq('owner_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/team')
  return { success: true }
}

'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function toggleSalonStatus(userId: string, newStatus: 'active' | 'suspended') {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('profiles')
    .update({ subscription_status: newStatus })
    .eq('id', userId)

  if (error) {
    console.error('[toggleSalonStatus]', error)
    return { error: error.message }
  }
  revalidatePath('/admin')
  return { success: true }
}

export async function createSalonAccount(salonName: string, email: string, password: string) {
  const supabase = createAdminClient()

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { salon_name: salonName },
  })

  if (authError) {
    console.error('[createSalonAccount] auth error:', authError)
    return { error: authError.message }
  }

  const { error: profileError } = await supabase.from('profiles').upsert({
    id: authData.user.id,
    email,
    salon_name: salonName,
    subscription_status: 'active',
    last_set_password: password,
  })

  if (profileError) {
    console.error('[createSalonAccount] profile error:', profileError)
    return { error: profileError.message }
  }

  revalidatePath('/admin')
  return { data: { userId: authData.user.id, email, salonName } }
}

export async function resetSalonPassword(userId: string, newPassword: string) {
  const supabase = createAdminClient()

  const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
    password: newPassword,
  })

  if (authError) {
    console.error('[resetSalonPassword] auth error:', authError)
    return { error: authError.message }
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ last_set_password: newPassword })
    .eq('id', userId)

  if (profileError) {
    console.error('[resetSalonPassword] profile error:', profileError)
    return { error: profileError.message }
  }

  revalidatePath('/admin')
  return { success: true }
}

export async function deleteSalonAccount(userId: string) {
  const supabase = createAdminClient()

  // Deleting the auth user cascades to profiles and all related data
  const { error } = await supabase.auth.admin.deleteUser(userId)

  if (error) {
    console.error('[deleteSalonAccount]', error)
    return { error: error.message }
  }

  revalidatePath('/admin')
  return { success: true }
}

export async function changeSalonEmail(userId: string, newEmail: string) {
  const supabase = createAdminClient()

  const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
    email: newEmail,
  })

  if (authError) {
    console.error('[changeSalonEmail] auth error:', authError)
    return { error: authError.message }
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ email: newEmail })
    .eq('id', userId)

  if (profileError) {
    console.error('[changeSalonEmail] profile error:', profileError)
    return { error: profileError.message }
  }

  revalidatePath('/admin')
  return { success: true }
}

export async function getSalonDetails(userId: string) {
  const supabase = createAdminClient()

  const [membersRes, apptRes, walkinRes] = await Promise.all([
    supabase
      .from('salon_members')
      .select('id, email, role, display_name, status, joined_at, last_set_password, permissions')
      .eq('owner_id', userId),
    supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('walk_ins')
      .select('total')
      .eq('user_id', userId)
      .eq('payment_status', 'paid'),
  ])

  if (membersRes.error) return { error: membersRes.error.message }

  const revenue = (walkinRes.data ?? []).reduce(
    (sum: number, w: { total: number }) => sum + (w.total ?? 0),
    0
  )

  return {
    members: membersRes.data ?? [],
    appointmentCount: apptRes.count ?? 0,
    revenue,
  }
}

export async function getLeads() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getLeads]', error)
    return { error: error.message }
  }
  return { data: data ?? [] }
}

export async function updateLead(id: string, updates: { status?: string; notes?: string }) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('leads').update(updates).eq('id', id)

  if (error) {
    console.error('[updateLead]', error)
    return { error: error.message }
  }
  return { success: true }
}

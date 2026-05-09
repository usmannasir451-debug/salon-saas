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

  console.log(
    '[createSalonAccount] url:', process.env.NEXT_PUBLIC_SUPABASE_URL,
    'service key set:', !!process.env.SUPABASE_SERVICE_ROLE_KEY
  )

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

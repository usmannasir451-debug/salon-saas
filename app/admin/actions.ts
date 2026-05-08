'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function toggleSalonStatus(userId: string, newStatus: 'active' | 'suspended') {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('profiles')
    .update({ subscription_status: newStatus })
    .eq('id', userId)

  if (error) throw new Error(error.message)
  revalidatePath('/admin')
}

export async function createSalonAccount(salonName: string, email: string, password: string) {
  const supabase = createAdminClient()

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { salon_name: salonName },
  })

  if (authError) throw new Error(authError.message)

  const { error: profileError } = await supabase.from('profiles').upsert({
    id: authData.user.id,
    email,
    salon_name: salonName,
    subscription_status: 'active',
  })

  if (profileError) throw new Error(profileError.message)

  revalidatePath('/admin')
  return { userId: authData.user.id, email, salonName }
}

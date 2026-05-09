import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminDashboard from './AdminDashboard'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
    redirect('/dashboard')
  }

  const adminSupabase = createAdminClient()
  const { data: salons } = await adminSupabase
    .from('profiles')
    .select('id, email, salon_name, subscription_status, created_at, last_set_password')
    .order('created_at', { ascending: false })

  return <AdminDashboard salons={salons ?? []} />
}

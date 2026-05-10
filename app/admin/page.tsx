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
  const { data: salonsRaw } = await adminSupabase
    .from('profiles')
    .select('id, email, salon_name, subscription_status, created_at, last_set_password, salon_members(count)')
    .order('created_at', { ascending: false })

  const salons = (salonsRaw ?? []).map((s) => ({
    ...s,
    member_count: (s.salon_members as unknown as [{ count: number }])[0]?.count ?? 0,
    salon_members: undefined,
  }))

  return <AdminDashboard salons={salons ?? []} />
}

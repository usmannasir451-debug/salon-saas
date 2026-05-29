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

  // Fetch sub-user IDs so we can exclude them from the main salon list
  const { data: membersRaw } = await adminSupabase
    .from('salon_members')
    .select('member_user_id')
    .not('member_user_id', 'is', null)

  const subUserIds = (membersRaw ?? [])
    .map((m) => m.member_user_id as string)
    .filter(Boolean)

  let salonsQuery = adminSupabase
    .from('profiles')
    .select('id, email, salon_name, subscription_status, created_at, last_set_password, max_branches, max_staff, enabled_modules, salon_members(count)')
    .order('created_at', { ascending: false })

  // Exclude sub-user profiles from the main list
  if (subUserIds.length > 0) {
    salonsQuery = salonsQuery.not('id', 'in', `(${subUserIds.join(',')})`)
  }

  const { data: salonsRaw } = await salonsQuery

  const salons = (salonsRaw ?? []).map((s) => ({
    ...s,
    member_count: (s.salon_members as unknown as [{ count: number }])[0]?.count ?? 0,
    enabled_modules: (s.enabled_modules as string[] | null) ?? null,
    salon_members: undefined,
  }))

  return <AdminDashboard salons={salons ?? []} />
}

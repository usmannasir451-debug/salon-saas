import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import { RoleProvider, type UserCtx } from '@/components/RoleContext'
import type { UserRole } from '@/lib/types'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('salon_members')
    .select('owner_id, role, staff_id')
    .eq('member_user_id', user.id)
    .eq('status', 'active')
    .single()

  let role: UserRole = 'owner'
  let ownerId = user.id
  let staffId: string | undefined

  if (membership) {
    role = membership.role as Exclude<UserRole, 'owner'>
    ownerId = membership.owner_id
    staffId = membership.staff_id ?? undefined
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('salon_name, salon_logo_url')
    .eq('id', ownerId)
    .single()

  const ctx: UserCtx = { role, ownerId, staffId }

  return (
    <div className="min-h-screen bg-gray-50">
      <RoleProvider value={ctx}>
        <Sidebar
          salonName={profile?.salon_name ?? undefined}
          salonLogoUrl={profile?.salon_logo_url ?? undefined}
          userEmail={user.email}
          role={role}
        />
        <div className="lg:pl-60">
          <main className="pt-16 lg:pt-0 min-h-screen">
            {children}
          </main>
          <footer className="lg:block text-center py-3 text-xs text-gray-300">
            Powered by SalonPro
          </footer>
        </div>
      </RoleProvider>
    </div>
  )
}

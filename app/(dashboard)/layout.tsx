import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import FloatingWalkIn from '@/components/FloatingWalkIn'
import { RoleProvider, type UserCtx } from '@/components/RoleContext'
import { PermissionGuard } from '@/components/PermissionGuard'
import type { UserRole } from '@/lib/types'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('salon_members')
    .select('owner_id, role, staff_id, permissions, display_name')
    .eq('member_user_id', user.id)
    .eq('status', 'active')
    .single()

  let role: UserRole = 'owner'
  let ownerId = user.id
  let staffId: string | undefined
  let permissions: string[] | null = null
  let displayName: string | null = null
  const isOwner = !membership

  if (membership) {
    role = membership.role as Exclude<UserRole, 'owner'>
    ownerId = membership.owner_id
    staffId = membership.staff_id ?? undefined
    permissions = (membership.permissions as string[] | null) ?? null
    displayName = membership.display_name ?? null
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('salon_name, salon_logo_url')
    .eq('id', ownerId)
    .single()

  const ctx: UserCtx = { role, ownerId, staffId, permissions, isOwner, displayName }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <RoleProvider value={ctx}>
        <Sidebar
          salonName={profile?.salon_name ?? undefined}
          salonLogoUrl={profile?.salon_logo_url ?? undefined}
          userEmail={user.email}
          role={role}
          ownerId={ownerId}
          permissions={permissions}
          displayName={displayName}
        />
        <div className="lg:pl-60">
          <main className="pt-16 lg:pt-0 min-h-screen">
            <PermissionGuard>{children}</PermissionGuard>
          </main>
          <footer className="lg:block text-center py-3 text-xs text-gray-300">
            Powered by Snipforce
          </footer>
        </div>
        <FloatingWalkIn />
      </RoleProvider>
    </div>
  )
}

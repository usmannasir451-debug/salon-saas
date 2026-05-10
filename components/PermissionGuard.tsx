'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useUserContext } from './RoleContext'
import { ROLE_NAV } from '@/lib/roles'

const PERM_TO_HREF: Record<string, string> = {
  dashboard: '/dashboard',
  appointments: '/appointments',
  calendar: '/calendar',
  walkin: '/walkin',
  services: '/services',
  staff: '/staff',
  performance: '/staff/performance',
  reviews: '/reviews',
  clients: '/clients',
  inventory: '/inventory',
  expenses: '/expenses',
  payroll: '/payroll',
  reports: '/reports/pnl',
  team: '/team',
  settings: '/settings',
}

// Always blocked for sub-users — even if owner accidentally grants these permissions
const OWNER_ONLY_PATHS = ['/team', '/settings', '/payroll', '/admin']
const OWNER_ONLY_PERM_KEYS = new Set(['team', 'settings', 'payroll'])

export function PermissionGuard({ children }: { children: React.ReactNode }) {
  const { role, permissions } = useUserContext()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (role === 'owner') return

    const isOwnerOnlyPath = OWNER_ONLY_PATHS.some(
      (p) => pathname === p || pathname.startsWith(p + '/')
    )

    let allowed: string[]
    if (permissions && permissions.length > 0) {
      const permSet = new Set(permissions)
      allowed = Object.entries(PERM_TO_HREF)
        .filter(([key]) => permSet.has(key) && !OWNER_ONLY_PERM_KEYS.has(key))
        .map(([, href]) => href)
    } else {
      allowed = (ROLE_NAV[role] ?? []).filter(
        (p) => !OWNER_ONLY_PATHS.some((op) => p === op || p.startsWith(op + '/'))
      )
    }

    const firstAllowed = allowed[0] ?? '/appointments'

    if (isOwnerOnlyPath) {
      toast.error('Access denied — owner only')
      router.replace(firstAllowed)
      return
    }

    const isAllowed = allowed.some(
      (p) => pathname === p || (p !== '/dashboard' && pathname.startsWith(p))
    )

    if (!isAllowed) {
      toast.error('Access denied')
      router.replace(firstAllowed)
    }
  }, [pathname, role, permissions, router])

  return <>{children}</>
}

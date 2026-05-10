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

export function PermissionGuard({ children }: { children: React.ReactNode }) {
  const { role, permissions } = useUserContext()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (role === 'owner') return

    let allowed: string[]

    if (permissions && permissions.length > 0) {
      const permSet = new Set(permissions)
      allowed = Object.entries(PERM_TO_HREF)
        .filter(([key]) => permSet.has(key))
        .map(([, href]) => href)
    } else {
      allowed = ROLE_NAV[role] ?? []
    }

    const isAllowed = allowed.some(
      (p) => pathname === p || (p !== '/dashboard' && pathname.startsWith(p))
    )

    if (!isAllowed) {
      toast.error('Access denied')
      router.replace('/dashboard')
    }
  }, [pathname, role, permissions, router])

  return <>{children}</>
}

'use client'

import { useEffect, useRef } from 'react'
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
  attendance: '/attendance',
  reports: '/reports/pnl',
  reports_pnl: '/reports/pnl',
  team: '/team',
  team_members: '/team',
  branches: '/branches',
  settings: '/settings',
  memberships: '/memberships',
}

// Map of module key → path prefixes it covers
const MODULE_PATH_MAP: Record<string, string[]> = {
  dashboard: ['/dashboard'],
  appointments: ['/appointments'],
  calendar: ['/calendar'],
  walkin: ['/walkin'],
  services: ['/services'],
  staff: ['/staff'],
  performance: ['/staff/performance'],
  reviews: ['/reviews'],
  clients: ['/clients'],
  inventory: ['/inventory'],
  expenses: ['/expenses'],
  payroll: ['/payroll'],
  attendance: ['/attendance'],
  reports_pnl: ['/reports/pnl', '/reports'],
  branches: ['/branches'],
  team_members: ['/team'],
  settings: ['/settings'],
  memberships: ['/memberships'],
}

// Always blocked for sub-users — even if owner accidentally grants these permissions
const OWNER_ONLY_PATHS = ['/team', '/settings', '/payroll', '/admin']
const OWNER_ONLY_PERM_KEYS = new Set(['team', 'settings', 'payroll', 'team_members'])

function isModuleEnabled(pathname: string, enabledModules: string[] | null | undefined): boolean {
  if (!enabledModules) return true // no restriction if null (all enabled)
  // These paths are always accessible
  if (pathname.startsWith('/export') || pathname.startsWith('/onboarding') || pathname.startsWith('/suspended')) return true

  for (const [mod, paths] of Object.entries(MODULE_PATH_MAP)) {
    const covers = paths.some((p) => pathname === p || pathname.startsWith(p + '/'))
    if (covers) {
      return enabledModules.includes(mod)
    }
  }
  return true // unknown paths pass through
}

export function PermissionGuard({ children }: { children: React.ReactNode }) {
  const { role, permissions, enabledModules } = useUserContext()
  const pathname = usePathname()
  const router = useRouter()
  // Track previous pathname — null means this is the initial page load.
  // On initial load we redirect silently (no toast) so sub-users don't see
  // spurious "Access denied" errors when first landing on /dashboard.
  const prevPathnameRef = useRef<string | null>(null)

  useEffect(() => {
    const prevPath = prevPathnameRef.current
    prevPathnameRef.current = pathname

    // Check salon-level module access first (applies to everyone including owner)
    if (!isModuleEnabled(pathname, enabledModules)) {
      if (prevPath !== null) {
        toast.error('This feature is not enabled for your account. Please contact support.')
      }
      // Avoid infinite loop if /dashboard is also disabled
      if (pathname !== '/dashboard') {
        router.replace('/dashboard')
      }
      return
    }

    // Sub-user role/permission checks
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

    // Pick the first allowed path that is also module-enabled to avoid redirect loops
    const moduleEnabledAllowed = allowed.filter((p) => isModuleEnabled(p, enabledModules))
    const firstAllowed = moduleEnabledAllowed[0] ?? '/dashboard'

    if (isOwnerOnlyPath) {
      if (prevPath !== null) {
        toast.error('Access denied — owner only')
      }
      router.replace(firstAllowed)
      return
    }

    const isAllowed = allowed.some(
      (p) => pathname === p || (p !== '/dashboard' && pathname.startsWith(p))
    )

    if (!isAllowed) {
      if (prevPath !== null) {
        toast.error('Access denied')
      }
      router.replace(firstAllowed)
    }
  }, [pathname, role, permissions, enabledModules, router])

  return <>{children}</>
}

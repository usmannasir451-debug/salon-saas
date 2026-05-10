'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/lib/types'
import { ROLE_LABELS, ROLE_COLORS, ROLE_NAV } from '@/lib/roles'
import {
  LayoutDashboard,
  CalendarDays,
  CalendarRange,
  Scissors,
  Users,
  LogOut,
  Menu,
  X,
  ChevronRight,
  UserSearch,
  Building2,
  UserCog,
  Settings,
  Zap,
  DollarSign,
  Package,
  Wallet,
  BarChart2,
  TrendingUp,
  Star,
  Download,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import NotificationBell from '@/components/NotificationBell'

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

const allNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/appointments', label: 'Appointments', icon: CalendarDays },
  { href: '/calendar', label: 'Calendar', icon: CalendarRange },
  { href: '/walkin', label: 'Walk-In', icon: Zap },
  { href: '/services', label: 'Services', icon: Scissors },
  { href: '/staff', label: 'Staff', icon: Users },
  { href: '/staff/performance', label: 'Performance', icon: TrendingUp },
  { href: '/reviews', label: 'Reviews', icon: Star },
  { href: '/clients', label: 'Clients', icon: UserSearch },
  { href: '/branches', label: 'Branches', icon: Building2 },
  { href: '/team', label: 'Team', icon: UserCog },
  { href: '/expenses', label: 'Expenses', icon: DollarSign },
  { href: '/inventory', label: 'Inventory', icon: Package },
  { href: '/payroll', label: 'Payroll', icon: Wallet },
  { href: '/reports/pnl', label: 'P&L Report', icon: BarChart2 },
  { href: '/export', label: 'Export Data', icon: Download },
  { href: '/settings', label: 'Settings', icon: Settings },
]

interface SidebarProps {
  salonName?: string
  salonLogoUrl?: string
  userEmail?: string
  role?: UserRole
  ownerId?: string
  permissions?: string[] | null
  displayName?: string | null
}

export default function Sidebar({
  salonName,
  salonLogoUrl,
  userEmail,
  role = 'owner',
  ownerId,
  permissions,
  displayName,
}: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  let allowedPaths: string[]
  if (role === 'owner') {
    allowedPaths = ROLE_NAV['owner']
  } else if (permissions && permissions.length > 0) {
    const permSet = new Set(permissions)
    allowedPaths = Object.entries(PERM_TO_HREF)
      .filter(([key]) => permSet.has(key))
      .map(([, href]) => href)
  } else {
    allowedPaths = ROLE_NAV[role]
  }

  const navItems = allNavItems.filter((item) => allowedPaths.includes(item.href))

  async function handleLogout() {
    setLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success('Logged out successfully')
    router.push('/')
    router.refresh()
  }

  const initials = salonName ? salonName[0].toUpperCase() : userEmail?.[0]?.toUpperCase() ?? 'S'

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <Link
            href={navItems[0]?.href ?? '/appointments'}
            className="flex items-center gap-2.5 group"
            onClick={() => setMobileOpen(false)}
          >
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-sm shadow-primary/30 flex-shrink-0 overflow-hidden">
              {salonLogoUrl ? (
                <Image src={salonLogoUrl} alt="Salon logo" width={32} height={32} className="object-cover w-full h-full" unoptimized />
              ) : (
                <Scissors className="w-4 h-4 text-white" />
              )}
            </div>
            <div className="overflow-hidden">
              <p className="font-bold text-sm text-gray-900 leading-tight truncate">
                {salonName || 'My Salon'}
              </p>
              <p className="text-[10px] text-primary font-medium leading-tight">Snipforce</p>
            </div>
          </Link>
          {ownerId && <NotificationBell ownerId={ownerId} side="left" />}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
                active
                  ? 'bg-primary text-white shadow-sm shadow-primary/25'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <item.icon className={cn('w-4 h-4 flex-shrink-0', active ? 'text-white' : 'text-gray-400 group-hover:text-gray-600')} />
              <span className="flex-1">{item.label}</span>
              {active && <ChevronRight className="w-3 h-3 text-white/70" />}
            </Link>
          )
        })}
      </nav>

      <Separator />

      {/* User section */}
      <div className="px-4 py-4 space-y-3">
        <div className="flex items-center gap-3 px-1">
          <div className="w-8 h-8 bg-primary/20 flex items-center justify-center rounded-full flex-shrink-0 overflow-hidden">
            {salonLogoUrl ? (
              <Image src={salonLogoUrl} alt="Logo" width={32} height={32} className="object-cover w-full h-full" unoptimized />
            ) : (
              <span className="text-primary text-xs font-bold">{initials}</span>
            )}
          </div>
          <div className="overflow-hidden flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-xs font-semibold text-gray-800 truncate">
                {role !== 'owner' && displayName ? displayName : (salonName ?? 'My Salon')}
              </p>
              {role !== 'owner' && (
                <Badge className={cn('text-[10px] px-1.5 py-0', ROLE_COLORS[role])}>
                  {ROLE_LABELS[role]}
                </Badge>
              )}
            </div>
            <p className="text-[10px] text-gray-400 truncate">{userEmail}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-gray-500 hover:text-red-600 hover:bg-red-50 gap-2"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          <LogOut className="w-4 h-4" />
          {loggingOut ? 'Logging out...' : 'Log Out'}
        </Button>
      </div>

      <div className="px-4 pb-3 text-center">
        <p className="text-[10px] text-gray-300">Powered by Snipforce</p>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-60 flex-col h-screen border-r border-gray-100 bg-white fixed top-0 left-0 z-40">
        <SidebarContent />
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between shadow-sm">
        <Link href={navItems[0]?.href ?? '/appointments'} className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center overflow-hidden">
            {salonLogoUrl ? (
              <Image src={salonLogoUrl} alt="Logo" width={28} height={28} className="object-cover w-full h-full" unoptimized />
            ) : (
              <Scissors className="w-3.5 h-3.5 text-white" />
            )}
          </div>
          <span className="font-bold text-sm text-gray-900">{salonName || 'Snipforce'}</span>
        </Link>
        <div className="flex items-center gap-1">
          {ownerId && <NotificationBell ownerId={ownerId} />}
          <button
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </header>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={cn(
          'lg:hidden fixed top-0 left-0 z-50 h-full w-72 bg-white shadow-2xl transform transition-transform duration-300',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <button
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-gray-100"
          onClick={() => setMobileOpen(false)}
        >
          <X className="w-4 h-4 text-gray-600" />
        </button>
        <SidebarContent />
      </aside>
    </>
  )
}

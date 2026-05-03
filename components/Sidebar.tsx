'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  CalendarDays,
  Scissors,
  Users,
  LogOut,
  Menu,
  X,
  ChevronRight,
  UserSearch,
  Building2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Avatar } from '@/components/ui/avatar'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, urdu: 'ڈیش بورڈ' },
  { href: '/appointments', label: 'Appointments', icon: CalendarDays, urdu: 'اپائنٹمنٹ' },
  { href: '/services', label: 'Services', icon: Scissors, urdu: 'سروسز' },
  { href: '/staff', label: 'Staff', icon: Users, urdu: 'اسٹاف' },
  { href: '/clients', label: 'Clients', icon: UserSearch, urdu: 'کلائنٹس' },
  { href: '/branches', label: 'Branches', icon: Building2, urdu: 'برانچز' },
]

interface SidebarProps {
  salonName?: string
  userEmail?: string
}

export default function Sidebar({ salonName, userEmail }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success('Logged out successfully')
    router.push('/')
    router.refresh()
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-gray-100">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 group"
          onClick={() => setMobileOpen(false)}
        >
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-sm shadow-primary/30 flex-shrink-0">
            <Scissors className="w-4 h-4 text-white" />
          </div>
          <div className="overflow-hidden">
            <p className="font-bold text-sm text-gray-900 leading-tight truncate">SalonPro</p>
            <p className="text-[10px] text-primary font-medium leading-tight">Pakistan</p>
          </div>
        </Link>
      </div>

      {/* Salon name */}
      {salonName && (
        <div className="px-4 py-3 bg-primary/5 border-b border-primary/10">
          <p className="text-xs text-gray-500 mb-0.5">Your Salon</p>
          <p className="text-sm font-semibold text-gray-800 truncate">{salonName}</p>
        </div>
      )}

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
          <Avatar className="w-8 h-8 bg-primary/20 flex items-center justify-center rounded-full flex-shrink-0">
            <span className="text-primary text-xs font-bold">
              {salonName ? salonName[0].toUpperCase() : userEmail?.[0]?.toUpperCase() ?? 'U'}
            </span>
          </Avatar>
          <div className="overflow-hidden flex-1">
            <p className="text-xs font-semibold text-gray-800 truncate">{salonName ?? 'My Salon'}</p>
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
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
            <Scissors className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-sm text-gray-900">
            SalonPro <span className="text-primary">Pakistan</span>
          </span>
        </Link>
        <button
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="w-5 h-5 text-gray-600" />
        </button>
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

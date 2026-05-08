'use client'

import Link from 'next/link'
import { Zap } from 'lucide-react'
import type { UserRole } from '@/lib/types'

const WALKIN_ROLES: UserRole[] = ['owner', 'regional_manager', 'manager', 'receptionist', 'cashier']

export default function FloatingWalkIn({ role }: { role: UserRole }) {
  if (!WALKIN_ROLES.includes(role)) return null

  return (
    <Link
      href="/walkin"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-primary text-white px-5 py-3 rounded-full shadow-xl shadow-primary/30 hover:bg-primary/90 hover:scale-105 active:scale-95 transition-all font-semibold text-sm"
      title="New Walk-In"
    >
      <Zap className="w-4 h-4" />
      <span className="hidden sm:inline">Walk-In</span>
    </Link>
  )
}

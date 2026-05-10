'use client'

import Link from 'next/link'
import { Zap } from 'lucide-react'
import { useUserContext } from '@/components/RoleContext'

export default function FloatingWalkIn() {
  const { role, permissions } = useUserContext()

  const canSeeWalkIn =
    ['owner', 'regional_manager', 'manager', 'receptionist', 'cashier'].includes(role) ||
    (permissions && permissions.includes('walkin'))

  if (!canSeeWalkIn) return null

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

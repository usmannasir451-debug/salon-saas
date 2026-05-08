'use client'

import { useEffect, useState, useRef } from 'react'
import { Bell, X, Check, Calendar, CreditCard, Star, Package, Cake } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import Link from 'next/link'

type Notification = {
  id: string
  type: string
  title: string
  message: string
  read: boolean
  link: string | null
  created_at: string
}

const typeIcon: Record<string, React.ElementType> = {
  new_appointment: Calendar,
  payment_received: CreditCard,
  new_review: Star,
  low_inventory: Package,
  staff_birthday: Cake,
}

const typeColor: Record<string, string> = {
  new_appointment: 'text-blue-500 bg-blue-50',
  payment_received: 'text-green-500 bg-green-50',
  new_review: 'text-yellow-500 bg-yellow-50',
  low_inventory: 'text-orange-500 bg-orange-50',
  staff_birthday: 'text-pink-500 bg-pink-50',
}

interface NotificationBellProps {
  ownerId: string
}

export default function NotificationBell({ ownerId }: NotificationBellProps) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter((n) => !n.read).length

  useEffect(() => {
    loadNotifications()
    // Poll every 60 seconds for new notifications
    const interval = setInterval(loadNotifications, 60000)
    return () => clearInterval(interval)
  }, [ownerId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function loadNotifications() {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(20)
    setNotifications((data as Notification[]) ?? [])
    setLoading(false)
  }

  async function markAllRead() {
    const supabase = createClient()
    const ids = notifications.filter((n) => !n.read).map((n) => n.id)
    if (!ids.length) return
    await supabase.from('notifications').update({ read: true }).in('id', ids)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  async function markOneRead(id: string) {
    const supabase = createClient()
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }

  async function deleteOne(id: string) {
    const supabase = createClient()
    await supabase.from('notifications').delete().eq('id', id)
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen((o) => !o); if (!open) loadNotifications() }}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <Check className="w-3 h-3" /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {loading && notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">
                <Bell className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = typeIcon[n.type] ?? Bell
                const color = typeColor[n.type] ?? 'text-gray-500 bg-gray-50'
                const content = (
                  <div
                    className={cn(
                      'flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors relative group cursor-pointer',
                      !n.read && 'bg-primary/5'
                    )}
                    onClick={() => markOneRead(n.id)}
                  >
                    <div className={cn('p-1.5 rounded-lg flex-shrink-0 mt-0.5', color)}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-xs font-semibold text-gray-900 leading-tight', !n.read && 'font-bold')}>
                        {n.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-snug">{n.message}</p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    {!n.read && (
                      <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-1" />
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteOne(n.id) }}
                      className="absolute top-2 right-2 hidden group-hover:flex p-0.5 rounded hover:bg-gray-200 transition-colors"
                    >
                      <X className="w-3 h-3 text-gray-400" />
                    </button>
                  </div>
                )

                return n.link ? (
                  <Link key={n.id} href={n.link} onClick={() => setOpen(false)}>
                    {content}
                  </Link>
                ) : (
                  <div key={n.id}>{content}</div>
                )
              })
            )}
          </div>

          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100 text-center">
              <button
                onClick={() => {
                  const supabase = createClient()
                  supabase.from('notifications').delete().eq('user_id', ownerId).then(() => {
                    setNotifications([])
                    setOpen(false)
                  })
                }}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

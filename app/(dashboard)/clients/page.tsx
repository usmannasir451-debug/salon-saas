'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { format, differenceInDays, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { useUserContext } from '@/components/RoleContext'
import { useCurrency } from '@/hooks/useCurrency'
import {
  UserSearch, TrendingUp, CalendarDays, Loader2, Search, MessageCircle, Star,
  Crown, Users, Zap, Clock, Gift, Phone, ChevronRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { cn } from '@/lib/utils'

type ClientSummary = {
  name: string
  phone: string
  birthday: string | null
  totalVisits: number
  completedVisits: number
  totalSpend: number
  avgBill: number
  lastVisit: string | null
  firstVisit: string | null
  favoriteService: string | null
  segment: 'VIP' | 'Regular' | 'New' | 'Inactive'
  loyaltyBalance: number
  activeMembership: string | null
}

const SEGMENT_CONFIG = {
  VIP: {
    label: 'VIP',
    color: 'bg-yellow-50 text-yellow-700 border-yellow-300',
    icon: Crown,
    desc: '10+ completed visits',
  },
  Regular: {
    label: 'Regular',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: Users,
    desc: '3–9 completed visits',
  },
  New: {
    label: 'New',
    color: 'bg-green-50 text-green-700 border-green-200',
    icon: Zap,
    desc: '1–2 visits',
  },
  Inactive: {
    label: 'Inactive',
    color: 'bg-gray-100 text-gray-600 border-gray-200',
    icon: Clock,
    desc: 'No visit in 60+ days',
  },
}

function getSegment(client: Omit<ClientSummary, 'segment'>): ClientSummary['segment'] {
  const daysSinceLast = client.lastVisit
    ? differenceInDays(new Date(), parseISO(client.lastVisit))
    : 999
  if (daysSinceLast >= 60) return 'Inactive'
  if (client.completedVisits >= 10) return 'VIP'
  if (client.completedVisits >= 3) return 'Regular'
  return 'New'
}

function whatsappUrl(phone: string, clientName: string) {
  const digits = phone.replace(/\D/g, '')
  const wa = digits.startsWith('0') ? '92' + digits.slice(1) : digits.startsWith('92') ? digits : '92' + digits
  const msg = `Hello ${clientName}! We miss you at the salon. Come visit us soon! 🌸`
  return `https://wa.me/${wa}?text=${encodeURIComponent(msg)}`
}


function isBirthdayThisMonth(birthday: string | null) {
  if (!birthday) return false
  const bday = parseISO(birthday)
  return bday.getMonth() === new Date().getMonth()
}

export default function ClientsPage() {
  const { role, ownerId } = useUserContext()
  const router = useRouter()
  const { formatAmount } = useCurrency()

  const [clients, setClients] = useState<ClientSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [segmentFilter, setSegmentFilter] = useState<string>('All')

  useEffect(() => {
    if (!['owner', 'manager', 'receptionist'].includes(role)) {
      router.replace('/appointments')
      return
    }
    loadClients()
  }, [role, router]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadClients() {
    const supabase = createClient()

    const [apptRes, walkRes, clientsRes, loyaltyRes, membershipRes] = await Promise.all([
      supabase
        .from('appointments')
        .select('client_name, client_phone, appointment_date, status, services(name, price)')
        .eq('user_id', ownerId)
        .order('appointment_date', { ascending: false }),
      supabase
        .from('walk_ins')
        .select('client_name, client_phone, total, created_at, services(name)')
        .eq('user_id', ownerId)
        .order('created_at', { ascending: false }),
      supabase
        .from('clients')
        .select('name, phone, birthday')
        .eq('user_id', ownerId),
      supabase
        .from('loyalty_transactions')
        .select('client_phone, points, type')
        .eq('user_id', ownerId),
      supabase
        .from('client_memberships')
        .select('client_phone, membership_plans(name)')
        .eq('owner_id', ownerId)
        .eq('status', 'active'),
    ])

    // Build loyalty balance map by phone
    const loyaltyMap = new Map<string, number>()
    for (const t of loyaltyRes.data ?? []) {
      if (!t.client_phone) continue
      const cur = loyaltyMap.get(t.client_phone) ?? 0
      loyaltyMap.set(t.client_phone, cur + (t.type === 'earn' ? t.points : -t.points))
    }

    // Build active membership map by phone (first active plan name)
    const membershipMap = new Map<string, string>()
    for (const m of membershipRes.data ?? []) {
      if (!m.client_phone || membershipMap.has(m.client_phone)) continue
      const mp = m.membership_plans as { name?: string } | null
      if (mp?.name) membershipMap.set(m.client_phone, mp.name)
    }

    const map = new Map<string, Omit<ClientSummary, 'segment'>>()

    // Extended client data (birthday, etc.)
    const extendedMap = new Map<string, { phone: string; birthday: string | null }>()
    for (const c of clientsRes.data ?? []) {
      extendedMap.set(c.name, { phone: c.phone ?? '', birthday: c.birthday })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const a of (apptRes.data ?? []) as any[]) {
      const name = a.client_name?.trim()
      if (!name) continue
      if (!map.has(name)) {
        const ext = extendedMap.get(name)
        map.set(name, {
          name,
          phone: ext?.phone || a.client_phone || '',
          birthday: ext?.birthday ?? null,
          totalVisits: 0,
          completedVisits: 0,
          totalSpend: 0,
          avgBill: 0,
          lastVisit: null,
          firstVisit: null,
          favoriteService: null,
          loyaltyBalance: 0,
          activeMembership: null,
        })
      }
      const c = map.get(name)!
      c.totalVisits++
      if (a.client_phone && !c.phone) c.phone = a.client_phone
      if (a.status === 'completed') {
        c.completedVisits++
        c.totalSpend += a.services?.price ?? 0
      }
      if (!c.lastVisit || a.appointment_date > c.lastVisit) c.lastVisit = a.appointment_date
      if (!c.firstVisit || a.appointment_date < c.firstVisit) c.firstVisit = a.appointment_date
    }

    // Walk-ins
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const w of (walkRes.data ?? []) as any[]) {
      const name = w.client_name?.trim()
      if (!name) continue
      if (!map.has(name)) {
        const ext = extendedMap.get(name)
        map.set(name, {
          name,
          phone: ext?.phone || w.client_phone || '',
          birthday: ext?.birthday ?? null,
          totalVisits: 0,
          completedVisits: 0,
          totalSpend: 0,
          avgBill: 0,
          lastVisit: null,
          firstVisit: null,
          favoriteService: null,
          loyaltyBalance: 0,
          activeMembership: null,
        })
      }
      const c = map.get(name)!
      c.totalVisits++
      c.completedVisits++
      c.totalSpend += w.total ?? 0
      const wDate = w.created_at.slice(0, 10)
      if (!c.lastVisit || wDate > c.lastVisit) c.lastVisit = wDate
      if (!c.firstVisit || wDate < c.firstVisit) c.firstVisit = wDate
    }

    // Calculate avg bill, segment, loyalty, and membership
    const result: ClientSummary[] = Array.from(map.values()).map((c) => {
      const avgBill = c.completedVisits > 0 ? c.totalSpend / c.completedVisits : 0
      const loyaltyBalance = c.phone ? Math.max(0, loyaltyMap.get(c.phone) ?? 0) : 0
      const activeMembership = c.phone ? (membershipMap.get(c.phone) ?? null) : null
      return {
        ...c,
        avgBill,
        segment: getSegment(c),
        loyaltyBalance,
        activeMembership,
      }
    })

    result.sort((a, b) => (b.lastVisit ?? '') > (a.lastVisit ?? '') ? 1 : -1)
    setClients(result)
    setLoading(false)
  }

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      const matchSearch =
        !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.phone.includes(search)
      const matchSegment = segmentFilter === 'All' || c.segment === segmentFilter
      return matchSearch && matchSegment
    })
  }, [clients, search, segmentFilter])

  const segmentCounts = useMemo(() => {
    const counts: Record<string, number> = { All: clients.length }
    clients.forEach((c) => {
      counts[c.segment] = (counts[c.segment] ?? 0) + 1
    })
    return counts
  }, [clients])

  const birthdayThisMonth = clients.filter((c) => isBirthdayThisMonth(c.birthday))

  if (!['owner', 'manager', 'receptionist'].includes(role)) return null

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <UserSearch className="w-6 h-6 text-primary" />
            Clients
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{clients.length} clients across all channels</p>
        </div>
      </div>

      {/* Birthday reminders */}
      {birthdayThisMonth.length > 0 && (
        <div className="bg-pink-50 border border-pink-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Gift className="w-4 h-4 text-pink-600" />
            <p className="text-sm font-semibold text-pink-700">
              {birthdayThisMonth.length} client{birthdayThisMonth.length !== 1 ? 's' : ''} with birthday this month!
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {birthdayThisMonth.map((c) => (
              <div key={c.name} className="flex items-center gap-2 bg-white border border-pink-200 rounded-lg px-3 py-1.5">
                <p className="text-xs font-medium text-gray-900">{c.name}</p>
                {c.birthday && (
                  <p className="text-xs text-pink-500">
                    {format(parseISO(c.birthday), 'MMM d')}
                  </p>
                )}
                {c.phone && (
                  <a
                    href={whatsappUrl(c.phone, c.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-600 hover:text-green-700"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Segment stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(['All', 'VIP', 'Regular', 'New', 'Inactive'] as const).filter(s => s !== 'All').map((seg) => {
          const config = SEGMENT_CONFIG[seg]
          const Icon = config.icon
          return (
            <Card
              key={seg}
              className={cn(
                'cursor-pointer transition-all hover:shadow-sm',
                segmentFilter === seg && 'ring-2 ring-primary'
              )}
              onClick={() => setSegmentFilter(segmentFilter === seg ? 'All' : seg)}
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <p className="text-2xl font-bold text-gray-900">{segmentCounts[seg] ?? 0}</p>
                  <span className={cn('px-1.5 py-0.5 rounded-full border text-[10px] font-medium', config.color)}>
                    {seg}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{config.desc}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['All', 'VIP', 'Regular', 'New', 'Inactive'].map((seg) => (
            <button
              key={seg}
              onClick={() => setSegmentFilter(seg)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                segmentFilter === seg
                  ? 'bg-primary text-white border-primary'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              )}
            >
              {seg} {segmentCounts[seg] != null ? `(${segmentCounts[seg]})` : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Clients table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Client', 'Segment', 'Visits', 'Total Spend', 'Avg Bill', 'Loyalty Pts', 'Membership', 'Last Visit', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((c) => {
                  const segConfig = SEGMENT_CONFIG[c.segment]
                  const SegIcon = segConfig.icon
                  return (
                    <tr key={c.name} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">
                            {c.name[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{c.name}</p>
                            {c.phone && (
                              <p className="text-xs text-gray-400 flex items-center gap-1">
                                <Phone className="w-2.5 h-2.5" />
                                {c.phone}
                              </p>
                            )}
                            {c.birthday && (
                              <p className="text-xs text-pink-500 flex items-center gap-1">
                                <Gift className="w-2.5 h-2.5" />
                                {format(parseISO(c.birthday), 'MMM d')}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border', segConfig.color)}>
                          <SegIcon className="w-2.5 h-2.5" />
                          {c.segment}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        <span className="font-medium">{c.completedVisits}</span>
                        <span className="text-gray-400 text-xs"> / {c.totalVisits}</span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{formatAmount(c.totalSpend)}</td>
                      <td className="px-4 py-3 text-gray-700">{formatAmount(c.avgBill)}</td>
                      <td className="px-4 py-3">
                        {c.loyaltyBalance > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                            <Star className="w-3 h-3" />
                            {c.loyaltyBalance.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {c.activeMembership ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border bg-purple-50 text-purple-700 border-purple-200 max-w-[120px] truncate">
                            <Crown className="w-2.5 h-2.5 flex-shrink-0" />
                            {c.activeMembership}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {c.lastVisit ? format(parseISO(c.lastVisit), 'MMM d, yyyy') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {c.phone && (
                            <a
                              href={whatsappUrl(c.phone, c.name)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors"
                              title="WhatsApp"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </a>
                          )}
                          <Link
                            href={`/clients/${encodeURIComponent(c.name)}`}
                            className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors"
                            title="View profile"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center">
                      <UserSearch className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">
                        {clients.length === 0
                          ? 'No clients yet. They appear here once they have appointments.'
                          : 'No clients match your search.'}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

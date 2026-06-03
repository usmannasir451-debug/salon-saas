'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  subMonths, parseISO, addDays,
} from 'date-fns'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUserContext } from '@/components/RoleContext'
import { useCurrency } from '@/hooks/useCurrency'
import type { Branch } from '@/lib/types'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts'
import {
  CalendarDays, TrendingUp, Scissors, Users, Clock, Loader2, Sparkles,
  Building2, CheckCircle2, ReceiptText, AlertTriangle, Package,
  TrendingDown, UserCheck, Star, Gift, CreditCard, Zap, Activity, X,
  ArrowUpRight, ArrowDownRight, MessageCircle, Crown, Minus,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterType = 'today' | 'week' | 'month' | 'prev_month' | 'custom'

type AppRow = {
  id: string
  client_name: string
  client_phone?: string | null
  service_id: string
  staff_id?: string | null
  branch_id?: string | null
  appointment_date: string
  appointment_time: string
  status: string
  payment_method?: string | null
  total_amount?: number | null
  discount_amount?: number | null
  services?: { id: string; name: string; price: number } | null
  staff?: { id: string; name: string } | null
}

type WalkInRow = {
  id: string
  client_name?: string | null
  client_phone?: string | null
  staff_id?: string | null
  branch_id?: string | null
  total: number
  created_at: string
  payment_method?: string | null
  discount_amount?: number | null
  staff?: { id: string; name: string } | null
}

type WalkInServiceRow = {
  walk_in_id: string
  service_id: string
  quantity: number
  services?: { id: string; name: string; price: number } | null
}

type MembershipTxRow = { amount: number; created_at: string }
type ExpenseRow = { amount: number; branch_id: string | null }
type LowStockItem = { id: string; name: string; quantity: number; unit: string }
type ExpiringItem = {
  client_name: string
  client_phone: string | null
  expires_at: string
  plan_name: string
  type: 'membership' | 'package'
}

type PeriodData = {
  appts: AppRow[]
  walkIns: WalkInRow[]
  walkInServices: WalkInServiceRow[]
  expenses: ExpenseRow[]
  membershipTx: MembershipTxRow[]
  loyaltyRedeemed: number
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getDateRange(
  filter: FilterType,
  customFrom: string,
  customTo: string,
): { from: string; to: string } | null {
  const today = new Date()
  switch (filter) {
    case 'today':
      return { from: format(today, 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') }
    case 'week':
      return {
        from: format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        to: format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      }
    case 'month':
      return {
        from: format(startOfMonth(today), 'yyyy-MM-dd'),
        to: format(endOfMonth(today), 'yyyy-MM-dd'),
      }
    case 'prev_month': {
      const prev = subMonths(today, 1)
      return {
        from: format(startOfMonth(prev), 'yyyy-MM-dd'),
        to: format(endOfMonth(prev), 'yyyy-MM-dd'),
      }
    }
    case 'custom':
      return customFrom && customTo ? { from: customFrom, to: customTo } : null
    default:
      return null
  }
}

function getPrevDateRange(
  filter: FilterType,
  current: { from: string; to: string },
): { from: string; to: string } {
  const today = new Date()
  switch (filter) {
    case 'today': {
      const yd = format(subDays(today, 1), 'yyyy-MM-dd')
      return { from: yd, to: yd }
    }
    case 'week': {
      const prevStart = startOfWeek(subDays(today, 7), { weekStartsOn: 1 })
      const prevEnd   = endOfWeek(subDays(today, 7), { weekStartsOn: 1 })
      return { from: format(prevStart, 'yyyy-MM-dd'), to: format(prevEnd, 'yyyy-MM-dd') }
    }
    case 'month': {
      const prev = subMonths(today, 1)
      return {
        from: format(startOfMonth(prev), 'yyyy-MM-dd'),
        to: format(endOfMonth(prev), 'yyyy-MM-dd'),
      }
    }
    case 'prev_month': {
      const twoBack = subMonths(today, 2)
      return {
        from: format(startOfMonth(twoBack), 'yyyy-MM-dd'),
        to: format(endOfMonth(twoBack), 'yyyy-MM-dd'),
      }
    }
    case 'custom': {
      const fromD = parseISO(current.from)
      const toD   = parseISO(current.to)
      const days  = Math.round((toD.getTime() - fromD.getTime()) / 86400000) + 1
      const prevTo   = subDays(fromD, 1)
      const prevFrom = subDays(prevTo, days - 1)
      return { from: format(prevFrom, 'yyyy-MM-dd'), to: format(prevTo, 'yyyy-MM-dd') }
    }
  }
}

function changePct(current: number, prev: number): number | null {
  if (prev === 0) return null
  return Math.round(((current - prev) / prev) * 100)
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WEEK_DAYS  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOURS      = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]
const DOW_TO_IDX = [6, 0, 1, 2, 3, 4, 5] // JS getDay (0=Sun) → WEEK_DAYS index
const DONUT_COLORS = ['#f43f5e', '#ec4899', '#a855f7', '#3b82f6', '#f97316', '#10b981', '#6b7280']
const STAFF_COLORS = ['bg-primary', 'bg-rose-400', 'bg-pink-400', 'bg-fuchsia-400', 'bg-purple-400', 'bg-violet-400']

const statusConfig: Record<string, { label: string; className: string }> = {
  pending:   { label: 'Pending',   className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  confirmed: { label: 'Confirmed', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  completed: { label: 'Completed', className: 'bg-green-50 text-green-700 border-green-200' },
  cancelled: { label: 'Cancelled', className: 'bg-red-50 text-red-700 border-red-200' },
  no_show:   { label: 'No Show',   className: 'bg-gray-50 text-gray-600 border-gray-200' },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ChangeBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-[10px] text-gray-400">N/A</span>
  if (pct === 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-400">
        <Minus className="w-2.5 h-2.5" />0%
      </span>
    )
  const up = pct > 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${up ? 'text-green-600' : 'text-red-500'}`}>
      {up ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
      {up ? '+' : ''}{pct}%
    </span>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label, formatAmount }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-lg text-sm dark:bg-gray-900 dark:border-gray-700">
      <p className="font-medium text-gray-700 dark:text-gray-300 mb-0.5">{label}</p>
      <p className="font-bold text-primary">{formatAmount(payload[0].value)}</p>
    </div>
  )
}

function SkeletonCard() {
  return (
    <Card className="border-gray-100">
      <CardContent className="pt-5 pb-4">
        <div className="w-10 h-10 rounded-xl bg-gray-100 animate-pulse mb-3" />
        <div className="h-5 bg-gray-100 rounded animate-pulse mb-1.5 w-3/4" />
        <div className="h-3 bg-gray-100 rounded animate-pulse w-1/2" />
      </CardContent>
    </Card>
  )
}

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-40 text-gray-400">
      <Icon className="w-8 h-8 mb-2 opacity-30" />
      <p className="text-sm text-center">{message}</p>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { role, ownerId, enabledModules } = useUserContext()
  const { formatAmount } = useCurrency()
  const router = useRouter()
  const modOn = useCallback(
    (mod: string) => !enabledModules || enabledModules.includes(mod),
    [enabledModules],
  )

  // ── Static state (loaded once) ────────────────────────────────────────────
  const [salonName, setSalonName]           = useState('')
  const [branches, setBranches]             = useState<Branch[]>([])
  const [lowStockItems, setLowStockItems]   = useState<LowStockItem[]>([])
  const [birthdayClients, setBirthdayClients] = useState<{ name: string; phone: string | null }[]>([])
  const [avgRating, setAvgRating]           = useState(0)
  const [totalReviews, setTotalReviews]     = useState(0)
  const [trendAppts, setTrendAppts]         = useState<{ appointment_date: string; total_amount?: number | null; branch_id?: string | null }[]>([])
  const [trendWalkIns, setTrendWalkIns]     = useState<{ total: number; created_at: string; branch_id?: string | null }[]>([])
  const [trendMemTx, setTrendMemTx]         = useState<MembershipTxRow[]>([])
  const [todayAppts, setTodayAppts]         = useState<AppRow[]>([])
  const [expiringItems, setExpiringItems]   = useState<ExpiringItem[]>([])
  const [staticLoading, setStaticLoading]   = useState(true)

  // ── Period state (reloaded on filter change) ──────────────────────────────
  const [currentPeriod, setCurrentPeriod]   = useState<PeriodData | null>(null)
  const [prevPeriod, setPrevPeriod]         = useState<PeriodData | null>(null)
  const [periodLoading, setPeriodLoading]   = useState(false)

  // ── UI state ──────────────────────────────────────────────────────────────
  const [activeFilter, setActiveFilter]     = useState<FilterType>('month')
  const [customFrom, setCustomFrom]         = useState('')
  const [customTo, setCustomTo]             = useState('')
  const [showCustomPicker, setShowCustomPicker] = useState(false)
  const [activeBranch, setActiveBranch]     = useState('all')
  const [trendYear, setTrendYear]           = useState(() => new Date().getFullYear())
  const [liveTime, setLiveTime]             = useState(() => format(new Date(), 'h:mm a'))

  // ── Live clock ────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setLiveTime(format(new Date(), 'h:mm a')), 60000)
    return () => clearInterval(t)
  }, [])

  // ── Role guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!['owner', 'regional_manager', 'manager'].includes(role)) {
      router.replace('/appointments')
    }
  }, [role, router])

  // ── Fetch one period's data ───────────────────────────────────────────────
  const fetchPeriod = useCallback(
    async (r: { from: string; to: string }): Promise<PeriodData> => {
      const supabase = createClient()
      const [apptRes, walkInRes, expenseRes, memTxRes, loyaltyRes] = await Promise.all([
        supabase
          .from('appointments')
          .select('id, client_name, client_phone, service_id, staff_id, branch_id, appointment_date, appointment_time, status, payment_method, total_amount, discount_amount, services(id, name, price), staff(id, name)')
          .eq('user_id', ownerId)
          .gte('appointment_date', r.from)
          .lte('appointment_date', r.to),
        supabase
          .from('walk_ins')
          .select('id, client_name, client_phone, staff_id, branch_id, total, created_at, payment_method, discount_amount, staff(id, name)')
          .eq('user_id', ownerId)
          .gte('created_at', r.from + 'T00:00:00')
          .lte('created_at', r.to + 'T23:59:59'),
        modOn('expenses')
          ? supabase
              .from('expenses')
              .select('amount, branch_id')
              .eq('user_id', ownerId)
              .gte('expense_date', r.from)
              .lte('expense_date', r.to)
          : Promise.resolve({ data: [] }),
        modOn('memberships')
          ? supabase
              .from('membership_transactions')
              .select('amount, created_at')
              .eq('owner_id', ownerId)
              .eq('type', 'payment')
              .gte('created_at', r.from + 'T00:00:00')
              .lte('created_at', r.to + 'T23:59:59')
          : Promise.resolve({ data: [] }),
        supabase
          .from('loyalty_transactions')
          .select('points')
          .eq('user_id', ownerId)
          .eq('type', 'redeem')
          .gte('created_at', r.from + 'T00:00:00')
          .lte('created_at', r.to + 'T23:59:59'),
      ])

      const walkIns = (walkInRes.data as unknown as WalkInRow[]) ?? []
      const walkInIds = walkIns.map(w => w.id)

      let walkInServices: WalkInServiceRow[] = []
      if (walkInIds.length > 0) {
        const { data: wisData } = await supabase
          .from('walk_in_services')
          .select('walk_in_id, service_id, quantity, services(id, name, price)')
          .in('walk_in_id', walkInIds)
        walkInServices = (wisData as unknown as WalkInServiceRow[]) ?? []
      }

      const loyaltyRedeemed = ((loyaltyRes.data ?? []) as { points: number }[])
        .reduce((s, t) => s + Number(t.points ?? 0), 0)

      return {
        appts: (apptRes.data as unknown as AppRow[]) ?? [],
        walkIns,
        walkInServices,
        expenses: (expenseRes.data as ExpenseRow[]) ?? [],
        membershipTx: (memTxRes.data as MembershipTxRow[]) ?? [],
        loyaltyRedeemed,
      }
    },
    [ownerId, modOn],
  )

  // ── Load static data once ─────────────────────────────────────────────────
  useEffect(() => {
    if (!ownerId) return
    void (async () => {
      const supabase = createClient()
      const today    = new Date()
      const todayStr = format(today, 'yyyy-MM-dd')
      const yearStart  = `${today.getFullYear()}-01-01`
      const sevenDays  = format(addDays(today, 7), 'yyyy-MM-dd')
      const thisMonth  = today.getMonth()

      const [
        profileRes, branchRes, inventoryRes, reviewRes, clientBdayRes,
        trendApptRes, trendWalkInRes, trendMemTxRes,
        todayApptRes, expiringMemRes, expiringPkgRes, staffBdayRes,
      ] = await Promise.all([
        supabase.from('profiles').select('salon_name').eq('id', ownerId).single(),
        supabase.from('branches').select('*').eq('user_id', ownerId).order('name'),
        supabase.from('inventory_items').select('id, name, quantity, reorder_level, unit').eq('user_id', ownerId),
        supabase.from('reviews').select('rating').eq('user_id', ownerId),
        supabase.from('clients').select('name, phone, birthday').eq('user_id', ownerId).not('birthday', 'is', null),
        supabase.from('appointments')
          .select('appointment_date, branch_id, total_amount')
          .eq('user_id', ownerId)
          .eq('status', 'completed')
          .gte('appointment_date', yearStart),
        supabase.from('walk_ins')
          .select('total, created_at, branch_id')
          .eq('user_id', ownerId)
          .gte('created_at', yearStart + 'T00:00:00'),
        supabase.from('membership_transactions')
          .select('amount, created_at')
          .eq('owner_id', ownerId)
          .eq('type', 'payment')
          .gte('created_at', yearStart + 'T00:00:00'),
        supabase.from('appointments')
          .select('id, client_name, client_phone, service_id, staff_id, branch_id, appointment_date, appointment_time, status, payment_method, total_amount, discount_amount, services(id, name, price), staff(id, name)')
          .eq('user_id', ownerId)
          .eq('appointment_date', todayStr)
          .order('appointment_time', { ascending: true }),
        supabase.from('client_memberships')
          .select('client_name, client_phone, next_billing_date, membership_plans(name)')
          .eq('owner_id', ownerId)
          .eq('status', 'active')
          .gte('next_billing_date', todayStr)
          .lte('next_billing_date', sevenDays),
        supabase.from('client_packages')
          .select('client_name, client_phone, expiry_date, packages(name)')
          .eq('owner_id', ownerId)
          .eq('status', 'active')
          .gte('expiry_date', todayStr)
          .lte('expiry_date', sevenDays),
        supabase.from('staff').select('id, name, birthday').eq('user_id', ownerId).not('birthday', 'is', null),
      ])

      setSalonName(profileRes.data?.salon_name ?? '')
      setBranches((branchRes.data as Branch[]) ?? [])

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const low = (inventoryRes.data ?? []).filter((i: any) => Number(i.quantity) <= Number(i.reorder_level))
      setLowStockItems(low as LowStockItem[])

      const reviews = (reviewRes.data ?? []) as { rating: number }[]
      setTotalReviews(reviews.length)
      setAvgRating(reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0)

      const bClients = ((clientBdayRes.data ?? []) as { name: string; phone: string | null; birthday: string }[])
        .filter(c => c.birthday && new Date(c.birthday + 'T00:00:00').getMonth() === thisMonth)
      setBirthdayClients(bClients)

      setTrendAppts((trendApptRes.data as unknown as typeof trendAppts) ?? [])
      setTrendWalkIns((trendWalkInRes.data as unknown as typeof trendWalkIns) ?? [])
      setTrendMemTx((trendMemTxRes.data as MembershipTxRow[]) ?? [])
      setTodayAppts((todayApptRes.data as unknown as AppRow[]) ?? [])

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const expMem = ((expiringMemRes.data ?? []) as any[]).map(m => ({
        client_name: m.client_name as string,
        client_phone: m.client_phone as string | null,
        expires_at: m.next_billing_date as string,
        plan_name: (m.membership_plans?.name ?? 'Membership') as string,
        type: 'membership' as const,
      }))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const expPkg = ((expiringPkgRes.data ?? []) as any[]).map(p => ({
        client_name: p.client_name as string,
        client_phone: p.client_phone as string | null,
        expires_at: p.expiry_date as string,
        plan_name: (p.packages?.name ?? 'Package') as string,
        type: 'package' as const,
      }))
      setExpiringItems([...expMem, ...expPkg].sort((a, b) => a.expires_at.localeCompare(b.expires_at)))

      // Staff birthday notification
      const todayMMDD = format(today, 'MM-dd')
      const bdayStaff = ((staffBdayRes.data ?? []) as { id: string; name: string; birthday: string }[])
        .filter(s => s.birthday && format(new Date(s.birthday + 'T00:00:00'), 'MM-dd') === todayMMDD)
      if (bdayStaff.length > 0) {
        const { count } = await supabase
          .from('notifications').select('id', { count: 'exact', head: true })
          .eq('user_id', ownerId).eq('type', 'staff_birthday').gte('created_at', todayStr + 'T00:00:00')
        if (!count) {
          void Promise.all(bdayStaff.map(s =>
            supabase.from('notifications').insert({
              user_id: ownerId, type: 'staff_birthday',
              title: 'Staff Birthday Today! 🎂',
              message: `${s.name}'s birthday is today. Wish them well!`,
              link: '/staff',
            })
          ))
        }
      }

      // Low stock notification
      if (low.length > 0) {
        const { count } = await supabase
          .from('notifications').select('id', { count: 'exact', head: true })
          .eq('user_id', ownerId).eq('type', 'low_inventory').gte('created_at', todayStr + 'T00:00:00')
        if (!count) {
          void supabase.from('notifications').insert({
            user_id: ownerId, type: 'low_inventory',
            title: 'Low Inventory Alert',
            message: `${low.length} item(s) running low: ${(low as LowStockItem[]).slice(0, 2).map(i => i.name).join(', ')}`,
            link: '/inventory',
          })
        }
      }

      setStaticLoading(false)
    })()
  }, [ownerId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reload period data whenever filter or dates change ────────────────────
  useEffect(() => {
    if (staticLoading || !ownerId) return
    const range = getDateRange(activeFilter, customFrom, customTo)
    if (!range) return
    const prevRange = getPrevDateRange(activeFilter, range)
    setPeriodLoading(true)
    Promise.all([fetchPeriod(range), fetchPeriod(prevRange)])
      .then(([curr, prev]) => {
        setCurrentPeriod(curr)
        setPrevPeriod(prev)
      })
      .finally(() => setPeriodLoading(false))
  }, [activeFilter, customFrom, customTo, staticLoading, ownerId, fetchPeriod])

  // ── Reload trend when year changes ────────────────────────────────────────
  useEffect(() => {
    if (staticLoading || !ownerId || trendYear === new Date().getFullYear()) return
    const supabase = createClient()
    const yStart = `${trendYear}-01-01`
    const yEnd   = `${trendYear}-12-31`
    void Promise.all([
      supabase.from('appointments').select('appointment_date, branch_id, total_amount')
        .eq('user_id', ownerId).eq('status', 'completed')
        .gte('appointment_date', yStart).lte('appointment_date', yEnd),
      supabase.from('walk_ins').select('total, created_at, branch_id')
        .eq('user_id', ownerId)
        .gte('created_at', yStart + 'T00:00:00').lte('created_at', yEnd + 'T23:59:59'),
      supabase.from('membership_transactions').select('amount, created_at')
        .eq('owner_id', ownerId).eq('type', 'payment')
        .gte('created_at', yStart + 'T00:00:00').lte('created_at', yEnd + 'T23:59:59'),
    ]).then(([a, w, m]) => {
      setTrendAppts((a.data as unknown as typeof trendAppts) ?? [])
      setTrendWalkIns((w.data as unknown as typeof trendWalkIns) ?? [])
      setTrendMemTx((m.data as MembershipTxRow[]) ?? [])
    })
  }, [trendYear, staticLoading, ownerId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Branch filter helper ──────────────────────────────────────────────────
  function bFilter<T extends { branch_id?: string | null }>(arr: T[]): T[] {
    return activeBranch === 'all' ? arr : arr.filter(i => i.branch_id === activeBranch)
  }

  // ── Period metrics ────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    if (!currentPeriod) return null
    const appts    = bFilter(currentPeriod.appts)
    const walkIns  = bFilter(currentPeriod.walkIns)
    const expenses = bFilter(currentPeriod.expenses)
    const memTx    = currentPeriod.membershipTx

    const completed     = appts.filter(a => a.status === 'completed')
    const apptRevenue   = completed.reduce((s, a) => s + Number(a.total_amount ?? a.services?.price ?? 0), 0)
    const walkInRevenue = walkIns.reduce((s, w) => s + Number(w.total ?? 0), 0)
    const memRevenue    = memTx.reduce((s, t) => s + Number(t.amount ?? 0), 0)
    const totalRevenue  = apptRevenue + walkInRevenue + memRevenue
    const discounts     = appts.reduce((s, a) => s + Number(a.discount_amount ?? 0), 0)
                        + walkIns.reduce((s, w) => s + Number(w.discount_amount ?? 0), 0)
    const loyalty       = currentPeriod.loyaltyRedeemed
    const netRevenue    = Math.max(0, totalRevenue - discounts - loyalty)
    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount ?? 0), 0)
    const netProfit     = netRevenue - totalExpenses

    // Unique clients from appts (phones) + walk-ins (phones)
    const phones = new Set<string>()
    appts.forEach(a => { if (a.client_phone) phones.add(a.client_phone) })
    walkIns.forEach(w => { if (w.client_phone) phones.add(w.client_phone) })
    // Fallback: unique names if phone not available
    const names = new Set<string>()
    appts.forEach(a => { if (!a.client_phone) names.add(a.client_name) })
    walkIns.forEach(w => { if (!w.client_phone && w.client_name) names.add(w.client_name) })
    const uniqueClients = phones.size + names.size

    return {
      apptCount: appts.length,
      walkInCount: walkIns.length,
      completedCount: completed.length,
      totalRevenue,
      apptRevenue,
      walkInRevenue,
      memRevenue,
      memSold: memTx.length,
      discounts,
      loyalty,
      netRevenue,
      totalExpenses,
      netProfit,
      uniqueClients,
    }
  }, [currentPeriod, activeBranch]) // eslint-disable-line react-hooks/exhaustive-deps

  const prevMetrics = useMemo(() => {
    if (!prevPeriod) return null
    const appts   = bFilter(prevPeriod.appts)
    const walkIns = bFilter(prevPeriod.walkIns)
    const memTx   = prevPeriod.membershipTx

    const completed   = appts.filter(a => a.status === 'completed')
    const apptRev     = completed.reduce((s, a) => s + Number(a.total_amount ?? a.services?.price ?? 0), 0)
    const walkinRev   = walkIns.reduce((s, w) => s + Number(w.total ?? 0), 0)
    const memRev      = memTx.reduce((s, t) => s + Number(t.amount ?? 0), 0)

    return {
      apptCount:    appts.length,
      walkInCount:  walkIns.length,
      totalRevenue: apptRev + walkinRev + memRev,
    }
  }, [prevPeriod, activeBranch]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Service popularity ────────────────────────────────────────────────────
  const servicePopularity = useMemo(() => {
    if (!currentPeriod) return []
    const appts     = bFilter(currentPeriod.appts).filter(a => a.status === 'completed')
    const wiIds     = new Set(bFilter(currentPeriod.walkIns).map(w => w.id))
    const map       = new Map<string, { name: string; count: number; revenue: number }>()

    appts.forEach(a => {
      if (!a.services) return
      const name = a.services.name
      const rev  = Number(a.total_amount ?? a.services.price ?? 0)
      const prev = map.get(name)
      if (prev) { prev.count++; prev.revenue += rev }
      else map.set(name, { name, count: 1, revenue: rev })
    })

    currentPeriod.walkInServices
      .filter(wis => wiIds.has(wis.walk_in_id) && wis.services)
      .forEach(wis => {
        const name = wis.services!.name
        const qty  = Number(wis.quantity ?? 1)
        const rev  = Number(wis.services!.price ?? 0) * qty
        const prev = map.get(name)
        if (prev) { prev.count += qty; prev.revenue += rev }
        else map.set(name, { name, count: qty, revenue: rev })
      })

    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 5)
  }, [currentPeriod, activeBranch]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Payment breakdown ─────────────────────────────────────────────────────
  const paymentBreakdown = useMemo(() => {
    if (!currentPeriod) return []
    const appts   = bFilter(currentPeriod.appts).filter(a => a.status === 'completed')
    const walkIns = bFilter(currentPeriod.walkIns)
    const map     = new Map<string, number>()
    appts.forEach(a => {
      const m = a.payment_method ?? 'cash'
      map.set(m, (map.get(m) ?? 0) + Number(a.total_amount ?? a.services?.price ?? 0))
    })
    walkIns.forEach(w => {
      const m = w.payment_method ?? 'cash'
      map.set(m, (map.get(m) ?? 0) + Number(w.total ?? 0))
    })
    return Array.from(map.entries())
      .map(([method, amount]) => ({
        method: method.charAt(0).toUpperCase() + method.slice(1).replace(/_/g, ' '),
        amount,
      }))
      .filter(e => e.amount > 0)
      .sort((a, b) => b.amount - a.amount)
  }, [currentPeriod, activeBranch]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Staff performance ─────────────────────────────────────────────────────
  const staffPerformance = useMemo(() => {
    if (!currentPeriod) return []
    const appts   = bFilter(currentPeriod.appts)
    const walkIns = bFilter(currentPeriod.walkIns)
    const map     = new Map<string, { name: string; appts: number; walkIns: number; revenue: number }>()

    appts.filter(a => a.staff).forEach(a => {
      const name = a.staff!.name
      const rev  = a.status === 'completed' ? Number(a.total_amount ?? a.services?.price ?? 0) : 0
      const prev = map.get(name)
      if (prev) { prev.appts++; prev.revenue += rev }
      else map.set(name, { name, appts: 1, walkIns: 0, revenue: rev })
    })

    walkIns.filter(w => w.staff).forEach(w => {
      const name = w.staff!.name
      const rev  = Number(w.total ?? 0)
      const prev = map.get(name)
      if (prev) { prev.walkIns++; prev.revenue += rev }
      else map.set(name, { name, appts: 0, walkIns: 1, revenue: rev })
    })

    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue)
  }, [currentPeriod, activeBranch]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sales by source ───────────────────────────────────────────────────────
  const salesBySource = useMemo(() => {
    if (!metrics) return []
    const entries = [
      { name: 'Appointments', value: metrics.apptRevenue,  color: '#f43f5e' },
      { name: 'Walk-Ins',     value: metrics.walkInRevenue, color: '#ec4899' },
    ]
    if (modOn('memberships') && metrics.memRevenue > 0)
      entries.push({ name: 'Memberships', value: metrics.memRevenue, color: '#a855f7' })
    return entries.filter(e => e.value > 0)
  }, [metrics, modOn])

  // ── 12-month trend ────────────────────────────────────────────────────────
  const revenueTrendData = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const d   = new Date(trendYear, i, 1)
        const mon = format(d, 'yyyy-MM')
        const apptRev   = trendAppts
          .filter(a => a.appointment_date.startsWith(mon) && (activeBranch === 'all' || a.branch_id === activeBranch))
          .reduce((s, a) => s + Number(a.total_amount ?? 0), 0)
        const wiRev = trendWalkIns
          .filter(w => w.created_at.startsWith(mon) && (activeBranch === 'all' || w.branch_id === activeBranch))
          .reduce((s, w) => s + Number(w.total ?? 0), 0)
        const memRev = trendMemTx
          .filter(t => t.created_at.startsWith(mon))
          .reduce((s, t) => s + Number(t.amount ?? 0), 0)
        return { month: format(d, 'MMM'), revenue: apptRev + wiRev + memRev }
      }),
    [trendAppts, trendWalkIns, trendMemTx, activeBranch, trendYear],
  )

  // ── Busy hours heatmap ────────────────────────────────────────────────────
  const peakHeatmap = useMemo(() => {
    if (!currentPeriod) return { map: {} as Record<string, number>, max: 1 }
    const hmap: Record<string, number> = {}
    bFilter(currentPeriod.appts).forEach(a => {
      if (!a.appointment_time) return
      const dow  = new Date(a.appointment_date + 'T00:00:00').getDay()
      const idx  = DOW_TO_IDX[dow]
      const hour = parseInt(a.appointment_time.split(':')[0])
      if (hour >= 8 && hour <= 22) hmap[`${idx}-${hour}`] = (hmap[`${idx}-${hour}`] ?? 0) + 1
    })
    bFilter(currentPeriod.walkIns).forEach(w => {
      const d    = new Date(w.created_at)
      const idx  = DOW_TO_IDX[d.getDay()]
      const hour = d.getHours()
      if (hour >= 8 && hour <= 22) hmap[`${idx}-${hour}`] = (hmap[`${idx}-${hour}`] ?? 0) + 1
    })
    const max = Math.max(...Object.values(hmap), 1)
    return { map: hmap, max }
  }, [currentPeriod, activeBranch]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Skeleton loading ─────────────────────────────────────────────────────

  if (!['owner', 'regional_manager', 'manager'].includes(role)) return null

  if (staticLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        <div className="h-10 bg-gray-100 rounded-xl animate-pulse w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const prevMonthName = format(subMonths(new Date(), 1), 'MMMM yyyy')
  const filterLabels: Record<FilterType, string> = {
    today: 'Today', week: 'This Week', month: 'This Month', prev_month: prevMonthName, custom: 'Custom',
  }
  const customLabel =
    activeFilter === 'custom' && customFrom && customTo
      ? `${format(parseISO(customFrom), 'MMM d')} – ${format(parseISO(customTo), 'MMM d, yyyy')}`
      : null

  const revPct    = prevMetrics ? changePct(metrics?.totalRevenue ?? 0, prevMetrics.totalRevenue) : null
  const apptPct   = prevMetrics ? changePct(metrics?.apptCount ?? 0, prevMetrics.apptCount) : null
  const wiPct     = prevMetrics ? changePct(metrics?.walkInCount ?? 0, prevMetrics.walkInCount) : null

  const PeriodLoader = () =>
    periodLoading ? <div className="h-full bg-gray-50 animate-pulse rounded min-h-[56px]" /> : null

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Welcome, {salonName || 'Dashboard'}! 👋
            </h1>
          </div>
          <p className="text-gray-500 text-sm dark:text-gray-400">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
            <span className="mx-2 text-gray-300">—</span>
            <span className="font-medium text-gray-700 dark:text-gray-300">{liveTime}</span>
          </p>
        </div>
      </div>

      {/* ── Alerts ── */}
      {modOn('inventory') && lowStockItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3 dark:bg-amber-900/20 dark:border-amber-700">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-200 flex-1">
            <strong>{lowStockItems.length} item(s)</strong> running low:{' '}
            {lowStockItems.slice(0, 3).map(i => `${i.name} (${i.quantity} ${i.unit})`).join(', ')}
            {lowStockItems.length > 3 ? ` and ${lowStockItems.length - 3} more` : ''}
          </p>
          <Link href="/inventory">
            <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-100 gap-1 text-xs h-7">
              <Package className="w-3 h-3" /> View
            </Button>
          </Link>
        </div>
      )}

      {birthdayClients.length > 0 && (
        <div className="bg-pink-50 border border-pink-200 rounded-xl p-3 flex items-start gap-3 dark:bg-pink-900/20 dark:border-pink-700">
          <Gift className="w-4 h-4 text-pink-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-pink-700 dark:text-pink-300 mb-1">
              {birthdayClients.length} client{birthdayClients.length !== 1 ? 's' : ''} with birthday this month
            </p>
            <div className="flex flex-wrap gap-2">
              {birthdayClients.slice(0, 5).map(c => (
                <div key={c.name} className="flex items-center gap-1.5 bg-white border border-pink-200 rounded-lg px-2 py-1">
                  <span className="text-xs font-medium text-gray-800">{c.name}</span>
                  {c.phone && (
                    <a
                      href={`https://wa.me/${c.phone.replace(/\D/g, '').replace(/^0/, '92')}?text=${encodeURIComponent(`Happy Birthday ${c.name}! 🎂🌸`)}`}
                      target="_blank" rel="noopener noreferrer" className="text-green-600 hover:text-green-700">
                      <MessageCircle className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ))}
              {birthdayClients.length > 5 && (
                <span className="text-xs text-pink-600 self-center">+{birthdayClients.length - 5} more</span>
              )}
            </div>
          </div>
          <Link href="/clients">
            <Button size="sm" variant="outline" className="border-pink-300 text-pink-700 hover:bg-pink-100 gap-1 text-xs h-7">
              <Users className="w-3 h-3" /> View All
            </Button>
          </Link>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          {(['today', 'week', 'month', 'prev_month'] as const).map(f => (
            <button key={f}
              onClick={() => { setActiveFilter(f); setShowCustomPicker(false) }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                activeFilter === f
                  ? 'bg-primary text-white shadow-sm shadow-primary/30'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}>
              {filterLabels[f]}
            </button>
          ))}
          <button
            onClick={() => { setShowCustomPicker(v => !v); setActiveFilter('custom') }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${
              activeFilter === 'custom'
                ? 'bg-primary text-white shadow-sm shadow-primary/30'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
            }`}>
            <CalendarDays className="w-3.5 h-3.5" />
            {customLabel ?? 'Custom Range'}
            {activeFilter === 'custom' && customLabel && (
              <span className="ml-1" onClick={e => {
                e.stopPropagation()
                setActiveFilter('month')
                setCustomFrom('')
                setCustomTo('')
                setShowCustomPicker(false)
              }}>
                <X className="w-3 h-3" />
              </span>
            )}
          </button>

          {branches.length > 0 && (
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
              {[{ id: 'all', name: 'All Branches' }, ...branches].map(b => (
                <button key={b.id} onClick={() => setActiveBranch(b.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                    activeBranch === b.id
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400'
                  }`}>
                  {b.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {showCustomPicker && (
          <div className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 border border-gray-100 rounded-xl dark:bg-gray-800 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 whitespace-nowrap">From</label>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="h-8 px-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-primary/50 dark:bg-gray-900 dark:border-gray-600" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 whitespace-nowrap">To</label>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="h-8 px-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-primary/50 dark:bg-gray-900 dark:border-gray-600" />
            </div>
            {customFrom && customTo && (
              <span className="text-xs text-gray-500">
                {format(parseISO(customFrom), 'MMM d')} – {format(parseISO(customTo), 'MMM d, yyyy')}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── ROW 1: Key Metrics ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-gray-100 hover:shadow-md transition-shadow">
          <CardContent className="pt-5 pb-4">
            {periodLoading ? <PeriodLoader /> : (
              <>
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-3">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex items-start justify-between gap-1 mb-0.5">
                  <p className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
                    {formatAmount(metrics?.totalRevenue ?? 0)}
                  </p>
                  <ChangeBadge pct={revPct} />
                </div>
                <p className="text-xs text-gray-500">Total Revenue</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-gray-100 hover:shadow-md transition-shadow">
          <CardContent className="pt-5 pb-4">
            {periodLoading ? <PeriodLoader /> : (
              <>
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                  <CalendarDays className="w-5 h-5 text-primary" />
                </div>
                <div className="flex items-start justify-between gap-1 mb-0.5">
                  <p className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{metrics?.apptCount ?? 0}</p>
                  <ChangeBadge pct={apptPct} />
                </div>
                <p className="text-xs text-gray-500">Appointments</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-gray-100 hover:shadow-md transition-shadow">
          <CardContent className="pt-5 pb-4">
            {periodLoading ? <PeriodLoader /> : (
              <>
                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center mb-3">
                  <Zap className="w-5 h-5 text-orange-500" />
                </div>
                <div className="flex items-start justify-between gap-1 mb-0.5">
                  <p className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{metrics?.walkInCount ?? 0}</p>
                  <ChangeBadge pct={wiPct} />
                </div>
                <p className="text-xs text-gray-500">Walk-Ins</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-gray-100 hover:shadow-md transition-shadow">
          <CardContent className="pt-5 pb-4">
            {periodLoading ? <PeriodLoader /> : (
              <>
                <div className="w-10 h-10 rounded-xl bg-yellow-50 flex items-center justify-center mb-3">
                  <ReceiptText className="w-5 h-5 text-yellow-600" />
                </div>
                <p className="text-xl font-bold text-gray-900 dark:text-white mb-0.5 leading-tight">
                  {formatAmount(metrics?.discounts ?? 0)}
                </p>
                <p className="text-xs text-gray-500">Discounts Given</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── ROW 2: Financial ── */}
      <div className={`grid grid-cols-2 gap-4 ${modOn('expenses') ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
        <Card className="border-gray-100 hover:shadow-md transition-shadow">
          <CardContent className="pt-5 pb-4">
            {periodLoading ? <PeriodLoader /> : (
              <>
                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <p className="text-xl font-bold text-gray-900 dark:text-white mb-0.5 leading-tight">
                  {formatAmount(metrics?.netRevenue ?? 0)}
                </p>
                <p className="text-xs text-gray-500">Net Revenue</p>
                {(metrics?.loyalty ?? 0) > 0 && (
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    incl. {formatAmount(metrics!.loyalty)} loyalty redeemed
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-gray-100 hover:shadow-md transition-shadow">
          <CardContent className="pt-5 pb-4">
            <div className="w-10 h-10 rounded-xl bg-yellow-50 flex items-center justify-center mb-3">
              <Star className="w-5 h-5 text-yellow-500" />
            </div>
            <div className="flex items-baseline gap-1">
              <p className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
                {avgRating > 0 ? avgRating.toFixed(1) : '—'}
              </p>
              {avgRating > 0 && <span className="text-yellow-400 text-sm">★</span>}
            </div>
            <p className="text-xs text-gray-500">Avg Rating</p>
            {totalReviews > 0 && <p className="text-[10px] text-gray-400 mt-0.5">{totalReviews} review{totalReviews !== 1 ? 's' : ''}</p>}
          </CardContent>
        </Card>

        {modOn('expenses') && (
          <Card className={`border-2 ${(metrics?.netProfit ?? 0) >= 0 ? 'border-green-200 bg-green-50 dark:bg-green-900/10 dark:border-green-800' : 'border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800'}`}>
            <CardContent className="pt-5 pb-4">
              {periodLoading ? <PeriodLoader /> : (
                <>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${(metrics?.netProfit ?? 0) >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                    {(metrics?.netProfit ?? 0) >= 0
                      ? <TrendingUp className="w-5 h-5 text-green-700" />
                      : <TrendingDown className="w-5 h-5 text-red-600" />}
                  </div>
                  <p className={`text-xl font-bold leading-tight mb-0.5 ${(metrics?.netProfit ?? 0) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {formatAmount(Math.abs(metrics?.netProfit ?? 0))}
                  </p>
                  <p className="text-xs text-gray-500">Net {(metrics?.netProfit ?? 0) >= 0 ? 'Profit' : 'Loss'}</p>
                  {(metrics?.totalExpenses ?? 0) > 0 && (
                    <p className="text-[10px] text-gray-400 mt-0.5">Expenses: {formatAmount(metrics!.totalExpenses)}</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── ROW 3: Clients + Completed + Memberships ── */}
      <div className={`grid grid-cols-2 gap-4 ${modOn('memberships') ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
        <Card className="border-gray-100 hover:shadow-md transition-shadow">
          <CardContent className="pt-5 pb-4">
            {periodLoading ? <PeriodLoader /> : (
              <>
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                  <UserCheck className="w-5 h-5 text-primary" />
                </div>
                <p className="text-xl font-bold text-gray-900 dark:text-white mb-0.5 leading-tight">
                  {metrics?.uniqueClients ?? 0}
                </p>
                <p className="text-xs text-gray-500">Unique Clients</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-gray-100 hover:shadow-md transition-shadow">
          <CardContent className="pt-5 pb-4">
            {periodLoading ? <PeriodLoader /> : (
              <>
                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <p className="text-xl font-bold text-gray-900 dark:text-white mb-0.5 leading-tight">
                  {metrics?.completedCount ?? 0}
                </p>
                <p className="text-xs text-gray-500">Completed</p>
              </>
            )}
          </CardContent>
        </Card>

        {modOn('memberships') && (
          <Card className="border-gray-100 hover:shadow-md transition-shadow">
            <CardContent className="pt-5 pb-4">
              {periodLoading ? <PeriodLoader /> : (
                <>
                  <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center mb-3">
                    <Crown className="w-5 h-5 text-purple-600" />
                  </div>
                  <p className="text-xl font-bold text-gray-900 dark:text-white mb-0.5 leading-tight">
                    {metrics?.memSold ?? 0}
                  </p>
                  <p className="text-xs text-gray-500">Memberships Sold</p>
                  {(metrics?.memRevenue ?? 0) > 0 && (
                    <p className="text-[10px] text-purple-600 mt-0.5">{formatAmount(metrics!.memRevenue)}</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── ROW 4: Revenue Trend + Sales by Source ── */}
      {modOn('reports') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border-gray-100">
            <CardHeader className="pb-2 border-b border-gray-50">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" /> Monthly Sales Trend
                </CardTitle>
                <select value={trendYear} onChange={e => setTrendYear(Number(e.target.value))}
                  className="h-7 px-2 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-primary/50 dark:bg-gray-900 dark:border-gray-700">
                  {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {revenueTrendData.every(d => d.revenue === 0) ? (
                <EmptyState icon={TrendingUp} message={`No revenue data for ${trendYear}`} />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={revenueTrendData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                      tickFormatter={v => v >= 1000 ? `${(Number(v) / 1000).toFixed(0)}k` : String(v)} width={36} />
                    <Tooltip content={<ChartTooltip formatAmount={formatAmount} />} />
                    <Line type="monotone" dataKey="revenue" stroke="#f43f5e" strokeWidth={2.5}
                      dot={{ fill: '#f43f5e', r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="border-gray-100">
            <CardHeader className="pb-2 border-b border-gray-50">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary" /> Sales by Source
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {periodLoading ? (
                <div className="h-40 bg-gray-50 animate-pulse rounded" />
              ) : salesBySource.length === 0 ? (
                <EmptyState icon={TrendingUp} message="No sales data for this period" />
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={140} height={140}>
                    <PieChart>
                      <Pie data={salesBySource} dataKey="value" nameKey="name"
                        cx="50%" cy="50%" innerRadius={38} outerRadius={60} paddingAngle={3}>
                        {salesBySource.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(v: unknown) => formatAmount(Number(v ?? 0))} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {salesBySource.map(entry => {
                      const total = salesBySource.reduce((s, e) => s + e.value, 0)
                      return (
                        <div key={entry.name} className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                          <span className="text-xs text-gray-600 dark:text-gray-400 flex-1">{entry.name}</span>
                          <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                            {Math.round((entry.value / total) * 100)}%
                          </span>
                        </div>
                      )
                    })}
                    <p className="text-[10px] text-gray-400 mt-1">Total: {formatAmount(metrics?.totalRevenue ?? 0)}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── ROW 5: Service Popularity + Payment Methods ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-gray-100">
          <CardHeader className="pb-2 border-b border-gray-50">
            <CardTitle className="text-base flex items-center gap-2">
              <Scissors className="w-4 h-4 text-primary" /> Top Services
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {periodLoading ? (
              <div className="h-40 bg-gray-50 animate-pulse rounded" />
            ) : servicePopularity.length === 0 ? (
              <EmptyState icon={Scissors} message="No services data for this period" />
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(120, servicePopularity.length * 42)}>
                <BarChart data={servicePopularity} layout="vertical" margin={{ top: 0, right: 32, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={110} />
                  <Tooltip formatter={(v: unknown) => [Number(v ?? 0), 'Bookings']} />
                  <Bar dataKey="count" fill="#f43f5e" radius={[0, 4, 4, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-gray-100">
          <CardHeader className="pb-2 border-b border-gray-50">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" /> Payment Methods
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {periodLoading ? (
              <div className="h-40 bg-gray-50 animate-pulse rounded" />
            ) : paymentBreakdown.length === 0 ? (
              <EmptyState icon={CreditCard} message="No payment data for this period" />
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={140} height={140}>
                  <PieChart>
                    <Pie data={paymentBreakdown} dataKey="amount" nameKey="method"
                      cx="50%" cy="50%" innerRadius={38} outerRadius={60} paddingAngle={3}>
                      {paymentBreakdown.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: unknown) => formatAmount(Number(v ?? 0))} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {paymentBreakdown.map(({ method, amount }, i) => {
                    const total = paymentBreakdown.reduce((s, p) => s + p.amount, 0)
                    return (
                      <div key={method} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                        <span className="text-xs text-gray-600 dark:text-gray-400 flex-1 truncate">{method}</span>
                        <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                          {Math.round((amount / total) * 100)}%
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── ROW 6: Staff Performance + Busy Hours ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-gray-100">
          <CardHeader className="pb-2 border-b border-gray-50">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Staff Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {periodLoading ? (
              <div className="h-40 bg-gray-50 animate-pulse rounded" />
            ) : staffPerformance.length === 0 ? (
              <EmptyState icon={Users} message="No staff data for this period" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-100">
                      <th className="text-left pb-2 font-medium">Staff</th>
                      <th className="text-right pb-2 font-medium">Appts</th>
                      <th className="text-right pb-2 font-medium">Walk-ins</th>
                      <th className="text-right pb-2 font-medium">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {staffPerformance.slice(0, 8).map((s, i) => (
                      <tr key={s.name} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-lg ${STAFF_COLORS[i] ?? STAFF_COLORS[0]} flex items-center justify-center flex-shrink-0`}>
                              <span className="text-white text-[10px] font-bold">{s.name[0]?.toUpperCase()}</span>
                            </div>
                            <span className="font-medium text-gray-800 dark:text-gray-200 truncate max-w-[90px]">{s.name}</span>
                          </div>
                        </td>
                        <td className="py-2 text-right text-gray-600 dark:text-gray-400">{s.appts}</td>
                        <td className="py-2 text-right text-gray-600 dark:text-gray-400">{s.walkIns}</td>
                        <td className="py-2 text-right font-semibold text-gray-800 dark:text-gray-200">{formatAmount(s.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-gray-100">
          <CardHeader className="pb-2 border-b border-gray-50">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> Busy Hours
              <span className="text-xs font-normal text-gray-400">8AM–10PM</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {periodLoading ? (
              <div className="h-40 bg-gray-50 animate-pulse rounded" />
            ) : Object.keys(peakHeatmap.map).length === 0 ? (
              <EmptyState icon={Clock} message="No activity data for this period" />
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[340px]">
                  <div className="flex mb-1">
                    <div className="w-7 flex-shrink-0" />
                    {HOURS.map(h => (
                      <div key={h} className="flex-1 text-center text-[8px] text-gray-400 font-medium">
                        {h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`}
                      </div>
                    ))}
                  </div>
                  {WEEK_DAYS.map((day, wdIdx) => (
                    <div key={day} className="flex items-center mb-0.5">
                      <div className="w-7 text-[9px] text-gray-500 font-medium flex-shrink-0">{day}</div>
                      {HOURS.map(hour => {
                        const count     = peakHeatmap.map[`${wdIdx}-${hour}`] ?? 0
                        const intensity = count / peakHeatmap.max
                        return (
                          <div key={hour}
                            className="flex-1 mx-px h-5 rounded-sm flex items-center justify-center"
                            style={{ backgroundColor: count === 0 ? '#f3f4f6' : `rgba(244,63,94,${0.15 + intensity * 0.85})` }}
                            title={`${day} ${hour}:00 — ${count}`}>
                            {count > 0 && (
                              <span className="text-[7px] font-bold" style={{ color: intensity > 0.5 ? '#fff' : '#f43f5e' }}>
                                {count}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                  <div className="flex items-center gap-1.5 mt-2 justify-end">
                    <span className="text-[8px] text-gray-400">Low</span>
                    {[0.15, 0.4, 0.65, 0.9].map(o => (
                      <div key={o} className="w-3.5 h-2.5 rounded-sm" style={{ backgroundColor: `rgba(244,63,94,${o})` }} />
                    ))}
                    <span className="text-[8px] text-gray-400">High</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── ROW 7: Quick Info ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Today's Appointments */}
        <Card className="border-gray-100">
          <CardHeader className="pb-2 border-b border-gray-50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" /> Today&apos;s Schedule
              </CardTitle>
              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">{todayAppts.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-3">
            {todayAppts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-gray-400">
                <CalendarDays className="w-7 h-7 mb-2 opacity-30" />
                <p className="text-xs">No appointments today</p>
                <p className="text-[10px] text-gray-300 mt-0.5">Start booking to see schedule</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {todayAppts.map(a => {
                  const sc = statusConfig[a.status] ?? statusConfig.pending
                  return (
                    <div key={a.id} className="flex items-start gap-2 text-xs">
                      <span className="font-bold text-primary w-10 flex-shrink-0 mt-0.5">{a.appointment_time.slice(0, 5)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 dark:text-gray-200 truncate">{a.client_name}</p>
                        {a.services && <p className="text-gray-400 text-[10px] truncate">{a.services.name}</p>}
                      </div>
                      <Badge className={`text-[9px] border ${sc.className} flex-shrink-0`}>{sc.label}</Badge>
                    </div>
                  )
                })}
              </div>
            )}
            <Link href="/appointments">
              <Button variant="ghost" size="sm" className="w-full mt-2 text-xs text-primary hover:bg-primary/5">
                View All Appointments
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Low Stock */}
        {modOn('inventory') ? (
          <Card className="border-gray-100">
            <CardHeader className="pb-2 border-b border-gray-50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="w-4 h-4 text-amber-500" /> Low Stock
                </CardTitle>
                {lowStockItems.length > 0 && (
                  <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs">{lowStockItems.length}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-3">
              {lowStockItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-gray-400">
                  <Package className="w-7 h-7 mb-2 opacity-30" />
                  <p className="text-xs">All stock levels OK</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {lowStockItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between text-xs">
                      <span className="font-medium text-gray-800 dark:text-gray-200 truncate flex-1 mr-2">{item.name}</span>
                      <span className="text-amber-600 font-semibold flex-shrink-0">
                        {item.quantity} {item.unit}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <Link href="/inventory">
                <Button variant="ghost" size="sm" className="w-full mt-2 text-xs text-amber-600 hover:bg-amber-50">
                  Manage Inventory
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : <div />}

        {/* Expiring Memberships */}
        {modOn('memberships') ? (
          <Card className="border-gray-100">
            <CardHeader className="pb-2 border-b border-gray-50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Crown className="w-4 h-4 text-purple-500" /> Expiring Soon
                </CardTitle>
                {expiringItems.length > 0 && (
                  <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-xs">{expiringItems.length}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-3">
              {expiringItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-gray-400">
                  <Crown className="w-7 h-7 mb-2 opacity-30" />
                  <p className="text-xs">No memberships expiring this week</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {expiringItems.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${item.type === 'membership' ? 'bg-purple-400' : 'bg-blue-400'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 dark:text-gray-200 truncate">{item.client_name}</p>
                        <p className="text-gray-400 text-[10px] truncate">{item.plan_name}</p>
                      </div>
                      <span className="text-gray-400 flex-shrink-0">{format(parseISO(item.expires_at), 'MMM d')}</span>
                    </div>
                  ))}
                </div>
              )}
              <Link href="/memberships">
                <Button variant="ghost" size="sm" className="w-full mt-2 text-xs text-purple-600 hover:bg-purple-50">
                  Manage Memberships
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : <div />}
      </div>

    </div>
  )
}

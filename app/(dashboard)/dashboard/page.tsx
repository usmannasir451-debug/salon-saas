'use client'

import { useEffect, useState, useMemo } from 'react'
import { format, subDays, startOfWeek, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUserContext } from '@/components/RoleContext'
import type { Branch } from '@/lib/types'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts'
import {
  CalendarDays, TrendingUp, Scissors, Users, Clock, Loader2, Sparkles, Download, MessageCircle,
  Building2, CheckCircle2, ReceiptText, AlertTriangle, Package,
  TrendingDown, UserCheck, Star, Gift, CreditCard, Zap, Activity, X,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

// ─── Types ───────────────────────────────────────────────────────────────────

type ServiceRef = { id: string; name: string; price: number }
type StaffRef   = { id: string; name: string }

type AppRow = {
  id: string
  client_name: string
  client_phone?: string
  service_id: string
  staff_id?: string
  branch_id?: string
  appointment_date: string
  appointment_time: string
  status: string
  payment_method?: string | null
  notes?: string
  total_amount?: number | null
  discount_amount?: number | null
  services?: ServiceRef | null
  staff?: StaffRef | null
}

type WalkInRow = {
  id: string
  staff_id?: string
  branch_id?: string
  total: number
  created_at: string
  payment_method?: string | null
  discount_amount?: number | null
  services?: ServiceRef | null
}

type ExpenseRow = { amount: number; branch_id: string | null }

type LowStockItem = { id: string; name: string; quantity: number; unit: string }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(n: number, currency = 'USD') {
  return `${currency} ${Math.round(n).toLocaleString()}`
}

function whatsappUrl(phone: string, clientName: string, date: string, time: string, salonName: string) {
  const digits = phone.replace(/\D/g, '')
  const wa = digits.startsWith('0') ? '92' + digits.slice(1) : digits.startsWith('92') ? digits : '92' + digits
  const d = format(new Date(date + 'T00:00:00'), 'EEEE, MMMM d')
  const t = time.slice(0, 5)
  const msg = `Hello ${clientName}! Your appointment is on ${d} at ${t}. ${salonName || 'Salon'} looks forward to seeing you. Thank you!`
  return `https://wa.me/${wa}?text=${encodeURIComponent(msg)}`
}

const statusConfig: Record<string, { label: string; className: string }> = {
  pending:   { label: 'Pending',   className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  confirmed: { label: 'Confirmed', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  completed: { label: 'Completed', className: 'bg-green-50 text-green-700 border-green-200' },
  cancelled: { label: 'Cancelled', className: 'bg-red-50 text-red-700 border-red-200' },
  no_show:   { label: 'No Show',   className: 'bg-gray-50 text-gray-600 border-gray-200' },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RevenueTooltip({ active, payload, label, currency }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-lg text-sm">
      <p className="font-medium text-gray-700 mb-0.5">{label}</p>
      <p className="font-bold text-primary">{formatCurrency(payload[0].value, currency)}</p>
    </div>
  )
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]
const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DOW_TO_LABEL = [6, 0, 1, 2, 3, 4, 5] // JS getDay (0=Sun) → WEEK_DAYS index

const DONUT_COLORS = ['#f43f5e', '#ec4899', '#a855f7', '#3b82f6', '#f97316', '#10b981', '#6b7280']

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { role, ownerId, enabledModules } = useUserContext()
  const modulesEnabled = (mod: string) => !enabledModules || enabledModules.includes(mod)
  const router = useRouter()

  const [allAppointments, setAllAppointments] = useState<AppRow[]>([])
  const [walkIns, setWalkIns] = useState<WalkInRow[]>([])
  const [allExpenses, setAllExpenses] = useState<ExpenseRow[]>([])
  const [sixMonthClients, setSixMonthClients] = useState<{ created_at: string }[]>([])
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([])
  const [lastMonthAppts, setLastMonthAppts] = useState<{ status: string; branch_id?: string; total_amount?: number | null; discount_amount?: number | null; services?: { price: number } | null }[]>([])
  const [lastMonthWalkIns, setLastMonthWalkIns] = useState<{ total: number; branch_id?: string; discount_amount?: number | null }[]>([])
  const [salonName, setSalonName] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<'today' | 'week' | 'month' | 'prev_month' | 'custom'>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [showCustomPicker, setShowCustomPicker] = useState(false)
  const [trendYear, setTrendYear] = useState(() => new Date().getFullYear())
  const [trendAppts, setTrendAppts] = useState<{ appointment_date: string; total_amount?: number | null; branch_id?: string }[]>([])
  const [trendWalkIns, setTrendWalkIns] = useState<{ total: number; created_at: string; branch_id?: string }[]>([])
  const [trendMembershipTx, setTrendMembershipTx] = useState<{ amount: number; created_at: string }[]>([])
  const [customAppts, setCustomAppts] = useState<AppRow[]>([])
  const [customWalkIns, setCustomWalkIns] = useState<WalkInRow[]>([])
  const [customMembershipTx, setCustomMembershipTx] = useState<{ amount: number; created_at: string }[]>([])
  const [liveTime, setLiveTime] = useState(() => format(new Date(), 'h:mm a'))
  const [activeBranch, setActiveBranch] = useState('all')
  const [pdfLoading, setPdfLoading] = useState(false)
  const [avgRating, setAvgRating] = useState(0)
  const [totalReviews, setTotalReviews] = useState(0)
  const [birthdayClients, setBirthdayClients] = useState<{ name: string; phone: string | null }[]>([])
  const [membershipMonthlyRevenue, setMembershipMonthlyRevenue] = useState(0)
  const [allMembershipTx, setAllMembershipTx] = useState<{ amount: number; created_at: string }[]>([])

  useEffect(() => {
    const timer = setInterval(() => setLiveTime(format(new Date(), 'h:mm a')), 60000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!['owner', 'regional_manager', 'manager'].includes(role)) {
      router.replace('/appointments')
      return
    }
    loadDashboard()
  }, [role, router]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (loading || trendYear === new Date().getFullYear()) return
    loadTrendData(trendYear)
  }, [trendYear, loading, ownerId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (loading || activeFilter !== 'custom' || !customFrom || !customTo) return
    loadCustomRangeData(customFrom, customTo)
  }, [activeFilter, customFrom, customTo, loading, ownerId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!['owner', 'regional_manager', 'manager'].includes(role)) return null

  async function loadDashboard() {
    const supabase = createClient()

    const todayStr        = format(new Date(), 'yyyy-MM-dd')
    const monthStart      = format(startOfMonth(new Date()), 'yyyy-MM-dd')
    const monthEnd        = format(endOfMonth(new Date()), 'yyyy-MM-dd')
    const lastMonthStart  = format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd')
    const lastMonthEnd    = format(endOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd')
    const sevenDaysAgo    = format(subDays(new Date(), 6), 'yyyy-MM-dd')
    const queryStart      = monthStart < sevenDaysAgo ? monthStart : sevenDaysAgo
    const trendYearStart  = `${new Date().getFullYear()}-01-01`

    const [
      profileRes, apptRes, walkInRes, branchRes, expenseRes,
      lastMonthApptRes, lastMonthWalkinRes, inventoryRes, reviewRes,
      clientBdayRes, staffBdayRes,
      sixMonthApptRes, sixMonthWalkInRes, sixMonthClientRes,
      membershipTxRes,
    ] = await Promise.all([
      supabase.from('profiles').select('salon_name, salon_currency').eq('id', ownerId).single(),
      supabase.from('appointments')
        .select('id, client_name, client_phone, service_id, staff_id, branch_id, appointment_date, appointment_time, status, payment_method, notes, total_amount, discount_amount, services(id, name, price), staff(id, name)')
        .eq('user_id', ownerId)
        .gte('appointment_date', queryStart)
        .order('appointment_date', { ascending: false })
        .order('appointment_time', { ascending: true }),
      supabase.from('walk_ins')
        .select('id, staff_id, branch_id, total, created_at, payment_method, discount_amount, services(id, name, price)')
        .eq('user_id', ownerId)
        .gte('created_at', monthStart + 'T00:00:00'),
      supabase.from('branches').select('*').eq('user_id', ownerId).order('name'),
      supabase.from('expenses').select('amount, branch_id').eq('user_id', ownerId)
        .gte('expense_date', monthStart).lte('expense_date', monthEnd),
      supabase.from('appointments')
        .select('status, branch_id, total_amount, discount_amount, services(price)')
        .eq('user_id', ownerId)
        .gte('appointment_date', lastMonthStart)
        .lte('appointment_date', lastMonthEnd),
      supabase.from('walk_ins').select('total, branch_id, discount_amount').eq('user_id', ownerId)
        .gte('created_at', lastMonthStart + 'T00:00:00').lte('created_at', lastMonthEnd + 'T23:59:59'),
      supabase.from('inventory_items').select('id, name, quantity, reorder_level, unit').eq('user_id', ownerId),
      supabase.from('reviews').select('rating').eq('user_id', ownerId),
      supabase.from('clients').select('name, phone, birthday').eq('user_id', ownerId).not('birthday', 'is', null),
      supabase.from('staff').select('id, name, birthday').eq('user_id', ownerId).not('birthday', 'is', null),
      // 12-month trend data for current year
      supabase.from('appointments')
        .select('appointment_date, branch_id, total_amount')
        .eq('user_id', ownerId)
        .eq('status', 'completed')
        .gte('appointment_date', trendYearStart),
      supabase.from('walk_ins')
        .select('total, created_at, branch_id')
        .eq('user_id', ownerId)
        .gte('created_at', trendYearStart + 'T00:00:00'),
      supabase.from('clients')
        .select('created_at')
        .eq('user_id', ownerId)
        .gte('created_at', trendYearStart + 'T00:00:00'),
      // Membership transactions for period stats (covers this month + last month)
      supabase.from('membership_transactions').select('amount, created_at')
        .eq('owner_id', ownerId).eq('type', 'payment')
        .gte('created_at', lastMonthStart + 'T00:00:00'),
    ])

    setSalonName(profileRes.data?.salon_name ?? '')
    setCurrency(profileRes.data?.salon_currency ?? 'USD')
    setAllAppointments((apptRes.data as unknown as AppRow[]) ?? [])
    setWalkIns((walkInRes.data as unknown as WalkInRow[]) ?? [])
    setBranches((branchRes.data as Branch[]) ?? [])
    setAllExpenses((expenseRes.data as unknown as ExpenseRow[]) ?? [])
    setTrendAppts((sixMonthApptRes.data as unknown as typeof trendAppts) ?? [])
    setTrendWalkIns((sixMonthWalkInRes.data as unknown as typeof trendWalkIns) ?? [])
    setSixMonthClients((sixMonthClientRes.data as unknown as typeof sixMonthClients) ?? [])
    setTrendMembershipTx((membershipTxRes.data as unknown as typeof trendMembershipTx) ?? [])

    // Membership transactions for period stats
    const allTx = (membershipTxRes.data ?? []) as { amount: number; created_at: string }[]
    setAllMembershipTx(allTx)
    // Monthly revenue from memberships (this calendar month)
    const memRev = allTx
      .filter(t => t.created_at.slice(0, 7) === monthStart.slice(0, 7))
      .reduce((s, t) => s + Number(t.amount ?? 0), 0)
    setMembershipMonthlyRevenue(memRev)

    // Last month data (stored for branch-aware comparison)
    setLastMonthAppts((lastMonthApptRes.data as unknown as typeof lastMonthAppts) ?? [])
    setLastMonthWalkIns((lastMonthWalkinRes.data ?? []) as typeof lastMonthWalkIns)

    // Low stock
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const low = (inventoryRes.data ?? []).filter((i: any) => Number(i.quantity) <= Number(i.reorder_level))
    setLowStockItems(low as LowStockItem[])

    // Avg rating
    const reviews = (reviewRes.data ?? []) as { rating: number }[]
    const totalRev = reviews.length
    const avgRat   = totalRev > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / totalRev : 0
    setAvgRating(avgRat)
    setTotalReviews(totalRev)

    // Birthday clients this month
    const currentMonth = new Date().getMonth()
    const bClients = ((clientBdayRes.data ?? []) as { name: string; phone: string | null; birthday: string }[])
      .filter((c) => c.birthday && new Date(c.birthday + 'T00:00:00').getMonth() === currentMonth)
    setBirthdayClients(bClients)

    // Staff birthday notifications
    const staffWithBirthday = ((staffBdayRes.data ?? []) as { id: string; name: string; birthday: string }[])
      .filter((s) => s.birthday && format(new Date(s.birthday + 'T00:00:00'), 'MM-dd') === format(new Date(), 'MM-dd'))
    if (staffWithBirthday.length > 0) {
      const { count: bdayCount } = await supabase
        .from('notifications').select('id', { count: 'exact', head: true })
        .eq('user_id', ownerId).eq('type', 'staff_birthday').gte('created_at', todayStr + 'T00:00:00')
      if (!bdayCount) {
        void Promise.all(staffWithBirthday.map((s) =>
          supabase.from('notifications').insert({
            user_id: ownerId, type: 'staff_birthday',
            title: 'Staff Birthday Today! 🎂',
            message: `${s.name}'s birthday is today. Wish them well!`,
            link: '/staff',
          })
        ))
      }
    }

    // Low inventory notification
    if (low.length > 0) {
      const { count: invCount } = await supabase
        .from('notifications').select('id', { count: 'exact', head: true })
        .eq('user_id', ownerId).eq('type', 'low_inventory').gte('created_at', todayStr + 'T00:00:00')
      if (!invCount) {
        void supabase.from('notifications').insert({
          user_id: ownerId, type: 'low_inventory',
          title: 'Low Inventory Alert',
          message: `${low.length} item(s) running low: ${(low as LowStockItem[]).slice(0, 2).map((i) => i.name).join(', ')}`,
          link: '/inventory',
        })
      }
    }

    setLoading(false)
  }

  async function loadTrendData(year: number) {
    const supabase = createClient()
    const yearStart = `${year}-01-01`
    const yearEnd   = `${year}-12-31`
    const [apptRes, walkinRes, memTxRes] = await Promise.all([
      supabase.from('appointments').select('appointment_date, branch_id, total_amount')
        .eq('user_id', ownerId).eq('status', 'completed')
        .gte('appointment_date', yearStart).lte('appointment_date', yearEnd),
      supabase.from('walk_ins').select('total, created_at, branch_id')
        .eq('user_id', ownerId)
        .gte('created_at', yearStart + 'T00:00:00').lte('created_at', yearEnd + 'T23:59:59'),
      supabase.from('membership_transactions').select('amount, created_at')
        .eq('owner_id', ownerId).eq('type', 'payment')
        .gte('created_at', yearStart + 'T00:00:00').lte('created_at', yearEnd + 'T23:59:59'),
    ])
    setTrendAppts((apptRes.data as unknown as typeof trendAppts) ?? [])
    setTrendWalkIns((walkinRes.data as unknown as typeof trendWalkIns) ?? [])
    setTrendMembershipTx((memTxRes.data as unknown as typeof trendMembershipTx) ?? [])
  }

  async function loadCustomRangeData(from: string, to: string) {
    const supabase = createClient()
    const [apptRes, walkinRes, memTxRes] = await Promise.all([
      supabase.from('appointments')
        .select('id, client_name, client_phone, service_id, staff_id, branch_id, appointment_date, appointment_time, status, payment_method, notes, total_amount, discount_amount, services(id, name, price), staff(id, name)')
        .eq('user_id', ownerId)
        .gte('appointment_date', from).lte('appointment_date', to),
      supabase.from('walk_ins')
        .select('id, staff_id, branch_id, total, created_at, payment_method, discount_amount')
        .eq('user_id', ownerId)
        .gte('created_at', from + 'T00:00:00').lte('created_at', to + 'T23:59:59'),
      supabase.from('membership_transactions').select('amount, created_at')
        .eq('owner_id', ownerId).eq('type', 'payment')
        .gte('created_at', from + 'T00:00:00').lte('created_at', to + 'T23:59:59'),
    ])
    setCustomAppts((apptRes.data as unknown as AppRow[]) ?? [])
    setCustomWalkIns((walkinRes.data as unknown as WalkInRow[]) ?? [])
    setCustomMembershipTx((memTxRes.data as unknown as typeof customMembershipTx) ?? [])
  }

  // ── Branch filter ──────────────────────────────────────────────────────────

  const branchFiltered = useMemo(() => {
    if (activeBranch === 'all') return allAppointments
    return allAppointments.filter(a => a.branch_id === activeBranch)
  }, [allAppointments, activeBranch])

  const branchFilteredWalkIns = useMemo(() => {
    if (activeBranch === 'all') return walkIns
    return walkIns.filter(w => w.branch_id === activeBranch)
  }, [walkIns, activeBranch])

  const branchFilteredExpenses = useMemo(() => {
    if (activeBranch === 'all') return allExpenses
    return allExpenses.filter(e => e.branch_id === activeBranch)
  }, [allExpenses, activeBranch])

  // ── Monthly data ──────────────────────────────────────────────────────────

  const monthlyAppts = useMemo(() => {
    const monthStart = startOfMonth(new Date())
    return branchFiltered.filter(a => new Date(a.appointment_date + 'T00:00:00') >= monthStart)
  }, [branchFiltered])

  // ── Period-filtered appointments ──────────────────────────────────────────

  const periodFiltered = useMemo(() => {
    const todayStr   = format(new Date(), 'yyyy-MM-dd')
    const weekStart  = startOfWeek(new Date(), { weekStartsOn: 1 })
    const monthStart = startOfMonth(new Date())
    switch (activeFilter) {
      case 'today':      return branchFiltered.filter(a => a.appointment_date === todayStr)
      case 'week':       return branchFiltered.filter(a => new Date(a.appointment_date + 'T00:00:00') >= weekStart)
      case 'prev_month': return lastMonthAppts.filter(a => activeBranch === 'all' || a.branch_id === activeBranch) as unknown as AppRow[]
      case 'custom': {
        if (!customFrom || !customTo) return branchFiltered.filter(a => new Date(a.appointment_date + 'T00:00:00') >= monthStart)
        return customAppts.length > 0
          ? customAppts.filter(a => activeBranch === 'all' || a.branch_id === activeBranch)
          : branchFiltered.filter(a => a.appointment_date >= customFrom && a.appointment_date <= customTo)
      }
      default:           return branchFiltered.filter(a => new Date(a.appointment_date + 'T00:00:00') >= monthStart)
    }
  }, [branchFiltered, lastMonthAppts, customAppts, activeFilter, customFrom, customTo, activeBranch])

  // ── Today walk-ins ──────────────────────────────────────────────────────────

  const todayWalkIns = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    return branchFilteredWalkIns.filter(w => w.created_at.startsWith(todayStr))
  }, [branchFilteredWalkIns])

  const weekWalkIns = useMemo(() => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
    return branchFilteredWalkIns.filter(w => new Date(w.created_at) >= weekStart)
  }, [branchFilteredWalkIns])

  // ── Revenue chart (last 7 days) ──────────────────────────────────────────────

  const revenueChartData = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date    = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd')
      const apptRev = branchFiltered
        .filter(a => a.appointment_date === date && a.status === 'completed')
        .reduce((sum, a) => sum + Number(a.total_amount ?? a.services?.price ?? 0), 0)
      const walkinRev = branchFilteredWalkIns
        .filter(w => w.created_at.startsWith(date))
        .reduce((sum, w) => sum + Number(w.total ?? 0), 0)
      return { day: format(new Date(date + 'T00:00:00'), 'EEE'), revenue: apptRev + walkinRev, date }
    })
  }, [branchFiltered, branchFilteredWalkIns])

  // ── Summary stats ─────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const todayStr  = format(new Date(), 'yyyy-MM-dd')
    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const mthStart  = format(startOfMonth(new Date()), 'yyyy-MM-dd')
    const lmStart   = format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd')
    const lmEnd     = format(endOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd')

    if (activeFilter === 'prev_month') {
      const brAppts    = lastMonthAppts.filter(a => activeBranch === 'all' || a.branch_id === activeBranch)
      const brWalkIns  = lastMonthWalkIns.filter(w => activeBranch === 'all' || w.branch_id === activeBranch)
      const completed  = brAppts.filter(a => a.status === 'completed')
      const apptRev    = completed.reduce((s, a) => s + Number(a.total_amount ?? (a.services as {price?:number}|null)?.price ?? 0), 0)
      const walkinRev  = brWalkIns.reduce((s, w) => s + Number(w.total ?? 0), 0)
      const memRev     = allMembershipTx.filter(t => { const d = t.created_at.slice(0, 10); return d >= lmStart && d <= lmEnd }).reduce((s, t) => s + Number(t.amount ?? 0), 0)
      const discAppts  = brAppts.reduce((s, a) => s + Number((a as {discount_amount?:number|null}).discount_amount ?? 0), 0)
      const discWalkin = brWalkIns.reduce((s, w) => s + Number((w as {discount_amount?:number|null}).discount_amount ?? 0), 0)
      const revenue    = apptRev + walkinRev + memRev
      return {
        total: brAppts.length, completed: completed.length, walkins: brWalkIns.length,
        revenue, membershipRevenue: memRev, membershipsSold: 0,
        avgBill: completed.length + brWalkIns.length > 0 ? Math.round(revenue / (completed.length + brWalkIns.length)) : 0,
        clients: 0, discounts: discAppts + discWalkin,
      }
    }

    const completed     = periodFiltered.filter(a => a.status === 'completed')
    const apptRevenue   = completed.reduce((sum, a) => sum + Number(a.total_amount ?? a.services?.price ?? 0), 0)
    const periodWalkIns = activeFilter === 'today' ? todayWalkIns
      : activeFilter === 'week' ? weekWalkIns
      : activeFilter === 'custom' && customFrom && customTo
        ? (customWalkIns.length > 0 ? customWalkIns.filter(w => activeBranch === 'all' || w.branch_id === activeBranch)
          : branchFilteredWalkIns.filter(w => { const d = w.created_at.slice(0, 10); return d >= customFrom && d <= customTo }))
        : branchFilteredWalkIns
    const walkinRevenue = periodWalkIns.reduce((sum, w) => sum + Number(w.total ?? 0), 0)

    const membershipSource = (activeFilter === 'custom' && customFrom && customTo && customMembershipTx.length > 0)
      ? customMembershipTx : allMembershipTx
    const membershipPeriodRevenue = membershipSource.filter(t => {
      const d = t.created_at.slice(0, 10)
      if (activeFilter === 'today')  return d === todayStr
      if (activeFilter === 'week')   return d >= weekStart
      if (activeFilter === 'custom' && customFrom && customTo) return d >= customFrom && d <= customTo
      return d >= mthStart
    }).reduce((s, t) => s + Number(t.amount ?? 0), 0)
    const membershipsSold = membershipSource.filter(t => {
      const d = t.created_at.slice(0, 10)
      if (activeFilter === 'today')  return d === todayStr
      if (activeFilter === 'week')   return d >= weekStart
      if (activeFilter === 'custom' && customFrom && customTo) return d >= customFrom && d <= customTo
      return d >= mthStart
    }).length

    const discAppts  = periodFiltered.reduce((s, a) => s + Number(a.discount_amount ?? 0), 0)
    const discWalkin = periodWalkIns.reduce((s, w) => s + Number(w.discount_amount ?? 0), 0)

    const revenue       = apptRevenue + walkinRevenue + membershipPeriodRevenue
    const totalClients  = new Set(periodFiltered.map(a => a.client_name)).size
    const walkInCount   = periodWalkIns.length
    return {
      total:    periodFiltered.length,
      completed: completed.length,
      walkins:  walkInCount,
      revenue,
      membershipRevenue: membershipPeriodRevenue,
      membershipsSold,
      avgBill:  completed.length + walkInCount > 0
        ? Math.round(revenue / (completed.length + walkInCount))
        : 0,
      clients:  totalClients,
      discounts: discAppts + discWalkin,
    }
  }, [periodFiltered, activeFilter, todayWalkIns, weekWalkIns, branchFilteredWalkIns, customWalkIns, customFrom, customTo, allMembershipTx, customMembershipTx, lastMonthAppts, lastMonthWalkIns, activeBranch])

  // ── Monthly revenue & net profit (branch-filtered expenses) ──────────────

  const monthlyRevenue = useMemo(() => {
    const apptRev   = monthlyAppts.filter(a => a.status === 'completed').reduce((s, a) => s + Number(a.total_amount ?? a.services?.price ?? 0), 0)
    const walkinRev = branchFilteredWalkIns.reduce((s, w) => s + Number(w.total ?? 0), 0)
    return apptRev + walkinRev + membershipMonthlyRevenue
  }, [monthlyAppts, branchFilteredWalkIns, membershipMonthlyRevenue])

  const monthExpenses = useMemo(() => branchFilteredExpenses.reduce((s, e) => s + Number(e.amount), 0), [branchFilteredExpenses])
  const netProfit     = monthlyRevenue - monthExpenses

  const lastMonthRevenue = useMemo(() => {
    const apptRev = lastMonthAppts
      .filter(a => a.status === 'completed' && (activeBranch === 'all' || a.branch_id === activeBranch))
      .reduce((s, a) => s + Number(a.total_amount ?? a.services?.price ?? 0), 0)
    const walkinRev = lastMonthWalkIns
      .filter(w => activeBranch === 'all' || w.branch_id === activeBranch)
      .reduce((s, w) => s + Number(w.total ?? 0), 0)
    return apptRev + walkinRev
  }, [lastMonthAppts, lastMonthWalkIns, activeBranch])

  const revenueChangePct = lastMonthRevenue > 0
    ? Math.round(((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
    : null

  // ── 12-month revenue trend ────────────────────────────────────────────────

  const revenueTrendData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const monthDate = new Date(trendYear, i, 1)
      const monthStr  = format(monthDate, 'yyyy-MM')
      const apptRev   = trendAppts
        .filter(a => a.appointment_date.startsWith(monthStr) && (activeBranch === 'all' || a.branch_id === activeBranch))
        .reduce((s, a) => s + Number(a.total_amount ?? 0), 0)
      const walkinRev = trendWalkIns
        .filter(w => w.created_at.startsWith(monthStr) && (activeBranch === 'all' || w.branch_id === activeBranch))
        .reduce((s, w) => s + Number(w.total ?? 0), 0)
      const memRev = trendMembershipTx
        .filter(t => t.created_at.startsWith(monthStr))
        .reduce((s, t) => s + Number(t.amount ?? 0), 0)
      return { month: format(monthDate, 'MMM'), revenue: apptRev + walkinRev + memRev }
    })
  }, [trendAppts, trendWalkIns, trendMembershipTx, activeBranch, trendYear])

  // ── Client growth (6 months) ─────────────────────────────────────────────

  const clientGrowthData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const monthDate = startOfMonth(subMonths(new Date(), 5 - i))
      const monthStr  = format(monthDate, 'yyyy-MM')
      const count     = sixMonthClients.filter(c => c.created_at.startsWith(monthStr)).length
      return { month: format(monthDate, 'MMM yy'), count }
    })
  }, [sixMonthClients])

  // ── Top services by count ────────────────────────────────────────────────

  const topServicesByCount = useMemo(() => {
    const map = new Map<string, number>()
    monthlyAppts.filter(a => a.status === 'completed' && a.services).forEach(a => {
      const name = a.services!.name
      map.set(name, (map.get(name) ?? 0) + 1)
    })
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [monthlyAppts])

  // ── Top services by revenue ───────────────────────────────────────────────

  const topServices = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; count: number }>()
    monthlyAppts.filter(a => a.status === 'completed' && a.services).forEach(a => {
      const name  = a.services!.name
      const price = Number(a.services!.price)
      const prev  = map.get(name)
      if (prev) { prev.revenue += price; prev.count++ }
      else map.set(name, { name, revenue: price, count: 1 })
    })
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5)
  }, [monthlyAppts])

  // ── Top staff by revenue ──────────────────────────────────────────────────

  const topStaff = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; count: number }>()
    monthlyAppts.filter(a => a.status === 'completed' && a.staff).forEach(a => {
      const name  = a.staff!.name
      const price = Number(a.services?.price ?? 0)
      const prev  = map.get(name)
      if (prev) { prev.revenue += price; prev.count++ }
      else map.set(name, { name, revenue: price, count: 1 })
    })
    branchFilteredWalkIns.filter(w => w.staff_id).forEach(w => {
      const staffName = `staff-${w.staff_id}`
      const prev = map.get(staffName)
      if (prev) prev.revenue += Number(w.total ?? 0)
    })
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5)
  }, [monthlyAppts, branchFilteredWalkIns])

  // ── Staff utilization (booking count as % of top) ────────────────────────

  const staffUtilization = useMemo(() => {
    const map = new Map<string, number>()
    monthlyAppts.filter(a => a.staff).forEach(a => {
      const name = a.staff!.name
      map.set(name, (map.get(name) ?? 0) + 1)
    })
    const max = Math.max(...Array.from(map.values()), 1)
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count, pct: Math.round((count / max) * 100) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
  }, [monthlyAppts])

  // ── Peak hours heatmap (appointments + walk-ins, 8AM–10PM) ─────────────────

  const peakHeatmap = useMemo(() => {
    const map: Record<string, number> = {}
    // Appointments: use appointment_time column (the booked slot time)
    monthlyAppts.forEach(a => {
      if (!a.appointment_time) return
      const dow   = new Date(a.appointment_date + 'T00:00:00').getDay()
      const wdIdx = DOW_TO_LABEL[dow]
      const hour  = parseInt(a.appointment_time.split(':')[0])
      if (hour >= 8 && hour <= 22) {
        const key = `${wdIdx}-${hour}`
        map[key]  = (map[key] ?? 0) + 1
      }
    })
    // Walk-ins: use created_at timestamp (actual checkout time)
    branchFilteredWalkIns.forEach(w => {
      const d     = new Date(w.created_at)
      const dow   = d.getDay()
      const wdIdx = DOW_TO_LABEL[dow]
      const hour  = d.getHours()
      if (hour >= 8 && hour <= 22) {
        const key = `${wdIdx}-${hour}`
        map[key]  = (map[key] ?? 0) + 1
      }
    })
    const max = Math.max(...Object.values(map), 1)
    return { map, max }
  }, [monthlyAppts, branchFilteredWalkIns])

  // ── Busiest days of week ──────────────────────────────────────────────────

  const busyDays = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0]
    monthlyAppts.forEach(a => {
      const dow = new Date(a.appointment_date + 'T00:00:00').getDay()
      counts[dow]++
    })
    const peak = Math.max(...counts, 1)
    return DAYS.map((day, i) => ({ day, count: counts[i], pct: Math.round((counts[i] / peak) * 100) }))
  }, [monthlyAppts])

  // ── Payment method donut ──────────────────────────────────────────────────

  const paymentBreakdown = useMemo(() => {
    const periodWalkIns = activeFilter === 'today' ? todayWalkIns
      : activeFilter === 'week' ? weekWalkIns
      : activeFilter === 'custom' && customFrom && customTo
        ? branchFilteredWalkIns.filter(w => { const d = w.created_at.slice(0, 10); return d >= customFrom && d <= customTo })
        : branchFilteredWalkIns
    const completed     = periodFiltered.filter(a => a.status === 'completed')
    const map = new Map<string, number>()
    periodWalkIns.forEach(w => {
      const m = w.payment_method ?? 'cash'
      map.set(m, (map.get(m) ?? 0) + Number(w.total ?? 0))
    })
    completed.forEach(a => {
      const m = a.payment_method ?? 'cash'
      map.set(m, (map.get(m) ?? 0) + Number(a.total_amount ?? a.services?.price ?? 0))
    })
    return Array.from(map.entries())
      .map(([method, amount]) => ({ method: method.charAt(0).toUpperCase() + method.slice(1).replace(/_/g, ' '), amount }))
      .filter(e => e.amount > 0)
      .sort((a, b) => b.amount - a.amount)
  }, [periodFiltered, activeFilter, todayWalkIns, weekWalkIns, branchFilteredWalkIns])

  // ── Today's summary ───────────────────────────────────────────────────────

  const todaySummary = useMemo(() => {
    const todayStr        = format(new Date(), 'yyyy-MM-dd')
    const todayAllAppts   = branchFiltered.filter(a => a.appointment_date === todayStr)
    const todayCompleted  = todayAllAppts.filter(a => a.status === 'completed')
    const todayPending    = todayAllAppts.filter(a => ['pending', 'confirmed'].includes(a.status))
    const revAppts        = todayCompleted.reduce((s, a) => s + Number(a.total_amount ?? a.services?.price ?? 0), 0)
    const revWalkins      = todayWalkIns.reduce((s, w) => s + Number(w.total ?? 0), 0)
    return {
      revenue:      revAppts + revWalkins,
      appointments: todayAllAppts.length,
      walkIns:      todayWalkIns.length,
      pending:      todayPending.length,
    }
  }, [branchFiltered, todayWalkIns])

  // ── Today timeline ────────────────────────────────────────────────────────

  const todayAppts = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    return branchFiltered
      .filter(a => a.appointment_date === todayStr)
      .sort((a, b) => a.appointment_time.localeCompare(b.appointment_time))
  }, [branchFiltered])

  // ── PDF ───────────────────────────────────────────────────────────────────

  async function downloadPDF() {
    setPdfLoading(true)
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const doc = new jsPDF() as any
      const W   = doc.internal.pageSize.width

      doc.setFillColor(244, 63, 94)
      doc.rect(0, 0, W, 38, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(22); doc.setFont('helvetica', 'bold')
      doc.text('Snipforce', 14, 16)
      doc.setFontSize(11); doc.setFont('helvetica', 'normal')
      doc.text(`Monthly Report — ${format(new Date(), 'MMMM yyyy')}`, 14, 26)
      if (salonName) doc.text(salonName, 14, 34)

      doc.setTextColor(30, 30, 30)
      doc.setFontSize(13); doc.setFont('helvetica', 'bold')
      doc.text('Summary', 14, 52)

      autoTable(doc, {
        startY: 56,
        head: [['Metric', 'Value']],
        body: [
          ['Monthly Revenue', formatCurrency(monthlyRevenue, currency)],
          ['Monthly Expenses', formatCurrency(monthExpenses, currency)],
          ['Net Profit', formatCurrency(netProfit, currency)],
          ['Total Appointments', stats.total.toString()],
          ['Walk-Ins', stats.walkins.toString()],
          ['Avg Bill', formatCurrency(stats.avgBill, currency)],
        ],
        theme: 'striped',
        headStyles: { fillColor: [244, 63, 94] },
        styles: { fontSize: 10 },
      })

      let y: number = (doc as any).lastAutoTable.finalY + 12
      if (topServices.length > 0) {
        doc.setFontSize(13); doc.setFont('helvetica', 'bold')
        doc.text('Top Services', 14, y)
        autoTable(doc, {
          startY: y + 4,
          head: [['Service', `Revenue (${currency})`, 'Bookings']],
          body: topServices.map(s => [s.name, s.revenue.toLocaleString(), s.count.toString()]),
          theme: 'striped',
          headStyles: { fillColor: [244, 63, 94] },
          styles: { fontSize: 10 },
        })
        y = (doc as any).lastAutoTable.finalY + 12
      }

      doc.save(`Snipforce-${salonName || 'Report'}-${format(new Date(), 'MMMM-yyyy')}.pdf`)
    } finally {
      setPdfLoading(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    )
  }

  const prevMonthName = format(subMonths(new Date(), 1), 'MMMM yyyy')
  const filterLabels: Record<string, string> = { today: 'Today', week: 'This Week', month: 'This Month', prev_month: prevMonthName, custom: 'Custom' }

  const customLabel = activeFilter === 'custom' && customFrom && customTo
    ? `${format(parseISO(customFrom), 'MMM d')} – ${format(parseISO(customTo), 'MMM d, yyyy')}`
    : null

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome, {salonName || 'Dashboard'}! 👋
            </h1>
          </div>
          <p className="text-gray-500 text-sm">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
            <span className="mx-2 text-gray-300">—</span>
            <span className="font-medium text-gray-700">{liveTime}</span>
          </p>
        </div>
        <Button onClick={downloadPDF} disabled={pdfLoading} variant="outline"
          className="gap-2 border-primary/30 text-primary hover:bg-primary/5 flex-shrink-0">
          {pdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          <span className="hidden sm:inline">Monthly Report</span>
          <span className="sm:hidden">PDF</span>
        </Button>
      </div>

      {/* Low inventory alert */}
      {lowStockItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-800 flex-1">
            <strong>{lowStockItems.length} item(s)</strong> running low:{' '}
            {lowStockItems.slice(0, 3).map(i => `${i.name} (${i.quantity} ${i.unit})`).join(', ')}
            {lowStockItems.length > 3 ? ` and ${lowStockItems.length - 3} more` : ''}
          </p>
          <Link href="/inventory">
            <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-100 gap-1 flex-shrink-0 text-xs h-7">
              <Package className="w-3 h-3" /> View
            </Button>
          </Link>
        </div>
      )}

      {/* Birthday reminder */}
      {birthdayClients.length > 0 && (
        <div className="bg-pink-50 border border-pink-200 rounded-xl p-3 flex items-start gap-3">
          <Gift className="w-4 h-4 text-pink-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-pink-700 mb-1">
              {birthdayClients.length} client{birthdayClients.length !== 1 ? 's' : ''} with birthday this month
            </p>
            <div className="flex flex-wrap gap-2">
              {birthdayClients.slice(0, 5).map((c) => (
                <div key={c.name} className="flex items-center gap-1.5 bg-white border border-pink-200 rounded-lg px-2 py-1">
                  <span className="text-xs font-medium text-gray-800">{c.name}</span>
                  {c.phone && (
                    <a href={`https://wa.me/${c.phone.replace(/\D/g, '').replace(/^0/, '92')}?text=${encodeURIComponent(`Happy Birthday ${c.name}! 🎂🌸`)}`}
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
            <Button size="sm" variant="outline" className="border-pink-300 text-pink-700 hover:bg-pink-100 gap-1 flex-shrink-0 text-xs h-7">
              <Users className="w-3 h-3" /> View All
            </Button>
          </Link>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          {(['today', 'week', 'month', 'prev_month'] as const).map(f => (
            <button key={f} onClick={() => { setActiveFilter(f); setShowCustomPicker(false) }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                activeFilter === f
                  ? 'bg-primary text-white shadow-sm shadow-primary/30'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {filterLabels[f]}
            </button>
          ))}
          <button
            onClick={() => { setShowCustomPicker(v => !v); if (activeFilter !== 'custom') setActiveFilter('custom') }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${
              activeFilter === 'custom'
                ? 'bg-primary text-white shadow-sm shadow-primary/30'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            <CalendarDays className="w-3.5 h-3.5" />
            {customLabel ?? 'Custom Range'}
            {activeFilter === 'custom' && customLabel && (
              <span className="ml-1 cursor-pointer hover:text-white/80" onClick={(e) => { e.stopPropagation(); setActiveFilter('month'); setCustomFrom(''); setCustomTo(''); setShowCustomPicker(false) }}>
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
                      : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'
                  }`}>
                  {b.name}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Custom date range picker */}
        {showCustomPicker && (
          <div className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 border border-gray-100 rounded-xl">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 whitespace-nowrap">From</label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-8 px-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 whitespace-nowrap">To</label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-8 px-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            {customFrom && customTo && (
              <span className="text-xs text-gray-500">
                {format(parseISO(customFrom), 'MMM d')} – {format(parseISO(customTo), 'MMM d, yyyy')}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Today's Summary Card (only when filter=today) */}
      {activeFilter === 'today' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Revenue Today',   value: formatCurrency(todaySummary.revenue, currency), icon: TrendingUp,   bg: 'bg-blue-50',   ic: 'text-blue-600' },
            { label: 'Appointments',    value: String(todaySummary.appointments),              icon: CalendarDays, bg: 'bg-primary/10', ic: 'text-primary' },
            { label: 'Walk-ins',        value: String(todaySummary.walkIns),                   icon: Zap,          bg: 'bg-orange-50',  ic: 'text-orange-500' },
            { label: 'Pending',         value: String(todaySummary.pending),                   icon: Clock,        bg: 'bg-yellow-50',  ic: 'text-yellow-600' },
          ].map(s => (
            <Card key={s.label} className="border-gray-100 hover:shadow-md transition-shadow">
              <CardContent className="pt-5 pb-4">
                <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                  <s.icon className={`w-5 h-5 ${s.ic}`} />
                </div>
                <p className="text-xl font-bold text-gray-900 mb-0.5 leading-tight">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* KPI Cards */}
      <div className={`grid grid-cols-2 gap-4 ${modulesEnabled('memberships') ? 'lg:grid-cols-6' : 'lg:grid-cols-5'}`}>
        <Card className="border-gray-100 hover:shadow-md transition-shadow">
          <CardContent className="pt-5 pb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-3">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex items-start justify-between gap-1">
              <div>
                <p className="text-xl font-bold text-gray-900 mb-0.5 leading-tight">{formatCurrency(stats.revenue, currency)}</p>
                <p className="text-xs text-gray-500">Total Sales</p>
              </div>
              {revenueChangePct !== null && activeFilter === 'month' && (
                <Badge className={`text-xs flex-shrink-0 ${revenueChangePct >= 0 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                  {revenueChangePct >= 0 ? '+' : ''}{revenueChangePct}%
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-100 hover:shadow-md transition-shadow">
          <CardContent className="pt-5 pb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
              <CalendarDays className="w-5 h-5 text-primary" />
            </div>
            <p className="text-xl font-bold text-gray-900 mb-0.5 leading-tight">{stats.total}</p>
            <p className="text-xs text-gray-500">Appointments</p>
          </CardContent>
        </Card>
        <Card className="border-gray-100 hover:shadow-md transition-shadow">
          <CardContent className="pt-5 pb-4">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center mb-3">
              <Zap className="w-5 h-5 text-orange-500" />
            </div>
            <p className="text-xl font-bold text-gray-900 mb-0.5 leading-tight">{stats.walkins}</p>
            <p className="text-xs text-gray-500">Walk-Ins</p>
          </CardContent>
        </Card>
        <Card className="border-gray-100 hover:shadow-md transition-shadow">
          <CardContent className="pt-5 pb-4">
            <div className="w-10 h-10 rounded-xl bg-yellow-50 flex items-center justify-center mb-3">
              <Star className="w-5 h-5 text-yellow-500" />
            </div>
            <div className="flex items-baseline gap-1">
              <p className="text-xl font-bold text-gray-900 leading-tight">{avgRating > 0 ? avgRating.toFixed(1) : '—'}</p>
              {avgRating > 0 && <span className="text-yellow-400 text-sm">★</span>}
            </div>
            <p className="text-xs text-gray-500">Avg Rating</p>
            {totalReviews > 0 && <p className="text-[10px] text-gray-400 mt-0.5">{totalReviews} review{totalReviews !== 1 ? 's' : ''}</p>}
          </CardContent>
        </Card>
        <Card className="border-gray-100 hover:shadow-md transition-shadow">
          <CardContent className="pt-5 pb-4">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center mb-3">
              <ReceiptText className="w-5 h-5 text-orange-500" />
            </div>
            <p className="text-xl font-bold text-gray-900 mb-0.5 leading-tight">{formatCurrency(stats.discounts ?? 0, currency)}</p>
            <p className="text-xs text-gray-500">Discounts Given</p>
          </CardContent>
        </Card>
        {modulesEnabled('memberships') && (
          <Card className="border-gray-100 hover:shadow-md transition-shadow">
            <CardContent className="pt-5 pb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center mb-3">
                <CreditCard className="w-5 h-5 text-amber-600" />
              </div>
              <p className="text-xl font-bold text-gray-900 mb-0.5 leading-tight">{stats.membershipsSold}</p>
              <p className="text-xs text-gray-500">Memberships Sold</p>
              {stats.membershipRevenue > 0 && (
                <p className="text-[10px] text-amber-600 mt-0.5">{formatCurrency(stats.membershipRevenue, currency)}</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Monthly KPIs (expenses + profit) */}
      {activeFilter === 'month' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-gray-100">
            <CardContent className="pt-5 pb-4">
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-xl font-bold text-gray-900 leading-tight">{stats.completed}</p>
              <p className="text-xs text-gray-500">Completed</p>
            </CardContent>
          </Card>
          <Card className="border-gray-100">
            <CardContent className="pt-5 pb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                <UserCheck className="w-5 h-5 text-primary" />
              </div>
              <p className="text-xl font-bold text-gray-900 leading-tight">{stats.clients}</p>
              <p className="text-xs text-gray-500">Clients Served</p>
            </CardContent>
          </Card>
          {modulesEnabled('expenses') && (
            <Card className="border-gray-100">
              <CardContent className="pt-5 pb-4">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center mb-3">
                  <TrendingDown className="w-5 h-5 text-red-500" />
                </div>
                <p className="text-xl font-bold text-gray-900 leading-tight">{formatCurrency(monthExpenses, currency)}</p>
                <p className="text-xs text-gray-500">Expenses{activeBranch !== 'all' ? ' (Branch)' : ''}</p>
              </CardContent>
            </Card>
          )}
          {modulesEnabled('expenses') && (
            <Card className={`border-2 ${netProfit >= 0 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
              <CardContent className="pt-5 pb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${netProfit >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                  {netProfit >= 0
                    ? <TrendingUp className="w-5 h-5 text-green-700" />
                    : <TrendingDown className="w-5 h-5 text-red-600" />}
                </div>
                <p className={`text-xl font-bold leading-tight ${netProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {formatCurrency(Math.abs(netProfit), currency)}
                </p>
                <p className="text-xs text-gray-500">Net {netProfit >= 0 ? 'Profit' : 'Loss'}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Revenue Trend — 12 months (Line Chart) */}
      {modulesEnabled('reports') && <Card className="border-gray-100">
        <CardHeader className="pb-2 border-b border-gray-50">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> Monthly Sales Trend
            </CardTitle>
            <div className="flex items-center gap-2">
              <select
                value={trendYear}
                onChange={(e) => setTrendYear(Number(e.target.value))}
                className="h-7 px-2 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-primary/50"
              >
                {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                {formatCurrency(revenueTrendData.reduce((s, d) => s + d.revenue, 0), currency)} total
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {revenueTrendData.every(d => d.revenue === 0) ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <TrendingUp className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">No revenue data for {trendYear}</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={revenueTrendData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} width={36} />
                <Tooltip content={<RevenueTooltip currency={currency} />} />
                <Line type="monotone" dataKey="revenue" stroke="#f43f5e" strokeWidth={2.5}
                  dot={{ fill: '#f43f5e', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>}

      {/* Revenue Chart (last 7 days) */}
      {modulesEnabled('reports') && <Card className="border-gray-100">
        <CardHeader className="pb-2 border-b border-gray-50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Revenue — Last 7 Days</CardTitle>
            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
              {formatCurrency(revenueChartData.reduce((s, d) => s + d.revenue, 0), currency)} total
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {revenueChartData.every(d => d.revenue === 0) ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <TrendingUp className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">No revenue data yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={revenueChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} width={36} />
                <Tooltip content={<RevenueTooltip currency={currency} />} cursor={{ fill: '#fdf2f4' }} />
                <Bar dataKey="revenue" fill="#f43f5e" radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>}

      {/* Payment Method Donut + Service Popularity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Payment Method Donut */}
        <Card className="border-gray-100">
          <CardHeader className="pb-2 border-b border-gray-50">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" /> Payment Methods
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {paymentBreakdown.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No payment data</p>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={140} height={140}>
                  <PieChart>
                    <Pie data={paymentBreakdown} dataKey="amount" nameKey="method"
                      cx="50%" cy="50%" innerRadius={38} outerRadius={60} paddingAngle={3}>
                      {paymentBreakdown.map((_, i) => (
                        <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: unknown) => formatCurrency(Number(v ?? 0), currency)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {paymentBreakdown.map(({ method, amount }, i) => {
                    const total = paymentBreakdown.reduce((s, p) => s + p.amount, 0)
                    return (
                      <div key={method} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                        <span className="text-xs text-gray-600 flex-1 truncate">{method}</span>
                        <span className="text-xs font-semibold text-gray-800">{Math.round((amount / total) * 100)}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Service Popularity (booking count) */}
        <Card className="border-gray-100">
          <CardHeader className="pb-2 border-b border-gray-50">
            <CardTitle className="text-base flex items-center gap-2">
              <Scissors className="w-4 h-4 text-primary" /> Service Popularity This Month
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {topServicesByCount.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No completed appointments yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(120, topServicesByCount.length * 38)}>
                <BarChart data={topServicesByCount} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
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
      </div>

      {/* Peak Hours Heatmap */}
      <Card className="border-gray-100">
        <CardHeader className="pb-2 border-b border-gray-50">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" /> Busy Hours This Month
            <span className="text-xs font-normal text-gray-400 ml-1">appointments + walk-ins • 8AM–10PM</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {monthlyAppts.length === 0 && branchFilteredWalkIns.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No activity this month</p>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[480px]">
                {/* Hour labels */}
                <div className="flex mb-1">
                  <div className="w-8 flex-shrink-0" />
                  {HOURS.map(h => (
                    <div key={h} className="flex-1 text-center text-[9px] text-gray-400 font-medium">
                      {h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`}
                    </div>
                  ))}
                </div>
                {/* Grid */}
                {WEEK_DAYS.map((day, wdIdx) => (
                  <div key={day} className="flex items-center mb-1">
                    <div className="w-8 text-[10px] text-gray-500 font-medium flex-shrink-0">{day}</div>
                    {HOURS.map(hour => {
                      const count = peakHeatmap.map[`${wdIdx}-${hour}`] ?? 0
                      const intensity = count / peakHeatmap.max
                      return (
                        <div key={hour} className="flex-1 mx-0.5 h-6 rounded-sm flex items-center justify-center"
                          style={{
                            backgroundColor: count === 0
                              ? '#f3f4f6'
                              : `rgba(244, 63, 94, ${0.15 + intensity * 0.85})`,
                          }}
                          title={`${day} ${hour}:00 — ${count} booking${count !== 1 ? 's' : ''}`}>
                          {count > 0 && (
                            <span className="text-[8px] font-bold"
                              style={{ color: intensity > 0.5 ? '#fff' : '#f43f5e' }}>
                              {count}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
                {/* Legend */}
                <div className="flex items-center gap-2 mt-2 justify-end">
                  <span className="text-[9px] text-gray-400">Low</span>
                  {[0.15, 0.4, 0.65, 0.9].map(o => (
                    <div key={o} className="w-4 h-3 rounded-sm" style={{ backgroundColor: `rgba(244,63,94,${o})` }} />
                  ))}
                  <span className="text-[9px] text-gray-400">High</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Client Growth + Staff Utilization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Client Growth */}
        <Card className="border-gray-100">
          <CardHeader className="pb-2 border-b border-gray-50">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> New Clients — Last 6 Months
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {clientGrowthData.every(d => d.count === 0) ? (
              <p className="text-sm text-gray-400 text-center py-6">No new client data</p>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={clientGrowthData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={24} allowDecimals={false} />
                  <Tooltip formatter={(v: unknown) => [Number(v ?? 0), 'New Clients']} />
                  <Bar dataKey="count" fill="#ec4899" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Staff Utilization */}
        <Card className="border-gray-100">
          <CardHeader className="pb-2 border-b border-gray-50">
            <CardTitle className="text-base flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-primary" /> Staff Utilization This Month
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {staffUtilization.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No staff data this month</p>
            ) : (
              <div className="space-y-3">
                {staffUtilization.map((s, i) => {
                  const colors = ['bg-primary', 'bg-rose-400', 'bg-pink-400', 'bg-fuchsia-400', 'bg-purple-400', 'bg-violet-400']
                  return (
                    <div key={s.name} className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-lg ${colors[i] ?? colors[0]} flex items-center justify-center flex-shrink-0`}>
                        <span className="text-white text-xs font-bold">{s.name[0]?.toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-medium text-gray-800 truncate">{s.name}</p>
                          <span className="text-xs font-bold text-gray-700 ml-2 flex-shrink-0">
                            {s.count} booking{s.count !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full ${colors[i] ?? colors[0]} rounded-full transition-all`}
                            style={{ width: `${s.pct}%` }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Busiest Days + Top Staff */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-gray-100">
          <CardHeader className="pb-2 border-b border-gray-50">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" /> Busiest Days This Month
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {monthlyAppts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No appointments this month</p>
            ) : (
              <div className="space-y-2">
                {busyDays.map(d => (
                  <div key={d.day} className="flex items-center gap-3">
                    <span className="text-xs font-medium text-gray-600 w-7 flex-shrink-0">{d.day}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary/70 rounded-full transition-all" style={{ width: `${d.pct}%` }} />
                    </div>
                    <span className="text-xs font-medium text-gray-700 w-5 text-right flex-shrink-0">{d.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {topStaff.length > 0 ? (
          <Card className="border-gray-100">
            <CardHeader className="pb-2 border-b border-gray-50">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> Top Staff by Revenue
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-3">
                {topStaff.map((s, i) => {
                  const maxRev = topStaff[0].revenue || 1
                  const colors = ['bg-primary', 'bg-rose-400', 'bg-pink-400', 'bg-fuchsia-400', 'bg-purple-400']
                  return (
                    <div key={s.name} className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-lg ${colors[i] ?? colors[0]} flex items-center justify-center flex-shrink-0`}>
                        <span className="text-white text-xs font-bold">{s.name[0]?.toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-medium text-gray-800 truncate">{s.name}</p>
                          <span className="text-xs font-bold text-gray-700 ml-2 flex-shrink-0">
                            {formatCurrency(s.revenue, currency)}
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full ${colors[i] ?? colors[0]} rounded-full`}
                            style={{ width: `${(s.revenue / maxRev) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-gray-100">
            <CardContent className="pt-10 pb-10 text-center">
              <Users className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No staff revenue data</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Today's Timeline (visible when filter = today) */}
      {activeFilter === 'today' && (
        <Card className="border-gray-100">
          <CardHeader className="pb-3 border-b border-gray-50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" /> Today&apos;s Timeline
              </CardTitle>
              <Badge className="bg-primary/10 text-primary border-primary/20">{todayAppts.length} appts</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {todayAppts.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No appointments today</p>
              </div>
            ) : (
              <div className="relative pl-8">
                <div className="absolute left-3.5 top-0 bottom-0 w-px bg-gray-200" />
                <div className="space-y-4">
                  {todayAppts.map(appt => {
                    const sc = statusConfig[appt.status] ?? statusConfig.pending
                    return (
                      <div key={appt.id} className="relative">
                        <div className="absolute -left-5 top-2 w-2.5 h-2.5 rounded-full bg-primary border-2 border-white shadow-sm" />
                        <div className="bg-gray-50 rounded-xl p-3 hover:bg-gray-100/80 transition-colors">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-xs font-bold text-primary">{appt.appointment_time.slice(0, 5)}</span>
                            <span className="font-semibold text-sm text-gray-900">{appt.client_name}</span>
                            <Badge className={`text-xs border ${sc.className}`}>{sc.label}</Badge>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                            {appt.services && <span>{appt.services.name} · {formatCurrency(appt.services.price, currency)}</span>}
                            {appt.staff && <span>· {appt.staff.name}</span>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

    </div>
  )
}

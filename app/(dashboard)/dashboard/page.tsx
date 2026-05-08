'use client'

import { useEffect, useState, useMemo } from 'react'
import { format, subDays, startOfWeek, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUserContext } from '@/components/RoleContext'
import type { Branch } from '@/lib/types'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  CalendarDays, TrendingUp, Scissors, Users, Clock, Loader2, Sparkles, Download, MessageCircle,
  Building2, CheckCircle2, ReceiptText, Sun, Sunset, Moon, AlertTriangle, Package,
  TrendingDown, UserCheck, Star, Gift, CreditCard,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

// ─── Types ──────────────────────────────────────────────────────────────────

type ServiceRef = { id: string; name: string; price: number }
type StaffRef = { id: string; name: string }

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
  services?: ServiceRef | null
}

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
  pending: { label: 'Pending', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  confirmed: { label: 'Confirmed', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  completed: { label: 'Completed', className: 'bg-green-50 text-green-700 border-green-200' },
  cancelled: { label: 'Cancelled', className: 'bg-red-50 text-red-700 border-red-200' },
  no_show: { label: 'No Show', className: 'bg-gray-50 text-gray-600 border-gray-200' },
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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { role, ownerId } = useUserContext()
  const router = useRouter()

  const [allAppointments, setAllAppointments] = useState<AppRow[]>([])
  const [walkIns, setWalkIns] = useState<WalkInRow[]>([])
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([])
  const [monthExpenses, setMonthExpenses] = useState(0)
  const [lastMonthRevenue, setLastMonthRevenue] = useState(0)
  const [salonName, setSalonName] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<'today' | 'week' | 'month'>('month')
  const [activeBranch, setActiveBranch] = useState('all')
  const [pdfLoading, setPdfLoading] = useState(false)
  const [avgRating, setAvgRating] = useState(0)
  const [totalReviews, setTotalReviews] = useState(0)
  const [birthdayClients, setBirthdayClients] = useState<{ name: string; phone: string | null }[]>([])

  useEffect(() => {
    if (!['owner', 'regional_manager', 'manager'].includes(role)) {
      router.replace('/appointments')
      return
    }
    loadDashboard()
  }, [role, router]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!['owner', 'regional_manager', 'manager'].includes(role)) return null

  async function loadDashboard() {
    const supabase = createClient()

    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
    const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd')
    const lastMonthStart = format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd')
    const lastMonthEnd = format(endOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd')
    const sevenDaysAgo = format(subDays(new Date(), 6), 'yyyy-MM-dd')
    const queryStart = monthStart < sevenDaysAgo ? monthStart : sevenDaysAgo

    const [profileRes, apptRes, walkInRes, branchRes, expenseRes, lastMonthApptRes, lastMonthWalkinRes, inventoryRes, reviewRes, clientBdayRes, staffBdayRes] = await Promise.all([
      supabase.from('profiles').select('salon_name, salon_currency').eq('id', ownerId).single(),
      supabase.from('appointments')
        .select('id, client_name, client_phone, service_id, staff_id, branch_id, appointment_date, appointment_time, status, payment_method, notes, services(id, name, price), staff(id, name)')
        .eq('user_id', ownerId)
        .gte('appointment_date', queryStart)
        .order('appointment_date', { ascending: false })
        .order('appointment_time', { ascending: true }),
      supabase.from('walk_ins')
        .select('id, staff_id, branch_id, total, created_at, payment_method, services(id, name, price)')
        .eq('user_id', ownerId)
        .gte('created_at', monthStart + 'T00:00:00'),
      supabase.from('branches').select('*').eq('user_id', ownerId).order('name'),
      supabase.from('expenses').select('amount').eq('user_id', ownerId)
        .gte('expense_date', monthStart).lte('expense_date', monthEnd),
      supabase.from('appointments')
        .select('services(price), status')
        .eq('user_id', ownerId)
        .gte('appointment_date', lastMonthStart)
        .lte('appointment_date', lastMonthEnd),
      supabase.from('walk_ins').select('total').eq('user_id', ownerId)
        .gte('created_at', lastMonthStart + 'T00:00:00').lte('created_at', lastMonthEnd + 'T23:59:59'),
      supabase.from('inventory_items')
        .select('id, name, quantity, reorder_level, unit')
        .eq('user_id', ownerId),
      supabase.from('reviews').select('rating').eq('user_id', ownerId),
      supabase.from('clients').select('name, phone, birthday').eq('user_id', ownerId).not('birthday', 'is', null),
      supabase.from('staff').select('id, name, birthday').eq('user_id', ownerId).not('birthday', 'is', null),
    ])

    setSalonName(profileRes.data?.salon_name ?? '')
    setCurrency(profileRes.data?.salon_currency ?? 'USD')
    setAllAppointments((apptRes.data as unknown as AppRow[]) ?? [])
    setWalkIns((walkInRes.data as unknown as WalkInRow[]) ?? [])
    setBranches((branchRes.data as Branch[]) ?? [])

    // Monthly expenses
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const expTotal = (expenseRes.data ?? []).reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0)
    setMonthExpenses(expTotal)

    // Last month revenue
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lmApptRev = (lastMonthApptRes.data ?? []).filter((a: any) => a.status === 'completed')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .reduce((s: number, a: any) => s + Number(a.services?.price ?? 0), 0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lmWalkinRev = (lastMonthWalkinRes.data ?? []).reduce((s: number, w: any) => s + Number(w.total ?? 0), 0)
    setLastMonthRevenue(lmApptRev + lmWalkinRev)

    // Low stock
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const low = (inventoryRes.data ?? []).filter((i: any) => Number(i.quantity) <= Number(i.reorder_level))
    setLowStockItems(low as LowStockItem[])

    // Avg rating
    const reviews = (reviewRes.data ?? []) as { rating: number }[]
    const totalRev = reviews.length
    const avgRat = totalRev > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / totalRev : 0
    setAvgRating(avgRat)
    setTotalReviews(totalRev)

    // Birthday clients this month
    const currentMonth = new Date().getMonth()
    const bClients = ((clientBdayRes.data ?? []) as { name: string; phone: string | null; birthday: string }[])
      .filter((c) => c.birthday && new Date(c.birthday + 'T00:00:00').getMonth() === currentMonth)
    setBirthdayClients(bClients)

    // Staff birthday notifications (fire once per day)
    const staffWithBirthday = ((staffBdayRes.data ?? []) as { id: string; name: string; birthday: string }[])
      .filter((s) => s.birthday && format(new Date(s.birthday + 'T00:00:00'), 'MM-dd') === format(new Date(), 'MM-dd'))
    if (staffWithBirthday.length > 0) {
      const { count: bdayCount } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', ownerId)
        .eq('type', 'staff_birthday')
        .gte('created_at', todayStr + 'T00:00:00')
      if (!bdayCount) {
        void Promise.all(staffWithBirthday.map((s) =>
          supabase.from('notifications').insert({
            user_id: ownerId,
            type: 'staff_birthday',
            title: 'Staff Birthday Today! 🎂',
            message: `${s.name}'s birthday is today. Wish them well!`,
            link: '/staff',
          })
        ))
      }
    }

    // Low inventory notification (fire once per day)
    if (low.length > 0) {
      const { count: invCount } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', ownerId)
        .eq('type', 'low_inventory')
        .gte('created_at', todayStr + 'T00:00:00')
      if (!invCount) {
        void supabase.from('notifications').insert({
          user_id: ownerId,
          type: 'low_inventory',
          title: 'Low Inventory Alert',
          message: `${low.length} item(s) running low: ${(low as LowStockItem[]).slice(0, 2).map((i) => i.name).join(', ')}`,
          link: '/inventory',
        })
      }
    }

    setLoading(false)
  }

  // ── Branch filter ──
  const branchFiltered = useMemo(() => {
    if (activeBranch === 'all') return allAppointments
    return allAppointments.filter(a => a.branch_id === activeBranch)
  }, [allAppointments, activeBranch])

  const branchFilteredWalkIns = useMemo(() => {
    if (activeBranch === 'all') return walkIns
    return walkIns.filter(w => w.branch_id === activeBranch)
  }, [walkIns, activeBranch])

  // ── Monthly data ──
  const monthlyAppts = useMemo(() => {
    const monthStart = startOfMonth(new Date())
    return branchFiltered.filter(a => new Date(a.appointment_date + 'T00:00:00') >= monthStart)
  }, [branchFiltered])

  // ── Period-filtered appointments ──
  const periodFiltered = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
    const monthStart = startOfMonth(new Date())
    switch (activeFilter) {
      case 'today': return branchFiltered.filter(a => a.appointment_date === todayStr)
      case 'week': return branchFiltered.filter(a => new Date(a.appointment_date + 'T00:00:00') >= weekStart)
      default: return branchFiltered.filter(a => new Date(a.appointment_date + 'T00:00:00') >= monthStart)
    }
  }, [branchFiltered, activeFilter])

  // ── Today walk-ins ──
  const todayWalkIns = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    return branchFilteredWalkIns.filter(w => w.created_at.startsWith(todayStr))
  }, [branchFilteredWalkIns])

  // ── Revenue chart (last 7 days — appt + walkin) ──
  const revenueChartData = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd')
      const apptRev = branchFiltered
        .filter(a => a.appointment_date === date && a.status === 'completed')
        .reduce((sum, a) => sum + Number(a.services?.price ?? 0), 0)
      const walkinRev = branchFilteredWalkIns
        .filter(w => w.created_at.startsWith(date))
        .reduce((sum, w) => sum + Number(w.total ?? 0), 0)
      return { day: format(new Date(date + 'T00:00:00'), 'EEE'), revenue: apptRev + walkinRev, date }
    })
  }, [branchFiltered, branchFilteredWalkIns])

  // ── Summary stats for selected period ──
  const stats = useMemo(() => {
    const completed = periodFiltered.filter(a => a.status === 'completed')
    const apptRevenue = completed.reduce((sum, a) => sum + Number(a.services?.price ?? 0), 0)
    const periodWalkIns = activeFilter === 'today' ? todayWalkIns : branchFilteredWalkIns
    const walkinRevenue = periodWalkIns.reduce((sum, w) => sum + Number(w.total ?? 0), 0)
    const revenue = apptRevenue + walkinRevenue
    const totalClients = new Set([
      ...periodFiltered.map(a => a.client_name),
    ]).size
    return {
      total: periodFiltered.length,
      completed: completed.length,
      walkins: activeFilter === 'today' ? todayWalkIns.length : branchFilteredWalkIns.length,
      revenue,
      avgBill: completed.length + (activeFilter === 'today' ? todayWalkIns.length : branchFilteredWalkIns.length) > 0
        ? Math.round(revenue / (completed.length + (activeFilter === 'today' ? todayWalkIns.length : branchFilteredWalkIns.length)))
        : 0,
      clients: totalClients,
    }
  }, [periodFiltered, activeFilter, todayWalkIns, branchFilteredWalkIns])

  // ── Monthly revenue & net profit ──
  const monthlyRevenue = useMemo(() => {
    const apptRev = monthlyAppts.filter(a => a.status === 'completed')
      .reduce((s, a) => s + Number(a.services?.price ?? 0), 0)
    const walkinRev = branchFilteredWalkIns.reduce((s, w) => s + Number(w.total ?? 0), 0)
    return apptRev + walkinRev
  }, [monthlyAppts, branchFilteredWalkIns])

  const netProfit = monthlyRevenue - monthExpenses
  const revenueChangePct = lastMonthRevenue > 0
    ? Math.round(((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
    : null

  // ── Top services by revenue ──
  const topServices = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; count: number }>()
    monthlyAppts.filter(a => a.status === 'completed' && a.services).forEach(a => {
      const name = a.services!.name
      const price = Number(a.services!.price)
      const prev = map.get(name)
      if (prev) { prev.revenue += price; prev.count++ }
      else map.set(name, { name, revenue: price, count: 1 })
    })
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5)
  }, [monthlyAppts])

  // ── Top staff by revenue ──
  const topStaff = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; count: number }>()
    monthlyAppts.filter(a => a.status === 'completed' && a.staff).forEach(a => {
      const name = a.staff!.name
      const price = Number(a.services?.price ?? 0)
      const prev = map.get(name)
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

  // ── Busy hours ──
  const busyHours = useMemo(() => {
    let morning = 0, afternoon = 0, evening = 0
    monthlyAppts.forEach(a => {
      const hour = parseInt(a.appointment_time.split(':')[0])
      if (hour >= 8 && hour < 12) morning++
      else if (hour >= 12 && hour < 17) afternoon++
      else if (hour >= 17 && hour < 21) evening++
    })
    const peak = Math.max(morning, afternoon, evening, 1)
    return [
      { label: 'Morning', time: '8am–12pm', count: morning, pct: Math.round((morning / peak) * 100), icon: Sun, color: 'bg-amber-400' },
      { label: 'Afternoon', time: '12pm–5pm', count: afternoon, pct: Math.round((afternoon / peak) * 100), icon: Sunset, color: 'bg-orange-400' },
      { label: 'Evening', time: '5pm–9pm', count: evening, pct: Math.round((evening / peak) * 100), icon: Moon, color: 'bg-primary' },
    ]
  }, [monthlyAppts])

  // ── Revenue by payment method ──
  const paymentBreakdown = useMemo(() => {
    const periodWalkIns = activeFilter === 'today' ? todayWalkIns : branchFilteredWalkIns
    const completed = periodFiltered.filter(a => a.status === 'completed')
    const map = new Map<string, number>()
    periodWalkIns.forEach(w => {
      const m = w.payment_method ?? 'cash'
      map.set(m, (map.get(m) ?? 0) + Number(w.total ?? 0))
    })
    completed.forEach(a => {
      const m = a.payment_method ?? 'cash'
      map.set(m, (map.get(m) ?? 0) + Number(a.services?.price ?? 0))
    })
    return Array.from(map.entries())
      .map(([method, amount]) => ({ method: method.charAt(0).toUpperCase() + method.slice(1).replace(/_/g, ' '), amount }))
      .filter(e => e.amount > 0)
      .sort((a, b) => b.amount - a.amount)
  }, [periodFiltered, activeFilter, todayWalkIns, branchFilteredWalkIns])

  // ── Busiest days of week ──
  const busyDays = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0]
    monthlyAppts.forEach(a => {
      const dow = new Date(a.appointment_date + 'T00:00:00').getDay()
      counts[dow]++
    })
    const peak = Math.max(...counts, 1)
    return DAYS.map((day, i) => ({ day, count: counts[i], pct: Math.round((counts[i] / peak) * 100) }))
  }, [monthlyAppts])

  // ── Today timeline ──
  const todayAppts = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    return branchFiltered
      .filter(a => a.appointment_date === todayStr)
      .sort((a, b) => a.appointment_time.localeCompare(b.appointment_time))
  }, [branchFiltered])

  // ── PDF Download ──
  async function downloadPDF() {
    setPdfLoading(true)
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const doc = new jsPDF() as any
      const W = doc.internal.pageSize.width

      doc.setFillColor(244, 63, 94)
      doc.rect(0, 0, W, 38, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(22)
      doc.setFont('helvetica', 'bold')
      doc.text('SalonPro', 14, 16)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.text(`Monthly Report — ${format(new Date(), 'MMMM yyyy')}`, 14, 26)
      if (salonName) doc.text(salonName, 14, 34)

      doc.setTextColor(30, 30, 30)
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
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
        doc.setFontSize(13)
        doc.setFont('helvetica', 'bold')
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

      doc.save(`SalonPro-${salonName || 'Report'}-${format(new Date(), 'MMMM-yyyy')}.pdf`)
    } finally {
      setPdfLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    )
  }

  const filterLabels = { today: 'Today', week: 'This Week', month: 'This Month' }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-gray-900">{salonName || 'Dashboard'}</h1>
          </div>
          <p className="text-gray-500 text-sm">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={downloadPDF} disabled={pdfLoading} variant="outline"
            className="gap-2 border-primary/30 text-primary hover:bg-primary/5 flex-shrink-0">
            {pdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span className="hidden sm:inline">Monthly Report</span>
            <span className="sm:hidden">PDF</span>
          </Button>
        </div>
      </div>

      {/* Low inventory alert */}
      {lowStockItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-800 flex-1">
            <strong>{lowStockItems.length} item(s)</strong> are running low on stock:{' '}
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
                    <a
                      href={`https://wa.me/${c.phone.replace(/\D/g, '').replace(/^0/, '92')}?text=${encodeURIComponent(`Happy Birthday ${c.name}! 🎂🌸`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-600 hover:text-green-700"
                    >
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
      <div className="flex items-center gap-2 flex-wrap">
        {(['today', 'week', 'month'] as const).map(f => (
          <button key={f} onClick={() => setActiveFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              activeFilter === f
                ? 'bg-primary text-white shadow-sm shadow-primary/30'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {filterLabels[f]}
          </button>
        ))}
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Revenue */}
        <Card className="border-gray-100 hover:shadow-md transition-shadow">
          <CardContent className="pt-5 pb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-3">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex items-start justify-between gap-1">
              <div>
                <p className="text-xl font-bold text-gray-900 mb-0.5 leading-tight">{formatCurrency(stats.revenue, currency)}</p>
                <p className="text-xs text-gray-500">Revenue</p>
              </div>
              {revenueChangePct !== null && activeFilter === 'month' && (
                <Badge className={`text-xs flex-shrink-0 ${revenueChangePct >= 0 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                  {revenueChangePct >= 0 ? '+' : ''}{revenueChangePct}%
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
        {/* Appointments */}
        <Card className="border-gray-100 hover:shadow-md transition-shadow">
          <CardContent className="pt-5 pb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
              <CalendarDays className="w-5 h-5 text-primary" />
            </div>
            <p className="text-xl font-bold text-gray-900 mb-0.5 leading-tight">{stats.total}</p>
            <p className="text-xs text-gray-500">Appointments</p>
          </CardContent>
        </Card>
        {/* Walk-Ins */}
        <Card className="border-gray-100 hover:shadow-md transition-shadow">
          <CardContent className="pt-5 pb-4">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center mb-3">
              <Zap className="w-5 h-5 text-orange-500" />
            </div>
            <p className="text-xl font-bold text-gray-900 mb-0.5 leading-tight">{stats.walkins}</p>
            <p className="text-xs text-gray-500">Walk-Ins</p>
          </CardContent>
        </Card>
        {/* Avg Bill */}
        <Card className="border-gray-100 hover:shadow-md transition-shadow">
          <CardContent className="pt-5 pb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center mb-3">
              <ReceiptText className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-xl font-bold text-gray-900 mb-0.5 leading-tight">{formatCurrency(stats.avgBill, currency)}</p>
            <p className="text-xs text-gray-500">Avg Bill</p>
          </CardContent>
        </Card>
        {/* Salon Rating */}
        <Card className="border-gray-100 hover:shadow-md transition-shadow">
          <CardContent className="pt-5 pb-4">
            <div className="w-10 h-10 rounded-xl bg-yellow-50 flex items-center justify-center mb-3">
              <Star className="w-5 h-5 text-yellow-500" />
            </div>
            <div className="flex items-baseline gap-1">
              <p className="text-xl font-bold text-gray-900 leading-tight">
                {avgRating > 0 ? avgRating.toFixed(1) : '—'}
              </p>
              {avgRating > 0 && <span className="text-yellow-400 text-sm">★</span>}
            </div>
            <p className="text-xs text-gray-500">Avg Rating</p>
            {totalReviews > 0 && <p className="text-[10px] text-gray-400 mt-0.5">{totalReviews} review{totalReviews !== 1 ? 's' : ''}</p>}
          </CardContent>
        </Card>
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
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center mb-3">
                <TrendingDown className="w-5 h-5 text-red-500" />
              </div>
              <p className="text-xl font-bold text-gray-900 leading-tight">{formatCurrency(monthExpenses, currency)}</p>
              <p className="text-xs text-gray-500">Expenses</p>
            </CardContent>
          </Card>
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
          <Card className="border-gray-100">
            <CardContent className="pt-5 pb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                <UserCheck className="w-5 h-5 text-primary" />
              </div>
              <p className="text-xl font-bold text-gray-900 leading-tight">{stats.clients}</p>
              <p className="text-xs text-gray-500">Clients Served</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Payment Method Breakdown */}
      {paymentBreakdown.length > 0 && (
        <Card className="border-gray-100">
          <CardHeader className="pb-2 border-b border-gray-50">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" /> Revenue by Payment Method
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {paymentBreakdown.map(({ method, amount }) => {
                const max = paymentBreakdown[0].amount || 1
                return (
                  <div key={method} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500 mb-1">{method}</p>
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(amount, currency)}</p>
                    <div className="h-1 bg-gray-200 rounded-full mt-2">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${(amount / max) * 100}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Revenue Chart */}
      <Card className="border-gray-100">
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
            <ResponsiveContainer width="100%" height={200}>
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
      </Card>

      {/* Top Services + Busy Hours */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-gray-100">
          <CardHeader className="pb-2 border-b border-gray-50">
            <CardTitle className="text-base flex items-center gap-2">
              <Scissors className="w-4 h-4 text-primary" /> Top Services This Month
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {topServices.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No completed appointments yet</p>
            ) : (
              <div className="space-y-3">
                {topServices.map((s, i) => {
                  const maxRev = topServices[0].revenue || 1
                  return (
                    <div key={s.name}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold flex-shrink-0">{i + 1}</span>
                          <span className="font-medium text-gray-800 truncate">{s.name}</span>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <span className="font-bold text-primary text-xs">{formatCurrency(s.revenue, currency)}</span>
                          <span className="text-gray-400 text-xs ml-1">({s.count})</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${(s.revenue / maxRev) * 100}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-gray-100">
          <CardHeader className="pb-2 border-b border-gray-50">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> Busy Hours This Month
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            {monthlyAppts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No appointments this month</p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {busyHours.map(h => (
                  <div key={h.label} className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2"
                      style={{ backgroundColor: h.label === 'Morning' ? '#fef3c7' : h.label === 'Afternoon' ? '#ffedd5' : '#fff1f3' }}>
                      <h.icon className={`w-5 h-5 ${h.label === 'Morning' ? 'text-amber-500' : h.label === 'Afternoon' ? 'text-orange-500' : 'text-primary'}`} />
                    </div>
                    <p className="text-xl font-bold text-gray-900">{h.count}</p>
                    <p className="text-xs font-medium text-gray-700">{h.label}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{h.time}</p>
                    <div className="w-full mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${h.color} transition-all`} style={{ width: `${h.pct}%` }} />
                    </div>
                  </div>
                ))}
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
                      <div className="h-full bg-primary/70 rounded-full transition-all"
                        style={{ width: `${d.pct}%` }} />
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

      {/* Appointments List */}
      <Card className="border-gray-100">
        <CardHeader className="pb-3 border-b border-gray-50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{filterLabels[activeFilter]} Appointments</CardTitle>
            <Badge className="bg-primary/10 text-primary border-primary/20">{periodFiltered.length} total</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {periodFiltered.length === 0 ? (
            <div className="text-center py-10">
              <CalendarDays className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No appointments</p>
            </div>
          ) : (
            <div className="space-y-2">
              {periodFiltered.map(appt => {
                const sc = statusConfig[appt.status] ?? statusConfig.pending
                return (
                  <div key={appt.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100/80 transition-colors group">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900">{appt.client_name}</p>
                        {appt.services && (
                          <>
                            <span className="text-gray-300">•</span>
                            <p className="text-sm text-gray-600 truncate">{appt.services.name}</p>
                            <span className="text-xs font-medium text-primary">{formatCurrency(appt.services.price, currency)}</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-gray-400">
                          {activeFilter !== 'today' && (
                            <>{format(new Date(appt.appointment_date + 'T00:00:00'), 'MMM d')} · </>
                          )}
                          {appt.appointment_time.slice(0, 5)}
                        </span>
                        {appt.staff && (
                          <>
                            <span className="text-gray-300">·</span>
                            <span className="text-xs text-gray-400">{appt.staff.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Badge className={`text-xs border ${sc.className}`}>{sc.label}</Badge>
                      {appt.client_phone && (
                        <a href={whatsappUrl(appt.client_phone, appt.client_name, appt.appointment_date, appt.appointment_time, salonName)}
                          target="_blank" rel="noopener noreferrer"
                          className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                          title="Send WhatsApp reminder">
                          <MessageCircle className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import { format, startOfMonth, endOfMonth, startOfWeek, subDays } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { useUserContext } from '@/components/RoleContext'
import { useCurrency } from '@/hooks/useCurrency'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  TrendingUp, Zap, CreditCard, CalendarDays, Users, Package, DollarSign,
  Download, Loader2, BarChart2, RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// ─── Types ────────────────────────────────────────────────────────────────────

type DateRange = { from: string; to: string }
type Preset = 'today' | 'week' | 'month' | 'custom'
type PieLabelProps = { method?: string; pct?: number }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map((row) =>
    row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')
  ).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function pct(value: number, total: number) {
  return total > 0 ? `${Math.round((value / total) * 100)}%` : '0%'
}

const CHART_COLORS = ['#f43f5e', '#ec4899', '#a855f7', '#3b82f6', '#f97316', '#10b981', '#6b7280', '#eab308']

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Date Range Controls ───────────────────────────────────────────────────────

function DateRangeBar({ range, preset, onChange, onPreset }: {
  range: DateRange
  preset: Preset
  onChange: (r: DateRange) => void
  onPreset: (p: Preset) => void
}) {
  const presets: { id: Preset; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
    { id: 'custom', label: 'Custom' },
  ]
  return (
    <div className="flex flex-wrap items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
      <div className="flex gap-1">
        {presets.map((p) => (
          <button
            key={p.id}
            onClick={() => onPreset(p.id)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              preset === p.id
                ? 'bg-primary text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="flex items-center gap-2 ml-2">
          <div className="flex items-center gap-1">
            <Label className="text-xs text-gray-500 whitespace-nowrap">From</Label>
            <Input
              type="date"
              value={range.from}
              onChange={(e) => onChange({ ...range, from: e.target.value })}
              className="h-7 text-xs w-36"
            />
          </div>
          <div className="flex items-center gap-1">
            <Label className="text-xs text-gray-500 whitespace-nowrap">To</Label>
            <Input
              type="date"
              value={range.to}
              onChange={(e) => onChange({ ...range, to: e.target.value })}
              className="h-7 text-xs w-36"
            />
          </div>
        </div>
      )}
      <span className="text-xs text-gray-400 ml-1">
        {format(new Date(range.from + 'T00:00:00'), 'MMM d')} – {format(new Date(range.to + 'T00:00:00'), 'MMM d, yyyy')}
      </span>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { ownerId, role, enabledModules } = useUserContext()
  const { currency, formatAmount } = useCurrency()

  const hasModule = useCallback((mod: string) => !enabledModules || enabledModules.includes(mod), [enabledModules])

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd')

  const [preset, setPreset] = useState<Preset>('month')
  const [range, setRange] = useState<DateRange>({ from: monthStart, to: monthEnd })

  function applyPreset(p: Preset) {
    setPreset(p)
    if (p === 'today') setRange({ from: todayStr, to: todayStr })
    else if (p === 'week') {
      const ws = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
      setRange({ from: ws, to: todayStr })
    } else if (p === 'month') setRange({ from: monthStart, to: monthEnd })
  }

  // ── Sales Report ────────────────────────────────────────────────────────────

  const [salesLoading, setSalesLoading] = useState(false)
  const [salesData, setSalesData] = useState<{
    totalRevenue: number; txCount: number; avgTx: number
    totalServices: number
    appointmentRevenue: number; walkinRevenue: number
    byService: { name: string; revenue: number; count: number; avgRevenue: number }[]
    top10: { name: string; revenue: number; count: number; avgRevenue: number }[]
    daily: {
      date: string; displayDate: string; revenue: number; orders: number; services: number
      appointmentRevenue: number; walkinRevenue: number
    }[]
  } | null>(null)

  const loadSales = useCallback(async () => {
    setSalesLoading(true)
    const supabase = createClient()
    const [apptRes, walkinRes] = await Promise.all([
      supabase.from('appointments')
        .select('total_amount, services(name, price), appointment_date, status')
        .eq('user_id', ownerId)
        .eq('status', 'completed')
        .gte('appointment_date', range.from)
        .lte('appointment_date', range.to),
      supabase.from('walk_ins')
        .select('total, walk_in_services(services(name, price)), created_at')
        .eq('user_id', ownerId)
        .gte('created_at', range.from + 'T00:00:00')
        .lte('created_at', range.to + 'T23:59:59'),
    ])
    const appts = ((apptRes.data ?? []) as unknown) as { total_amount: number | null; services: { name: string; price: number } | null; appointment_date: string }[]
    const walkins = ((walkinRes.data ?? []) as unknown) as { total: number; walk_in_services: { services: { name: string; price: number } | null }[]; created_at: string }[]

    const appointmentRevenue = appts.reduce((s, a) => s + Number(a.total_amount ?? a.services?.price ?? 0), 0)
    const walkinRevenue = walkins.reduce((s, w) => s + Number(w.total ?? 0), 0)
    const totalRevenue = appointmentRevenue + walkinRevenue
    const txCount = appts.length + walkins.length
    const avgTx = txCount > 0 ? Math.round(totalRevenue / txCount) : 0
    const totalServices = appts.length + walkins.reduce((s, w) => s + w.walk_in_services.length, 0)

    const svcMap = new Map<string, { revenue: number; count: number }>()
    appts.forEach(a => {
      const name = a.services?.name ?? 'Unknown'
      const cur = svcMap.get(name) ?? { revenue: 0, count: 0 }
      svcMap.set(name, {
        revenue: cur.revenue + Number(a.total_amount ?? a.services?.price ?? 0),
        count: cur.count + 1,
      })
    })
    walkins.forEach(w => {
      const servicePrices = w.walk_in_services.map(ws => Number(ws.services?.price ?? 0))
      const listedTotal = servicePrices.reduce((sum, price) => sum + price, 0)
      const paidTotal = Number(w.total ?? 0)
      w.walk_in_services.forEach(ws => {
        const name = ws.services?.name ?? 'Unknown'
        const listedPrice = Number(ws.services?.price ?? 0)
        const allocatedRevenue = listedTotal > 0
          ? (paidTotal * listedPrice) / listedTotal
          : w.walk_in_services.length > 0
            ? paidTotal / w.walk_in_services.length
            : 0
        const cur = svcMap.get(name) ?? { revenue: 0, count: 0 }
        svcMap.set(name, {
          revenue: cur.revenue + allocatedRevenue,
          count: cur.count + 1,
        })
      })
    })
    const byService = Array.from(svcMap.entries())
      .map(([name, v]) => ({
        name,
        revenue: Math.round(v.revenue),
        count: v.count,
        avgRevenue: v.count > 0 ? Math.round(v.revenue / v.count) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
    const top10 = byService.slice(0, 10)

    // Daily breakdown
    const dayMap = new Map<string, { revenue: number; orders: number; services: number; appointmentRevenue: number; walkinRevenue: number }>()
    appts.forEach(a => {
      const curDay = dayMap.get(a.appointment_date) ?? { revenue: 0, orders: 0, services: 0, appointmentRevenue: 0, walkinRevenue: 0 }
      const amount = Number(a.total_amount ?? a.services?.price ?? 0)
      dayMap.set(a.appointment_date, {
        revenue: curDay.revenue + amount,
        orders: curDay.orders + 1,
        services: curDay.services + 1,
        appointmentRevenue: curDay.appointmentRevenue + amount,
        walkinRevenue: curDay.walkinRevenue,
      })
    })
    walkins.forEach(w => {
      const d = w.created_at.slice(0, 10)
      const curDay = dayMap.get(d) ?? { revenue: 0, orders: 0, services: 0, appointmentRevenue: 0, walkinRevenue: 0 }
      const amount = Number(w.total ?? 0)
      dayMap.set(d, {
        revenue: curDay.revenue + amount,
        orders: curDay.orders + 1,
        services: curDay.services + w.walk_in_services.length,
        appointmentRevenue: curDay.appointmentRevenue,
        walkinRevenue: curDay.walkinRevenue + amount,
      })
    })
    const days = []
    let cur = new Date(range.from + 'T00:00:00')
    const end = new Date(range.to + 'T00:00:00')
    while (cur <= end && days.length < 31) {
      const ds = format(cur, 'yyyy-MM-dd')
      const v = dayMap.get(ds) ?? { revenue: 0, orders: 0, services: 0, appointmentRevenue: 0, walkinRevenue: 0 }
      days.push({ date: ds, displayDate: format(cur, 'MMM d'), ...v })
      cur = subDays(cur, -1)
    }

    setSalesData({ totalRevenue, txCount, avgTx, totalServices, appointmentRevenue, walkinRevenue, byService, top10, daily: days })
    setSalesLoading(false)
  }, [ownerId, range])

  // ── Walk-In Report ──────────────────────────────────────────────────────────

  const [walkinLoading, setWalkinLoading] = useState(false)
  const [walkinData, setWalkinData] = useState<{
    count: number; revenue: number; avgOrder: number
    byStaff: { name: string; count: number; revenue: number }[]
    byHour: { hour: string; count: number; revenue: number }[]
    byDay: { day: string; count: number; revenue: number }[]
  } | null>(null)

  const loadWalkins = useCallback(async () => {
    setWalkinLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('walk_ins')
      .select('id, total, created_at, staff(name), payment_method')
      .eq('user_id', ownerId)
      .gte('created_at', range.from + 'T00:00:00')
      .lte('created_at', range.to + 'T23:59:59')

    const rows = ((data ?? []) as unknown) as { id: string; total: number; created_at: string; staff: { name: string } | null; payment_method: string }[]
    const count = rows.length
    const revenue = rows.reduce((s, r) => s + Number(r.total ?? 0), 0)
    const avgOrder = count > 0 ? Math.round(revenue / count) : 0

    const staffMap = new Map<string, { count: number; revenue: number }>()
    rows.forEach(r => {
      const name = r.staff?.name ?? 'Unassigned'
      const cur = staffMap.get(name) ?? { count: 0, revenue: 0 }
      staffMap.set(name, { count: cur.count + 1, revenue: cur.revenue + Number(r.total ?? 0) })
    })
    const byStaff = Array.from(staffMap.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue)

    const hourMap = new Map<number, { count: number; revenue: number }>()
    rows.forEach(r => {
      const h = new Date(r.created_at).getHours()
      const cur = hourMap.get(h) ?? { count: 0, revenue: 0 }
      hourMap.set(h, { count: cur.count + 1, revenue: cur.revenue + Number(r.total ?? 0) })
    })
    const byHour = Array.from({ length: 16 }, (_, i) => {
      const h = 7 + i
      const label = h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`
      const v = hourMap.get(h) ?? { count: 0, revenue: 0 }
      return { hour: label, count: v.count, revenue: Math.round(v.revenue) }
    })

    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const dowMap = new Map<number, { count: number; revenue: number }>()
    rows.forEach(r => {
      const d = new Date(r.created_at).getDay()
      const cur = dowMap.get(d) ?? { count: 0, revenue: 0 }
      dowMap.set(d, { count: cur.count + 1, revenue: cur.revenue + Number(r.total ?? 0) })
    })
    const byDay = DAYS.map((day, i) => {
      const v = dowMap.get(i) ?? { count: 0, revenue: 0 }
      return { day, count: v.count, revenue: Math.round(v.revenue) }
    })

    setWalkinData({ count, revenue, avgOrder, byStaff, byHour, byDay })
    setWalkinLoading(false)
  }, [ownerId, range])

  // ── Payment Methods Report ──────────────────────────────────────────────────

  const [payLoading, setPayLoading] = useState(false)
  const [payData, setPayData] = useState<{ method: string; amount: number; count: number; pct: number }[] | null>(null)

  const loadPayments = useCallback(async () => {
    setPayLoading(true)
    const supabase = createClient()
    const [apptRes, walkinRes] = await Promise.all([
      supabase.from('appointments')
        .select('payment_method, total_amount, services(price), status')
        .eq('user_id', ownerId).eq('status', 'completed')
        .gte('appointment_date', range.from).lte('appointment_date', range.to),
      supabase.from('walk_ins')
        .select('payment_method, total')
        .eq('user_id', ownerId)
        .gte('created_at', range.from + 'T00:00:00').lte('created_at', range.to + 'T23:59:59'),
    ])
    const map = new Map<string, { amount: number; count: number }>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(apptRes.data ?? []).forEach((a: any) => {
      const m = a.payment_method ?? 'cash'
      const cur = map.get(m) ?? { amount: 0, count: 0 }
      map.set(m, { amount: cur.amount + Number(a.total_amount ?? a.services?.price ?? 0), count: cur.count + 1 })
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(walkinRes.data ?? []).forEach((w: any) => {
      const m = w.payment_method ?? 'cash'
      const cur = map.get(m) ?? { amount: 0, count: 0 }
      map.set(m, { amount: cur.amount + Number(w.total ?? 0), count: cur.count + 1 })
    })
    const total = Array.from(map.values()).reduce((s, v) => s + v.amount, 0)
    const result = Array.from(map.entries())
      .map(([method, v]) => ({
        method: method.charAt(0).toUpperCase() + method.slice(1).replace(/_/g, ' '),
        amount: Math.round(v.amount),
        count: v.count,
        pct: total > 0 ? Math.round((v.amount / total) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
    setPayData(result)
    setPayLoading(false)
  }, [ownerId, range])

  // ── Appointments Report ─────────────────────────────────────────────────────

  const [apptLoading, setApptLoading] = useState(false)
  const [apptData, setApptData] = useState<{
    total: number; completed: number; cancelled: number; noShow: number; pending: number; revenue: number; avgCompletedSale: number
    byStaff: { name: string; count: number; completed: number; cancelled: number; noShow: number; revenue: number }[]
  } | null>(null)

  const loadAppointments = useCallback(async () => {
    setApptLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('appointments')
      .select('status, total_amount, services(price), staff(name)')
      .eq('user_id', ownerId)
      .gte('appointment_date', range.from)
      .lte('appointment_date', range.to)
    const rows = ((data ?? []) as unknown) as { status: string; total_amount: number | null; services: { price: number } | null; staff: { name: string } | null }[]
    const total = rows.length
    const completed = rows.filter(r => r.status === 'completed').length
    const cancelled = rows.filter(r => r.status === 'cancelled').length
    const noShow = rows.filter(r => r.status === 'no_show').length
    const pending = total - completed - cancelled - noShow
    const revenue = rows.filter(r => r.status === 'completed').reduce((s, r) => s + Number(r.total_amount ?? r.services?.price ?? 0), 0)
    const avgCompletedSale = completed > 0 ? Math.round(revenue / completed) : 0
    const staffMap = new Map<string, { count: number; completed: number; cancelled: number; noShow: number; revenue: number }>()
    rows.forEach(r => {
      const name = r.staff?.name ?? 'Unassigned'
      const cur = staffMap.get(name) ?? { count: 0, completed: 0, cancelled: 0, noShow: 0, revenue: 0 }
      staffMap.set(name, {
        count: cur.count + 1,
        completed: cur.completed + (r.status === 'completed' ? 1 : 0),
        cancelled: cur.cancelled + (r.status === 'cancelled' ? 1 : 0),
        noShow: cur.noShow + (r.status === 'no_show' ? 1 : 0),
        revenue: cur.revenue + (r.status === 'completed' ? Number(r.total_amount ?? r.services?.price ?? 0) : 0),
      })
    })
    const byStaff = Array.from(staffMap.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue)
    setApptData({ total, completed, cancelled, noShow, pending, revenue, avgCompletedSale, byStaff })
    setApptLoading(false)
  }, [ownerId, range])

  // ── Staff Performance Report ────────────────────────────────────────────────

  const [staffLoading, setStaffLoading] = useState(false)
  const [staffPerf, setStaffPerf] = useState<{
    name: string; apptCount: number; walkinCount: number; revenue: number; avgRating: number; commission: number
  }[] | null>(null)

  const loadStaffPerf = useCallback(async () => {
    setStaffLoading(true)
    const supabase = createClient()
    const [apptRes, walkinRes, reviewRes, staffRes] = await Promise.all([
      supabase.from('appointments')
        .select('staff(name), total_amount, services(price), status')
        .eq('user_id', ownerId).eq('status', 'completed')
        .gte('appointment_date', range.from).lte('appointment_date', range.to),
      supabase.from('walk_ins')
        .select('staff(name), total')
        .eq('user_id', ownerId)
        .gte('created_at', range.from + 'T00:00:00').lte('created_at', range.to + 'T23:59:59'),
      supabase.from('reviews').select('staff_id, rating').eq('user_id', ownerId),
      supabase.from('staff').select('id, name, salary_type, commission_rate').eq('user_id', ownerId).eq('is_active', true),
    ])
    const staffList = (staffRes.data ?? []) as { id: string; name: string; salary_type: string; commission_rate: number | null }[]
    const map = new Map<string, { apptCount: number; walkinCount: number; revenue: number; ratings: number[]; commission: number; commRate: number }>()
    staffList.forEach(s => map.set(s.name, { apptCount: 0, walkinCount: 0, revenue: 0, ratings: [], commission: 0, commRate: s.commission_rate ?? 0 }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(apptRes.data ?? []).forEach((a: any) => {
      const name = a.staff?.name
      if (!name) return
      if (!map.has(name)) map.set(name, { apptCount: 0, walkinCount: 0, revenue: 0, ratings: [], commission: 0, commRate: 0 })
      const cur = map.get(name)!
      const rev = Number(a.total_amount ?? a.services?.price ?? 0)
      cur.apptCount++; cur.revenue += rev
      cur.commission += (rev * cur.commRate) / 100
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(walkinRes.data ?? []).forEach((w: any) => {
      const name = w.staff?.name
      if (!name) return
      if (!map.has(name)) map.set(name, { apptCount: 0, walkinCount: 0, revenue: 0, ratings: [], commission: 0, commRate: 0 })
      const cur = map.get(name)!
      const rev = Number(w.total ?? 0)
      cur.walkinCount++; cur.revenue += rev
      cur.commission += (rev * cur.commRate) / 100
    })
    const ratingsByStaff = new Map<string, number[]>()
    ;(reviewRes.data ?? []).forEach((r: { staff_id: string; rating: number }) => {
      const sf = staffList.find(s => s.id === r.staff_id)
      if (sf) {
        if (!ratingsByStaff.has(sf.name)) ratingsByStaff.set(sf.name, [])
        ratingsByStaff.get(sf.name)!.push(r.rating)
      }
    })
    const result = Array.from(map.entries()).map(([name, v]) => {
      const ratings = ratingsByStaff.get(name) ?? []
      const avgRating = ratings.length > 0 ? ratings.reduce((s, r) => s + r, 0) / ratings.length : 0
      return { name, apptCount: v.apptCount, walkinCount: v.walkinCount, revenue: Math.round(v.revenue), avgRating: Math.round(avgRating * 10) / 10, commission: Math.round(v.commission) }
    }).sort((a, b) => b.revenue - a.revenue)
    setStaffPerf(result)
    setStaffLoading(false)
  }, [ownerId, range])

  // ── Client Report ───────────────────────────────────────────────────────────

  const [clientLoading, setClientLoading] = useState(false)
  const [clientData, setClientData] = useState<{
    newClients: number; returning: number
    top10: { name: string; phone: string; spend: number; visits: number }[]
    retentionRate: number
  } | null>(null)

  const loadClients = useCallback(async () => {
    setClientLoading(true)
    const supabase = createClient()
    const [apptRes, clientRes] = await Promise.all([
      supabase.from('appointments')
        .select('client_name, client_phone, status, total_amount, services(price)')
        .eq('user_id', ownerId)
        .gte('appointment_date', range.from).lte('appointment_date', range.to),
      supabase.from('clients').select('phone, created_at').eq('user_id', ownerId)
        .gte('created_at', range.from + 'T00:00:00').lte('created_at', range.to + 'T23:59:59'),
    ])
    const appts = ((apptRes.data ?? []) as unknown) as { client_name: string | null; client_phone: string | null; status: string; total_amount: number | null; services: { price: number } | null }[]
    const clientMap = new Map<string, { name: string; spend: number; visits: number }>()
    appts.forEach(a => {
      const phone = a.client_phone ?? a.client_name ?? 'unknown'
      const cur = clientMap.get(phone) ?? { name: a.client_name ?? '', spend: 0, visits: 0 }
      cur.visits++
      if (a.status === 'completed') cur.spend += Number(a.total_amount ?? a.services?.price ?? 0)
      clientMap.set(phone, cur)
    })
    const newClients = (clientRes.data ?? []).length
    const returning = Array.from(clientMap.values()).filter(c => c.visits > 1).length
    const totalClients = clientMap.size
    const retentionRate = totalClients > 0 ? Math.round((returning / totalClients) * 100) : 0
    const top10 = Array.from(clientMap.entries())
      .map(([phone, v]) => ({ name: v.name || phone, phone, spend: Math.round(v.spend), visits: v.visits }))
      .sort((a, b) => b.spend - a.spend).slice(0, 10)
    setClientData({ newClients, returning, top10, retentionRate })
    setClientLoading(false)
  }, [ownerId, range])

  // ── Inventory Report ────────────────────────────────────────────────────────

  const [invLoading, setInvLoading] = useState(false)
  const [invData, setInvData] = useState<{
    items: { name: string; category: string; quantity: number; unit: string; cost_price: number; reorder_level: number }[]
    totalValue: number; lowStockCount: number
  } | null>(null)

  const loadInventory = useCallback(async () => {
    setInvLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('inventory_items')
      .select('name, category, quantity, unit, cost_price, reorder_level')
      .eq('user_id', ownerId)
      .order('name')
    const items = (data ?? []) as { name: string; category: string; quantity: number; unit: string; cost_price: number; reorder_level: number }[]
    const totalValue = items.reduce((s, i) => s + Number(i.quantity) * Number(i.cost_price ?? 0), 0)
    const lowStockCount = items.filter(i => Number(i.quantity) <= Number(i.reorder_level ?? 0)).length
    setInvData({ items, totalValue, lowStockCount })
    setInvLoading(false)
  }, [ownerId])

  // ── Expense Report ──────────────────────────────────────────────────────────

  const [expLoading, setExpLoading] = useState(false)
  const [expData, setExpData] = useState<{
    total: number; byCategory: { category: string; amount: number }[]
  } | null>(null)

  const loadExpenses = useCallback(async () => {
    setExpLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('expenses')
      .select('amount, category')
      .eq('user_id', ownerId)
      .gte('expense_date', range.from).lte('expense_date', range.to)
    const rows = (data ?? []) as { amount: number; category: string }[]
    const total = rows.reduce((s, r) => s + Number(r.amount), 0)
    const catMap = new Map<string, number>()
    rows.forEach(r => catMap.set(r.category, (catMap.get(r.category) ?? 0) + Number(r.amount)))
    const byCategory = Array.from(catMap.entries())
      .map(([category, amount]) => ({ category: category.replace(/_/g, ' '), amount: Math.round(amount) }))
      .sort((a, b) => b.amount - a.amount)
    setExpData({ total, byCategory })
    setExpLoading(false)
  }, [ownerId, range])

  // ── Tab state ───────────────────────────────────────────────────────────────

  const [activeTab, setActiveTab] = useState('sales')

  useEffect(() => {
    if (activeTab === 'sales') loadSales()
    else if (activeTab === 'walkins') loadWalkins()
    else if (activeTab === 'payments') loadPayments()
    else if (activeTab === 'appointments') loadAppointments()
    else if (activeTab === 'staff') loadStaffPerf()
    else if (activeTab === 'clients') loadClients()
    else if (activeTab === 'inventory') loadInventory()
    else if (activeTab === 'expenses') loadExpenses()
  }, [activeTab, range]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!['owner', 'regional_manager', 'manager'].includes(role)) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p>Access restricted to owners and managers.</p>
      </div>
    )
  }

  // ── CSV exports ─────────────────────────────────────────────────────────────

  function exportSalesCSV() {
    if (!salesData) return
    const rows: string[][] = [
      ['Sales Report'],
      ['Period', range.from, range.to],
      ['Total Sales', String(Math.round(salesData.totalRevenue))],
      ['Total Orders', String(salesData.txCount)],
      ['Total Services Sold', String(salesData.totalServices)],
      ['Average Order Value', String(salesData.avgTx)],
      ['Appointment Sales', String(Math.round(salesData.appointmentRevenue)), pct(salesData.appointmentRevenue, salesData.totalRevenue)],
      ['Walk-In Sales', String(Math.round(salesData.walkinRevenue)), pct(salesData.walkinRevenue, salesData.totalRevenue)],
      [],
      ['Daily Sales'],
      ['Date', `Total Sales (${currency})`, 'Orders', 'Services Sold', `Appointment Sales (${currency})`, `Walk-In Sales (${currency})`, `Average Order (${currency})`],
      ...salesData.daily.map(d => [
        d.date,
        String(Math.round(d.revenue)),
        String(d.orders),
        String(d.services),
        String(Math.round(d.appointmentRevenue)),
        String(Math.round(d.walkinRevenue)),
        String(d.orders > 0 ? Math.round(d.revenue / d.orders) : 0),
      ]),
      [],
      ['Service Breakdown'],
      ['Service', 'Services Sold', `Revenue (${currency})`, `Average Revenue (${currency})`, 'Share of Sales'],
      ...salesData.byService.map(s => [
        s.name,
        String(s.count),
        String(s.revenue),
        String(s.avgRevenue),
        pct(s.revenue, salesData.totalRevenue),
      ]),
    ]
    downloadCSV(`sales-report-${range.from}-to-${range.to}.csv`, rows)
  }

  function exportWalkinCSV() {
    if (!walkinData) return
    const rows: string[][] = [
      ['Walk-In Report'],
      ['Period', range.from, range.to],
      ['Total Walk-Ins', String(walkinData.count)],
      ['Walk-In Revenue', String(Math.round(walkinData.revenue))],
      ['Average Walk-In Order', String(walkinData.avgOrder)],
      [],
      ['Staff Breakdown'],
      ['Staff', 'Walk-Ins', `Revenue (${currency})`, `Average Order (${currency})`, 'Share of Walk-In Sales'],
      ...walkinData.byStaff.map(s => [s.name, String(s.count), String(Math.round(s.revenue)), String(s.count > 0 ? Math.round(s.revenue / s.count) : 0), pct(s.revenue, walkinData.revenue)]),
      [],
      ['Hourly Breakdown'],
      ['Hour', 'Walk-Ins', `Revenue (${currency})`],
      ...walkinData.byHour.map(h => [h.hour, String(h.count), String(h.revenue)]),
      [],
      ['Day of Week Breakdown'],
      ['Day', 'Walk-Ins', `Revenue (${currency})`],
      ...walkinData.byDay.map(d => [d.day, String(d.count), String(d.revenue)]),
    ]
    downloadCSV(`walkin-report-${range.from}-to-${range.to}.csv`, rows)
  }

  function exportPaymentsCSV() {
    if (!payData) return
    const totalAmount = payData.reduce((s, p) => s + p.amount, 0)
    const totalTx = payData.reduce((s, p) => s + p.count, 0)
    const rows: string[][] = [
      ['Payment Methods Report'],
      ['Period', range.from, range.to],
      ['Total Collected', String(totalAmount)],
      ['Total Transactions', String(totalTx)],
      [],
      ['Payment Breakdown'],
      ['Payment Method', `Amount (${currency})`, 'Transactions', 'Percentage', `Average Transaction (${currency})`],
      ...payData.map(p => [p.method, String(p.amount), String(p.count), `${p.pct}%`, String(p.count > 0 ? Math.round(p.amount / p.count) : 0)]),
    ]
    downloadCSV(`payment-methods-${range.from}-to-${range.to}.csv`, rows)
  }

  function exportApptsCSV() {
    if (!apptData) return
    const rows: string[][] = [
      ['Appointments Report'],
      ['Period', range.from, range.to],
      ['Total Appointments', String(apptData.total)],
      ['Completed', String(apptData.completed), pct(apptData.completed, apptData.total)],
      ['Cancelled', String(apptData.cancelled), pct(apptData.cancelled, apptData.total)],
      ['No Show', String(apptData.noShow), pct(apptData.noShow, apptData.total)],
      ['Pending / Other', String(apptData.pending), pct(apptData.pending, apptData.total)],
      ['Completed Revenue', String(Math.round(apptData.revenue))],
      ['Average Completed Sale', String(apptData.avgCompletedSale)],
      [],
      ['Staff Breakdown'],
      ['Staff', 'Total Appointments', 'Completed', 'Cancelled', 'No Show', `Revenue (${currency})`, 'Completion Rate'],
      ...apptData.byStaff.map(s => [s.name, String(s.count), String(s.completed), String(s.cancelled), String(s.noShow), String(Math.round(s.revenue)), pct(s.completed, s.count)]),
    ]
    downloadCSV(`appointments-report-${range.from}-to-${range.to}.csv`, rows)
  }

  function exportStaffCSV() {
    if (!staffPerf) return
    const totalRevenue = staffPerf.reduce((sum, s) => sum + s.revenue, 0)
    const totalCommission = staffPerf.reduce((sum, s) => sum + s.commission, 0)
    const rows: string[][] = [
      ['Staff Performance Report'],
      ['Period', range.from, range.to],
      ['Total Staff Revenue', String(totalRevenue)],
      ['Total Estimated Commission', String(totalCommission)],
      [],
      ['Staff Breakdown'],
      ['Staff', 'Appointments', 'Walk-Ins', 'Total Orders', `Revenue (${currency})`, `Average Sale (${currency})`, 'Avg Rating', `Commission (${currency})`, 'Revenue Share'],
      ...staffPerf.map(s => {
        const orders = s.apptCount + s.walkinCount
        return [s.name, String(s.apptCount), String(s.walkinCount), String(orders), String(s.revenue), String(orders > 0 ? Math.round(s.revenue / orders) : 0), String(s.avgRating || ''), String(s.commission), pct(s.revenue, totalRevenue)]
      }),
    ]
    downloadCSV(`staff-performance-${range.from}-to-${range.to}.csv`, rows)
  }

  function exportClientsCSV() {
    if (!clientData) return
    const totalSpend = clientData.top10.reduce((sum, c) => sum + c.spend, 0)
    const rows: string[][] = [
      ['Client Report'],
      ['Period', range.from, range.to],
      ['New Clients', String(clientData.newClients)],
      ['Returning Clients', String(clientData.returning)],
      ['Retention Rate', `${clientData.retentionRate}%`],
      [],
      ['Top Clients by Spend'],
      ['Name', 'Phone', `Total Spend (${currency})`, 'Visits', `Average Visit Value (${currency})`, 'Share of Top Client Spend'],
      ...clientData.top10.map(c => [c.name, c.phone, String(c.spend), String(c.visits), String(c.visits > 0 ? Math.round(c.spend / c.visits) : 0), pct(c.spend, totalSpend)]),
    ]
    downloadCSV(`client-report-${range.from}-to-${range.to}.csv`, rows)
  }

  function exportInventoryCSV() {
    if (!invData) return
    const rows: string[][] = [
      ['Inventory Report'],
      ['Total Items', String(invData.items.length)],
      ['Low Stock Items', String(invData.lowStockCount)],
      ['Total Stock Value', String(Math.round(invData.totalValue))],
      [],
      ['Stock Breakdown'],
      ['Name', 'Category', 'Quantity', 'Unit', `Cost Per Unit (${currency})`, `Stock Value (${currency})`, 'Reorder Level', 'Reorder Needed', 'Status'],
      ...invData.items.map(i => {
        const qty = Number(i.quantity)
        const reorder = Number(i.reorder_level)
        return [
          i.name,
          i.category,
          String(i.quantity),
          i.unit,
          String(i.cost_price),
          String(Math.round(qty * Number(i.cost_price ?? 0))),
          String(i.reorder_level),
          String(Math.max(0, reorder - qty)),
          qty <= reorder ? 'Low Stock' : 'OK',
        ]
      }),
    ]
    downloadCSV('inventory-report.csv', rows)
  }

  function exportExpensesCSV() {
    if (!expData) return
    const rows: string[][] = [
      ['Expense Report'],
      ['Period', range.from, range.to],
      ['Total Expenses', String(Math.round(expData.total))],
      [],
      ['Expense Breakdown'],
      ['Category', `Amount (${currency})`, 'Share of Expenses'],
      ...expData.byCategory.map(e => [e.category, String(e.amount), pct(e.amount, expData.total)]),
    ]
    downloadCSV(`expense-report-${range.from}-to-${range.to}.csv`, rows)
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const availableTabs = [
    { id: 'sales', label: 'Sales', icon: TrendingUp, always: true },
    { id: 'walkins', label: 'Walk-In', icon: Zap, module: 'walkin' },
    { id: 'payments', label: 'Payments', icon: CreditCard, always: true },
    { id: 'appointments', label: 'Appointments', icon: CalendarDays, module: 'appointments' },
    { id: 'staff', label: 'Staff', icon: Users, module: 'staff' },
    { id: 'clients', label: 'Clients', icon: Users, module: 'clients' },
    { id: 'inventory', label: 'Inventory', icon: Package, module: 'inventory' },
    { id: 'expenses', label: 'Expenses', icon: DollarSign, module: 'expenses' },
  ].filter(t => t.always || hasModule(t.module ?? ''))

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart2 className="w-6 h-6 text-primary" />
          Reports
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Analytics and insights for your salon</p>
      </div>

      {/* Date range */}
      <DateRangeBar
        range={range}
        preset={preset}
        onChange={r => { setRange(r); setPreset('custom') }}
        onPreset={applyPreset}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto">
          <TabsList className="flex w-max gap-1 bg-gray-100 p-1 rounded-xl h-auto">
            {availableTabs.map(t => (
              <TabsTrigger
                key={t.id}
                value={t.id}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm whitespace-nowrap"
              >
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* ── Sales Report ── */}
        <TabsContent value="sales" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" />Sales Report</h2>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { loadSales(); }} className="gap-1.5 h-8"><RefreshCw className="w-3.5 h-3.5" />Refresh</Button>
              <Button size="sm" onClick={exportSalesCSV} disabled={!salesData} className="gap-1.5 h-8 bg-primary hover:bg-primary/90"><Download className="w-3.5 h-3.5" />Export CSV</Button>
            </div>
          </div>
          {salesLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : salesData ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Total Revenue" value={formatAmount(salesData.totalRevenue)} />
                <StatCard label="Transactions" value={String(salesData.txCount)} />
                <StatCard label="Services Sold" value={String(salesData.totalServices)} />
                <StatCard label="Avg Transaction" value={formatAmount(salesData.avgTx)} />
              </div>
              {salesData.daily.length > 1 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Daily Revenue</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={salesData.daily} margin={{ left: -10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="displayDate" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v) => formatAmount(Number(v))} />
                        <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
              {salesData.top10.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Top Services by Revenue</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {salesData.top10.map((s, i) => (
                        <div key={s.name} className="flex items-center gap-3">
                          <span className="text-xs text-gray-400 w-5 text-right">{i + 1}</span>
                            <span className="flex-1 text-sm text-gray-700 truncate">{s.name}</span>
                            <span className="text-xs text-gray-400">{s.count} sold</span>
                            <span className="text-sm font-semibold text-primary">{formatAmount(s.revenue)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : null}
        </TabsContent>

        {/* ── Walk-In Report ── */}
        {hasModule('walkin') && (
          <TabsContent value="walkins" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2"><Zap className="w-4 h-4 text-primary" />Walk-In Report</h2>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={loadWalkins} className="gap-1.5 h-8"><RefreshCw className="w-3.5 h-3.5" />Refresh</Button>
                <Button size="sm" onClick={exportWalkinCSV} disabled={!walkinData} className="gap-1.5 h-8 bg-primary hover:bg-primary/90"><Download className="w-3.5 h-3.5" />Export CSV</Button>
              </div>
            </div>
            {walkinLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : walkinData ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <StatCard label="Total Walk-Ins" value={String(walkinData.count)} />
                  <StatCard label="Walk-In Revenue" value={formatAmount(walkinData.revenue)} />
                  <StatCard label="Avg Walk-In Order" value={formatAmount(walkinData.avgOrder)} />
                </div>
                {walkinData.byHour.some(h => h.count > 0) && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Walk-Ins by Hour</CardTitle></CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={walkinData.byHour} margin={{ left: -10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={1} />
                          <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                          <Tooltip />
                          <Bar dataKey="count" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
                {walkinData.byStaff.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Walk-Ins by Staff</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {walkinData.byStaff.map(s => (
                          <div key={s.name} className="flex items-center gap-3">
                            <span className="flex-1 text-sm text-gray-700">{s.name}</span>
                            <span className="text-xs text-gray-400">{s.count} orders</span>
                            <span className="text-sm font-semibold text-primary">{formatAmount(s.revenue)}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Walk-Ins by Day of Week</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={140}>
                      <BarChart data={walkinData.byDay} margin={{ left: -10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </>
            ) : null}
          </TabsContent>
        )}

        {/* ── Payment Methods ── */}
        <TabsContent value="payments" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2"><CreditCard className="w-4 h-4 text-primary" />Payment Methods</h2>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={loadPayments} className="gap-1.5 h-8"><RefreshCw className="w-3.5 h-3.5" />Refresh</Button>
              <Button size="sm" onClick={exportPaymentsCSV} disabled={!payData} className="gap-1.5 h-8 bg-primary hover:bg-primary/90"><Download className="w-3.5 h-3.5" />Export CSV</Button>
            </div>
          </div>
          {payLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : payData ? (
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Revenue Split</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={payData} cx="50%" cy="50%" outerRadius={70} dataKey="amount" nameKey="method" label={(props: PieLabelProps) => `${props.method ?? ''} ${props.pct ?? 0}%`} labelLine={false}>
                        {payData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => formatAmount(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Breakdown</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {payData.map((p, i) => (
                      <div key={p.method} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium text-gray-700">{p.method}</span>
                          <span className="font-bold text-gray-900">{formatAmount(p.amount)}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${p.pct}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                        </div>
                        <div className="flex justify-between text-xs text-gray-400">
                          <span>{p.count} transactions</span>
                          <span>{p.pct}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </TabsContent>

        {/* ── Appointments Report ── */}
        {hasModule('appointments') && (
          <TabsContent value="appointments" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2"><CalendarDays className="w-4 h-4 text-primary" />Appointments Report</h2>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={loadAppointments} className="gap-1.5 h-8"><RefreshCw className="w-3.5 h-3.5" />Refresh</Button>
                <Button size="sm" onClick={exportApptsCSV} disabled={!apptData} className="gap-1.5 h-8 bg-primary hover:bg-primary/90"><Download className="w-3.5 h-3.5" />Export CSV</Button>
              </div>
            </div>
            {apptLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : apptData ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <StatCard label="Total" value={String(apptData.total)} />
                  <StatCard label="Completed" value={String(apptData.completed)} sub={`${apptData.total > 0 ? Math.round((apptData.completed / apptData.total) * 100) : 0}%`} />
                  <StatCard label="Cancelled" value={String(apptData.cancelled)} />
                  <StatCard label="No Show" value={String(apptData.noShow)} />
                  <StatCard label="Revenue" value={formatAmount(apptData.revenue)} />
                </div>
                {apptData.byStaff.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Appointments by Staff</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {apptData.byStaff.map(s => (
                          <div key={s.name} className="flex items-center gap-3">
                            <span className="flex-1 text-sm text-gray-700">{s.name}</span>
                            <span className="text-xs text-gray-400">{s.count} appts</span>
                            <span className="text-sm font-semibold text-primary">{formatAmount(s.revenue)}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : null}
          </TabsContent>
        )}

        {/* ── Staff Performance ── */}
        {hasModule('staff') && (
          <TabsContent value="staff" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2"><Users className="w-4 h-4 text-primary" />Staff Performance</h2>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={loadStaffPerf} className="gap-1.5 h-8"><RefreshCw className="w-3.5 h-3.5" />Refresh</Button>
                <Button size="sm" onClick={exportStaffCSV} disabled={!staffPerf} className="gap-1.5 h-8 bg-primary hover:bg-primary/90"><Download className="w-3.5 h-3.5" />Export CSV</Button>
              </div>
            </div>
            {staffLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : staffPerf ? (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Staff</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Appts</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Walk-Ins</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Revenue</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Rating</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Commission</th>
                        </tr>
                      </thead>
                      <tbody>
                        {staffPerf.map((s, i) => (
                          <tr key={s.name} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                            <td className="px-4 py-3 text-right text-gray-600">{s.apptCount}</td>
                            <td className="px-4 py-3 text-right text-gray-600">{s.walkinCount}</td>
                            <td className="px-4 py-3 text-right font-semibold text-primary">{formatAmount(s.revenue)}</td>
                            <td className="px-4 py-3 text-right text-gray-600">{s.avgRating > 0 ? `⭐ ${s.avgRating}` : '—'}</td>
                            <td className="px-4 py-3 text-right text-gray-600">{formatAmount(s.commission)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>
        )}

        {/* ── Client Report ── */}
        {hasModule('clients') && (
          <TabsContent value="clients" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2"><Users className="w-4 h-4 text-primary" />Client Report</h2>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={loadClients} className="gap-1.5 h-8"><RefreshCw className="w-3.5 h-3.5" />Refresh</Button>
                <Button size="sm" onClick={exportClientsCSV} disabled={!clientData} className="gap-1.5 h-8 bg-primary hover:bg-primary/90"><Download className="w-3.5 h-3.5" />Export CSV</Button>
              </div>
            </div>
            {clientLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : clientData ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <StatCard label="New Clients" value={String(clientData.newClients)} />
                  <StatCard label="Returning Clients" value={String(clientData.returning)} />
                  <StatCard label="Retention Rate" value={`${clientData.retentionRate}%`} />
                </div>
                {clientData.top10.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Top 10 Clients by Spend</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {clientData.top10.map((c, i) => (
                          <div key={c.phone} className="flex items-center gap-3">
                            <span className="text-xs text-gray-400 w-5 text-right">{i + 1}</span>
                            <span className="flex-1 text-sm font-medium text-gray-800 truncate">{c.name}</span>
                            <span className="text-xs text-gray-400">{c.visits} visits</span>
                            <span className="text-sm font-semibold text-primary">{formatAmount(c.spend)}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : null}
          </TabsContent>
        )}

        {/* ── Inventory Report ── */}
        {hasModule('inventory') && (
          <TabsContent value="inventory" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2"><Package className="w-4 h-4 text-primary" />Inventory Report</h2>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={loadInventory} className="gap-1.5 h-8"><RefreshCw className="w-3.5 h-3.5" />Refresh</Button>
                <Button size="sm" onClick={exportInventoryCSV} disabled={!invData} className="gap-1.5 h-8 bg-primary hover:bg-primary/90"><Download className="w-3.5 h-3.5" />Export CSV</Button>
              </div>
            </div>
            {invLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : invData ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <StatCard label="Total Items" value={String(invData.items.length)} />
                  <StatCard label="Low Stock Items" value={String(invData.lowStockCount)} />
                  <StatCard label="Total Stock Value" value={formatAmount(invData.totalValue)} />
                </div>
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Item</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Category</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Qty</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Cost</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Value</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invData.items.map((item, i) => {
                            const isLow = Number(item.quantity) <= Number(item.reorder_level)
                            return (
                              <tr key={item.name} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="px-4 py-2.5 font-medium text-gray-900">{item.name}</td>
                                <td className="px-4 py-2.5 text-gray-500 capitalize">{item.category?.replace(/_/g, ' ')}</td>
                                <td className="px-4 py-2.5 text-right text-gray-700">{item.quantity} {item.unit}</td>
                                <td className="px-4 py-2.5 text-right text-gray-600">{formatAmount(item.cost_price)}</td>
                                <td className="px-4 py-2.5 text-right font-medium text-gray-800">{formatAmount(Number(item.quantity) * Number(item.cost_price))}</td>
                                <td className="px-4 py-2.5 text-right">
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isLow ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                                    {isLow ? 'Low Stock' : 'OK'}
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : null}
          </TabsContent>
        )}

        {/* ── Expense Report ── */}
        {hasModule('expenses') && (
          <TabsContent value="expenses" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2"><DollarSign className="w-4 h-4 text-primary" />Expense Report</h2>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={loadExpenses} className="gap-1.5 h-8"><RefreshCw className="w-3.5 h-3.5" />Refresh</Button>
                <Button size="sm" onClick={exportExpensesCSV} disabled={!expData} className="gap-1.5 h-8 bg-primary hover:bg-primary/90"><Download className="w-3.5 h-3.5" />Export CSV</Button>
              </div>
            </div>
            {expLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : expData ? (
              <>
                <StatCard label="Total Expenses" value={formatAmount(expData.total)} />
                {expData.byCategory.length > 0 && (
                  <div className="grid md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm">By Category</CardTitle></CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {expData.byCategory.map(e => (
                            <div key={e.category} className="flex items-center justify-between">
                              <span className="text-sm text-gray-700 capitalize">{e.category}</span>
                              <span className="text-sm font-semibold text-gray-900">{formatAmount(e.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm">Distribution</CardTitle></CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie data={expData.byCategory} cx="50%" cy="50%" outerRadius={70} dataKey="amount" nameKey="category">
                              {expData.byCategory.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                            </Pie>
                            <Tooltip formatter={(v) => formatAmount(Number(v))} />
                            <Legend iconSize={8} formatter={(v) => <span style={{ fontSize: 11 }}>{v}</span>} />
                          </PieChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </>
            ) : null}
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

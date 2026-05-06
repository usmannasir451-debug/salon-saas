'use client'

import { useEffect, useState, useMemo } from 'react'
import { format, subDays, startOfWeek, startOfMonth } from 'date-fns'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUserContext } from '@/components/RoleContext'
import type { Branch } from '@/lib/types'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  CalendarDays,
  TrendingUp,
  Scissors,
  Users,
  Clock,
  Loader2,
  Sparkles,
  Download,
  MessageCircle,
  Building2,
  CheckCircle2,
  ReceiptText,
  Sun,
  Sunset,
  Moon,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

// ─── Types ───────────────────────────────────────────────────────────────────

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
  notes?: string
  services?: ServiceRef | null
  staff?: StaffRef | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPKR(n: number) {
  return `PKR ${Math.round(n).toLocaleString('en-PK')}`
}

function whatsappUrl(phone: string, clientName: string, date: string, time: string, salonName: string) {
  const digits = phone.replace(/\D/g, '')
  const wa = digits.startsWith('0') ? '92' + digits.slice(1) : digits.startsWith('92') ? digits : '92' + digits
  const d = format(new Date(date + 'T00:00:00'), 'EEEE, MMMM d')
  const t = time.slice(0, 5)
  const msg = `Assalamu Alaikum ${clientName}! Aapki appointment ${d} ko ${t} baje hai. ${salonName || 'Salon'} mein aapka intezaar hai. Shukriya! 🌸`
  return `https://wa.me/${wa}?text=${encodeURIComponent(msg)}`
}

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  confirmed: { label: 'Confirmed', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  completed: { label: 'Completed', className: 'bg-green-50 text-green-700 border-green-200' },
  cancelled: { label: 'Cancelled', className: 'bg-red-50 text-red-700 border-red-200' },
}

// ─── Custom Tooltip for Revenue Chart ────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-lg text-sm">
      <p className="font-medium text-gray-700 mb-0.5">{label}</p>
      <p className="font-bold text-primary">{formatPKR(payload[0].value)}</p>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { role, ownerId } = useUserContext()
  const router = useRouter()

  const [allAppointments, setAllAppointments] = useState<AppRow[]>([])
  const [salonName, setSalonName] = useState('')
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<'today' | 'week' | 'month'>('month')
  const [activeBranch, setActiveBranch] = useState('all')
  const [pdfLoading, setPdfLoading] = useState(false)

  useEffect(() => {
    if (!['owner', 'manager'].includes(role)) {
      router.replace('/appointments')
      return
    }
    loadDashboard()
  }, [role, router]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!['owner', 'manager'].includes(role)) return null

  async function loadDashboard() {
    const supabase = createClient()

    const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
    const sevenDaysAgo = format(subDays(new Date(), 6), 'yyyy-MM-dd')
    const queryStart = monthStart < sevenDaysAgo ? monthStart : sevenDaysAgo

    const [profileRes, apptRes, branchRes] = await Promise.all([
      supabase.from('profiles').select('salon_name').eq('id', ownerId).single(),
      supabase
        .from('appointments')
        .select('id, client_name, client_phone, service_id, staff_id, branch_id, appointment_date, appointment_time, status, notes, services(id, name, price), staff(id, name)')
        .eq('user_id', ownerId)
        .gte('appointment_date', queryStart)
        .order('appointment_date', { ascending: false })
        .order('appointment_time', { ascending: true }),
      supabase.from('branches').select('*').eq('user_id', ownerId).order('name'),
    ])

    setSalonName(profileRes.data?.salon_name ?? '')
    setAllAppointments((apptRes.data as unknown as AppRow[]) ?? [])
    setBranches((branchRes.data as Branch[]) ?? [])
    setLoading(false)
  }

  // ── Filtered by branch ──
  const branchFiltered = useMemo(() => {
    if (activeBranch === 'all') return allAppointments
    return allAppointments.filter((a) => a.branch_id === activeBranch)
  }, [allAppointments, activeBranch])

  // ── Monthly data (always for charts + top lists) ──
  const monthlyData = useMemo(() => {
    const monthStart = startOfMonth(new Date())
    return branchFiltered.filter((a) => new Date(a.appointment_date + 'T00:00:00') >= monthStart)
  }, [branchFiltered])

  // ── Period-filtered (for summary cards + appointments list) ──
  const periodFiltered = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
    const monthStart = startOfMonth(new Date())
    switch (activeFilter) {
      case 'today':
        return branchFiltered.filter((a) => a.appointment_date === todayStr)
      case 'week':
        return branchFiltered.filter((a) => new Date(a.appointment_date + 'T00:00:00') >= weekStart)
      default:
        return branchFiltered.filter((a) => new Date(a.appointment_date + 'T00:00:00') >= monthStart)
    }
  }, [branchFiltered, activeFilter])

  // ── Revenue chart (last 7 days) ──
  const revenueChartData = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd')
      const revenue = branchFiltered
        .filter((a) => a.appointment_date === date && a.status === 'completed')
        .reduce((sum, a) => sum + Number(a.services?.price ?? 0), 0)
      return { day: format(new Date(date + 'T00:00:00'), 'EEE'), revenue, date }
    })
  }, [branchFiltered])

  // ── Summary stats (period) ──
  const stats = useMemo(() => {
    const completed = periodFiltered.filter((a) => a.status === 'completed')
    const revenue = completed.reduce((sum, a) => sum + Number(a.services?.price ?? 0), 0)
    return {
      total: periodFiltered.length,
      completed: completed.length,
      revenue,
      avgBill: completed.length > 0 ? Math.round(revenue / completed.length) : 0,
    }
  }, [periodFiltered])

  // ── Top services (monthly, by revenue) ──
  const topServices = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; count: number }>()
    monthlyData
      .filter((a) => a.status === 'completed' && a.services)
      .forEach((a) => {
        const name = a.services!.name
        const price = Number(a.services!.price)
        const prev = map.get(name)
        if (prev) { prev.revenue += price; prev.count++ }
        else map.set(name, { name, revenue: price, count: 1 })
      })
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5)
  }, [monthlyData])

  // ── Top staff (monthly, by appointment count) ──
  const topStaff = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>()
    monthlyData
      .filter((a) => a.staff)
      .forEach((a) => {
        const name = a.staff!.name
        const prev = map.get(name)
        if (prev) prev.count++
        else map.set(name, { name, count: 1 })
      })
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 5)
  }, [monthlyData])

  // ── Busy hours (monthly) ──
  const busyHours = useMemo(() => {
    let morning = 0, afternoon = 0, evening = 0
    monthlyData.forEach((a) => {
      const hour = parseInt(a.appointment_time.split(':')[0])
      if (hour >= 8 && hour < 12) morning++
      else if (hour >= 12 && hour < 17) afternoon++
      else if (hour >= 17 && hour < 21) evening++
    })
    const peak = Math.max(morning, afternoon, evening, 1)
    return [
      { label: 'Morning', urdu: 'صبح', time: '8am–12pm', count: morning, pct: Math.round((morning / peak) * 100), icon: Sun, color: 'bg-amber-400' },
      { label: 'Afternoon', urdu: 'دوپہر', time: '12pm–5pm', count: afternoon, pct: Math.round((afternoon / peak) * 100), icon: Sunset, color: 'bg-orange-400' },
      { label: 'Evening', urdu: 'شام', time: '5pm–9pm', count: evening, pct: Math.round((evening / peak) * 100), icon: Moon, color: 'bg-primary' },
    ]
  }, [monthlyData])

  // ── PDF Report ──
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
      doc.text('SalonPro Pakistan', 14, 16)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.text(`Monthly Report — ${format(new Date(), 'MMMM yyyy')}`, 14, 26)
      if (salonName) doc.text(salonName, 14, 34)

      doc.setTextColor(30, 30, 30)
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text('Summary', 14, 52)

      const monthLabel = activeFilter === 'today' ? 'Today' : activeFilter === 'week' ? 'This Week' : 'This Month'
      autoTable(doc, {
        startY: 56,
        head: [['Metric', 'Value']],
        body: [
          [`Total Appointments (${monthLabel})`, stats.total.toString()],
          ['Completed', stats.completed.toString()],
          ['Total Revenue', `PKR ${stats.revenue.toLocaleString()}`],
          ['Average Bill per Client', `PKR ${stats.avgBill.toLocaleString()}`],
        ],
        theme: 'striped',
        headStyles: { fillColor: [244, 63, 94] },
        styles: { fontSize: 10 },
      })

      let y: number = (doc as any).lastAutoTable.finalY + 12

      if (topServices.length > 0) {
        doc.setFontSize(13)
        doc.setFont('helvetica', 'bold')
        doc.text('Top Services This Month', 14, y)
        autoTable(doc, {
          startY: y + 4,
          head: [['Service', 'Revenue (PKR)', 'Bookings']],
          body: topServices.map((s) => [s.name, s.revenue.toLocaleString(), s.count.toString()]),
          theme: 'striped',
          headStyles: { fillColor: [244, 63, 94] },
          styles: { fontSize: 10 },
        })
        y = (doc as any).lastAutoTable.finalY + 12
      }

      if (topStaff.length > 0) {
        doc.setFontSize(13)
        doc.setFont('helvetica', 'bold')
        doc.text('Top Staff This Month', 14, y)
        autoTable(doc, {
          startY: y + 4,
          head: [['Staff Member', 'Appointments']],
          body: topStaff.map((s) => [s.name, s.count.toString()]),
          theme: 'striped',
          headStyles: { fillColor: [244, 63, 94] },
          styles: { fontSize: 10 },
        })
        y = (doc as any).lastAutoTable.finalY + 12
      }

      if (periodFiltered.length > 0) {
        if (y > 230) doc.addPage()
        doc.setFontSize(13)
        doc.setFont('helvetica', 'bold')
        doc.text(`Appointments — ${monthLabel}`, 14, y)
        autoTable(doc, {
          startY: y + 4,
          head: [['Date', 'Time', 'Client', 'Service', 'Staff', 'Status']],
          body: periodFiltered.map((a) => [
            format(new Date(a.appointment_date + 'T00:00:00'), 'MMM d'),
            a.appointment_time.slice(0, 5),
            a.client_name,
            a.services?.name ?? '—',
            a.staff?.name ?? '—',
            a.status,
          ]),
          theme: 'striped',
          headStyles: { fillColor: [244, 63, 94] },
          styles: { fontSize: 9 },
        })
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

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-gray-900">{salonName || 'Dashboard'}</h1>
          </div>
          <p className="text-gray-500 text-sm">
            {format(new Date(), 'EEEE, MMMM d, yyyy')} •{' '}
            <span className="font-urdu">خوش آمدید</span>
          </p>
        </div>
        <Button
          onClick={downloadPDF}
          disabled={pdfLoading}
          variant="outline"
          className="gap-2 border-primary/30 text-primary hover:bg-primary/5 flex-shrink-0"
        >
          {pdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          <span className="hidden sm:inline">Monthly Report</span>
          <span className="sm:hidden">PDF</span>
        </Button>
      </div>

      {/* ── Quick Filters ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['today', 'week', 'month'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              activeFilter === f
                ? 'bg-primary text-white shadow-sm shadow-primary/30'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {filterLabels[f]}
          </button>
        ))}
        {branches.length > 0 && (
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
            {[{ id: 'all', name: 'All Branches' }, ...branches].map((b) => (
              <button
                key={b.id}
                onClick={() => setActiveBranch(b.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  activeBranch === b.id
                    ? 'bg-primary/15 text-primary border border-primary/30'
                    : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                {b.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            title: 'Appointments',
            urdu: 'اپائنٹمنٹ',
            value: stats.total,
            icon: CalendarDays,
            color: 'text-primary',
            bg: 'bg-primary/10',
          },
          {
            title: 'Completed',
            urdu: 'مکمل',
            value: stats.completed,
            icon: CheckCircle2,
            color: 'text-green-600',
            bg: 'bg-green-50',
          },
          {
            title: 'Revenue',
            urdu: 'آمدنی',
            value: formatPKR(stats.revenue),
            icon: TrendingUp,
            color: 'text-blue-600',
            bg: 'bg-blue-50',
          },
          {
            title: 'Avg Bill',
            urdu: 'اوسط بل',
            value: formatPKR(stats.avgBill),
            icon: ReceiptText,
            color: 'text-purple-600',
            bg: 'bg-purple-50',
          },
        ].map((s) => (
          <Card key={s.title} className="border-gray-100 hover:shadow-md transition-shadow">
            <CardContent className="pt-5 pb-4">
              <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <p className="text-xl font-bold text-gray-900 mb-0.5 leading-tight">{s.value}</p>
              <p className="text-xs text-gray-500">{s.title}</p>
              <p className="font-urdu text-xs text-gray-400">{s.urdu}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Revenue Chart (last 7 days) ── */}
      <Card className="border-gray-100">
        <CardHeader className="pb-2 border-b border-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Revenue — Last 7 Days</CardTitle>
              <p className="font-urdu text-xs text-gray-400 mt-0.5">گزشتہ 7 دن کی آمدنی</p>
            </div>
            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
              {formatPKR(revenueChartData.reduce((s, d) => s + d.revenue, 0))} total
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {revenueChartData.every((d) => d.revenue === 0) ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <TrendingUp className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">No revenue data yet</p>
              <p className="font-urdu text-xs mt-1">ابھی کوئی ڈیٹا نہیں</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={revenueChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                  width={36}
                />
                <Tooltip content={<RevenueTooltip />} cursor={{ fill: '#fdf2f4' }} />
                <Bar dataKey="revenue" fill="#f43f5e" radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Top Services + Busy Hours ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Top Services */}
        <Card className="border-gray-100">
          <CardHeader className="pb-2 border-b border-gray-50">
            <CardTitle className="text-base flex items-center gap-2">
              <Scissors className="w-4 h-4 text-primary" />
              Top Services This Month
            </CardTitle>
            <p className="font-urdu text-xs text-gray-400">اس ماہ کی بہترین سروسز</p>
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
                          <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold flex-shrink-0">
                            {i + 1}
                          </span>
                          <span className="font-medium text-gray-800 truncate">{s.name}</span>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <span className="font-bold text-primary text-xs">{formatPKR(s.revenue)}</span>
                          <span className="text-gray-400 text-xs ml-1">({s.count})</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${(s.revenue / maxRev) * 100}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Busy Hours */}
        <Card className="border-gray-100">
          <CardHeader className="pb-2 border-b border-gray-50">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Busy Hours This Month
            </CardTitle>
            <p className="font-urdu text-xs text-gray-400">مصروف اوقات</p>
          </CardHeader>
          <CardContent className="pt-5">
            {monthlyData.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No appointments this month</p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {busyHours.map((h) => (
                  <div key={h.label} className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-xl ${h.color} bg-opacity-15 flex items-center justify-center mb-2`}
                         style={{ backgroundColor: h.label === 'Morning' ? '#fef3c7' : h.label === 'Afternoon' ? '#ffedd5' : '#fff1f3' }}>
                      <h.icon className={`w-5 h-5 ${h.label === 'Morning' ? 'text-amber-500' : h.label === 'Afternoon' ? 'text-orange-500' : 'text-primary'}`} />
                    </div>
                    <p className="text-xl font-bold text-gray-900">{h.count}</p>
                    <p className="text-xs font-medium text-gray-700">{h.label}</p>
                    <p className="font-urdu text-xs text-gray-400">{h.urdu}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{h.time}</p>
                    <div className="w-full mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${h.color} transition-all`}
                        style={{ width: `${h.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Top Staff ── */}
      {topStaff.length > 0 && (
        <Card className="border-gray-100">
          <CardHeader className="pb-2 border-b border-gray-50">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Top Staff This Month
            </CardTitle>
            <p className="font-urdu text-xs text-gray-400">اس ماہ کا بہترین اسٹاف</p>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {topStaff.map((s, i) => {
                const max = topStaff[0].count || 1
                const colors = ['bg-primary', 'bg-rose-400', 'bg-pink-400', 'bg-fuchsia-400', 'bg-purple-400']
                return (
                  <div key={s.name} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                    <div className={`w-9 h-9 rounded-xl ${colors[i] ?? colors[0]} flex items-center justify-center flex-shrink-0`}>
                      <span className="text-white text-sm font-bold">{s.name[0]?.toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{s.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${colors[i] ?? colors[0]} rounded-full`}
                            style={{ width: `${(s.count / max) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-gray-600 flex-shrink-0">{s.count}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Appointments List (filtered by period) ── */}
      <Card className="border-gray-100">
        <CardHeader className="pb-3 border-b border-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">
                {filterLabels[activeFilter]} Appointments
              </CardTitle>
              <p className="font-urdu text-xs text-gray-400 mt-0.5">اپائنٹمنٹ</p>
            </div>
            <Badge className="bg-primary/10 text-primary border-primary/20">
              {periodFiltered.length} total
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {periodFiltered.length === 0 ? (
            <div className="text-center py-10">
              <CalendarDays className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No appointments</p>
              <p className="font-urdu text-sm text-gray-400 mt-1">کوئی اپائنٹمنٹ نہیں</p>
            </div>
          ) : (
            <div className="space-y-2">
              {periodFiltered.map((appt) => {
                const sc = statusConfig[appt.status] ?? statusConfig.pending
                return (
                  <div
                    key={appt.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100/80 transition-colors group"
                  >
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
                            <span className="text-xs font-medium text-primary">{formatPKR(appt.services.price)}</span>
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
                        <a
                          href={whatsappUrl(appt.client_phone, appt.client_name, appt.appointment_date, appt.appointment_time, salonName)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                          title="Send WhatsApp reminder"
                        >
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

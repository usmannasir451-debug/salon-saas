'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, startOfMonth, endOfMonth, subMonths, startOfDay } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { useUserContext } from '@/components/RoleContext'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  TrendingUp, Star, Users, Trophy, Loader2, ArrowLeft, Crown, Zap,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { cn } from '@/lib/utils'

type StaffPerf = {
  id: string
  name: string
  commission_rate: number
  totalAppointments: number
  completedAppointments: number
  totalWalkIns: number
  totalRevenue: number
  monthRevenue: number
  commissionEarned: number
  avgRating: number
  totalReviews: number
  badges: string[]
}

type MonthlyPoint = { month: string; revenue: number; appointments: number }

function formatPKR(n: number) {
  return `PKR ${Math.round(n).toLocaleString('en-PK')}`
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={cn(
            'w-3 h-3',
            s <= Math.round(rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'
          )}
        />
      ))}
    </div>
  )
}

const BADGE_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  top_performer: { label: 'Top Performer', color: 'bg-rose-100 text-rose-700 border-rose-200', icon: Crown },
  most_booked: { label: 'Most Booked', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Users },
  highest_rated: { label: 'Highest Rated', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Star },
}

export default function StaffPerformancePage() {
  const { role, ownerId } = useUserContext()
  const router = useRouter()

  const [staff, setStaff] = useState<StaffPerf[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<StaffPerf | null>(null)
  const [monthlyData, setMonthlyData] = useState<MonthlyPoint[]>([])
  const [chartLoading, setChartLoading] = useState(false)

  useEffect(() => {
    if (!['owner', 'manager'].includes(role)) { router.replace('/appointments'); return }
    loadData()
  }, [role, router]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    const supabase = createClient()
    const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
    const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd')

    const [staffRes, apptRes, walkRes, reviewRes] = await Promise.all([
      supabase.from('staff').select('id, name, commission_rate').eq('user_id', ownerId).order('name'),
      supabase
        .from('appointments')
        .select('staff_id, status, services(price), appointment_date')
        .eq('user_id', ownerId),
      supabase
        .from('walk_ins')
        .select('staff_id, total, created_at')
        .eq('user_id', ownerId),
      supabase
        .from('reviews')
        .select('staff_id, rating')
        .eq('user_id', ownerId),
    ])

    const staffData = staffRes.data ?? []
    const appts = apptRes.data ?? []
    const walks = walkRes.data ?? []
    const reviews = reviewRes.data ?? []

    // Aggregate per staff
    const map = new Map<string, StaffPerf>()
    staffData.forEach((s) => {
      map.set(s.id, {
        id: s.id,
        name: s.name,
        commission_rate: s.commission_rate ?? 0,
        totalAppointments: 0,
        completedAppointments: 0,
        totalWalkIns: 0,
        totalRevenue: 0,
        monthRevenue: 0,
        commissionEarned: 0,
        avgRating: 0,
        totalReviews: 0,
        badges: [],
      })
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    appts.forEach((a: any) => {
      if (!a.staff_id || !map.has(a.staff_id)) return
      const p = map.get(a.staff_id)!
      p.totalAppointments++
      if (a.status === 'completed') {
        p.completedAppointments++
        const price = a.services?.price ?? 0
        p.totalRevenue += price
        if (a.appointment_date >= monthStart && a.appointment_date <= monthEnd) {
          p.monthRevenue += price
        }
      }
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    walks.forEach((w: any) => {
      if (!w.staff_id || !map.has(w.staff_id)) return
      const p = map.get(w.staff_id)!
      p.totalWalkIns++
      p.totalRevenue += w.total ?? 0
      const wDate = format(new Date(w.created_at), 'yyyy-MM-dd')
      if (wDate >= monthStart && wDate <= monthEnd) {
        p.monthRevenue += w.total ?? 0
      }
    })

    // Reviews
    const ratingMap = new Map<string, number[]>()
    reviews.forEach((r: { staff_id: string; rating: number }) => {
      if (!ratingMap.has(r.staff_id)) ratingMap.set(r.staff_id, [])
      ratingMap.get(r.staff_id)!.push(r.rating)
    })
    ratingMap.forEach((ratings, staffId) => {
      if (map.has(staffId)) {
        const p = map.get(staffId)!
        p.totalReviews = ratings.length
        p.avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length
      }
    })

    // Commission
    map.forEach((p) => {
      p.commissionEarned = (p.monthRevenue * (p.commission_rate ?? 0)) / 100
    })

    const list = Array.from(map.values())

    // Assign badges
    if (list.length > 0) {
      const topRevenue = list.reduce((a, b) => (b.monthRevenue > a.monthRevenue ? b : a))
      const mostBooked = list.reduce((a, b) =>
        (b.completedAppointments + b.totalWalkIns > a.completedAppointments + a.totalWalkIns ? b : a)
      )
      const highestRated = list.filter((s) => s.totalReviews > 0).reduce((a, b) =>
        (a && b.avgRating > a.avgRating ? b : a), list.find((s) => s.totalReviews > 0) ?? null)

      if (topRevenue.monthRevenue > 0) topRevenue.badges.push('top_performer')
      if (mostBooked.completedAppointments + mostBooked.totalWalkIns > 0) mostBooked.badges.push('most_booked')
      if (highestRated && highestRated.avgRating > 0) highestRated.badges.push('highest_rated')
    }

    setStaff(list)
    setLoading(false)
  }

  async function loadMonthlyChart(staffId: string) {
    setChartLoading(true)
    const supabase = createClient()
    const points: MonthlyPoint[] = []

    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i)
      const mStart = format(startOfMonth(d), 'yyyy-MM-dd')
      const mEnd = format(endOfMonth(d), 'yyyy-MM-dd')
      const monthLabel = format(d, 'MMM yy')

      const [apptRes, walkRes] = await Promise.all([
        supabase
          .from('appointments')
          .select('services(price)')
          .eq('user_id', ownerId)
          .eq('staff_id', staffId)
          .eq('status', 'completed')
          .gte('appointment_date', mStart)
          .lte('appointment_date', mEnd),
        supabase
          .from('walk_ins')
          .select('total')
          .eq('user_id', ownerId)
          .eq('staff_id', staffId)
          .gte('created_at', startOfDay(new Date(mStart)).toISOString())
          .lte('created_at', new Date(mEnd + 'T23:59:59').toISOString()),
      ])

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const apptRev = (apptRes.data ?? []).reduce((sum: number, a: any) => sum + (a.services?.price ?? 0), 0)
      const walkRev = (walkRes.data ?? []).reduce((sum: number, w: any) => sum + (w.total ?? 0), 0)

      points.push({
        month: monthLabel,
        revenue: apptRev + walkRev,
        appointments: (apptRes.data?.length ?? 0) + (walkRes.data?.length ?? 0),
      })
    }

    setMonthlyData(points)
    setChartLoading(false)
  }

  function selectStaff(s: StaffPerf) {
    setSelected(s)
    loadMonthlyChart(s.id)
  }

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
      <div className="flex items-center gap-4">
        <Link href="/staff">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" />
            Staff Performance
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Current month performance overview</p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Staff', value: staff.length, icon: Users, color: 'text-blue-600 bg-blue-50' },
          {
            label: 'Month Revenue',
            value: formatPKR(staff.reduce((s, x) => s + x.monthRevenue, 0)),
            icon: TrendingUp,
            color: 'text-green-600 bg-green-50',
          },
          {
            label: 'Total Bookings',
            value: staff.reduce((s, x) => s + x.completedAppointments + x.totalWalkIns, 0),
            icon: Zap,
            color: 'text-purple-600 bg-purple-50',
          },
          {
            label: 'Avg Rating',
            value: (() => {
              const rated = staff.filter((s) => s.totalReviews > 0)
              return rated.length
                ? (rated.reduce((sum, s) => sum + s.avgRating, 0) / rated.length).toFixed(1) + ' ★'
                : '—'
            })(),
            icon: Star,
            color: 'text-yellow-600 bg-yellow-50',
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center mb-2', color)}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Staff Table */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Staff Leaderboard</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      {['Staff', 'Appts', 'Walk-ins', 'Revenue', 'Rating', 'Commission'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {staff.map((s) => (
                      <tr
                        key={s.id}
                        onClick={() => selectStaff(s)}
                        className={cn(
                          'hover:bg-primary/5 cursor-pointer transition-colors',
                          selected?.id === s.id && 'bg-primary/10'
                        )}
                      >
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900">{s.name}</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {s.badges.map((b) => {
                                const bc = BADGE_CONFIG[b]
                                if (!bc) return null
                                const Icon = bc.icon
                                return (
                                  <span key={b} className={cn('text-[10px] px-1.5 py-0.5 rounded-full border font-medium flex items-center gap-0.5', bc.color)}>
                                    <Icon className="w-2.5 h-2.5" />
                                    {bc.label}
                                  </span>
                                )
                              })}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{s.completedAppointments}</td>
                        <td className="px-4 py-3 text-gray-700">{s.totalWalkIns}</td>
                        <td className="px-4 py-3 text-gray-700 font-medium">{formatPKR(s.monthRevenue)}</td>
                        <td className="px-4 py-3">
                          {s.totalReviews > 0 ? (
                            <div>
                              <StarRow rating={s.avgRating} />
                              <p className="text-[10px] text-gray-400 mt-0.5">{s.totalReviews} reviews</p>
                            </div>
                          ) : (
                            <span className="text-gray-300 text-xs">No reviews</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-green-700 font-medium">
                          {s.commission_rate > 0 ? formatPKR(s.commissionEarned) : '—'}
                        </td>
                      </tr>
                    ))}
                    {staff.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                          No staff members found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Staff Detail Panel */}
        <div className="lg:col-span-2">
          {selected ? (
            <Card className="h-full">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{selected.name}</CardTitle>
                    <div className="flex gap-1 flex-wrap mt-1">
                      {selected.badges.map((b) => {
                        const bc = BADGE_CONFIG[b]
                        if (!bc) return null
                        const Icon = bc.icon
                        return (
                          <Badge key={b} className={cn('text-[10px] px-1.5 py-0.5', bc.color)}>
                            <Icon className="w-2.5 h-2.5 mr-0.5" />
                            {bc.label}
                          </Badge>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Total Appts', value: selected.totalAppointments },
                    { label: 'Walk-ins', value: selected.totalWalkIns },
                    { label: 'Total Revenue', value: formatPKR(selected.totalRevenue) },
                    { label: 'Month Revenue', value: formatPKR(selected.monthRevenue) },
                    {
                      label: 'Avg Rating',
                      value: selected.totalReviews > 0 ? `${selected.avgRating.toFixed(1)} ★` : '—',
                    },
                    { label: 'Month Commission', value: formatPKR(selected.commissionEarned) },
                  ].map(({ label, value }) => (
                    <div key={label} className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className="font-semibold text-gray-900 text-sm mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Monthly trend chart */}
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-2">6-Month Revenue Trend</p>
                  {chartLoading ? (
                    <div className="h-32 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={140}>
                      <LineChart data={monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} width={40} />
                        <Tooltip
                          formatter={(value) => [formatPKR(Number(value)), 'Revenue']}
                          labelStyle={{ fontSize: 11 }}
                          contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="revenue"
                          stroke="#f43f5e"
                          strokeWidth={2}
                          dot={{ r: 3, fill: '#f43f5e' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="h-full flex items-center justify-center border-2 border-dashed border-gray-200 rounded-xl">
              <div className="text-center p-6">
                <Trophy className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Click on a staff member to view their detailed performance</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

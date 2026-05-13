'use client'

import { useEffect, useState, useMemo } from 'react'
import { format, addDays, subDays, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { useUserContext } from '@/components/RoleContext'
import { toast } from 'sonner'
import type { StaffMember, AttendanceStatus } from '@/lib/types'
import {
  ClipboardList, ChevronLeft, ChevronRight, Loader2,
  UserCheck, Save,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type AttendanceRow = { staff_id: string; date: string; status: AttendanceStatus }

const STATUS_ORDER: AttendanceStatus[] = ['present', 'half_day', 'absent', 'leave', 'holiday']

const STATUS_CFG: Record<AttendanceStatus, { label: string; short: string; activeBg: string; chip: string }> = {
  present:  { label: 'Present',  short: 'P',  activeBg: 'bg-green-500 text-white border-green-500',  chip: 'bg-green-100 text-green-700 border-green-300' },
  half_day: { label: 'Half Day', short: 'H',  activeBg: 'bg-yellow-500 text-white border-yellow-500', chip: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  absent:   { label: 'Absent',   short: 'A',  activeBg: 'bg-red-500 text-white border-red-500',       chip: 'bg-red-100 text-red-700 border-red-300' },
  leave:    { label: 'On Leave', short: 'L',  activeBg: 'bg-blue-500 text-white border-blue-500',     chip: 'bg-blue-100 text-blue-700 border-blue-300' },
  holiday:  { label: 'Holiday',  short: 'Ho', activeBg: 'bg-gray-500 text-white border-gray-500',     chip: 'bg-gray-100 text-gray-600 border-gray-300' },
}

export default function AttendancePage() {
  const { role, ownerId } = useUserContext()

  const [activeTab, setActiveTab] = useState<'daily' | 'monthly' | 'summary'>('daily')
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [selectedMonth, setSelectedMonth] = useState(startOfMonth(new Date()))
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [dailyMap, setDailyMap] = useState<Record<string, AttendanceStatus | null>>({})
  const [monthlyRecords, setMonthlyRecords] = useState<AttendanceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const canEdit = role === 'owner' || role === 'manager'

  // ── Load staff ──────────────────────────────────────────────────────────────
  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('staff').select('*').eq('user_id', ownerId).eq('is_active', true).order('name')
      const staffData = (data ?? []) as StaffMember[]
      setStaffList(staffData)
      if (staffData.length > 0) setSelectedStaffId(staffData[0].id)
      setLoading(false)
    })()
  }, [ownerId])

  // ── Load daily attendance ───────────────────────────────────────────────────
  useEffect(() => {
    if (!staffList.length) return
    ;(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('attendance').select('staff_id, status')
        .eq('owner_id', ownerId).eq('date', selectedDate)
      const map: Record<string, AttendanceStatus | null> = {}
      for (const s of staffList) map[s.id] = null
      for (const r of (data ?? []) as AttendanceRow[]) map[r.staff_id] = r.status
      setDailyMap(map)
      setHasChanges(false)
    })()
  }, [selectedDate, staffList, ownerId])

  // ── Load monthly attendance ─────────────────────────────────────────────────
  useEffect(() => {
    if (!staffList.length || activeTab === 'daily') return
    ;(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('attendance').select('staff_id, date, status')
        .eq('owner_id', ownerId)
        .gte('date', format(selectedMonth, 'yyyy-MM-dd'))
        .lte('date', format(endOfMonth(selectedMonth), 'yyyy-MM-dd'))
      setMonthlyRecords((data ?? []) as AttendanceRow[])
    })()
  }, [selectedMonth, activeTab, staffList, ownerId])

  function toggleStatus(staffId: string, status: AttendanceStatus) {
    if (!canEdit) return
    setDailyMap(prev => ({ ...prev, [staffId]: prev[staffId] === status ? null : status }))
    setHasChanges(true)
  }

  function markAll(status: AttendanceStatus) {
    if (!canEdit) return
    const map: Record<string, AttendanceStatus | null> = {}
    for (const s of staffList) map[s.id] = status
    setDailyMap(map)
    setHasChanges(true)
  }

  async function saveDaily() {
    setSaving(true)
    const supabase = createClient()
    const toUpsert: object[] = []
    const toClear: string[] = []
    for (const [staffId, status] of Object.entries(dailyMap)) {
      if (status) {
        toUpsert.push({ owner_id: ownerId, staff_id: staffId, date: selectedDate, status })
      } else {
        toClear.push(staffId)
      }
    }
    if (toUpsert.length > 0) {
      const { error } = await supabase.from('attendance')
        .upsert(toUpsert, { onConflict: 'owner_id,staff_id,date' })
      if (error) { toast.error(error.message); setSaving(false); return }
    }
    if (toClear.length > 0) {
      await supabase.from('attendance').delete()
        .eq('owner_id', ownerId).eq('date', selectedDate).in('staff_id', toClear)
    }
    toast.success(`Attendance saved for ${format(parseISO(selectedDate), 'MMM d, yyyy')}`)
    setHasChanges(false)
    setSaving(false)
  }

  // ── Calendar grid data ──────────────────────────────────────────────────────
  const monthDays = useMemo(() => eachDayOfInterval({
    start: startOfMonth(selectedMonth),
    end: endOfMonth(selectedMonth),
  }), [selectedMonth])

  const selectedStaffMonthly = useMemo(() => {
    const map: Record<string, AttendanceStatus> = {}
    for (const r of monthlyRecords) {
      if (r.staff_id === selectedStaffId) map[r.date] = r.status
    }
    return map
  }, [monthlyRecords, selectedStaffId])

  const summaryStats = useMemo(() => {
    const stats: Record<string, Record<AttendanceStatus, number>> = {}
    for (const s of staffList) {
      stats[s.id] = { present: 0, half_day: 0, absent: 0, leave: 0, holiday: 0 }
    }
    for (const r of monthlyRecords) {
      if (stats[r.staff_id]) stats[r.staff_id][r.status]++
    }
    return stats
  }, [monthlyRecords, staffList])

  function prevMonth() { setSelectedMonth(m => startOfMonth(subDays(m, 1))) }
  function nextMonth() { setSelectedMonth(m => startOfMonth(addDays(endOfMonth(m), 1))) }

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
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-primary" />
          Attendance
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Track daily staff attendance and manage leave</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
        {([
          { key: 'daily', label: 'Daily View' },
          { key: 'monthly', label: 'Calendar View' },
          { key: 'summary', label: 'Monthly Summary' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all',
              activeTab === key
                ? 'bg-white dark:bg-gray-700 text-primary shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── DAILY TAB ── */}
      {activeTab === 'daily' && (
        <div className="space-y-4">
          {/* Date nav + bulk actions */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="px-2"
                onClick={() => setSelectedDate(d => format(subDays(parseISO(d), 1), 'yyyy-MM-dd'))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="h-9 rounded-lg border border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <Button variant="outline" size="sm" className="px-2"
                onClick={() => setSelectedDate(d => format(addDays(parseISO(d), 1), 'yyyy-MM-dd'))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}>
                Today
              </Button>
            </div>
            {canEdit && (
              <div className="flex items-center gap-2 ml-auto flex-wrap">
                <Button variant="outline" size="sm" onClick={() => markAll('present')}
                  className="text-green-600 border-green-200 hover:bg-green-50 gap-1.5">
                  <UserCheck className="w-4 h-4" /> Mark All Present
                </Button>
                <Button variant="outline" size="sm" onClick={() => markAll('holiday')}
                  className="text-gray-600 gap-1.5">
                  Mark All Holiday
                </Button>
              </div>
            )}
          </div>

          {/* Attendance table */}
          <Card className="border-gray-100 dark:border-gray-700">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Staff Member</th>
                      {STATUS_ORDER.map(s => (
                        <th key={s} className="px-2 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {STATUS_CFG[s].label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                    {staffList.map(staff => {
                      const cur = dailyMap[staff.id] ?? null
                      return (
                        <tr key={staff.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <span className="text-primary text-xs font-bold">{staff.name[0].toUpperCase()}</span>
                              </div>
                              <span className="font-medium text-gray-900 dark:text-gray-100">{staff.name}</span>
                              {cur && (
                                <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border font-medium', STATUS_CFG[cur].chip)}>
                                  {STATUS_CFG[cur].label}
                                </span>
                              )}
                            </div>
                          </td>
                          {STATUS_ORDER.map(status => {
                            const isActive = cur === status
                            return (
                              <td key={status} className="px-2 py-3 text-center">
                                <button
                                  onClick={() => toggleStatus(staff.id, status)}
                                  disabled={!canEdit}
                                  title={STATUS_CFG[status].label}
                                  className={cn(
                                    'w-8 h-8 rounded-full border-2 font-bold text-xs transition-all',
                                    isActive
                                      ? STATUS_CFG[status].activeBg
                                      : 'border-gray-200 dark:border-gray-600 text-gray-400 hover:border-gray-300 bg-white dark:bg-gray-800',
                                    !canEdit && 'cursor-default opacity-60'
                                  )}
                                >
                                  {STATUS_CFG[status].short}
                                </button>
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                    {staffList.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">
                          No active staff found. Add staff members first.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Status legend */}
          <div className="flex flex-wrap gap-3">
            {STATUS_ORDER.map(s => (
              <div key={s} className="flex items-center gap-1.5">
                <div className={cn('w-5 h-5 rounded-full border-2 font-bold text-[9px] flex items-center justify-center', STATUS_CFG[s].activeBg)}>
                  {STATUS_CFG[s].short}
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">{STATUS_CFG[s].label}</span>
              </div>
            ))}
          </div>

          {/* Save */}
          {canEdit && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {Object.values(dailyMap).filter(Boolean).length}/{staffList.length} staff marked
              </p>
              <Button onClick={saveDaily} disabled={saving || !hasChanges} className="bg-primary hover:bg-primary/90 gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Attendance
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── MONTHLY CALENDAR TAB ── */}
      {activeTab === 'monthly' && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="px-2" onClick={prevMonth}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="font-semibold text-gray-900 dark:text-gray-100 min-w-[130px] text-center">
                {format(selectedMonth, 'MMMM yyyy')}
              </span>
              <Button variant="outline" size="sm" className="px-2" onClick={nextMonth}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <select
              value={selectedStaffId}
              onChange={e => setSelectedStaffId(e.target.value)}
              className="h-9 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Calendar */}
          <Card className="border-gray-100 dark:border-gray-700">
            <CardContent className="p-4">
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                  <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
                ))}
              </div>
              {(() => {
                const startDow = (startOfMonth(selectedMonth).getDay() + 6) % 7
                const cells: (Date | null)[] = [...Array(startDow).fill(null), ...monthDays]
                while (cells.length % 7 !== 0) cells.push(null)
                const rows: (Date | null)[][] = []
                for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
                return rows.map((row, ri) => (
                  <div key={ri} className="grid grid-cols-7 gap-1 mb-1">
                    {row.map((day, di) => {
                      if (!day) return <div key={di} className="h-10" />
                      const dateStr = format(day, 'yyyy-MM-dd')
                      const status = selectedStaffMonthly[dateStr]
                      const isSun = day.getDay() === 0
                      return (
                        <div
                          key={di}
                          className={cn(
                            'h-10 rounded-lg flex flex-col items-center justify-center text-xs font-medium border relative',
                            status
                              ? cn(STATUS_CFG[status].activeBg, 'border-transparent')
                              : isSun
                                ? 'bg-gray-50 dark:bg-gray-800/30 text-gray-300 border-gray-100 dark:border-gray-700/50'
                                : 'bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 border-gray-100 dark:border-gray-700'
                          )}
                        >
                          <span>{format(day, 'd')}</span>
                          {isSun && !status && <span className="text-[8px] leading-none text-gray-300">off</span>}
                        </div>
                      )
                    })}
                  </div>
                ))
              })()}
              {/* Legend */}
              <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                {STATUS_ORDER.map(s => (
                  <div key={s} className="flex items-center gap-1.5">
                    <div className={cn('w-4 h-4 rounded', STATUS_CFG[s].activeBg)} />
                    <span className="text-xs text-gray-500 dark:text-gray-400">{STATUS_CFG[s].label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Stats for selected staff */}
          {selectedStaffId && summaryStats[selectedStaffId] && (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {STATUS_ORDER.map(s => (
                <Card key={s} className="border-gray-100 dark:border-gray-700">
                  <CardContent className="pt-4 pb-3 text-center">
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {summaryStats[selectedStaffId][s]}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{STATUS_CFG[s].label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SUMMARY TAB ── */}
      {activeTab === 'summary' && (
        <div className="space-y-4">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="px-2" onClick={prevMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="font-semibold text-gray-900 dark:text-gray-100 min-w-[130px] text-center">
              {format(selectedMonth, 'MMMM yyyy')}
            </span>
            <Button variant="outline" size="sm" className="px-2" onClick={nextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <Card className="border-gray-100 dark:border-gray-700">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                      {['Staff Member', 'Present', 'Half Day', 'Absent', 'On Leave', 'Holiday', 'Leave Used', 'Leave Balance'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                    {staffList.map(staff => {
                      const stats = summaryStats[staff.id] ?? { present: 0, half_day: 0, absent: 0, leave: 0, holiday: 0 }
                      const allowance = staff.leave_allowance ?? 2
                      const balance = Math.max(0, allowance - stats.leave)
                      const lowLeave = balance <= 1 && stats.leave > 0
                      return (
                        <tr key={staff.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <span className="text-primary text-xs font-bold">{staff.name[0].toUpperCase()}</span>
                              </div>
                              <span className="font-medium text-gray-900 dark:text-gray-100">{staff.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-medium text-green-700">{stats.present}</td>
                          <td className="px-4 py-3 font-medium text-yellow-600">{stats.half_day}</td>
                          <td className="px-4 py-3 font-medium text-red-600">{stats.absent}</td>
                          <td className="px-4 py-3 font-medium text-blue-700">{stats.leave}</td>
                          <td className="px-4 py-3 font-medium text-gray-600">{stats.holiday}</td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{stats.leave}/{allowance}</td>
                          <td className="px-4 py-3">
                            <span className={cn('font-medium', lowLeave ? 'text-red-600' : 'text-gray-700 dark:text-gray-300')}>
                              {balance} day{balance !== 1 ? 's' : ''}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                    {staffList.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">
                          No active staff found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

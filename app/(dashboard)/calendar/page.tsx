'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { format, addDays, subDays, startOfWeek, isSameDay } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { useUserContext } from '@/components/RoleContext'
import { toast } from 'sonner'
import { canEdit, canDelete } from '@/lib/roles'
import type { AppointmentStatus, Service, StaffMember } from '@/lib/types'
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Loader2,
  X,
  Save,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// ─── Constants ─────────────────────────────────────────────────────────────────

const GRID_START = 8   // 8am
const GRID_END = 21    // 9pm
const GRID_HOURS = GRID_END - GRID_START
const PX_PER_MIN = 1.5 // pixels per minute

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  confirmed:  { bg: 'bg-green-50',  border: 'border-green-400',  text: 'text-green-800',  badge: 'bg-green-100 text-green-700 border-green-300' },
  pending:    { bg: 'bg-yellow-50', border: 'border-yellow-400', text: 'text-yellow-800', badge: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  completed:  { bg: 'bg-blue-50',   border: 'border-blue-400',   text: 'text-blue-800',   badge: 'bg-blue-100 text-blue-700 border-blue-300' },
  cancelled:  { bg: 'bg-red-50',    border: 'border-red-400',    text: 'text-red-800',    badge: 'bg-red-100 text-red-700 border-red-300' },
  no_show:    { bg: 'bg-gray-50',   border: 'border-gray-400',   text: 'text-gray-700',   badge: 'bg-gray-100 text-gray-600 border-gray-300' },
}

// ─── Types ─────────────────────────────────────────────────────────────────────

type ApptRow = {
  id: string
  client_name: string
  client_phone?: string
  appointment_date: string
  appointment_time: string
  status: AppointmentStatus
  payment_status: 'unpaid' | 'paid'
  discount_amount: number
  notes?: string
  services: Pick<Service, 'id' | 'name' | 'price' | 'duration'> | null
  staff: Pick<StaffMember, 'id' | 'name'> | null
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { role, ownerId, staffId } = useUserContext()

  const [view, setView] = useState<'day' | 'week'>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [appointments, setAppointments] = useState<ApptRow[]>([])
  const [staffList, setStaffList] = useState<Pick<StaffMember, 'id' | 'name'>[]>([])
  const [services, setServices] = useState<Pick<Service, 'id' | 'name' | 'price' | 'duration'>[]>([])
  const [staffFilter, setStaffFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ApptRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Edit form state
  const [editForm, setEditForm] = useState({
    client_name: '',
    client_phone: '',
    appointment_date: '',
    appointment_time: '',
    status: 'pending' as AppointmentStatus,
    service_id: '',
    staff_id: '',
    notes: '',
  })

  // Visible days
  const days = useMemo(() => {
    if (view === 'day') return [currentDate]
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  }, [view, currentDate])

  // Date range for query
  const dateRange = useMemo(() => {
    const first = days[0]
    const last = days[days.length - 1]
    return { from: format(first, 'yyyy-MM-dd'), to: format(last, 'yyyy-MM-dd') }
  }, [days])

  const loadData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [apptRes, staffRes, svcRes] = await Promise.all([
      supabase
        .from('appointments')
        .select('id, client_name, client_phone, appointment_date, appointment_time, status, payment_status, discount_amount, notes, services(id, name, price, duration), staff(id, name)')
        .eq('user_id', ownerId)
        .gte('appointment_date', dateRange.from)
        .lte('appointment_date', dateRange.to)
        .order('appointment_time'),
      supabase.from('staff').select('id, name').eq('user_id', ownerId).order('name'),
      supabase.from('services').select('id, name, price, duration').eq('user_id', ownerId).order('name'),
    ])
    setAppointments((apptRes.data as unknown as ApptRow[]) ?? [])
    setStaffList((staffRes.data ?? []) as Pick<StaffMember, 'id' | 'name'>[])
    setServices((svcRes.data ?? []) as Pick<Service, 'id' | 'name' | 'price' | 'duration'>[])
    setLoading(false)
  }, [ownerId, dateRange])

  useEffect(() => { loadData() }, [loadData])

  // Staff-filtered appointments
  const filteredAppts = useMemo(() => {
    let list = appointments
    if (role === 'staff' && staffId) {
      list = list.filter((a) => a.staff?.id === staffId)
    } else if (staffFilter !== 'all') {
      list = list.filter((a) => a.staff?.id === staffFilter)
    }
    return list
  }, [appointments, staffFilter, role, staffId])

  function getApptsByDay(day: Date) {
    const dateStr = format(day, 'yyyy-MM-dd')
    return filteredAppts.filter((a) => a.appointment_date === dateStr)
  }

  function timeToMinutes(time: string) {
    const [h, m] = time.split(':').map(Number)
    return h * 60 + m
  }

  function navigate(dir: -1 | 1) {
    if (view === 'day') setCurrentDate((d) => (dir === 1 ? addDays(d, 1) : subDays(d, 1)))
    else setCurrentDate((d) => (dir === 1 ? addDays(d, 7) : subDays(d, -7)))
  }

  function openAppt(appt: ApptRow) {
    setSelected(appt)
    setEditForm({
      client_name: appt.client_name,
      client_phone: appt.client_phone ?? '',
      appointment_date: appt.appointment_date,
      appointment_time: appt.appointment_time.slice(0, 5),
      status: appt.status,
      service_id: appt.services?.id ?? '',
      staff_id: appt.staff?.id ?? '',
      notes: appt.notes ?? '',
    })
  }

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('appointments')
      .update({
        client_name: editForm.client_name,
        client_phone: editForm.client_phone || null,
        appointment_date: editForm.appointment_date,
        appointment_time: editForm.appointment_time,
        status: editForm.status,
        service_id: editForm.service_id || null,
        staff_id: editForm.staff_id || null,
        notes: editForm.notes || null,
      })
      .eq('id', selected.id)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Appointment updated')
      setSelected(null)
      await loadData()
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!selected || !confirm('Delete this appointment?')) return
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from('appointments').delete().eq('id', selected.id)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Appointment deleted')
      setSelected(null)
      await loadData()
    }
    setDeleting(false)
  }

  const gridHeight = GRID_HOURS * 60 * PX_PER_MIN

  const headerLabel =
    view === 'day'
      ? format(currentDate, 'EEEE, MMMM d, yyyy')
      : `${format(days[0], 'MMM d')} – ${format(days[days.length - 1], 'MMM d, yyyy')}`

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-primary" />
            Calendar
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{headerLabel}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Staff filter */}
          {role !== 'staff' && staffList.length > 0 && (
            <select
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">All Staff</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}

          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-white">
            {(['day', 'week'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-1.5 text-sm font-medium transition-colors capitalize ${
                  view === v ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="px-2">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(1)} className="px-2">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Status Legend ── */}
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.entries(STATUS_COLORS).map(([status, c]) => (
          <span key={status} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${c.badge}`}>
            <span className={`w-2 h-2 rounded-full border ${c.border}`} style={{ backgroundColor: '' }} />
            {status.replace('_', ' ')}
          </span>
        ))}
      </div>

      {/* ── Calendar Grid ── */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : (
        <Card className="border-gray-100 overflow-hidden">
          <div className="flex overflow-x-auto">
            {/* Time column */}
            <div className="flex-shrink-0 w-14 border-r border-gray-100 bg-gray-50">
              <div className="h-10 border-b border-gray-100" /> {/* header spacer */}
              <div className="relative" style={{ height: gridHeight }}>
                {Array.from({ length: GRID_HOURS }, (_, i) => {
                  const hour = GRID_START + i
                  return (
                    <div
                      key={hour}
                      className="absolute w-full flex items-start pl-1 pr-1"
                      style={{ top: i * 60 * PX_PER_MIN }}
                    >
                      <span className="text-[10px] text-gray-400 -mt-1.5 leading-none">
                        {hour === 12 ? '12pm' : hour > 12 ? `${hour - 12}pm` : `${hour}am`}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Day columns */}
            <div className={`flex flex-1 min-w-0 ${view === 'week' ? '' : ''}`}>
              {days.map((day) => {
                const dayAppts = getApptsByDay(day)
                const isToday = isSameDay(day, new Date())
                return (
                  <div
                    key={day.toISOString()}
                    className={`flex-1 min-w-[120px] border-r border-gray-100 last:border-r-0 ${view === 'week' ? '' : 'max-w-full'}`}
                  >
                    {/* Day header */}
                    <div className={`h-10 border-b border-gray-100 flex flex-col items-center justify-center sticky top-0 z-10 ${isToday ? 'bg-primary/5' : 'bg-white'}`}>
                      <span className="text-[10px] text-gray-400 uppercase tracking-wide">{format(day, 'EEE')}</span>
                      <span className={`text-sm font-bold leading-none ${isToday ? 'text-primary' : 'text-gray-800'}`}>
                        {format(day, 'd')}
                      </span>
                    </div>

                    {/* Time grid */}
                    <div className="relative" style={{ height: gridHeight }}>
                      {/* Hour lines */}
                      {Array.from({ length: GRID_HOURS }, (_, i) => (
                        <div
                          key={i}
                          className="absolute w-full border-t border-gray-100"
                          style={{ top: i * 60 * PX_PER_MIN }}
                        />
                      ))}

                      {/* Appointment blocks */}
                      {dayAppts.map((appt) => {
                        const startMin = timeToMinutes(appt.appointment_time)
                        const duration = appt.services?.duration ?? 30
                        const top = (startMin - GRID_START * 60) * PX_PER_MIN
                        const height = Math.max(duration * PX_PER_MIN, 28)
                        const c = STATUS_COLORS[appt.status] ?? STATUS_COLORS.pending

                        if (startMin < GRID_START * 60 || startMin >= GRID_END * 60) return null

                        return (
                          <button
                            key={appt.id}
                            onClick={() => openAppt(appt)}
                            className={`absolute inset-x-0.5 rounded-md border-l-2 ${c.bg} ${c.border} ${c.text} px-1.5 py-1 text-left overflow-hidden hover:brightness-95 transition-all shadow-sm`}
                            style={{ top, height }}
                          >
                            <p className="text-[10px] font-bold leading-tight truncate">{appt.client_name}</p>
                            {height > 36 && (
                              <p className="text-[9px] leading-tight truncate opacity-80">{appt.services?.name}</p>
                            )}
                            {height > 50 && (
                              <p className="text-[9px] leading-tight truncate opacity-70">{appt.staff?.name}</p>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>
      )}

      {/* ── Appointment Edit Modal ── */}
      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              Edit Appointment
            </DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Client Name</Label>
                <Input
                  value={editForm.client_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, client_name: e.target.value }))}
                  disabled={!canEdit(role)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input
                  value={editForm.client_phone}
                  onChange={(e) => setEditForm((f) => ({ ...f, client_phone: e.target.value }))}
                  disabled={!canEdit(role)}
                  className="h-9"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={editForm.appointment_date}
                    onChange={(e) => setEditForm((f) => ({ ...f, appointment_date: e.target.value }))}
                    disabled={!canEdit(role)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Time</Label>
                  <Input
                    type="time"
                    value={editForm.appointment_time}
                    onChange={(e) => setEditForm((f) => ({ ...f, appointment_time: e.target.value }))}
                    disabled={!canEdit(role)}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, status: (v ?? 'pending') as AppointmentStatus }))}
                  disabled={!canEdit(role)}
                >
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['pending', 'confirmed', 'completed', 'cancelled', 'no_show'] as AppointmentStatus[]).map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Service</Label>
                <Select
                  value={editForm.service_id}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, service_id: v ?? '' }))}
                  disabled={!canEdit(role)}
                >
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select service" /></SelectTrigger>
                  <SelectContent>
                    {services.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Staff</Label>
                <Select
                  value={editForm.staff_id}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, staff_id: v ?? '' }))}
                  disabled={!canEdit(role)}
                >
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select staff" /></SelectTrigger>
                  <SelectContent>
                    {staffList.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Input
                  value={editForm.notes}
                  onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                  disabled={!canEdit(role)}
                  placeholder="Optional notes..."
                  className="h-9"
                />
              </div>

              {/* Status badge */}
              <div className="flex items-center gap-2">
                <Badge className={`text-xs border ${STATUS_COLORS[selected.status]?.badge}`}>
                  {selected.status.replace('_', ' ')}
                </Badge>
                <Badge className={`text-xs border ${selected.payment_status === 'paid' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                  {selected.payment_status}
                </Badge>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 flex-wrap">
            {canDelete(role) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
                className="text-red-500 hover:text-red-600 hover:bg-red-50 mr-auto"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setSelected(null)}>
              <X className="w-3.5 h-3.5 mr-1" />
              Cancel
            </Button>
            {canEdit(role) && (
              <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                Save
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

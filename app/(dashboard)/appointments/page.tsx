'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { Appointment, Service, StaffMember, AppointmentStatus, Branch } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import {
  CalendarDays,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Clock,
  User,
  Scissors,
  Users,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Building2,
} from 'lucide-react'

type AppointmentRow = Appointment & {
  services?: { id: string; name: string; price: number } | null
  staff?: { id: string; name: string } | null
}

const statusConfig: Record<AppointmentStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  confirmed: { label: 'Confirmed', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  completed: { label: 'Completed', className: 'bg-green-50 text-green-700 border-green-200' },
  cancelled: { label: 'Cancelled', className: 'bg-red-50 text-red-700 border-red-200' },
}

const emptyForm = {
  client_name: '',
  client_phone: '',
  service_id: '',
  staff_id: '',
  branch_id: '',
  appointment_date: format(new Date(), 'yyyy-MM-dd'),
  appointment_time: '10:00',
  status: 'pending' as AppointmentStatus,
  notes: '',
}

function whatsappUrl(phone: string, clientName: string, date: string, time: string) {
  const digits = phone.replace(/\D/g, '')
  const wa = digits.startsWith('0') ? '92' + digits.slice(1) : digits.startsWith('92') ? digits : '92' + digits
  const d = format(new Date(date + 'T00:00:00'), 'EEEE, MMMM d')
  const t = time.slice(0, 5)
  const msg = `Assalamu Alaikum ${clientName}! Aapki appointment ${d} ko ${t} baje hai. Aapka intezaar hai. Shukriya! 🌸`
  return `https://wa.me/${wa}?text=${encodeURIComponent(msg)}`
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<AppointmentRow[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [filterDate, setFilterDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [filterAll, setFilterAll] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [apptRes, serviceRes, staffRes, branchRes] = await Promise.all([
      supabase
        .from('appointments')
        .select('*, services(id, name, price), staff(id, name)')
        .eq('user_id', user.id)
        .order('appointment_date', { ascending: false })
        .order('appointment_time', { ascending: true }),
      supabase.from('services').select('*').eq('user_id', user.id).order('name'),
      supabase.from('staff').select('*').eq('user_id', user.id).order('name'),
      supabase.from('branches').select('*').eq('user_id', user.id).order('name'),
    ])

    setAppointments((apptRes.data as AppointmentRow[]) ?? [])
    setServices(serviceRes.data ?? [])
    setStaff(staffRes.data ?? [])
    setBranches((branchRes.data as Branch[]) ?? [])
    setLoading(false)
  }

  const filtered = filterAll
    ? appointments
    : appointments.filter((a) => a.appointment_date === filterDate)

  function openCreate() {
    setEditingId(null)
    setForm({ ...emptyForm, appointment_date: filterDate })
    setDialogOpen(true)
  }

  function openEdit(appt: AppointmentRow) {
    setEditingId(appt.id)
    setForm({
      client_name: appt.client_name,
      client_phone: appt.client_phone ?? '',
      service_id: appt.service_id ?? '',
      staff_id: appt.staff_id ?? '',
      branch_id: appt.branch_id ?? '',
      appointment_date: appt.appointment_date,
      appointment_time: appt.appointment_time.slice(0, 5),
      status: appt.status,
      notes: appt.notes ?? '',
    })
    setDialogOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.client_name.trim() || !form.appointment_date || !form.appointment_time) {
      toast.error('Please fill required fields')
      return
    }
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const payload = {
      client_name: form.client_name.trim(),
      client_phone: form.client_phone.trim() || null,
      service_id: form.service_id || null,
      staff_id: form.staff_id || null,
      branch_id: form.branch_id || null,
      appointment_date: form.appointment_date,
      appointment_time: form.appointment_time,
      status: form.status,
      notes: form.notes.trim() || null,
      user_id: user.id,
    }

    if (editingId) {
      const { error } = await supabase.from('appointments').update(payload).eq('id', editingId)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Appointment updated')
    } else {
      const { error } = await supabase.from('appointments').insert(payload)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Appointment booked')
    }

    setDialogOpen(false)
    await loadData()
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this appointment?')) return
    setDeleting(id)
    const supabase = createClient()
    const { error } = await supabase.from('appointments').delete().eq('id', id)
    if (error) { toast.error(error.message) } else { toast.success('Appointment deleted') }
    await loadData()
    setDeleting(null)
  }

  async function updateStatus(id: string, status: AppointmentStatus) {
    const supabase = createClient()
    const { error } = await supabase.from('appointments').update({ status }).eq('id', id)
    if (error) { toast.error(error.message) } else {
      toast.success(`Marked as ${status}`)
      await loadData()
    }
  }

  function shiftDate(days: number) {
    const d = new Date(filterDate)
    d.setDate(d.getDate() + days)
    setFilterDate(format(d, 'yyyy-MM-dd'))
    setFilterAll(false)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-primary" />
            Appointments
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            <span className="font-urdu">اپائنٹمنٹ مینجمنٹ</span> — Book and manage client appointments
          </p>
        </div>
        <Button onClick={openCreate} className="bg-primary hover:bg-primary/90 gap-2">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Appointment</span>
          <span className="sm:hidden">New</span>
        </Button>
      </div>

      {/* Date Filter */}
      <div className="flex items-center gap-2 mb-6 bg-white rounded-xl p-3 border border-gray-100 shadow-sm flex-wrap">
        <button
          onClick={() => shiftDate(-1)}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <input
          type="date"
          value={filterDate}
          onChange={(e) => { setFilterDate(e.target.value); setFilterAll(false) }}
          className="text-sm font-medium text-gray-700 border-0 outline-none bg-transparent cursor-pointer"
        />
        <button
          onClick={() => shiftDate(1)}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => { setFilterDate(format(new Date(), 'yyyy-MM-dd')); setFilterAll(false) }}
          className="text-xs text-primary hover:underline px-2 py-1 rounded hover:bg-primary/5"
        >
          Today
        </button>
        <button
          onClick={() => setFilterAll(true)}
          className={`text-xs px-2 py-1 rounded transition-colors ${filterAll ? 'bg-primary/10 text-primary font-medium' : 'text-gray-500 hover:bg-gray-100'}`}
        >
          All
        </button>
        <div className="ml-auto">
          <Badge className="bg-primary/10 text-primary border-primary/20">
            {filtered.length} appointment{filtered.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </div>

      {/* Appointments List */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CalendarDays className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No appointments</h3>
          <p className="text-gray-500 text-sm mb-2">
            <span className="font-urdu">کوئی اپائنٹمنٹ نہیں</span>
          </p>
          <p className="text-gray-400 text-sm mb-6">
            {filterAll ? 'Book your first appointment to get started' : `No appointments for ${format(new Date(filterDate + 'T00:00:00'), 'MMMM d')}`}
          </p>
          <Button onClick={openCreate} className="bg-primary hover:bg-primary/90 gap-2">
            <Plus className="w-4 h-4" /> Book Appointment
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((appt) => {
            const sc = statusConfig[appt.status] ?? statusConfig.pending
            return (
              <div
                key={appt.id}
                className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-all group"
              >
                <div className="flex items-start gap-3">
                  {/* Time */}
                  <div className="flex-shrink-0 w-14 text-center">
                    <div className="text-sm font-bold text-gray-900">{appt.appointment_time.slice(0, 5)}</div>
                    {filterAll && (
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        {format(new Date(appt.appointment_date + 'T00:00:00'), 'MMM d')}
                      </div>
                    )}
                  </div>

                  <div className="w-px h-12 bg-gray-100 flex-shrink-0" />

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <span className="font-semibold text-gray-900 text-sm">{appt.client_name}</span>
                          <Badge className={`text-xs border ${sc.className}`}>{sc.label}</Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {appt.services && (
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <Scissors className="w-3 h-3 text-gray-400" />
                              <span>{appt.services.name}</span>
                              <span className="text-primary font-medium">PKR {appt.services.price?.toLocaleString()}</span>
                            </div>
                          )}
                          {appt.staff && (
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <Users className="w-3 h-3 text-gray-400" />
                              <span>{appt.staff.name}</span>
                            </div>
                          )}
                          {appt.notes && (
                            <div className="flex items-center gap-1 text-xs text-gray-400 italic">
                              <span>&quot;{appt.notes}&quot;</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {/* WhatsApp reminder */}
                        {appt.client_phone && (
                          <a
                            href={whatsappUrl(appt.client_phone, appt.client_name, appt.appointment_date, appt.appointment_time)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                            title="Send WhatsApp reminder"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                        )}

                        {/* Quick status buttons */}
                        <div className="hidden sm:flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {appt.status !== 'completed' && (
                            <button
                              onClick={() => updateStatus(appt.id, 'completed')}
                              className="text-[10px] px-2 py-1 rounded-md bg-green-50 text-green-600 hover:bg-green-100 transition-colors font-medium"
                            >
                              ✓ Done
                            </button>
                          )}
                          {appt.status === 'pending' && (
                            <button
                              onClick={() => updateStatus(appt.id, 'confirmed')}
                              className="text-[10px] px-2 py-1 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors font-medium"
                            >
                              Confirm
                            </button>
                          )}
                        </div>
                        <button
                          onClick={() => openEdit(appt)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-primary transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(appt.id)}
                          disabled={deleting === appt.id}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          {deleting === appt.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              {editingId ? 'Edit Appointment' : 'New Appointment'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4">
            {/* Client Name */}
            <div className="space-y-1.5">
              <Label htmlFor="clientName">Client Name *</Label>
              <Input
                id="clientName"
                placeholder="e.g. Fatima Ahmed"
                value={form.client_name}
                onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                required
                className="h-9"
              />
            </div>

            {/* Client Phone (WhatsApp) */}
            <div className="space-y-1.5">
              <Label htmlFor="clientPhone">
                WhatsApp Number
                <span className="ml-1 text-xs text-gray-400 font-normal">(optional — for reminders)</span>
              </Label>
              <div className="relative">
                <MessageCircle className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-green-500 pointer-events-none" />
                <Input
                  id="clientPhone"
                  placeholder="03001234567"
                  value={form.client_phone}
                  onChange={(e) => setForm({ ...form, client_phone: e.target.value })}
                  className="h-9 pl-8"
                />
              </div>
            </div>

            {/* Service */}
            <div className="space-y-1.5">
              <Label>Service</Label>
              <Select
                value={form.service_id}
                onValueChange={(v) => setForm({ ...form, service_id: v ?? '' })}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Select a service" />
                </SelectTrigger>
                <SelectContent>
                  {services.length === 0 ? (
                    <SelectItem value="none" disabled>No services — add some first</SelectItem>
                  ) : (
                    services.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} — PKR {s.price.toLocaleString()}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Staff */}
            <div className="space-y-1.5">
              <Label>Staff Member</Label>
              <Select
                value={form.staff_id}
                onValueChange={(v) => setForm({ ...form, staff_id: v ?? '' })}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Assign to staff" />
                </SelectTrigger>
                <SelectContent>
                  {staff.length === 0 ? (
                    <SelectItem value="none" disabled>No staff — add some first</SelectItem>
                  ) : (
                    staff.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Branch (only shown if branches exist) */}
            {branches.length > 0 && (
              <div className="space-y-1.5">
                <Label>Branch</Label>
                <Select
                  value={form.branch_id}
                  onValueChange={(v) => setForm({ ...form, branch_id: v ?? '' })}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-gray-400" />
                          {b.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="apptDate">Date *</Label>
                <div className="relative">
                  <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  <input
                    id="apptDate"
                    type="date"
                    value={form.appointment_date}
                    onChange={(e) => setForm({ ...form, appointment_date: e.target.value })}
                    required
                    className="h-9 w-full rounded-lg border border-input bg-transparent pl-8 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="apptTime">Time *</Label>
                <div className="relative">
                  <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  <input
                    id="apptTime"
                    type="time"
                    value={form.appointment_time}
                    onChange={(e) => setForm({ ...form, appointment_time: e.target.value })}
                    required
                    className="h-9 w-full rounded-lg border border-input bg-transparent pl-8 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                  />
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: (v ?? 'pending') as AppointmentStatus })}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Input
                id="notes"
                placeholder="Any special instructions..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="h-9"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} size="sm">
                Cancel
              </Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90" size="sm" disabled={saving}>
                {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                {editingId ? 'Update' : 'Book Appointment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

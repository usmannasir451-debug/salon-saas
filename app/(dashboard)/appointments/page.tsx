'use client'

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUserContext } from '@/components/RoleContext'
import { canCreate, canEdit, canDelete } from '@/lib/roles'
import type { Appointment, Service, StaffMember, AppointmentStatus, Branch } from '@/lib/types'
import FeedbackModal from '@/components/FeedbackModal'
import InvoiceModal, { type InvoiceData } from '@/components/InvoiceModal'
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
  MessageSquare,
  Lock,
  FileText,
  X,
  Crown,
  Star,
  Zap,
} from 'lucide-react'

type ServiceRef = { id: string; name: string; price: number; duration: number }

type DealItem = {
  id: string
  name: string
  description: string | null
  price: number
  is_active: boolean
  deal_services: { services: ServiceRef | null }[]
}

type AppointmentRow = Appointment & {
  services?: { id: string; name: string; price: number } | null
  staff?: { id: string; name: string } | null
  appointment_services?: { services: ServiceRef }[]
}

const statusConfig: Record<AppointmentStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  confirmed: { label: 'Confirmed', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  completed: { label: 'Completed', className: 'bg-green-50 text-green-700 border-green-200' },
  cancelled: { label: 'Cancelled', className: 'bg-red-50 text-red-700 border-red-200' },
  no_show: { label: 'No Show', className: 'bg-gray-50 text-gray-600 border-gray-200' },
}

const emptyForm = {
  client_name: '',
  client_phone: '',
  service_ids: [] as string[],
  deal_id: '',
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
  const msg = `Hello ${clientName}! Your appointment is on ${d} at ${t}. We look forward to seeing you. Thank you! 🌸`
  return `https://wa.me/${wa}?text=${encodeURIComponent(msg)}`
}

function getAppointmentServices(appt: AppointmentRow, allServices: ServiceRef[]): ServiceRef[] {
  if (appt.appointment_services && appt.appointment_services.length > 0) {
    return appt.appointment_services.map(as => as.services).filter(Boolean) as ServiceRef[]
  }
  if (appt.service_id) {
    const svc = allServices.find(s => s.id === appt.service_id)
    return svc ? [svc] : []
  }
  return []
}

function getServicesTotal(svcs: ServiceRef[]): number {
  return svcs.reduce((sum, s) => sum + Number(s.price), 0)
}

export default function AppointmentsPage() {
  const { role, ownerId, staffId } = useUserContext()
  const router = useRouter()
  const isStaffRole = role === 'staff'

  const [appointments, setAppointments] = useState<AppointmentRow[]>([])
  const [services, setServices] = useState<ServiceRef[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [deals, setDeals] = useState<DealItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [filterDate, setFilterDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [filterAll, setFilterAll] = useState(false)

  const [feedbackAppt, setFeedbackAppt] = useState<AppointmentRow | null>(null)
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null)
  const [salonName, setSalonName] = useState('')
  const [salonAddress, setSalonAddress] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [taxPercentage, setTaxPercentage] = useState(0)

  type PhoneClientInfo = {
    name: string
    totalVisits: number
    loyaltyPoints: number
    activeMembership: string | null
  }
  const [phoneClientInfo, setPhoneClientInfo] = useState<PhoneClientInfo | null>(null)
  const [phoneSearching, setPhoneSearching] = useState(false)
  const phoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const lookupPhone = useCallback(async (phone: string) => {
    if (phone.replace(/\D/g, '').length < 7) { setPhoneClientInfo(null); return }
    setPhoneSearching(true)
    const supabase = createClient()
    const [clientRes, loyaltyRes, membershipRes] = await Promise.all([
      supabase.from('appointments').select('client_name').eq('user_id', ownerId).eq('client_phone', phone).limit(1).maybeSingle(),
      supabase.from('loyalty_transactions').select('points, type').eq('user_id', ownerId).eq('client_phone', phone),
      supabase.from('client_memberships').select('membership_plans(name)').eq('user_id', ownerId).eq('client_phone', phone).eq('status', 'active').limit(1).maybeSingle(),
    ])
    if (!clientRes.data) { setPhoneClientInfo(null); setPhoneSearching(false); return }
    const allAppts = await supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('user_id', ownerId).eq('client_phone', phone)
    const pts = (loyaltyRes.data ?? []).reduce((sum, t) => t.type === 'earn' ? sum + t.points : sum - t.points, 0)
    const mem = membershipRes.data?.membership_plans as { name?: string } | null
    setPhoneClientInfo({
      name: clientRes.data.client_name,
      totalVisits: allAppts.count ?? 0,
      loyaltyPoints: Math.max(0, pts),
      activeMembership: mem?.name ?? null,
    })
    setPhoneSearching(false)
  }, [ownerId])

  function handlePhoneChange(phone: string) {
    setForm(f => ({ ...f, client_phone: phone }))
    setPhoneClientInfo(null)
    if (phoneTimerRef.current) clearTimeout(phoneTimerRef.current)
    phoneTimerRef.current = setTimeout(() => { void lookupPhone(phone) }, 500)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData() }, [])

  async function loadData() {
    const supabase = createClient()
    const today = format(new Date(), 'yyyy-MM-dd')

    let apptQuery = supabase
      .from('appointments')
      .select('*, services(id, name, price, duration), staff(id, name), appointment_services(services(id, name, price, duration))')
      .eq('user_id', ownerId)
      .order('appointment_date', { ascending: false })
      .order('appointment_time', { ascending: true })

    if (isStaffRole && staffId) {
      apptQuery = apptQuery.eq('staff_id', staffId)
    }

    const [apptRes, serviceRes, staffRes, branchRes, profileRes, dealsRes] = await Promise.all([
      apptQuery,
      supabase.from('services').select('id, name, price, duration').eq('user_id', ownerId).order('name'),
      supabase.from('staff').select('*').eq('user_id', ownerId).eq('is_active', true).order('name'),
      supabase.from('branches').select('*').eq('user_id', ownerId).order('name'),
      supabase.from('profiles').select('salon_name, salon_address, salon_currency, tax_percentage').eq('id', ownerId).single(),
      supabase.from('deals').select('id, name, description, price, is_active, deal_services(services(id, name, price, duration))').eq('user_id', ownerId).eq('is_active', true).order('name'),
    ])

    setAppointments((apptRes.data as unknown as AppointmentRow[]) ?? [])
    setServices((serviceRes.data ?? []) as ServiceRef[])
    setStaff(staffRes.data ?? [])
    setBranches((branchRes.data as Branch[]) ?? [])
    setSalonName(profileRes.data?.salon_name ?? '')
    setSalonAddress(profileRes.data?.salon_address ?? '')
    setCurrency(profileRes.data?.salon_currency ?? 'PKR')
    setTaxPercentage(profileRes.data?.tax_percentage ?? 0)
    setDeals((dealsRes.data as unknown as DealItem[]) ?? [])

    if (isStaffRole) {
      setFilterDate(today)
      setFilterAll(false)
    }
    setLoading(false)
  }

  const filtered = isStaffRole
    ? appointments.filter((a) => a.appointment_date === format(new Date(), 'yyyy-MM-dd'))
    : filterAll
    ? appointments
    : appointments.filter((a) => a.appointment_date === filterDate)

  // Computed totals for form
  const selectedServices = useMemo(
    () => services.filter(s => form.service_ids.includes(s.id)),
    [services, form.service_ids]
  )

  const selectedDeal = useMemo(
    () => deals.find(d => d.id === form.deal_id) ?? null,
    [deals, form.deal_id]
  )

  const dealServiceIds = useMemo(
    () => selectedDeal?.deal_services?.map(ds => ds.services?.id).filter(Boolean) as string[] ?? [],
    [selectedDeal]
  )

  const additionalServices = useMemo(
    () => selectedServices.filter(s => !dealServiceIds.includes(s.id)),
    [selectedServices, dealServiceIds]
  )

  const formTotal = selectedDeal
    ? selectedDeal.price + additionalServices.reduce((sum, s) => sum + s.price, 0)
    : selectedServices.reduce((sum, s) => sum + s.price, 0)

  const formDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0)

  function toggleService(id: string) {
    setForm(f => ({
      ...f,
      service_ids: f.service_ids.includes(id)
        ? f.service_ids.filter(sid => sid !== id)
        : [...f.service_ids, id],
    }))
  }

  function openCreate() {
    setEditingId(null)
    const autoBranch = branches.length === 1 ? branches[0].id : ''
    setForm({ ...emptyForm, appointment_date: filterDate, branch_id: autoBranch })
    setPhoneClientInfo(null)
    setDialogOpen(true)
  }

  function openEdit(appt: AppointmentRow) {
    setPhoneClientInfo(null)
    setEditingId(appt.id)
    const existingSvcIds = appt.appointment_services && appt.appointment_services.length > 0
      ? appt.appointment_services.map(as => as.services?.id).filter(Boolean) as string[]
      : appt.service_id ? [appt.service_id] : []
    setForm({
      client_name: appt.client_name,
      client_phone: appt.client_phone ?? '',
      service_ids: existingSvcIds,
      deal_id: (appt as unknown as { deal_id?: string }).deal_id ?? '',
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
    if (!form.client_name.trim()) { toast.error('Client name is required'); return }
    if (!form.client_phone.trim()) { toast.error('Client phone is required'); return }
    if (!form.staff_id) { toast.error('Please select a staff member'); return }
    if (!form.appointment_date || !form.appointment_time) {
      toast.error('Please fill in date and time')
      return
    }
    if (branches.length > 1 && !form.branch_id) {
      toast.error('Please select a branch')
      return
    }
    // Auto-assign single branch
    if (branches.length === 1 && !form.branch_id) {
      setForm(f => ({ ...f, branch_id: branches[0].id }))
    }
    setSaving(true)
    const supabase = createClient()

    // All service IDs = deal's services + additional individual services
    const allServiceIds = form.deal_id && selectedDeal
      ? [...dealServiceIds, ...form.service_ids.filter(id => !dealServiceIds.includes(id))]
      : form.service_ids

    const basePayload = {
      client_name: form.client_name.trim(),
      client_phone: form.client_phone.trim() || null,
      service_id: allServiceIds[0] || null,
      staff_id: form.staff_id || null,
      branch_id: form.branch_id || null,
      appointment_date: form.appointment_date,
      appointment_time: form.appointment_time,
      status: form.status,
      notes: form.notes.trim() || null,
      deal_id: form.deal_id || null,
      user_id: ownerId,
    }

    if (editingId) {
      const { error } = await supabase.from('appointments').update(basePayload).eq('id', editingId)
      if (error) { toast.error(error.message); setSaving(false); return }

      // Refresh junction table
      await supabase.from('appointment_services').delete().eq('appointment_id', editingId)
      if (allServiceIds.length > 0) {
        await supabase.from('appointment_services').insert(
          allServiceIds.map(sid => ({ appointment_id: editingId, service_id: sid, user_id: ownerId }))
        )
      }
      toast.success('Appointment updated')
    } else {
      const payload = { ...basePayload, total_amount: formTotal }
      const { data: newAppt, error } = await supabase.from('appointments').insert(payload).select('id').single()
      if (error) { toast.error(error.message); setSaving(false); return }

      // Insert junction rows
      if (allServiceIds.length > 0 && newAppt) {
        await supabase.from('appointment_services').insert(
          allServiceIds.map(sid => ({ appointment_id: newAppt.id, service_id: sid, user_id: ownerId }))
        )
      }

      toast.success('Appointment booked')
      void Promise.all([
        supabase.from('notifications').insert({
          user_id: ownerId,
          type: 'new_appointment',
          title: 'New Appointment Booked',
          message: `${form.client_name.trim()} — ${form.appointment_date} at ${form.appointment_time.slice(0, 5)}`,
          link: '/appointments',
        }),
        supabase.from('audit_log').insert({
          user_id: ownerId,
          actor_role: role,
          action: 'create_appointment',
          entity_type: 'appointment',
          entity_id: newAppt?.id ?? null,
          details: { client: form.client_name.trim(), date: form.appointment_date, time: form.appointment_time },
        }),
      ])
    }

    setDialogOpen(false)
    await loadData()
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this appointment?')) return
    setDeleting(id)
    const supabase = createClient()
    const apptToDelete = appointments.find((a) => a.id === id)
    const { error } = await supabase.from('appointments').delete().eq('id', id)
    if (error) { toast.error(error.message) } else {
      toast.success('Appointment deleted')
      void supabase.from('audit_log').insert({
        user_id: ownerId,
        actor_role: role,
        action: 'delete_appointment',
        entity_type: 'appointment',
        entity_id: id,
        details: { client: apptToDelete?.client_name ?? null },
      })
    }
    await loadData()
    setDeleting(null)
  }

  async function updateStatus(id: string, status: AppointmentStatus) {
    const supabase = createClient()
    const { error } = await supabase.from('appointments').update({ status }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success(`Marked as ${status}`)

    if (status === 'completed') {
      const appt = appointments.find((a) => a.id === id)
      await Promise.all([
        supabase.from('notifications').insert({
          user_id: ownerId,
          type: 'payment_received',
          title: 'Appointment Completed',
          message: `${appt?.client_name ?? 'Client'} appointment marked as completed`,
          link: '/appointments',
        }),
        supabase.from('audit_log').insert({
          user_id: ownerId,
          actor_role: role,
          action: 'complete_appointment',
          entity_type: 'appointment',
          entity_id: id,
          details: { client: appt?.client_name, status },
        }),
      ])
      if (appt?.staff_id) setFeedbackAppt(appt)
    }
    await loadData()
  }

  function handleCheckIn(appt: AppointmentRow) {
    const apptServices = getAppointmentServices(appt, services)
    const checkInData = {
      client_name: appt.client_name,
      client_phone: appt.client_phone ?? '',
      staff_id: appt.staff_id ?? '',
      branch_id: appt.branch_id ?? '',
      service_ids: apptServices.map(s => s.id),
      appointment_id: appt.id,
    }
    localStorage.setItem('walkin_prefill', JSON.stringify(checkInData))
    router.push('/walkin')
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
            {isStaffRole ? 'My Appointments' : 'Appointments'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isStaffRole ? 'Showing your appointments for today' : role === 'cashier' ? 'Mark payments and collect feedback' : 'Appointment Management'}
          </p>
        </div>
        {canCreate(role) && (
          <Button onClick={openCreate} className="bg-primary hover:bg-primary/90 gap-2">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Appointment</span>
            <span className="sm:hidden">New</span>
          </Button>
        )}
      </div>

      {isStaffRole && (
        <div className="mb-4 p-3 rounded-xl bg-orange-50 border border-orange-200 text-sm text-orange-700 flex items-center gap-2">
          <Lock className="w-4 h-4 flex-shrink-0" />
          <span>Showing today&apos;s appointments assigned to you. Contact your manager to make changes.</span>
        </div>
      )}

      {!isStaffRole && (
        <div className="flex items-center gap-2 mb-6 bg-white rounded-xl p-3 border border-gray-100 shadow-sm flex-wrap">
          <button onClick={() => shiftDate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => { setFilterDate(e.target.value); setFilterAll(false) }}
            className="text-sm font-medium text-gray-700 border-0 outline-none bg-transparent cursor-pointer"
          />
          <button onClick={() => shiftDate(1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
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
      )}

      {isStaffRole && (
        <div className="flex items-center gap-2 mb-4">
          <Badge className="bg-primary/10 text-primary border-primary/20">
            {format(new Date(), 'EEEE, MMMM d')} · {filtered.length} appointment{filtered.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      )}

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
          <p className="text-gray-400 text-sm mb-6">
            {isStaffRole ? 'No appointments assigned to you today' : filterAll ? 'Book your first appointment to get started' : `No appointments for ${format(new Date(filterDate + 'T00:00:00'), 'MMMM d')}`}
          </p>
          {canCreate(role) && (
            <Button onClick={openCreate} className="bg-primary hover:bg-primary/90 gap-2">
              <Plus className="w-4 h-4" /> Book Appointment
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((appt) => {
            const sc = statusConfig[appt.status] ?? statusConfig.pending
            const isPaid = appt.payment_status === 'paid'
            const apptServices = getAppointmentServices(appt, services)
            const serviceTotal = getServicesTotal(apptServices)
            const discountAmt = appt.discount_amount ?? 0
            const netAmount = Math.max(0, serviceTotal - discountAmt)

            return (
              <div key={appt.id} className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-all group">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-14 text-center">
                    <div className="text-sm font-bold text-gray-900">{appt.appointment_time.slice(0, 5)}</div>
                    {(filterAll && !isStaffRole) && (
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        {format(new Date(appt.appointment_date + 'T00:00:00'), 'MMM d')}
                      </div>
                    )}
                  </div>

                  <div className="w-px h-12 bg-gray-100 flex-shrink-0" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <span className="font-semibold text-gray-900 text-sm">{appt.client_name}</span>
                          <Badge className={`text-xs border ${sc.className}`}>{sc.label}</Badge>
                        </div>
                        <div className="flex items-start gap-3 mt-1 flex-wrap">
                          {apptServices.length > 0 && (
                            <div className="flex items-start gap-1 text-xs text-gray-500">
                              <Scissors className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                              <div className="flex flex-wrap gap-1">
                                {apptServices.map(svc => (
                                  <span key={svc.id} className="bg-primary/5 text-primary rounded px-1.5 py-0.5">
                                    {svc.name}
                                  </span>
                                ))}
                                <span className="text-primary font-medium">{currency} {serviceTotal.toLocaleString()}</span>
                              </div>
                            </div>
                          )}
                          {appt.staff && (
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <Users className="w-3 h-3 text-gray-400" />
                              <span>{appt.staff.name}</span>
                            </div>
                          )}
                          {appt.notes && (
                            <div className="flex items-center gap-1 text-xs text-gray-400">
                              <MessageSquare className="w-3 h-3" />
                              <span className="italic truncate max-w-[160px]">{appt.notes}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0 flex-wrap justify-end">
                        {appt.client_phone && (
                          <a
                            href={whatsappUrl(appt.client_phone, appt.client_name, appt.appointment_date, appt.appointment_time)}
                            target="_blank" rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                            title="Send WhatsApp reminder"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                        )}

                        {/* Check In / Bill button for confirmed appointments */}
                        {appt.status === 'confirmed' && canCreate(role) && (
                          <button
                            onClick={() => handleCheckIn(appt)}
                            className="flex items-center gap-1 text-[10px] px-2 py-1.5 rounded-md bg-primary text-white hover:bg-primary/90 transition-colors font-semibold"
                          >
                            <Zap className="w-3 h-3" /> Check In / Bill
                          </button>
                        )}

                        {canEdit(role) && (
                          <div className="hidden sm:flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {appt.status === 'pending' && (
                              <button onClick={() => updateStatus(appt.id, 'confirmed')}
                                className="text-[10px] px-2 py-1 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors font-medium">
                                Confirm
                              </button>
                            )}
                            {['pending', 'confirmed'].includes(appt.status) && (
                              <button onClick={() => updateStatus(appt.id, 'no_show')}
                                className="text-[10px] px-2 py-1 rounded-md bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors font-medium">
                                No Show
                              </button>
                            )}
                          </div>
                        )}

                        {canEdit(role) && (
                          <button onClick={() => openEdit(appt)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-primary transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {appt.status === 'completed' && (
                          <button
                            onClick={() => setInvoiceData({
                              id: appt.id,
                              invoiceType: 'appointment',
                              salonName,
                              salonAddress,
                              clientName: appt.client_name,
                              clientPhone: appt.client_phone ?? undefined,
                              staffName: appt.staff?.name ?? undefined,
                              serviceName: apptServices.map(s => s.name).join(', ') || appt.services?.name,
                              date: appt.appointment_date,
                              time: appt.appointment_time,
                              subtotal: serviceTotal || appt.services?.price || 0,
                              discountAmount: appt.discount_amount ?? 0,
                              taxPercentage,
                              total: Math.max(0, (serviceTotal || appt.services?.price || 0) - (appt.discount_amount ?? 0)),
                              currency,
                            })}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                            title="Invoice"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {canDelete(role) && (
                          <button onClick={() => handleDelete(appt.id)} disabled={deleting === appt.id}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                            {deleting === appt.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        )}
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
      {canCreate(role) && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-primary" />
                {editingId ? 'Edit Appointment' : 'New Appointment'}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSave} className="space-y-4">
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

              <div className="space-y-1.5">
                <Label htmlFor="clientPhone">
                  WhatsApp / Phone Number
                  <span className="ml-1 text-xs text-gray-400 font-normal">(auto-lookup client)</span>
                </Label>
                <div className="relative">
                  <MessageCircle className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-green-500 pointer-events-none" />
                  <Input
                    id="clientPhone"
                    placeholder="03001234567"
                    value={form.client_phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    className="h-9 pl-8"
                  />
                  {phoneSearching && (
                    <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 animate-spin" />
                  )}
                </div>
                {phoneClientInfo && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-semibold text-blue-800">
                        <User className="w-3.5 h-3.5" />
                        {phoneClientInfo.name}
                        <button
                          type="button"
                          onClick={() => setForm(f => ({ ...f, client_name: phoneClientInfo.name }))}
                          className="ml-1 text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded"
                        >
                          Use Name
                        </button>
                      </div>
                      <span className="text-blue-600">{phoneClientInfo.totalVisits} visit{phoneClientInfo.totalVisits !== 1 ? 's' : ''}</span>
                    </div>
                    {phoneClientInfo.loyaltyPoints > 0 && (
                      <div className="flex items-center gap-1 text-amber-700">
                        <Star className="w-3 h-3" />
                        {phoneClientInfo.loyaltyPoints} loyalty pts
                      </div>
                    )}
                    {phoneClientInfo.activeMembership && (
                      <div className="flex items-center gap-1 text-purple-700">
                        <Crown className="w-3 h-3" />
                        Active: {phoneClientInfo.activeMembership}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Deal selection */}
              {deals.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Deal / Package <span className="text-gray-400 font-normal text-xs">(optional)</span></Label>
                  <Select
                    value={form.deal_id}
                    onValueChange={(v) => {
                      if (!v || v === 'none') { setForm({ ...form, deal_id: '', service_ids: [] }); return }
                      const deal = deals.find(d => d.id === v)
                      const dealSvcIds = deal?.deal_services?.map(ds => ds.services?.id).filter(Boolean) as string[] ?? []
                      setForm({ ...form, deal_id: v, service_ids: dealSvcIds })
                    }}
                  >
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue placeholder="Select a deal (optional)">
                        {form.deal_id ? (deals.find(d => d.id === form.deal_id)?.name ?? undefined) : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No deal</SelectItem>
                      {deals.map(d => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name} — {currency} {Number(d.price).toLocaleString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.deal_id && selectedDeal && (
                    <div className="bg-primary/5 rounded-lg px-3 py-2 text-xs text-primary">
                      Deal includes: {selectedDeal.deal_services.map(ds => ds.services?.name).filter(Boolean).join(', ')} · {currency} {Number(selectedDeal.price).toLocaleString()}
                      <button type="button" className="ml-2 text-gray-400 hover:text-red-500" onClick={() => setForm({ ...form, deal_id: '', service_ids: [] })}>✕ Remove</button>
                    </div>
                  )}
                </div>
              )}

              {/* Multi-service selection */}
              <div className="space-y-1.5">
                <Label>{deals.length > 0 && form.deal_id ? 'Extra Services' : 'Services'}</Label>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2 max-h-48 overflow-y-auto">
                  {services.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-2">No services — add some in Services page</p>
                  ) : (
                    services.map((s) => {
                      const selected = form.service_ids.includes(s.id)
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => toggleService(s.id)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
                            selected
                              ? 'bg-primary text-white shadow-sm'
                              : 'bg-white border border-gray-200 text-gray-700 hover:border-primary/40'
                          }`}
                        >
                          <span className="font-medium truncate">{s.name}</span>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            <span className="text-xs opacity-75">{s.duration}min</span>
                            <span className="font-semibold">{currency} {s.price.toLocaleString()}</span>
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
                {form.service_ids.length > 0 && (
                  <div className="flex items-center justify-between text-xs bg-primary/5 rounded-lg px-3 py-2">
                    <span className="text-gray-600">{form.service_ids.length} service(s) · {formDuration} min total</span>
                    <span className="font-bold text-primary">{currency} {formTotal.toLocaleString()}</span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Staff Member</Label>
                <Select
                  value={form.staff_id}
                  onValueChange={(v) => setForm({ ...form, staff_id: v ?? '' })}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Assign to staff">
                      {form.staff_id ? (staff.find(s => s.id === form.staff_id)?.name ?? undefined) : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {staff.length === 0 ? (
                      <SelectItem value="none" disabled>No active staff</SelectItem>
                    ) : (
                      staff.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {branches.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Branch{branches.length > 1 ? ' *' : ''}</Label>
                  <Select
                    value={form.branch_id}
                    onValueChange={(v) => setForm({ ...form, branch_id: v ?? '' })}
                  >
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue placeholder="Select branch">
                        {form.branch_id ? (branches.find(b => b.id === form.branch_id)?.name ?? undefined) : undefined}
                      </SelectValue>
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
                    <SelectItem value="no_show">No Show</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

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
      )}

      <FeedbackModal
        open={!!feedbackAppt}
        onClose={() => setFeedbackAppt(null)}
        ownerId={ownerId}
        staffId={feedbackAppt?.staff_id ?? null}
        staffName={feedbackAppt?.staff?.name ?? 'Staff'}
        clientName={feedbackAppt?.client_name ?? ''}
        appointmentId={feedbackAppt?.id}
      />

      <InvoiceModal open={!!invoiceData} onClose={() => setInvoiceData(null)} data={invoiceData} />

      {/* Floating Walk-In button */}
      <a
        href="/walkin"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-primary text-white px-4 py-3 rounded-full shadow-lg hover:bg-primary/90 transition-all hover:scale-105 font-medium text-sm"
      >
        <X className="w-4 h-4 rotate-45" />
        <span className="hidden sm:inline">New Walk-In</span>
      </a>
    </div>
  )
}

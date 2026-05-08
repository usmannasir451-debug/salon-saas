'use client'

import { useEffect, useState, useMemo } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useUserContext } from '@/components/RoleContext'
import { canCreate, canEdit, canDelete, canMarkPayment } from '@/lib/roles'
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
  CreditCard,
  MessageSquare,
  Lock,
  FileText,
  X,
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

type PaymentMethodConfig = { value: string; label: string; enabled: boolean }

type AppointmentRow = Appointment & {
  services?: { id: string; name: string; price: number } | null
  staff?: { id: string; name: string } | null
  appointment_services?: { services: ServiceRef }[]
}

const DEFAULT_PAYMENT_METHODS: PaymentMethodConfig[] = [
  { value: 'cash', label: 'Cash', enabled: true },
  { value: 'card', label: 'Card', enabled: true },
  { value: 'easypaisa', label: 'EasyPaisa', enabled: true },
  { value: 'jazzcash', label: 'JazzCash', enabled: true },
]

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
  const msg = `Assalamu Alaikum ${clientName}! Aapki appointment ${d} ko ${t} baje hai. Aapka intezaar hai. Shukriya! 🌸`
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
  const isStaffRole = role === 'staff'

  const [appointments, setAppointments] = useState<AppointmentRow[]>([])
  const [services, setServices] = useState<ServiceRef[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [deals, setDeals] = useState<DealItem[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodConfig[]>(DEFAULT_PAYMENT_METHODS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [filterDate, setFilterDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [filterAll, setFilterAll] = useState(false)

  const [payDialog, setPayDialog] = useState<{ open: boolean; appt: AppointmentRow | null }>({ open: false, appt: null })
  const [payForm, setPayForm] = useState({ discount: '', payment_method: 'cash', feedback: '' })
  const [paying, setPaying] = useState(false)

  const [feedbackAppt, setFeedbackAppt] = useState<AppointmentRow | null>(null)
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null)
  const [salonName, setSalonName] = useState('')
  const [salonAddress, setSalonAddress] = useState('')
  const [currency, setCurrency] = useState('PKR')
  const [taxPercentage, setTaxPercentage] = useState(0)

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
      supabase.from('profiles').select('salon_name, salon_address, salon_currency, tax_percentage, payment_methods').eq('id', ownerId).single(),
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
    const pm = profileRes.data?.payment_methods
    if (pm && Array.isArray(pm) && pm.length > 0) setPaymentMethods(pm as PaymentMethodConfig[])
    else setPaymentMethods(DEFAULT_PAYMENT_METHODS)

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
    setForm({ ...emptyForm, appointment_date: filterDate })
    setDialogOpen(true)
  }

  function openEdit(appt: AppointmentRow) {
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
    if (!form.client_name.trim() || !form.appointment_date || !form.appointment_time) {
      toast.error('Please fill required fields')
      return
    }
    setSaving(true)
    const supabase = createClient()

    // All service IDs = deal's services + additional individual services
    const allServiceIds = form.deal_id && selectedDeal
      ? [...dealServiceIds, ...form.service_ids.filter(id => !dealServiceIds.includes(id))]
      : form.service_ids

    const payload = {
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
      const { error } = await supabase.from('appointments').update(payload).eq('id', editingId)
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

  async function handleMarkPaid(e: React.FormEvent) {
    e.preventDefault()
    if (!payDialog.appt) return
    setPaying(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('appointments')
      .update({
        payment_status: 'paid',
        payment_method: payForm.payment_method,
        discount_amount: parseFloat(payForm.discount) || 0,
        feedback: payForm.feedback.trim() || null,
      })
      .eq('id', payDialog.appt.id)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Payment recorded')
      const discountVal = parseFloat(payForm.discount) || 0
      if (discountVal > 0) {
        void supabase.from('audit_log').insert({
          user_id: ownerId,
          actor_role: role,
          action: 'discount_applied',
          entity_type: 'appointment',
          entity_id: payDialog.appt!.id,
          details: { client: payDialog.appt!.client_name, discount_amount: discountVal },
        })
      }
      setPayDialog({ open: false, appt: null })
      setPayForm({ discount: '', payment_method: 'cash', feedback: '' })
      await loadData()
    }
    setPaying(false)
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
            <span className="font-urdu">اپائنٹمنٹ مینجمنٹ</span>
            {isStaffRole && ' — Showing your appointments for today'}
            {role === 'cashier' && ' — Mark payments and collect feedback'}
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
                          {canMarkPayment(role) && (
                            <Badge className={`text-xs border ${isPaid ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                              {isPaid ? '✓ Paid' : 'Unpaid'}
                            </Badge>
                          )}
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
                                {isPaid && discountAmt > 0 ? (
                                  <>
                                    <span className="line-through text-gray-400">PKR {serviceTotal.toLocaleString()}</span>
                                    <span className="text-primary font-medium">PKR {netAmount.toLocaleString()}</span>
                                  </>
                                ) : (
                                  <span className="text-primary font-medium">PKR {serviceTotal.toLocaleString()}</span>
                                )}
                              </div>
                            </div>
                          )}
                          {appt.staff && (
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <Users className="w-3 h-3 text-gray-400" />
                              <span>{appt.staff.name}</span>
                            </div>
                          )}
                          {appt.feedback && (
                            <div className="flex items-center gap-1 text-xs text-gray-400">
                              <MessageSquare className="w-3 h-3" />
                              <span className="italic">&quot;{appt.feedback}&quot;</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
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

                        {canMarkPayment(role) && !isPaid && (
                          <button
                            onClick={() => { setPayDialog({ open: true, appt }); setPayForm({ discount: '', payment_method: 'cash', feedback: '' }) }}
                            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors font-medium"
                          >
                            <CreditCard className="w-3 h-3" />
                            Mark Paid
                          </button>
                        )}

                        {canEdit(role) && (
                          <div className="hidden sm:flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {appt.status !== 'completed' && (
                              <button onClick={() => updateStatus(appt.id, 'completed')}
                                className="text-[10px] px-2 py-1 rounded-md bg-green-50 text-green-600 hover:bg-green-100 transition-colors font-medium">
                                ✓ Done
                              </button>
                            )}
                            {appt.status === 'pending' && (
                              <button onClick={() => updateStatus(appt.id, 'confirmed')}
                                className="text-[10px] px-2 py-1 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors font-medium">
                                Confirm
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
                  WhatsApp Number
                  <span className="ml-1 text-xs text-gray-400 font-normal">(optional)</span>
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

              {/* Deal selection */}
              {deals.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Deal / Package <span className="text-gray-400 font-normal text-xs">(optional)</span></Label>
                  <Select
                    value={form.deal_id || undefined}
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
                          {d.name} — PKR {Number(d.price).toLocaleString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.deal_id && selectedDeal && (
                    <div className="bg-primary/5 rounded-lg px-3 py-2 text-xs text-primary">
                      Deal includes: {selectedDeal.deal_services.map(ds => ds.services?.name).filter(Boolean).join(', ')} · PKR {Number(selectedDeal.price).toLocaleString()}
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
                            <span className="font-semibold">PKR {s.price.toLocaleString()}</span>
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
                {form.service_ids.length > 0 && (
                  <div className="flex items-center justify-between text-xs bg-primary/5 rounded-lg px-3 py-2">
                    <span className="text-gray-600">{form.service_ids.length} service(s) · {formDuration} min total</span>
                    <span className="font-bold text-primary">PKR {formTotal.toLocaleString()}</span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Staff Member</Label>
                <Select
                  value={form.staff_id || undefined}
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
                    <SelectItem value="completed">Completed</SelectItem>
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

      {/* Payment Dialog */}
      {canMarkPayment(role) && (
        <Dialog open={payDialog.open} onOpenChange={(open) => setPayDialog({ open, appt: open ? payDialog.appt : null })}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary" />
                Record Payment
              </DialogTitle>
            </DialogHeader>
            {payDialog.appt && (() => {
              const apptSvcs = getAppointmentServices(payDialog.appt, services)
              const svcTotal = getServicesTotal(apptSvcs) || payDialog.appt.services?.price || 0
              return (
                <form onSubmit={handleMarkPaid} className="space-y-4">
                  <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 text-sm space-y-1">
                    <p className="font-semibold text-gray-800">{payDialog.appt.client_name}</p>
                    {apptSvcs.length > 0 ? (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {apptSvcs.map(s => (
                          <span key={s.id} className="bg-primary/10 text-primary text-xs rounded px-1.5 py-0.5">{s.name}</span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-xs">{payDialog.appt.services?.name ?? 'No service'}</p>
                    )}
                    <p className="text-xs text-gray-400">
                      {format(new Date(payDialog.appt.appointment_date + 'T00:00:00'), 'MMM d, yyyy')} at {payDialog.appt.appointment_time.slice(0, 5)}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Payment Method</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {paymentMethods.filter(pm => pm.enabled).map(pm => (
                        <button
                          key={pm.value}
                          type="button"
                          onClick={() => setPayForm({ ...payForm, payment_method: pm.value })}
                          className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                            payForm.payment_method === pm.value
                              ? 'bg-primary text-white border-primary'
                              : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-primary/40'
                          }`}
                        >
                          {pm.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="discount">Discount (PKR) <span className="text-xs text-gray-400 font-normal">(optional)</span></Label>
                    <Input id="discount" type="number" min="0" placeholder="0" value={payForm.discount}
                      onChange={(e) => setPayForm({ ...payForm, discount: e.target.value })} className="h-9" />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="payFeedback">Client Feedback <span className="text-xs text-gray-400 font-normal">(optional)</span></Label>
                    <Input id="payFeedback" placeholder="Rating or comments..." value={payForm.feedback}
                      onChange={(e) => setPayForm({ ...payForm, feedback: e.target.value })} className="h-9" />
                  </div>

                  <div className="rounded-lg bg-primary/5 border border-primary/15 p-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Services total</span>
                      <span className="font-medium">PKR {svcTotal.toLocaleString()}</span>
                    </div>
                    {payForm.discount && parseFloat(payForm.discount) > 0 && (
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-gray-600">Discount</span>
                        <span className="font-medium text-red-600">− PKR {parseFloat(payForm.discount).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-primary/15">
                      <span className="font-semibold text-gray-800">Total due</span>
                      <span className="font-bold text-primary">
                        PKR {Math.max(0, svcTotal - (parseFloat(payForm.discount) || 0)).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setPayDialog({ open: false, appt: null })} size="sm">Cancel</Button>
                    <Button type="submit" className="bg-primary hover:bg-primary/90" size="sm" disabled={paying}>
                      {paying && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                      Confirm Payment
                    </Button>
                  </DialogFooter>
                </form>
              )
            })()}
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

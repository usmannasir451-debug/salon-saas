'use client'

import { useEffect, useState, useMemo } from 'react'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useUserContext } from '@/components/RoleContext'
import type { DiscountType, DiscountReason, PaymentMethod, WalkIn, Service, StaffMember } from '@/lib/types'
import FeedbackModal from '@/components/FeedbackModal'
import InvoiceModal, { type InvoiceData } from '@/components/InvoiceModal'
import {
  Zap,
  Plus,
  Loader2,
  Receipt,
  X,
  Printer,
  CheckCircle2,
  Clock,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(n: number, currency = 'USD') {
  return `${currency} ${Math.round(n).toLocaleString()}`
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'jazzcash', label: 'JazzCash' },
  { value: 'easypaisa', label: 'EasyPaisa' },
]

const DISCOUNT_REASONS: { value: DiscountReason; label: string }[] = [
  { value: 'loyalty', label: 'Loyalty Reward' },
  { value: 'promo', label: 'Promotion' },
  { value: 'staff_discount', label: 'Staff Discount' },
  { value: 'birthday', label: 'Birthday' },
  { value: 'other', label: 'Other' },
]

const emptyForm = {
  client_name: '',
  client_phone: '',
  service_id: '',
  staff_id: '',
  payment_method: 'cash' as PaymentMethod,
  discount_type: 'percentage' as DiscountType,
  discount_value: '',
  discount_reason: '' as DiscountReason | '',
  notes: '',
}

// ─── Receipt Component ──────────────────────────────────────────────────────────

function ReceiptView({ walkin, currency, salonName }: { walkin: WalkIn; currency: string; salonName: string }) {
  return (
    <div id="walkin-receipt" className="bg-white rounded-xl border border-gray-200 p-6 font-mono text-sm max-w-xs mx-auto">
      <div className="text-center mb-4">
        <p className="font-bold text-lg">{salonName || 'SalonPro'}</p>
        <p className="text-xs text-gray-500">Walk-In Receipt</p>
        <p className="text-xs text-gray-400">{format(new Date(walkin.created_at), 'MMM d, yyyy — h:mm a')}</p>
      </div>
      <div className="border-t border-dashed border-gray-300 my-3" />
      <div className="space-y-1">
        {walkin.client_name && (
          <div className="flex justify-between">
            <span className="text-gray-500">Client</span>
            <span className="font-medium">{walkin.client_name}</span>
          </div>
        )}
        {walkin.services && (
          <div className="flex justify-between">
            <span className="text-gray-500">Service</span>
            <span className="font-medium">{walkin.services.name}</span>
          </div>
        )}
        {walkin.staff && (
          <div className="flex justify-between">
            <span className="text-gray-500">Staff</span>
            <span className="font-medium">{walkin.staff.name}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-500">Payment</span>
          <span className="font-medium capitalize">{walkin.payment_method}</span>
        </div>
      </div>
      <div className="border-t border-dashed border-gray-300 my-3" />
      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-gray-500">Subtotal</span>
          <span>{formatCurrency(walkin.subtotal, currency)}</span>
        </div>
        {walkin.discount_amount > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Discount ({walkin.discount_type === 'percentage' ? `${walkin.discount_value}%` : formatCurrency(walkin.discount_value, currency)})</span>
            <span>-{formatCurrency(walkin.discount_amount, currency)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-base border-t border-gray-200 pt-1 mt-1">
          <span>TOTAL</span>
          <span>{formatCurrency(walkin.total, currency)}</span>
        </div>
      </div>
      <div className="border-t border-dashed border-gray-300 my-3" />
      <div className="text-center text-xs text-gray-400">
        <p>Thank you for visiting!</p>
        <p className="mt-1">Powered by SalonPro</p>
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function WalkInPage() {
  const { role, ownerId } = useUserContext()
  const router = useRouter()

  const [walkIns, setWalkIns] = useState<WalkIn[]>([])
  const [services, setServices] = useState<Pick<Service, 'id' | 'name' | 'price' | 'duration'>[]>([])
  const [staffList, setStaffList] = useState<Pick<StaffMember, 'id' | 'name'>[]>([])
  const [currency, setCurrency] = useState('USD')
  const [salonName, setSalonName] = useState('')
  const [salonAddress, setSalonAddress] = useState('')
  const [taxPercentage, setTaxPercentage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [receiptWalkIn, setReceiptWalkIn] = useState<WalkIn | null>(null)
  const [feedbackWalkIn, setFeedbackWalkIn] = useState<WalkIn | null>(null)
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null)
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    if (!['owner', 'regional_manager', 'manager', 'receptionist', 'cashier'].includes(role)) {
      router.replace('/appointments')
      return
    }
    loadData()
  }, [role, router]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    const supabase = createClient()
    const [walkRes, svcRes, staffRes, profileRes] = await Promise.all([
      supabase
        .from('walk_ins')
        .select('*, services(id, name, price, duration), staff(id, name)')
        .eq('user_id', ownerId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('services').select('id, name, price, duration').eq('user_id', ownerId).order('name'),
      supabase.from('staff').select('id, name').eq('user_id', ownerId).order('name'),
      supabase.from('profiles').select('salon_currency, salon_name, salon_address, tax_percentage').eq('id', ownerId).single(),
    ])
    setWalkIns((walkRes.data as unknown as WalkIn[]) ?? [])
    setServices((svcRes.data ?? []) as Pick<Service, 'id' | 'name' | 'price' | 'duration'>[])
    setStaffList((staffRes.data ?? []) as Pick<StaffMember, 'id' | 'name'>[])
    setCurrency(profileRes.data?.salon_currency ?? 'PKR')
    setSalonName(profileRes.data?.salon_name ?? '')
    setSalonAddress(profileRes.data?.salon_address ?? '')
    setTaxPercentage(profileRes.data?.tax_percentage ?? 0)
    setLoading(false)
  }

  // Discount calculation
  const selectedService = useMemo(
    () => services.find((s) => s.id === form.service_id),
    [services, form.service_id]
  )

  const subtotal = useMemo(() => Number(selectedService?.price ?? 0), [selectedService])

  const discountAmount = useMemo(() => {
    const val = parseFloat(form.discount_value) || 0
    if (form.discount_type === 'percentage') return Math.min((subtotal * val) / 100, subtotal)
    return Math.min(val, subtotal)
  }, [subtotal, form.discount_type, form.discount_value])

  const total = Math.max(subtotal - discountAmount, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.service_id) {
      toast.error('Please select a service')
      return
    }
    setSubmitting(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from('walk_ins')
      .insert({
        user_id: ownerId,
        client_name: form.client_name.trim() || null,
        client_phone: form.client_phone.trim() || null,
        service_id: form.service_id,
        staff_id: form.staff_id || null,
        payment_method: form.payment_method,
        subtotal,
        discount_type: form.discount_value ? form.discount_type : null,
        discount_value: parseFloat(form.discount_value) || 0,
        discount_amount: discountAmount,
        discount_reason: form.discount_reason || null,
        total,
        payment_status: 'paid',
        notes: form.notes.trim() || null,
      })
      .select('*, services(id, name, price, duration), staff(id, name)')
      .single()

    if (error) {
      toast.error(error.message)
      setSubmitting(false)
      return
    }

    const walkinData = data as unknown as WalkIn
    toast.success('Walk-in recorded!')

    // Create notifications
    const supabaseNotify = createClient()
    const svc = services.find((s) => s.id === form.service_id)
    await Promise.all([
      supabaseNotify.from('notifications').insert({
        user_id: ownerId,
        type: 'payment_received',
        title: 'Payment Received',
        message: `${form.client_name || 'Walk-in client'} paid ${formatCurrency(total, currency)} for ${svc?.name ?? 'service'}`,
        link: '/walkin',
      }),
      // Log audit
      supabaseNotify.from('audit_log').insert({
        user_id: ownerId,
        actor_user_id: (await supabaseNotify.auth.getUser()).data.user?.id,
        actor_email: (await supabaseNotify.auth.getUser()).data.user?.email,
        actor_role: role,
        action: 'payment_walkin',
        entity_type: 'walk_in',
        entity_id: walkinData.id,
        details: { client: form.client_name, amount: total, payment: form.payment_method },
      }),
    ])

    setForm(emptyForm)
    setShowForm(false)
    setReceiptWalkIn(walkinData)
    // Show feedback modal if staff was assigned
    if (walkinData.staff_id) setFeedbackWalkIn(walkinData)
    await loadData()
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Zap className="w-6 h-6 text-primary" />
            Walk-Ins
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Quick walk-in service recording</p>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          className="bg-primary hover:bg-primary/90 gap-2"
        >
          <Plus className="w-4 h-4" />
          New Walk-In
        </Button>
      </div>

      {/* ── Walk-In Form Dialog ── */}
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) setShowForm(false) }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              New Walk-In
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Client info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Client Name <span className="text-gray-400 font-normal">(optional)</span></Label>
                <Input
                  value={form.client_name}
                  onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))}
                  placeholder="Guest"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Phone <span className="text-gray-400 font-normal">(optional)</span></Label>
                <Input
                  value={form.client_phone}
                  onChange={(e) => setForm((f) => ({ ...f, client_phone: e.target.value }))}
                  placeholder="+1 555..."
                  className="h-9"
                />
              </div>
            </div>

            {/* Service */}
            <div className="space-y-1.5">
              <Label>Service *</Label>
              <Select
                value={form.service_id}
                onValueChange={(v) => setForm((f) => ({ ...f, service_id: v ?? '' }))}
              >
                <SelectTrigger className="h-9"><SelectValue placeholder="Select service" /></SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} — {formatCurrency(s.price, currency)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Staff */}
            <div className="space-y-1.5">
              <Label>Staff <span className="text-gray-400 font-normal">(optional)</span></Label>
              <Select
                value={form.staff_id}
                onValueChange={(v) => setForm((f) => ({ ...f, staff_id: v ?? '' }))}
              >
                <SelectTrigger className="h-9"><SelectValue placeholder="Select staff member" /></SelectTrigger>
                <SelectContent>
                  {staffList.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Payment method */}
            <div className="space-y-1.5">
              <Label>Payment Method</Label>
              <Select
                value={form.payment_method}
                onValueChange={(v) => setForm((f) => ({ ...f, payment_method: (v ?? 'cash') as PaymentMethod }))}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Discount */}
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 space-y-3">
              <p className="text-sm font-semibold text-gray-700">Discount (optional)</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select
                    value={form.discount_type}
                    onValueChange={(v) => setForm((f) => ({ ...f, discount_type: (v ?? 'percentage') as DiscountType }))}
                  >
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Value</Label>
                  <Input
                    type="number"
                    min="0"
                    max={form.discount_type === 'percentage' ? '100' : undefined}
                    value={form.discount_value}
                    onChange={(e) => setForm((f) => ({ ...f, discount_value: e.target.value }))}
                    placeholder={form.discount_type === 'percentage' ? '0%' : '0.00'}
                    className="h-9"
                  />
                </div>
              </div>
              {form.discount_value && (
                <div className="space-y-1.5">
                  <Label>Discount Reason</Label>
                  <Select
                    value={form.discount_reason}
                    onValueChange={(v) => setForm((f) => ({ ...f, discount_reason: (v ?? '') as DiscountReason | '' }))}
                  >
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select reason" /></SelectTrigger>
                    <SelectContent>
                      {DISCOUNT_REASONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Bill summary */}
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">{formatCurrency(subtotal, currency)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount</span>
                  <span>-{formatCurrency(discountAmount, currency)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base border-t border-primary/20 pt-2 mt-1">
                <span className="text-gray-900">Total Payable</span>
                <span className="text-primary">{formatCurrency(total, currency)}</span>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Notes <span className="text-gray-400 font-normal">(optional)</span></Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Any special notes..."
                className="h-9"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>
                <X className="w-4 h-4 mr-1" /> Cancel
              </Button>
              <Button type="submit" size="sm" disabled={submitting} className="bg-primary hover:bg-primary/90 gap-2">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {submitting ? 'Processing...' : `Mark Paid — ${formatCurrency(total, currency)}`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Receipt Dialog ── */}
      <Dialog open={!!receiptWalkIn} onOpenChange={(o) => { if (!o) setReceiptWalkIn(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-primary" />
              Receipt
            </DialogTitle>
          </DialogHeader>
          {receiptWalkIn && (
            <ReceiptView walkin={receiptWalkIn} currency={currency} salonName={salonName} />
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
              <Printer className="w-4 h-4" />
              Print
            </Button>
            <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => setReceiptWalkIn(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Today's Walk-In Stats ── */}
      {(() => {
        const todayStr = format(new Date(), 'yyyy-MM-dd')
        const todayWalkIns = walkIns.filter((w) => w.created_at.startsWith(todayStr))
        const todayRevenue = todayWalkIns.reduce((s, w) => s + Number(w.total), 0)
        const todayDiscounts = todayWalkIns.reduce((s, w) => s + Number(w.discount_amount), 0)
        return todayWalkIns.length > 0 ? (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Today's Walk-Ins", value: todayWalkIns.length, color: 'text-primary', bg: 'bg-primary/10' },
              { label: 'Revenue', value: formatCurrency(todayRevenue, currency), color: 'text-green-600', bg: 'bg-green-50' },
              { label: 'Discounts', value: formatCurrency(todayDiscounts, currency), color: 'text-orange-600', bg: 'bg-orange-50' },
            ].map((s) => (
              <Card key={s.label} className="border-gray-100">
                <CardContent className="pt-4 pb-3">
                  <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center mb-2`}>
                    <Zap className={`w-4 h-4 ${s.color}`} />
                  </div>
                  <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null
      })()}

      {/* ── Walk-Ins List ── */}
      <Card className="border-gray-100">
        <CardHeader className="pb-3 border-b border-gray-50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Recent Walk-Ins</CardTitle>
            <Badge className="bg-primary/10 text-primary border-primary/20">{walkIns.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {walkIns.length === 0 ? (
            <div className="text-center py-12">
              <Zap className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No walk-ins yet</p>
              <p className="text-sm text-gray-400 mt-1">Click &quot;New Walk-In&quot; to record your first one</p>
            </div>
          ) : (
            <div className="space-y-2">
              {walkIns.map((w) => (
                <div key={w.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100/80 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{w.client_name || 'Guest'}</p>
                      {w.services && (
                        <>
                          <span className="text-gray-300">·</span>
                          <p className="text-sm text-gray-600 truncate">{w.services.name}</p>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Clock className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-gray-400">
                        {format(new Date(w.created_at), 'MMM d, h:mm a')}
                      </span>
                      {w.staff && (
                        <>
                          <span className="text-gray-300">·</span>
                          <span className="text-xs text-gray-400">{w.staff.name}</span>
                        </>
                      )}
                      <span className="text-gray-300">·</span>
                      <span className="text-xs text-gray-500 capitalize">{w.payment_method}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {w.discount_amount > 0 && (
                      <span className="text-xs text-green-600">-{formatCurrency(w.discount_amount, currency)}</span>
                    )}
                    <span className="font-bold text-sm text-primary">{formatCurrency(w.total, currency)}</span>
                    <Badge className="text-xs bg-green-50 text-green-700 border-green-200">Paid</Badge>
                    <button
                      onClick={() => setReceiptWalkIn(w)}
                      className="p-1.5 rounded-lg hover:bg-white text-gray-400 hover:text-primary transition-colors"
                      title="View receipt"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setInvoiceData({
                        id: w.id,
                        invoiceType: 'walkin',
                        salonName,
                        salonAddress,
                        clientName: w.client_name ?? undefined,
                        clientPhone: w.client_phone ?? undefined,
                        staffName: w.staff?.name ?? undefined,
                        serviceName: w.services?.name ?? undefined,
                        date: w.created_at.slice(0, 10),
                        subtotal: w.subtotal,
                        discountAmount: w.discount_amount,
                        taxPercentage,
                        total: w.total,
                        paymentMethod: w.payment_method,
                        currency,
                      })}
                      className="p-1.5 rounded-lg hover:bg-white text-gray-400 hover:text-blue-600 transition-colors"
                      title="Invoice"
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Feedback Modal */}
      <FeedbackModal
        open={!!feedbackWalkIn}
        onClose={() => setFeedbackWalkIn(null)}
        ownerId={ownerId}
        staffId={feedbackWalkIn?.staff_id ?? null}
        staffName={feedbackWalkIn?.staff?.name ?? 'Staff'}
        clientName={feedbackWalkIn?.client_name ?? ''}
        walkInId={feedbackWalkIn?.id}
      />

      {/* Invoice Modal */}
      <InvoiceModal
        open={!!invoiceData}
        onClose={() => setInvoiceData(null)}
        data={invoiceData}
      />
    </div>
  )
}

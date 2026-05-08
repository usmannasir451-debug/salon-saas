'use client'

import { useEffect, useState, useMemo } from 'react'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useUserContext } from '@/components/RoleContext'
import type { DiscountType, DiscountReason, PaymentMethod, WalkIn, Service, StaffMember } from '@/lib/types'

type DealItem = {
  id: string
  name: string
  description: string | null
  price: number
  is_active: boolean
  deal_services: { services: { id: string; name: string; price: number; duration: number } | null }[]
}

type PaymentMethodConfig = { value: string; label: string; enabled: boolean }

const DEFAULT_PAYMENT_METHODS: PaymentMethodConfig[] = [
  { value: 'cash', label: 'Cash', enabled: true },
  { value: 'card', label: 'Card', enabled: true },
  { value: 'easypaisa', label: 'EasyPaisa', enabled: true },
  { value: 'jazzcash', label: 'JazzCash', enabled: true },
]

const PAYMENT_ICON_MAP: Record<string, { icon: React.ElementType; color: string }> = {
  cash: { icon: Banknote, color: 'bg-green-500 hover:bg-green-600' },
  card: { icon: CreditCard, color: 'bg-blue-500 hover:bg-blue-600' },
  jazzcash: { icon: Smartphone, color: 'bg-red-500 hover:bg-red-600' },
  easypaisa: { icon: Wallet, color: 'bg-emerald-600 hover:bg-emerald-700' },
}
import FeedbackModal from '@/components/FeedbackModal'
import InvoiceModal, { type InvoiceData } from '@/components/InvoiceModal'
import {
  Zap, Plus, Loader2, Receipt, X, Printer, CheckCircle2, Clock, FileText,
  Banknote, CreditCard, Smartphone, Wallet, User, Phone, Search, Star,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

function formatCurrency(n: number, currency = 'PKR') {
  return `${currency} ${Math.round(n).toLocaleString()}`
}

const DISCOUNT_REASONS: { value: DiscountReason; label: string }[] = [
  { value: 'loyalty', label: 'Loyalty Reward' },
  { value: 'promo', label: 'Promotion' },
  { value: 'staff_discount', label: 'Staff Discount' },
  { value: 'birthday', label: 'Birthday' },
  { value: 'other', label: 'Other' },
]

type ServiceItem = Pick<Service, 'id' | 'name' | 'price' | 'duration'>
type StaffItem = Pick<StaffMember, 'id' | 'name'>

type ClientProfile = {
  name: string
  loyalty_balance: number
}

const emptyForm = {
  client_name: '',
  client_phone: '',
  service_ids: [] as string[],
  deal_id: '',
  staff_id: '',
  payment_method: 'cash' as PaymentMethod,
  discount_type: 'percentage' as DiscountType,
  discount_value: '',
  discount_reason: '' as DiscountReason | '',
  loyalty_redeem: '',
  notes: '',
}

function ReceiptView({ walkin, currency, salonName, serviceNames }: {
  walkin: WalkIn; currency: string; salonName: string; serviceNames: string[]
}) {
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
        {serviceNames.length > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-500">Services</span>
            <span className="font-medium text-right max-w-[150px]">{serviceNames.join(', ')}</span>
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
            <span>Discount</span>
            <span>-{formatCurrency(walkin.discount_amount, currency)}</span>
          </div>
        )}
        {(walkin.loyalty_redeemed ?? 0) > 0 && (
          <div className="flex justify-between text-purple-600">
            <span>Loyalty Redeemed</span>
            <span>-{formatCurrency(walkin.loyalty_redeemed ?? 0, currency)}</span>
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

export default function WalkInPage() {
  const { role, ownerId } = useUserContext()
  const router = useRouter()

  const [walkIns, setWalkIns] = useState<WalkIn[]>([])
  const [services, setServices] = useState<ServiceItem[]>([])
  const [staffList, setStaffList] = useState<StaffItem[]>([])
  const [deals, setDeals] = useState<DealItem[]>([])
  const [paymentMethodConfig, setPaymentMethodConfig] = useState<PaymentMethodConfig[]>(DEFAULT_PAYMENT_METHODS)
  const [currency, setCurrency] = useState('PKR')
  const [salonName, setSalonName] = useState('')
  const [salonAddress, setSalonAddress] = useState('')
  const [taxPercentage, setTaxPercentage] = useState(0)
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(false)
  const [loyaltyEarnPct, setLoyaltyEarnPct] = useState(10)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [receiptWalkIn, setReceiptWalkIn] = useState<WalkIn | null>(null)
  const [receiptServiceNames, setReceiptServiceNames] = useState<string[]>([])
  const [feedbackWalkIn, setFeedbackWalkIn] = useState<WalkIn | null>(null)
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null)
  const [form, setForm] = useState(emptyForm)

  // Client lookup by phone
  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null)
  const [lookingUp, setLookingUp] = useState(false)

  useEffect(() => {
    if (!['owner', 'regional_manager', 'manager', 'receptionist', 'cashier'].includes(role)) {
      router.replace('/appointments')
      return
    }
    loadData()
  }, [role, router]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    const supabase = createClient()
    const [walkRes, svcRes, staffRes, profileRes, dealsRes] = await Promise.all([
      supabase
        .from('walk_ins')
        .select('*, services(id, name, price, duration), staff(id, name), walk_in_services(services(id, name, price, duration))')
        .eq('user_id', ownerId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('services').select('id, name, price, duration').eq('user_id', ownerId).order('name'),
      supabase.from('staff').select('id, name').eq('user_id', ownerId).eq('is_active', true).order('name'),
      supabase.from('profiles').select('salon_currency, salon_name, salon_address, tax_percentage, loyalty_enabled, loyalty_earn_pct, payment_methods').eq('id', ownerId).single(),
      supabase.from('deals').select('id, name, description, price, is_active, deal_services(services(id, name, price, duration))').eq('user_id', ownerId).eq('is_active', true).order('name'),
    ])
    setWalkIns((walkRes.data as unknown as WalkIn[]) ?? [])
    setServices((svcRes.data ?? []) as ServiceItem[])
    setStaffList((staffRes.data ?? []) as StaffItem[])
    setCurrency(profileRes.data?.salon_currency ?? 'PKR')
    setSalonName(profileRes.data?.salon_name ?? '')
    setSalonAddress(profileRes.data?.salon_address ?? '')
    setTaxPercentage(profileRes.data?.tax_percentage ?? 0)
    setLoyaltyEnabled(profileRes.data?.loyalty_enabled ?? false)
    setLoyaltyEarnPct(profileRes.data?.loyalty_earn_pct ?? 10)
    setDeals((dealsRes.data as unknown as DealItem[]) ?? [])
    const pm = profileRes.data?.payment_methods
    if (pm && Array.isArray(pm) && pm.length > 0) setPaymentMethodConfig(pm as PaymentMethodConfig[])
    else setPaymentMethodConfig(DEFAULT_PAYMENT_METHODS)
    setLoading(false)
  }

  async function lookupClient(phone: string) {
    if (!phone || phone.length < 7) { setClientProfile(null); return }
    setLookingUp(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('clients')
      .select('name, loyalty_balance')
      .eq('user_id', ownerId)
      .eq('phone', phone)
      .maybeSingle()
    setClientProfile(data ? { name: data.name, loyalty_balance: data.loyalty_balance ?? 0 } : null)
    if (data && !form.client_name) {
      setForm(f => ({ ...f, client_name: data.name }))
    }
    setLookingUp(false)
  }

  function toggleService(id: string) {
    setForm(f => ({
      ...f,
      service_ids: f.service_ids.includes(id)
        ? f.service_ids.filter(sid => sid !== id)
        : [...f.service_ids, id],
    }))
  }

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

  const subtotal = useMemo(() => {
    if (selectedDeal) return Number(selectedDeal.price) + additionalServices.reduce((s, svc) => s + Number(svc.price), 0)
    return selectedServices.reduce((s, svc) => s + Number(svc.price), 0)
  }, [selectedDeal, selectedServices, additionalServices])

  const discountAmount = useMemo(() => {
    const val = parseFloat(form.discount_value) || 0
    if (form.discount_type === 'percentage') return Math.min((subtotal * val) / 100, subtotal)
    return Math.min(val, subtotal)
  }, [subtotal, form.discount_type, form.discount_value])

  const loyaltyRedeemAmount = useMemo(() => {
    if (!loyaltyEnabled || !clientProfile) return 0
    const redeem = parseFloat(form.loyalty_redeem) || 0
    return Math.min(redeem, clientProfile.loyalty_balance, subtotal - discountAmount)
  }, [loyaltyEnabled, clientProfile, form.loyalty_redeem, subtotal, discountAmount])

  const total = Math.max(subtotal - discountAmount - loyaltyRedeemAmount, 0)

  const loyaltyEarned = useMemo(() => {
    if (!loyaltyEnabled) return 0
    return Math.round((total * loyaltyEarnPct) / 100)
  }, [loyaltyEnabled, total, loyaltyEarnPct])

  async function handleSubmit(method: PaymentMethod) {
    if (form.service_ids.length === 0 && !form.deal_id) {
      toast.error('Please select at least one service or deal')
      return
    }
    setSubmitting(true)
    const supabase = createClient()

    const allServiceIds = form.deal_id && selectedDeal
      ? [...dealServiceIds, ...form.service_ids.filter(id => !dealServiceIds.includes(id))]
      : form.service_ids

    const { data, error } = await supabase
      .from('walk_ins')
      .insert({
        user_id: ownerId,
        client_name: form.client_name.trim() || null,
        client_phone: form.client_phone.trim() || null,
        service_id: allServiceIds[0] || null,
        staff_id: form.staff_id || null,
        payment_method: method,
        subtotal,
        discount_type: form.discount_value ? form.discount_type : null,
        discount_value: parseFloat(form.discount_value) || 0,
        discount_amount: discountAmount,
        discount_reason: form.discount_reason || null,
        loyalty_redeemed: loyaltyRedeemAmount,
        deal_id: form.deal_id || null,
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

    // Insert junction rows for all services (deal + individual)
    if (allServiceIds.length > 0) {
      await supabase.from('walk_in_services').insert(
        allServiceIds.map(sid => ({ walk_in_id: walkinData.id, service_id: sid, user_id: ownerId }))
      )
    }

    // Loyalty: update client balance and log transaction
    if (loyaltyEnabled && form.client_phone.trim()) {
      const phone = form.client_phone.trim()
      // Upsert client record
      await supabase.from('clients').upsert(
        { user_id: ownerId, phone, name: form.client_name.trim() || phone },
        { onConflict: 'user_id,phone' }
      )

      const loyaltyUpdates: Promise<unknown>[] = []

      if (loyaltyRedeemAmount > 0) {
        const redeemTask = async () => {
          await supabase.rpc('decrement_loyalty', { p_user_id: ownerId, p_phone: phone, p_amount: loyaltyRedeemAmount })
          await supabase.from('loyalty_transactions').insert({
            user_id: ownerId,
            client_phone: phone,
            client_name: form.client_name.trim() || null,
            transaction_type: 'redeemed',
            amount: loyaltyRedeemAmount,
            reference_id: walkinData.id,
            reference_type: 'walk_in',
          })
        }
        loyaltyUpdates.push(redeemTask())
      }

      if (loyaltyEarned > 0) {
        const earnTask = async () => {
          await supabase.from('clients').update({ loyalty_balance: (clientProfile?.loyalty_balance ?? 0) - loyaltyRedeemAmount + loyaltyEarned })
            .eq('user_id', ownerId).eq('phone', phone)
          await supabase.from('loyalty_transactions').insert({
            user_id: ownerId,
            client_phone: phone,
            client_name: form.client_name.trim() || null,
            transaction_type: 'earned',
            amount: loyaltyEarned,
            reference_id: walkinData.id,
            reference_type: 'walk_in',
          })
        }
        loyaltyUpdates.push(earnTask()
        )
      }

      await Promise.all(loyaltyUpdates)
    }

    toast.success('Walk-in recorded!')

    void Promise.all([
      supabase.from('notifications').insert({
        user_id: ownerId,
        type: 'payment_received',
        title: 'Payment Received',
        message: `${form.client_name || 'Walk-in client'} paid ${formatCurrency(total, currency)} via ${method}`,
        link: '/walkin',
      }),
      supabase.from('audit_log').insert({
        user_id: ownerId,
        actor_role: role,
        action: 'payment_walkin',
        entity_type: 'walk_in',
        entity_id: walkinData.id,
        details: { client: form.client_name, amount: total, payment: method },
      }),
    ])

    const svcNames = selectedDeal
      ? [selectedDeal.name + ' (Deal)', ...additionalServices.map(s => s.name)]
      : selectedServices.map(s => s.name)
    setReceiptServiceNames(svcNames)
    setForm(emptyForm)
    setClientProfile(null)
    setShowForm(false)
    setReceiptWalkIn(walkinData)
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

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const todayWalkIns = walkIns.filter((w) => w.created_at.startsWith(todayStr))
  const todayRevenue = todayWalkIns.reduce((s, w) => s + Number(w.total), 0)
  const todayDiscounts = todayWalkIns.reduce((s, w) => s + Number(w.discount_amount), 0)

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Zap className="w-6 h-6 text-primary" />
            Walk-Ins
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Quick POS — tap to select services, choose payment</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-primary hover:bg-primary/90 gap-2 h-11 px-5">
          <Plus className="w-4 h-4" />
          New Walk-In
        </Button>
      </div>

      {/* Walk-In Form Dialog */}
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); setClientProfile(null) } }}>
        <DialogContent className="sm:max-w-2xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Zap className="w-5 h-5 text-primary" />
              New Walk-In — POS
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Client info row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> Phone</Label>
                <div className="relative">
                  <Input
                    value={form.client_phone}
                    onChange={(e) => {
                      setForm(f => ({ ...f, client_phone: e.target.value }))
                      lookupClient(e.target.value)
                    }}
                    placeholder="03001234567"
                    className="h-10 pr-8"
                  />
                  {lookingUp && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />}
                </div>
                {clientProfile && (
                  <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg px-2.5 py-1.5">
                    <Star className="w-3.5 h-3.5 text-purple-500" />
                    <span className="text-xs text-purple-700 font-medium">{clientProfile.name} · Loyalty: PKR {clientProfile.loyalty_balance.toLocaleString()}</span>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> Client Name</Label>
                <Input
                  value={form.client_name}
                  onChange={(e) => setForm(f => ({ ...f, client_name: e.target.value }))}
                  placeholder="Guest"
                  className="h-10"
                />
              </div>
            </div>

            {/* Deals section */}
            {deals.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Deal / Package <span className="text-gray-400 font-normal text-xs">(optional)</span></Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {deals.map(deal => {
                    const isSelected = form.deal_id === deal.id
                    return (
                      <button
                        key={deal.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setForm(f => ({ ...f, deal_id: '', service_ids: [] }))
                          } else {
                            const svcIds = deal.deal_services.map(ds => ds.services?.id).filter(Boolean) as string[]
                            setForm(f => ({ ...f, deal_id: deal.id, service_ids: svcIds }))
                          }
                        }}
                        className={`flex flex-col items-start p-3 rounded-xl text-left transition-all border ${
                          isSelected
                            ? 'bg-primary text-white border-primary shadow-md ring-2 ring-primary/30'
                            : 'bg-gray-50 border-gray-200 hover:border-primary/40 hover:bg-primary/5'
                        }`}
                      >
                        <span className={`font-semibold text-sm ${isSelected ? 'text-white' : 'text-gray-900'}`}>{deal.name}</span>
                        <span className={`text-xs mt-0.5 ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
                          {deal.deal_services.map(ds => ds.services?.name).filter(Boolean).join(', ')}
                        </span>
                        <span className={`text-sm font-bold mt-1 ${isSelected ? 'text-white' : 'text-primary'}`}>
                          PKR {Number(deal.price).toLocaleString()}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Services grid */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">{deals.length > 0 && form.deal_id ? 'Extra Services' : 'Select Services *'}</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                {services.map((s) => {
                  const selected = form.service_ids.includes(s.id)
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleService(s.id)}
                      className={`flex flex-col items-start p-3 rounded-xl text-left transition-all ${
                        selected
                          ? 'bg-primary text-white shadow-md ring-2 ring-primary/30'
                          : 'bg-gray-50 border border-gray-200 hover:border-primary/40 hover:bg-primary/5'
                      }`}
                    >
                      <span className="font-semibold text-sm truncate w-full">{s.name}</span>
                      <span className={`text-xs mt-1 ${selected ? 'text-white/80' : 'text-gray-500'}`}>{s.duration} min</span>
                      <span className={`text-sm font-bold mt-1 ${selected ? 'text-white' : 'text-primary'}`}>
                        PKR {Number(s.price).toLocaleString()}
                      </span>
                    </button>
                  )
                })}
              </div>
              {form.service_ids.length > 0 && (
                <div className="flex items-center justify-between bg-primary/5 rounded-xl px-4 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {selectedServices.map(s => (
                      <span key={s.id} className="bg-primary/15 text-primary text-xs rounded-full px-2.5 py-0.5 font-medium">{s.name}</span>
                    ))}
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className="text-xs text-gray-500">{selectedServices.reduce((s, svc) => s + svc.duration, 0)} min</p>
                    <p className="font-bold text-primary">PKR {subtotal.toLocaleString()}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Staff */}
            <div className="space-y-1.5">
              <Label>Staff <span className="text-gray-400 font-normal text-xs">(optional)</span></Label>
              <Select value={form.staff_id} onValueChange={(v) => setForm(f => ({ ...f, staff_id: v ?? '' }))}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select staff member">
                    {form.staff_id ? (staffList.find(s => s.id === form.staff_id)?.name ?? undefined) : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {staffList.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Discount */}
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 space-y-3">
              <p className="text-sm font-semibold text-gray-700">Discount <span className="text-xs font-normal text-gray-400">(optional)</span></p>
              <div className="grid grid-cols-2 gap-3">
                <Select value={form.discount_type} onValueChange={(v) => setForm(f => ({ ...f, discount_type: (v ?? 'percentage') as DiscountType }))}>
                  <SelectTrigger className="h-9">
                    <SelectValue>
                      {form.discount_type === 'fixed' ? 'Fixed (PKR)' : 'Percentage (%)'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed (PKR)</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number" min="0"
                  max={form.discount_type === 'percentage' ? '100' : undefined}
                  value={form.discount_value}
                  onChange={(e) => setForm(f => ({ ...f, discount_value: e.target.value }))}
                  placeholder={form.discount_type === 'percentage' ? '0%' : '0.00'}
                  className="h-9"
                />
              </div>
              {form.discount_value && (
                <Select value={form.discount_reason} onValueChange={(v) => setForm(f => ({ ...f, discount_reason: (v ?? '') as DiscountReason | '' }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Discount reason" /></SelectTrigger>
                  <SelectContent>
                    {DISCOUNT_REASONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Loyalty redemption */}
            {loyaltyEnabled && clientProfile && clientProfile.loyalty_balance > 0 && (
              <div className="rounded-xl bg-purple-50 border border-purple-200 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-purple-800">Loyalty Points</p>
                  <span className="text-sm font-bold text-purple-700">Balance: PKR {clientProfile.loyalty_balance.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number" min="0" max={clientProfile.loyalty_balance}
                    value={form.loyalty_redeem}
                    onChange={(e) => setForm(f => ({ ...f, loyalty_redeem: e.target.value }))}
                    placeholder="Amount to redeem"
                    className="h-9 flex-1"
                  />
                  <Button type="button" size="sm" variant="outline"
                    onClick={() => setForm(f => ({ ...f, loyalty_redeem: String(Math.min(clientProfile.loyalty_balance, subtotal - discountAmount)) }))}
                    className="border-purple-300 text-purple-700 hover:bg-purple-100 text-xs">
                    Max
                  </Button>
                </div>
                {loyaltyRedeemAmount > 0 && (
                  <p className="text-xs text-purple-600">Redeeming PKR {loyaltyRedeemAmount.toLocaleString()} from loyalty points</p>
                )}
              </div>
            )}

            {/* Bill Summary — always visible */}
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
              {loyaltyRedeemAmount > 0 && (
                <div className="flex justify-between text-sm text-purple-600">
                  <span>Loyalty Redeemed</span>
                  <span>-{formatCurrency(loyaltyRedeemAmount, currency)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-xl border-t border-primary/20 pt-2 mt-1">
                <span className="text-gray-900">Total</span>
                <span className="text-primary">{formatCurrency(total, currency)}</span>
              </div>
              {loyaltyEnabled && loyaltyEarned > 0 && (
                <p className="text-xs text-purple-600 text-right">+PKR {loyaltyEarned.toLocaleString()} loyalty earned</p>
              )}
            </div>

            {/* ONE-CLICK PAYMENT BUTTONS (dynamic from settings) */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Pay & Complete</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {paymentMethodConfig.filter(pm => pm.enabled).map(pm => {
                  const iconInfo = PAYMENT_ICON_MAP[pm.value] ?? { icon: CreditCard, color: 'bg-gray-500 hover:bg-gray-600' }
                  const Icon = iconInfo.icon
                  return (
                    <button
                      key={pm.value}
                      type="button"
                      disabled={submitting || (form.service_ids.length === 0 && !form.deal_id)}
                      onClick={() => handleSubmit(pm.value as PaymentMethod)}
                      className={`flex flex-col items-center justify-center gap-2 py-4 px-3 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${iconInfo.color} shadow-sm`}
                    >
                      {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Icon className="w-5 h-5" />}
                      <span>{pm.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Notes <span className="text-gray-400 font-normal text-xs">(optional)</span></Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Any special notes..."
                className="h-9"
              />
            </div>

            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); setClientProfile(null) }}>
                <X className="w-4 h-4 mr-1" /> Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={!!receiptWalkIn} onOpenChange={(o) => { if (!o) setReceiptWalkIn(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-primary" />
              Receipt
            </DialogTitle>
          </DialogHeader>
          {receiptWalkIn && (
            <ReceiptView walkin={receiptWalkIn} currency={currency} salonName={salonName} serviceNames={receiptServiceNames} />
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
              <Printer className="w-4 h-4" /> Print
            </Button>
            <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => setReceiptWalkIn(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Today's Stats */}
      {todayWalkIns.length > 0 && (
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
      )}

      {/* Walk-Ins List */}
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
              {walkIns.map((w) => {
                const svcList = (w.walk_in_services && w.walk_in_services.length > 0)
                  ? w.walk_in_services.map(ws => ws.services?.name).filter(Boolean)
                  : w.services ? [w.services.name] : []
                return (
                  <div key={w.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100/80 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Zap className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900">{w.client_name || 'Guest'}</p>
                        {svcList.length > 0 && (
                          <>
                            <span className="text-gray-300">·</span>
                            <p className="text-sm text-gray-600 truncate">{svcList.join(', ')}</p>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Clock className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-400">{format(new Date(w.created_at), 'MMM d, h:mm a')}</span>
                        {w.staff && <><span className="text-gray-300">·</span><span className="text-xs text-gray-400">{w.staff.name}</span></>}
                        <span className="text-gray-300">·</span>
                        <span className="text-xs text-gray-500 capitalize">{w.payment_method}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {w.discount_amount > 0 && <span className="text-xs text-green-600">-{formatCurrency(w.discount_amount, currency)}</span>}
                      <span className="font-bold text-sm text-primary">{formatCurrency(w.total, currency)}</span>
                      <Badge className="text-xs bg-green-50 text-green-700 border-green-200">Paid</Badge>
                      <button onClick={() => { setReceiptServiceNames(svcList as string[]); setReceiptWalkIn(w) }}
                        className="p-1.5 rounded-lg hover:bg-white text-gray-400 hover:text-primary transition-colors" title="Receipt">
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
                          serviceName: svcList.join(', ') || undefined,
                          date: w.created_at.slice(0, 10),
                          subtotal: w.subtotal,
                          discountAmount: w.discount_amount,
                          taxPercentage,
                          total: w.total,
                          paymentMethod: w.payment_method,
                          currency,
                        })}
                        className="p-1.5 rounded-lg hover:bg-white text-gray-400 hover:text-blue-600 transition-colors" title="Invoice">
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <FeedbackModal
        open={!!feedbackWalkIn}
        onClose={() => setFeedbackWalkIn(null)}
        ownerId={ownerId}
        staffId={feedbackWalkIn?.staff_id ?? null}
        staffName={feedbackWalkIn?.staff?.name ?? 'Staff'}
        clientName={feedbackWalkIn?.client_name ?? ''}
        walkInId={feedbackWalkIn?.id}
      />

      <InvoiceModal open={!!invoiceData} onClose={() => setInvoiceData(null)} data={invoiceData} />
    </div>
  )
}

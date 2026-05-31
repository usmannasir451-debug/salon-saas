'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useUserContext } from '@/components/RoleContext'
import type { DiscountType, DiscountReason, PaymentMethod, WalkIn, Service, StaffMember, ClientMembership, ClientPackage, Branch } from '@/lib/types'
import FeedbackModal from '@/components/FeedbackModal'
import InvoiceModal, { type InvoiceData } from '@/components/InvoiceModal'
import {
  Zap, Loader2, X, Banknote, CreditCard, User, Phone, Search,
  Star, ChevronDown, ChevronUp, CheckCircle2, Receipt, Printer,
  MessageSquare, ShoppingCart, Trash2, Package, Clock, History, LayoutGrid, List,
  Crown, Tag, Building2, Plus, Minus, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

// ──────────────── Types ────────────────

type DealItem = {
  id: string
  name: string
  description: string | null
  price: number
  is_active: boolean
  deal_services: { services: { id: string; name: string; price: number; duration: number } | null }[]
}

type PaymentMethodConfig = { value: string; label: string; enabled: boolean }
type ServiceItem = Pick<Service, 'id' | 'name' | 'price' | 'duration'>
type StaffItem = Pick<StaffMember, 'id' | 'name'>
type ClientProfile = { name: string; loyalty_balance: number }

type TodayOrder = {
  id: string
  client_name: string | null
  client_phone: string | null
  total: number
  payment_method: string
  created_at: string
  walk_in_services: { services: { name: string } | null }[]
}

const DEFAULT_PAYMENT_METHODS: PaymentMethodConfig[] = [
  { value: 'cash', label: 'Cash', enabled: true },
  { value: 'card', label: 'Card', enabled: true },
]

const DISCOUNT_REASONS: { value: DiscountReason; label: string }[] = [
  { value: 'loyalty', label: 'Loyalty Reward' },
  { value: 'promo', label: 'Promotion' },
  { value: 'staff_discount', label: 'Staff Discount' },
  { value: 'birthday', label: 'Birthday' },
  { value: 'other', label: 'Other' },
]

const PM_COLORS: Record<string, string> = {
  cash: 'bg-green-500 hover:bg-green-600',
  card: 'bg-blue-500 hover:bg-blue-600',
}

function formatCurrency(n: number, currency = 'USD') {
  return `${currency} ${Math.round(n).toLocaleString()}`
}

// ──────────────── Receipt View ────────────────

function ReceiptView({ walkin, currency, salonName, serviceNames }: {
  walkin: WalkIn; currency: string; salonName: string; serviceNames: string[]
}) {
  return (
    <div id="walkin-receipt" className="bg-white rounded-xl border border-gray-200 p-6 font-mono text-sm max-w-xs mx-auto">
      <div className="text-center mb-4">
        <p className="font-bold text-lg">{salonName || 'Snipforce'}</p>
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
            <span className="font-medium">{(walkin.staff as StaffMember).name}</span>
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
        <p className="mt-1">Powered by Snipforce</p>
      </div>
    </div>
  )
}

// ──────────────── Main Component ────────────────

export default function WalkInPage() {
  const { role, ownerId, permissions } = useUserContext()
  const router = useRouter()

  // Data
  const [services, setServices] = useState<ServiceItem[]>([])
  const [staffList, setStaffList] = useState<StaffItem[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [deals, setDeals] = useState<DealItem[]>([])
  const [paymentMethodConfig, setPaymentMethodConfig] = useState<PaymentMethodConfig[]>(DEFAULT_PAYMENT_METHODS)
  const [currency, setCurrency] = useState('USD')
  const [salonName, setSalonName] = useState('')
  const [salonAddress, setSalonAddress] = useState('')
  const [taxPercentage, setTaxPercentage] = useState(0)
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(false)
  const [loyaltyEarnPct, setLoyaltyEarnPct] = useState(10)
  const [loading, setLoading] = useState(true)

  // Order form
  const [clientPhone, setClientPhone] = useState('')
  const [clientName, setClientName] = useState('')
  const [staffId, setStaffId] = useState('')
  const [branchId, setBranchId] = useState('')
  // serviceQuantities: { [serviceId]: quantity }
  const [serviceQuantities, setServiceQuantities] = useState<Record<string, number>>({})
  const [selectedDealId, setSelectedDealId] = useState('')
  const [discountType, setDiscountType] = useState<DiscountType>('percentage')
  const [discountValue, setDiscountValue] = useState('')
  const [discountReason, setDiscountReason] = useState<DiscountReason | ''>('')
  const [loyaltyRedeem, setLoyaltyRedeem] = useState('')
  const [notes, setNotes] = useState('')
  const [showNotes, setShowNotes] = useState(false)

  // UI
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'services' | 'deals'>('all')
  const [showOrderSheet, setShowOrderSheet] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Client lookup
  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null)
  const [lookingUp, setLookingUp] = useState(false)

  // Membership / package
  const [activeMemberships, setActiveMemberships] = useState<ClientMembership[]>([])
  const [activePackages, setActivePackages] = useState<ClientPackage[]>([])
  const [membershipRedemptions, setMembershipRedemptions] = useState<Record<string, string>>({})
  const [packageRedemptions, setPackageRedemptions] = useState<Record<string, string>>({})
  const [balanceUse, setBalanceUse] = useState('')
  const [showDiscountSection, setShowDiscountSection] = useState(false)

  // After completion
  const [completedWalkIn, setCompletedWalkIn] = useState<WalkIn | null>(null)
  const [completedServiceNames, setCompletedServiceNames] = useState<string[]>([])
  const [feedbackWalkIn, setFeedbackWalkIn] = useState<WalkIn | null>(null)
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null)

  // View mode & history
  const [serviceViewMode, setServiceViewMode] = useState<'grid' | 'list'>('grid')
  const [activeMainTab, setActiveMainTab] = useState<'pos' | 'history'>('pos')
  const [todayOrders, setTodayOrders] = useState<TodayOrder[]>([])
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<TodayOrder | null>(null)
  const [ordersDate, setOrdersDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [linkedAppointmentId, setLinkedAppointmentId] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('walkin_view_mode')
    if (saved === 'list' || saved === 'grid') setServiceViewMode(saved)
  }, [])

  // Pre-fill from appointment check-in
  useEffect(() => {
    const prefillRaw = localStorage.getItem('walkin_prefill')
    if (!prefillRaw) return
    try {
      const data = JSON.parse(prefillRaw) as {
        client_name?: string; client_phone?: string; staff_id?: string
        branch_id?: string; service_ids?: string[]; appointment_id?: string
      }
      if (data.client_name) setClientName(data.client_name)
      if (data.client_phone) { setClientPhone(data.client_phone) }
      if (data.staff_id) setStaffId(data.staff_id)
      if (data.branch_id) setBranchId(data.branch_id)
      if (data.service_ids && data.service_ids.length > 0) {
        const qtys: Record<string, number> = {}
        data.service_ids.forEach((id: string) => { qtys[id] = (qtys[id] ?? 0) + 1 })
        setServiceQuantities(qtys)
      }
      if (data.appointment_id) setLinkedAppointmentId(data.appointment_id)
      localStorage.removeItem('walkin_prefill')
      setActiveMainTab('pos')
    } catch {}
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const hasAccess =
      ['owner', 'regional_manager', 'manager', 'receptionist', 'cashier'].includes(role) ||
      (permissions && permissions.includes('walkin'))
    if (!hasAccess) {
      router.replace('/appointments')
      return
    }
    loadData()
  }, [role, permissions, router]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchOrdersForDate = useCallback(async (dateStr: string) => {
    const supabase = createClient()
    const { data } = await supabase
      .from('walk_ins')
      .select('id, client_name, client_phone, total, payment_method, created_at, walk_in_services(services(name))')
      .eq('user_id', ownerId)
      .gte('created_at', dateStr + 'T00:00:00')
      .lte('created_at', dateStr + 'T23:59:59')
      .order('created_at', { ascending: false })
    setTodayOrders((data as unknown as TodayOrder[]) ?? [])
  }, [ownerId])

  useEffect(() => {
    if (!loading) fetchOrdersForDate(ordersDate)
  }, [ordersDate, loading, fetchOrdersForDate]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    const supabase = createClient()
    const [svcRes, staffRes, profileRes, dealsRes, branchRes] = await Promise.all([
      supabase.from('services').select('id, name, price, duration').eq('user_id', ownerId).order('name'),
      supabase.from('staff').select('id, name').eq('user_id', ownerId).eq('is_active', true).order('name'),
      supabase.from('profiles').select('salon_currency, salon_name, salon_address, tax_percentage, loyalty_enabled, loyalty_earn_pct, payment_methods').eq('id', ownerId).single(),
      supabase.from('deals').select('id, name, description, price, is_active, deal_services(services(id, name, price, duration))').eq('user_id', ownerId).eq('is_active', true).order('name'),
      supabase.from('branches').select('*').eq('user_id', ownerId).order('name'),
    ])
    setServices((svcRes.data ?? []) as ServiceItem[])
    setStaffList((staffRes.data ?? []) as StaffItem[])
    const branchList = (branchRes.data ?? []) as Branch[]
    setBranches(branchList)
    // Auto-select if only one branch
    if (branchList.length === 1) setBranchId(branchList[0].id)
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

    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const { data: todayData } = await supabase
      .from('walk_ins')
      .select('id, client_name, client_phone, total, payment_method, created_at, walk_in_services(services(name))')
      .eq('user_id', ownerId)
      .gte('created_at', todayStr + 'T00:00:00')
      .order('created_at', { ascending: false })
    setTodayOrders((todayData as unknown as TodayOrder[]) ?? [])

    setLoading(false)
  }

  const lookupClient = useCallback(async (phone: string) => {
    if (!phone || phone.length < 7) {
      setClientProfile(null)
      setActiveMemberships([])
      setActivePackages([])
      return
    }
    setLookingUp(true)
    const supabase = createClient()
    const [clientRes, membRes, pkgRes] = await Promise.all([
      supabase.from('clients').select('name, loyalty_balance').eq('user_id', ownerId).eq('phone', phone).maybeSingle(),
      supabase.from('client_memberships')
        .select('*, membership_plans(id, name, type, price, billing_period, discount_percentage)')
        .eq('owner_id', ownerId).eq('client_phone', phone).eq('status', 'active'),
      supabase.from('client_packages')
        .select('*, packages(id, name, price, validity_days)')
        .eq('owner_id', ownerId).eq('client_phone', phone).eq('status', 'active'),
    ])
    setClientProfile(clientRes.data ? { name: clientRes.data.name, loyalty_balance: clientRes.data.loyalty_balance ?? 0 } : null)
    if (clientRes.data && !clientName) setClientName(clientRes.data.name)
    setActiveMemberships((membRes.data ?? []) as unknown as ClientMembership[])
    setActivePackages((pkgRes.data ?? []) as unknown as ClientPackage[])
    setLookingUp(false)
  }, [ownerId, clientName])

  function addService(id: string) {
    setServiceQuantities(prev => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }))
  }

  function removeService(id: string) {
    setServiceQuantities(prev => {
      const n = { ...prev }
      if (!n[id] || n[id] <= 1) {
        delete n[id]
        setMembershipRedemptions(m => { const nm = { ...m }; delete nm[id]; return nm })
        setPackageRedemptions(p => { const np = { ...p }; delete np[id]; return np })
      } else {
        n[id] = n[id] - 1
      }
      return n
    })
  }

  function removeServiceCompletely(id: string) {
    setServiceQuantities(prev => { const n = { ...prev }; delete n[id]; return n })
    setMembershipRedemptions(m => { const n = { ...m }; delete n[id]; return n })
    setPackageRedemptions(p => { const n = { ...p }; delete n[id]; return n })
  }

  // Keep toggleService for backward compatibility with deal selection
  function toggleService(id: string) {
    setServiceQuantities(prev => {
      if (prev[id]) {
        const n = { ...prev }; delete n[id]
        setMembershipRedemptions(m => { const nm = { ...m }; delete nm[id]; return nm })
        setPackageRedemptions(p => { const np = { ...p }; delete np[id]; return np })
        return n
      }
      return { ...prev, [id]: 1 }
    })
  }

  function toggleMembershipRedemption(serviceId: string, membershipId: string) {
    setMembershipRedemptions(prev => {
      const n = { ...prev }
      if (n[serviceId] === membershipId) { delete n[serviceId]; return n }
      return { ...n, [serviceId]: membershipId }
    })
    setPackageRedemptions(prev => { const n = { ...prev }; delete n[serviceId]; return n })
  }

  function togglePackageRedemption(serviceId: string, pkgId: string) {
    setPackageRedemptions(prev => {
      const n = { ...prev }
      if (n[serviceId] === pkgId) { delete n[serviceId]; return n }
      return { ...n, [serviceId]: pkgId }
    })
    setMembershipRedemptions(prev => { const n = { ...prev }; delete n[serviceId]; return n })
  }

  function selectDeal(id: string) {
    if (selectedDealId === id) {
      setSelectedDealId('')
      setServiceQuantities({})
    } else {
      const deal = deals.find(d => d.id === id)
      const svcIds = deal?.deal_services.map(ds => ds.services?.id).filter(Boolean) as string[] ?? []
      setSelectedDealId(id)
      const qtys: Record<string, number> = {}
      svcIds.forEach(sid => { qtys[sid] = 1 })
      setServiceQuantities(qtys)
    }
  }

  function clearOrder() {
    setClientPhone('')
    setClientName('')
    setStaffId('')
    if (branches.length !== 1) setBranchId('')
    setServiceQuantities({})
    setSelectedDealId('')
    setDiscountType('percentage')
    setDiscountValue('')
    setDiscountReason('')
    setLoyaltyRedeem('')
    setBalanceUse('')
    setNotes('')
    setClientProfile(null)
    setActiveMemberships([])
    setActivePackages([])
    setMembershipRedemptions({})
    setPackageRedemptions({})
    setShowNotes(false)
    setShowDiscountSection(false)
  }

  // Derived service IDs list (flat, with duplicates for quantity)
  const selectedServiceIds = useMemo(
    () => Object.entries(serviceQuantities).flatMap(([id, qty]) => Array(qty).fill(id) as string[]),
    [serviceQuantities]
  )

  // Unique services in cart
  const selectedServices = useMemo(
    () => services.filter(s => !!serviceQuantities[s.id]),
    [services, serviceQuantities]
  )

  const selectedDeal = useMemo(
    () => deals.find(d => d.id === selectedDealId) ?? null,
    [deals, selectedDealId]
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
    if (selectedDeal) return Number(selectedDeal.price) + additionalServices.reduce((s, svc) => {
      const qty = serviceQuantities[svc.id] ?? 1
      const isRedeemed = !!membershipRedemptions[svc.id] || !!packageRedemptions[svc.id]
      return s + (isRedeemed ? 0 : Number(svc.price) * qty)
    }, 0)
    return selectedServices.reduce((s, svc) => {
      const qty = serviceQuantities[svc.id] ?? 1
      const isRedeemed = !!membershipRedemptions[svc.id] || !!packageRedemptions[svc.id]
      return s + (isRedeemed ? 0 : Number(svc.price) * qty)
    }, 0)
  }, [selectedDeal, selectedServices, additionalServices, membershipRedemptions, packageRedemptions, serviceQuantities])

  const discountAmount = useMemo(() => {
    const val = parseFloat(discountValue) || 0
    if (discountType === 'percentage') return Math.min((subtotal * val) / 100, subtotal)
    return Math.min(val, subtotal)
  }, [subtotal, discountType, discountValue])

  const loyaltyRedeemAmount = useMemo(() => {
    if (!loyaltyEnabled || !clientProfile) return 0
    const redeem = parseFloat(loyaltyRedeem) || 0
    return Math.min(redeem, clientProfile.loyalty_balance, subtotal - discountAmount)
  }, [loyaltyEnabled, clientProfile, loyaltyRedeem, subtotal, discountAmount])

  const totalBeforeBalance = Math.max(subtotal - discountAmount - loyaltyRedeemAmount, 0)

  const balanceUseAmount = useMemo(() => {
    const bm = activeMemberships.find(m => (m.membership_plans as { type?: string } | undefined)?.type === 'balance_based')
    if (!bm || !balanceUse) return 0
    const requested = parseFloat(balanceUse) || 0
    return Math.min(requested, bm.balance, totalBeforeBalance)
  }, [activeMemberships, balanceUse, totalBeforeBalance])

  const total = Math.max(totalBeforeBalance - balanceUseAmount, 0)

  const loyaltyEarned = useMemo(() => {
    if (!loyaltyEnabled) return 0
    return Math.round((total * loyaltyEarnPct) / 100)
  }, [loyaltyEnabled, total, loyaltyEarnPct])

  const orderItemCount = Object.keys(serviceQuantities).length + (selectedDealId ? 1 : 0)

  const filteredServices = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return services.filter(s => s.name.toLowerCase().includes(q))
  }, [services, searchQuery])

  const filteredDeals = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return deals.filter(d => d.name.toLowerCase().includes(q))
  }, [deals, searchQuery])

  async function handleComplete(method: PaymentMethod) {
    if (Object.keys(serviceQuantities).length === 0 && !selectedDealId) {
      toast.error('Please select at least one service or deal')
      return
    }
    if (!staffId) {
      toast.error('Please select a staff member')
      return
    }
    if (branches.length > 1 && !branchId) {
      toast.error('Please select a branch before completing the order')
      return
    }
    setSubmitting(true)
    const supabase = createClient()

    // Flat list with quantities (duplicate IDs for qty > 1)
    const allServiceIds = selectedServiceIds

    const { data, error } = await supabase
      .from('walk_ins')
      .insert({
        user_id: ownerId,
        client_name: clientName.trim() || null,
        client_phone: clientPhone.trim() || null,
        service_id: allServiceIds[0] || null,
        staff_id: staffId || null,
        branch_id: branchId || null,
        payment_method: method,
        subtotal,
        discount_type: discountValue ? discountType : null,
        discount_value: parseFloat(discountValue) || 0,
        discount_amount: discountAmount,
        discount_reason: discountReason || null,
        loyalty_redeemed: loyaltyRedeemAmount,
        deal_id: selectedDealId || null,
        total,
        payment_status: 'paid',
        notes: notes.trim() || null,
      })
      .select('*, services(id, name, price, duration), staff(id, name)')
      .single()

    if (error) {
      toast.error(error.message)
      setSubmitting(false)
      return
    }

    const walkinData = data as unknown as WalkIn

    if (allServiceIds.length > 0) {
      await supabase.from('walk_in_services').insert(
        allServiceIds.map(sid => ({ walk_in_id: walkinData.id, service_id: sid, user_id: ownerId }))
      )
    }

    if (loyaltyEnabled && clientPhone.trim()) {
      const phone = clientPhone.trim()
      await supabase.from('clients').upsert(
        { user_id: ownerId, phone, name: clientName.trim() || phone },
        { onConflict: 'user_id,phone' }
      )

      const loyaltyTasks: Promise<unknown>[] = []
      if (loyaltyRedeemAmount > 0) {
        loyaltyTasks.push(
          Promise.resolve(supabase.rpc('decrement_loyalty', { p_user_id: ownerId, p_phone: phone, p_amount: loyaltyRedeemAmount })),
          Promise.resolve(supabase.from('loyalty_transactions').insert({
            user_id: ownerId, client_phone: phone,
            client_name: clientName.trim() || null,
            transaction_type: 'redeemed', amount: loyaltyRedeemAmount,
            reference_id: walkinData.id, reference_type: 'walk_in',
          }))
        )
      }
      if (loyaltyEarned > 0) {
        loyaltyTasks.push(
          Promise.resolve(supabase.from('clients')
            .update({ loyalty_balance: (clientProfile?.loyalty_balance ?? 0) - loyaltyRedeemAmount + loyaltyEarned })
            .eq('user_id', ownerId).eq('phone', phone)),
          Promise.resolve(supabase.from('loyalty_transactions').insert({
            user_id: ownerId, client_phone: phone,
            client_name: clientName.trim() || null,
            transaction_type: 'earned', amount: loyaltyEarned,
            reference_id: walkinData.id, reference_type: 'walk_in',
          }))
        )
      }
      await Promise.all(loyaltyTasks)
    }

    // Handle membership service redemptions
    const membRedEntries = Object.entries(membershipRedemptions)
    if (membRedEntries.length > 0) {
      for (const [serviceId, membershipId] of membRedEntries) {
        const membership = activeMemberships.find(m => m.id === membershipId)
        if (!membership) continue
        const currentRemaining = { ...membership.services_remaining }
        currentRemaining[serviceId] = Math.max((Number(currentRemaining[serviceId]) || 0) - 1, 0)
        const allZero = Object.values(currentRemaining).every(v => Number(v) === 0)
        await supabase.from('client_memberships').update({
          services_remaining: currentRemaining,
          ...(allZero ? { status: 'expired' } : {}),
        }).eq('id', membershipId)
        const svcPrice = services.find(s => s.id === serviceId)?.price ?? 0
        const svcName = services.find(s => s.id === serviceId)?.name ?? 'Service'
        await supabase.from('membership_transactions').insert({
          owner_id: ownerId,
          membership_id: membershipId,
          type: 'service_redemption',
          amount: svcPrice,
          description: `Service redeemed at walk-in: ${svcName}`,
        })
      }
    }

    // Handle package service redemptions
    const pkgRedEntries = Object.entries(packageRedemptions)
    if (pkgRedEntries.length > 0) {
      for (const [serviceId, clientPkgId] of pkgRedEntries) {
        const clientPkg = activePackages.find(p => p.id === clientPkgId)
        if (!clientPkg) continue
        const currentRemaining = { ...clientPkg.services_remaining }
        currentRemaining[serviceId] = Math.max((Number(currentRemaining[serviceId]) || 0) - 1, 0)
        const allZero = Object.values(currentRemaining).every(v => Number(v) === 0)
        await supabase.from('client_packages').update({
          services_remaining: currentRemaining,
          ...(allZero ? { status: 'used' } : {}),
        }).eq('id', clientPkgId)
      }
    }

    // Handle balance-based membership usage
    if (balanceUseAmount > 0) {
      const bm = activeMemberships.find(m => (m.membership_plans as { type?: string } | undefined)?.type === 'balance_based')
      if (bm) {
        await supabase.from('client_memberships').update({
          balance: Math.max(bm.balance - balanceUseAmount, 0),
        }).eq('id', bm.id)
        await supabase.from('membership_transactions').insert({
          owner_id: ownerId,
          membership_id: bm.id,
          type: 'balance_credit',
          amount: balanceUseAmount,
          description: 'Balance used for walk-in payment',
        })
      }
    }

    void Promise.all([
      supabase.from('notifications').insert({
        user_id: ownerId, type: 'payment_received',
        title: 'Payment Received',
        message: `${clientName || 'Walk-in client'} paid ${formatCurrency(total, currency)} via ${method}`,
        link: '/walkin',
      }),
      supabase.from('audit_log').insert({
        user_id: ownerId, actor_role: role,
        action: 'payment_walkin', entity_type: 'walk_in',
        entity_id: walkinData.id,
        details: { client: clientName, amount: total, payment: method },
      }),
    ])

    const svcNames = selectedDeal
      ? [selectedDeal.name + ' (Deal)', ...additionalServices.map(s => s.name)]
      : selectedServices.map(s => s.name)

    // If this walk-in came from an appointment check-in, mark it completed
    if (linkedAppointmentId) {
      await supabase.from('appointments').update({ status: 'completed' }).eq('id', linkedAppointmentId)
      setLinkedAppointmentId('')
    }

    setCompletedServiceNames(svcNames)
    setCompletedWalkIn(walkinData)
    if (walkinData.staff_id) setFeedbackWalkIn(walkinData)
    setShowOrderSheet(false)
    clearOrder()
    toast.success('Walk-in recorded!')

    // Refresh orders list
    await fetchOrdersForDate(ordersDate)

    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    )
  }

  // ──────────────── Order Panel Content ────────────────
  const OrderPanel = ({ compact = false }: { compact?: boolean }) => (
    <div className={cn('flex flex-col h-full', compact ? '' : '')}>
      {/* Order items */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0">
        {orderItemCount === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-center">
            <ShoppingCart className="w-10 h-10 text-gray-200 mb-3" />
            <p className="text-sm text-gray-400">No items yet</p>
            <p className="text-xs text-gray-300 mt-1">Tap a service or deal to add</p>
          </div>
        ) : (
          <>
            {selectedDeal && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2 min-w-0">
                  <Package className="w-4 h-4 text-primary flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{selectedDeal.name}</p>
                    <p className="text-xs text-gray-500">Deal package</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-bold text-primary">{formatCurrency(Number(selectedDeal.price), currency)}</span>
                  <button onClick={() => selectDeal(selectedDeal.id)} className="text-gray-400 hover:text-red-500 p-0.5">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
            {selectedDeal && additionalServices.map(svc => (
              <div key={svc.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                <div className="flex items-center gap-2 min-w-0">
                  <Zap className="w-4 h-4 text-primary flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{svc.name}</p>
                    <p className="text-xs text-gray-400">{svc.duration} min</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-bold text-primary">{formatCurrency(Number(svc.price), currency)}</span>
                  <button onClick={() => toggleService(svc.id)} className="text-gray-400 hover:text-red-500 p-0.5">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {!selectedDeal && selectedServices.map(svc => {
              const qty = serviceQuantities[svc.id] ?? 1
              const coveringMembership = activeMemberships.find(m =>
                (m.membership_plans as { type?: string } | undefined)?.type === 'service_based' &&
                Number(m.services_remaining[svc.id] ?? 0) > 0
              )
              const coveringPkg = activePackages.find(p => Number(p.services_remaining[svc.id] ?? 0) > 0)
              const redeemedByMembership = membershipRedemptions[svc.id]
              const redeemedByPkg = packageRedemptions[svc.id]
              const isRedeemed = !!redeemedByMembership || !!redeemedByPkg
              const linePrice = Number(svc.price) * qty
              return (
                <div key={svc.id} className="p-3 rounded-xl bg-gray-50 border border-gray-100 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <Zap className="w-4 h-4 text-primary flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{svc.name}</p>
                        <p className="text-xs text-gray-400">{svc.duration} min</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isRedeemed ? (
                        <span className="text-xs text-gray-400 line-through">{formatCurrency(linePrice, currency)}</span>
                      ) : (
                        <span className="text-sm font-bold text-primary">{formatCurrency(linePrice, currency)}</span>
                      )}
                      <button onClick={() => removeServiceCompletely(svc.id)} className="text-gray-400 hover:text-red-500 p-0.5">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {/* Quantity controls */}
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => removeService(svc.id)}
                      className="w-6 h-6 rounded-full border border-gray-200 bg-white flex items-center justify-center hover:bg-red-50 hover:border-red-300 transition-colors">
                      <Minus className="w-3 h-3 text-gray-500" />
                    </button>
                    <span className="text-sm font-bold text-gray-800 min-w-[20px] text-center">{qty}</span>
                    <button type="button" onClick={() => addService(svc.id)}
                      className="w-6 h-6 rounded-full border border-gray-200 bg-white flex items-center justify-center hover:bg-primary/10 hover:border-primary/40 transition-colors">
                      <Plus className="w-3 h-3 text-gray-500" />
                    </button>
                    <span className="text-xs text-gray-400 ml-1">× {formatCurrency(Number(svc.price), currency)} each</span>
                  </div>
                  {(coveringMembership || coveringPkg) && (
                    <div className="flex gap-1 flex-wrap">
                      {coveringMembership && (
                        <button
                          type="button"
                          onClick={() => toggleMembershipRedemption(svc.id, coveringMembership.id)}
                          className={cn(
                            'flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors',
                            redeemedByMembership
                              ? 'bg-amber-500 text-white border-amber-500'
                              : 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100'
                          )}
                        >
                          <Crown className="w-2.5 h-2.5" />
                          {redeemedByMembership ? 'Membership Applied' : 'Apply Membership'}
                        </button>
                      )}
                      {coveringPkg && (
                        <button
                          type="button"
                          onClick={() => togglePackageRedemption(svc.id, coveringPkg.id)}
                          className={cn(
                            'flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors',
                            redeemedByPkg
                              ? 'bg-blue-500 text-white border-blue-500'
                              : 'bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100'
                          )}
                        >
                          <Package className="w-2.5 h-2.5" />
                          {redeemedByPkg ? 'Package Redeemed' : 'Redeem Package'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>

      {/* Summary + checkout section */}
      <div className="border-t border-gray-100 px-4 py-3 space-y-3 flex-shrink-0 overflow-y-auto max-h-[60vh]">
        {/* Subtotal row */}
        <div className="flex justify-between text-sm text-gray-600">
          <span>Subtotal</span>
          <span className="font-medium">{formatCurrency(subtotal, currency)}</span>
        </div>

        {/* Discount section — collapsible */}
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => setShowDiscountSection(v => !v)}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors w-full"
          >
            <Tag className="w-3 h-3" />
            <span>Add Discount</span>
            {discountAmount > 0 && (
              <span className="text-green-600 font-semibold ml-1">
                (-{formatCurrency(discountAmount, currency)})
              </span>
            )}
            {showDiscountSection ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
          </button>
          {showDiscountSection && (
            <div className="space-y-2 pt-1">
              <div className="flex gap-2">
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as DiscountType)}
                  className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary/50 w-28 flex-shrink-0"
                >
                  <option value="percentage">% Off</option>
                  <option value="fixed">Fixed</option>
                </select>
                <Input
                  type="number"
                  min="0"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder={discountType === 'percentage' ? 'Discount %' : `Discount ${currency}`}
                  className="h-9 flex-1"
                />
                {discountValue && (
                  <button onClick={() => { setDiscountValue(''); setDiscountReason('') }} className="text-gray-400 hover:text-gray-600 p-1 flex-shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              {discountValue && (
                <Select value={discountReason} onValueChange={(v) => setDiscountReason(v as DiscountReason | '')}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Discount reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {DISCOUNT_REASONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount applied</span>
                  <span>-{formatCurrency(discountAmount, currency)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Loyalty */}
        {loyaltyEnabled && clientProfile && clientProfile.loyalty_balance > 0 && (
          <div className="rounded-xl bg-purple-50 border border-purple-200 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-purple-500" />
                <span className="text-xs font-semibold text-purple-800">Loyalty Points</span>
              </div>
              <span className="text-xs font-bold text-purple-700">Balance: {formatCurrency(clientProfile.loyalty_balance, currency)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number" min="0" max={clientProfile.loyalty_balance}
                value={loyaltyRedeem}
                onChange={(e) => setLoyaltyRedeem(e.target.value)}
                placeholder="Redeem amount"
                className="h-8 flex-1 text-sm"
              />
              <Button
                type="button" size="sm" variant="outline"
                onClick={() => setLoyaltyRedeem(String(Math.min(clientProfile.loyalty_balance, subtotal - discountAmount)))}
                className="h-8 border-purple-300 text-purple-700 hover:bg-purple-100 text-xs px-2"
              >
                Max
              </Button>
            </div>
            {loyaltyRedeemAmount > 0 && (
              <div className="flex justify-between text-xs text-purple-600">
                <span>Points redeemed</span>
                <span>-{formatCurrency(loyaltyRedeemAmount, currency)}</span>
              </div>
            )}
          </div>
        )}

        {/* Balance-based membership payment */}
        {(() => {
          const bm = activeMemberships.find(m => (m.membership_plans as { type?: string } | undefined)?.type === 'balance_based')
          if (!bm || bm.balance <= 0) return null
          const planName = (bm.membership_plans as { name?: string } | undefined)?.name ?? 'Membership'
          return (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-xs font-semibold text-amber-800">{planName} Balance</span>
                </div>
                <span className="text-xs font-bold text-amber-700">
                  Available: {formatCurrency(bm.balance, currency)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number" min="0" max={bm.balance}
                  value={balanceUse}
                  onChange={e => setBalanceUse(e.target.value)}
                  placeholder="Use balance amount"
                  className="h-8 flex-1 text-sm"
                />
                <Button
                  type="button" size="sm" variant="outline"
                  onClick={() => setBalanceUse(String(Math.min(bm.balance, totalBeforeBalance)))}
                  className="h-8 border-amber-300 text-amber-700 hover:bg-amber-100 text-xs px-2"
                >
                  Max
                </Button>
              </div>
              {balanceUseAmount > 0 && (
                <div className="flex justify-between text-xs text-amber-600">
                  <span>Balance used</span>
                  <span>-{formatCurrency(balanceUseAmount, currency)}</span>
                </div>
              )}
            </div>
          )
        })()}

        {/* Total */}
        <div className="flex justify-between items-center py-2 border-t border-gray-100">
          <span className="text-base font-bold text-gray-900">Total</span>
          <span className="text-2xl font-black text-primary">{formatCurrency(total, currency)}</span>
        </div>

        {loyaltyEnabled && loyaltyEarned > 0 && (
          <p className="text-xs text-purple-600 text-right -mt-1">+{formatCurrency(loyaltyEarned, currency)} loyalty earned</p>
        )}

        {/* Payment buttons */}
        <div className="grid grid-cols-2 gap-2">
          {paymentMethodConfig.filter(pm => pm.enabled).map(pm => {
            const color = PM_COLORS[pm.value] ?? 'bg-gray-600 hover:bg-gray-700'
            const disabled = submitting || orderItemCount === 0
            return (
              <button
                key={pm.value}
                type="button"
                disabled={disabled}
                onClick={() => handleComplete(pm.value as PaymentMethod)}
                className={cn(
                  'flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-white font-semibold text-sm transition-all',
                  color, 'disabled:opacity-50 disabled:cursor-not-allowed shadow-sm'
                )}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : pm.value === 'cash' ? (
                  <Banknote className="w-4 h-4" />
                ) : pm.value === 'card' ? (
                  <CreditCard className="w-4 h-4" />
                ) : null}
                {pm.label}
              </button>
            )
          })}
        </div>

        {/* Notes toggle */}
        <button
          type="button"
          onClick={() => setShowNotes(v => !v)}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors w-full"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          {showNotes ? 'Hide notes' : 'Add notes'}
          {showNotes ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
        </button>
        {showNotes && (
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any special notes..."
            className="h-9 text-sm"
          />
        )}

        {/* Clear */}
        {orderItemCount > 0 && (
          <button
            type="button"
            onClick={clearOrder}
            className="flex items-center justify-center gap-1.5 text-xs text-red-400 hover:text-red-600 w-full py-1"
          >
            <Trash2 className="w-3 h-3" /> Clear order
          </button>
        )}
      </div>
    </div>
  )

  // ──────────────── Full Page Layout ────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-0px)] lg:h-screen overflow-hidden bg-gray-50">

      {/* ── Page Header ── */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <div className="hidden sm:block min-w-0">
            <h1 className="text-base font-bold text-gray-900">Walk-In POS</h1>
            <p className="text-xs text-gray-400">Select services, choose payment</p>
          </div>
        </div>
        {/* Tab switcher */}
        <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-0.5 bg-gray-50">
          <button
            onClick={() => setActiveMainTab('pos')}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1',
              activeMainTab === 'pos' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            <Zap className="w-3 h-3" /> POS
          </button>
          <button
            onClick={() => setActiveMainTab('history')}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5',
              activeMainTab === 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            <History className="w-3 h-3" />
            Orders
            {todayOrders.length > 0 && (
              <span className={cn(
                'text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold',
                activeMainTab === 'history' ? 'bg-primary text-white' : 'bg-gray-300 text-gray-600'
              )}>
                {todayOrders.length}
              </span>
            )}
          </button>
        </div>
        {/* Mobile: order button in header */}
        {activeMainTab === 'pos' && (
          <button
            className="md:hidden flex items-center gap-2 bg-primary text-white rounded-xl px-3 py-2 text-sm font-semibold flex-shrink-0"
            onClick={() => setShowOrderSheet(true)}
          >
            <ShoppingCart className="w-4 h-4" />
            {orderItemCount > 0 && (
              <span className="bg-white text-primary rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                {orderItemCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* ── Split Layout (POS mode) ── */}
      {activeMainTab === 'history' ? (
        /* ── Orders History ── */
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
              <History className="w-4 h-4 text-primary" />
              Orders
            </h2>
            <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1">
              <button
                type="button"
                onClick={() => {
                  const d = new Date(ordersDate); d.setDate(d.getDate() - 1)
                  setOrdersDate(format(d, 'yyyy-MM-dd'))
                }}
                className="p-0.5 rounded hover:bg-gray-200 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-gray-500" />
              </button>
              <span className="text-xs font-medium text-gray-700 min-w-[90px] text-center">
                {ordersDate === format(new Date(), 'yyyy-MM-dd') ? 'Today' : format(new Date(ordersDate + 'T00:00:00'), 'MMM d, yyyy')}
              </span>
              <button
                type="button"
                disabled={ordersDate >= format(new Date(), 'yyyy-MM-dd')}
                onClick={() => {
                  const d = new Date(ordersDate); d.setDate(d.getDate() + 1)
                  const next = format(d, 'yyyy-MM-dd')
                  if (next <= format(new Date(), 'yyyy-MM-dd')) setOrdersDate(next)
                }}
                className="p-0.5 rounded hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>
          {todayOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ShoppingCart className="w-12 h-12 text-gray-200 mb-3" />
              <p className="text-sm text-gray-400">No orders yet today</p>
              <p className="text-xs text-gray-300 mt-1">Completed walk-ins will appear here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {todayOrders.map(order => {
                const services = order.walk_in_services.map(ws => ws.services?.name).filter(Boolean)
                return (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => setSelectedOrderDetail(order)}
                    className="w-full text-left bg-white border border-gray-100 rounded-xl p-4 hover:border-primary/30 hover:bg-primary/5 transition-all"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{order.client_name || 'Walk-in Client'}</span>
                        <Badge className="bg-green-50 text-green-700 border-green-200 text-xs capitalize">{order.payment_method}</Badge>
                      </div>
                      <span className="text-base font-bold text-primary">{formatCurrency(order.total, currency)}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{format(new Date(order.created_at), 'h:mm a')}</span>
                      {order.client_phone && <span>{order.client_phone}</span>}
                      {services.length > 0 && <span className="truncate">{services.join(', ')}</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      ) : (
      <div className="flex-1 flex overflow-hidden">

        {/* ─── LEFT PANEL: Service picker ─── */}
        <div className="flex-1 md:flex-[3] flex flex-col overflow-hidden min-w-0 bg-white border-r border-gray-100">

          {/* Client + Staff row */}
          <div className="flex-shrink-0 px-4 py-3 border-b border-gray-100 space-y-2">
            <div className="grid grid-cols-2 gap-3">
              {/* Phone lookup */}
              <div className="space-y-1">
                <Label className="text-xs text-gray-500 flex items-center gap-1">
                  <Phone className="w-3 h-3" /> Client Phone
                </Label>
                <div className="relative">
                  <Input
                    value={clientPhone}
                    onChange={(e) => {
                      setClientPhone(e.target.value)
                      lookupClient(e.target.value)
                    }}
                    placeholder="03001234567"
                    className="h-9 pr-8 text-sm"
                  />
                  {lookingUp && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-gray-400" />}
                </div>
              </div>
              {/* Client name */}
              <div className="space-y-1">
                <Label className="text-xs text-gray-500 flex items-center gap-1">
                  <User className="w-3 h-3" /> Client Name
                </Label>
                <Input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Guest"
                  className="h-9 text-sm"
                />
              </div>
            </div>
            {/* Client loyalty banner */}
            {clientProfile && (
              <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg px-2.5 py-1.5">
                <Star className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                <span className="text-xs text-purple-700 font-medium">
                  {clientProfile.name} · Loyalty: {formatCurrency(clientProfile.loyalty_balance, currency)}
                </span>
              </div>
            )}
            {/* Active membership banners */}
            {activeMemberships.map(m => {
              const plan = m.membership_plans as { name?: string; type?: string } | undefined
              return (
                <div key={m.id} className="rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <Crown className="w-3 h-3 text-amber-600 flex-shrink-0" />
                    <span className="text-xs font-semibold text-amber-800 truncate">
                      Active Membership: {plan?.name ?? 'Membership'}
                    </span>
                  </div>
                  {plan?.type === 'service_based' ? (
                    <p className="text-[10px] text-amber-700 truncate">
                      {Object.entries(m.services_remaining).map(([sid, qty]) => {
                        const svcName = services.find(s => s.id === sid)?.name ?? sid
                        return `${svcName}: ${qty} left`
                      }).join(' · ')}
                    </p>
                  ) : (
                    <p className="text-[10px] text-amber-700">Balance: {formatCurrency(m.balance, currency)}</p>
                  )}
                </div>
              )
            })}
            {/* Active package banners */}
            {activePackages.map(p => {
              const pkg = p.packages as { name?: string } | undefined
              return (
                <div key={p.id} className="rounded-lg bg-blue-50 border border-blue-200 px-2.5 py-1.5 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <Package className="w-3 h-3 text-blue-600 flex-shrink-0" />
                    <span className="text-xs font-semibold text-blue-800 truncate">
                      Package: {pkg?.name ?? 'Package'}
                    </span>
                  </div>
                  <p className="text-[10px] text-blue-700 truncate">
                    {Object.entries(p.services_remaining).map(([sid, qty]) => {
                      const svcName = services.find(s => s.id === sid)?.name ?? sid
                      return `${svcName}: ${qty} left`
                    }).join(' · ')}
                  </p>
                </div>
              )
            })}
            {/* Staff + Branch row */}
            <div className="grid grid-cols-2 gap-2">
              <Select value={staffId || ''} onValueChange={(v) => setStaffId(v ?? '')}>
                <SelectTrigger className={cn('h-9 text-sm', !staffId ? 'border-amber-300' : '')}>
                  <SelectValue placeholder="Staff * (required)">
                    {staffId ? (staffList.find(s => s.id === staffId)?.name ?? 'Select staff') : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {staffList.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {branches.length > 1 && (
                <Select value={branchId || ''} onValueChange={(v) => setBranchId(v ?? '')}>
                  <SelectTrigger className={cn('h-9 text-sm', !branchId ? 'border-amber-300 text-amber-700' : '')}>
                    <SelectValue placeholder="Branch *">
                      {branchId ? (branches.find(b => b.id === branchId)?.name ?? 'Select branch') : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Search + Tab filters */}
          <div className="flex-shrink-0 px-4 py-2 border-b border-gray-100 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search services or deals..."
                className="pl-9 h-9 text-sm"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1">
              {(['all', 'services', 'deals'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize',
                    activeTab === tab
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  {tab === 'all' ? 'All' : tab === 'deals' ? `Deals (${filteredDeals.length})` : `Services (${filteredServices.length})`}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  const next = serviceViewMode === 'grid' ? 'list' : 'grid'
                  setServiceViewMode(next)
                  localStorage.setItem('walkin_view_mode', next)
                }}
                className="ml-auto h-7 w-7 flex items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 flex-shrink-0"
                title={serviceViewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
              >
                {serviceViewMode === 'grid' ? <List className="w-3.5 h-3.5 text-gray-500" /> : <LayoutGrid className="w-3.5 h-3.5 text-gray-500" />}
              </button>
            </div>
          </div>

          {/* Services / Deals grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Deals section */}
            {(activeTab === 'all' || activeTab === 'deals') && filteredDeals.length > 0 && (
              <div className="mb-4">
                {activeTab === 'all' && <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Deals</p>}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                  {filteredDeals.map(deal => {
                    const isSelected = selectedDealId === deal.id
                    return (
                      <button
                        key={deal.id}
                        type="button"
                        onClick={() => selectDeal(deal.id)}
                        className={cn(
                          'flex flex-col items-start p-3 rounded-xl text-left transition-all border relative',
                          isSelected
                            ? 'bg-primary text-white border-primary shadow-md'
                            : 'bg-gray-50 border-gray-200 hover:border-primary/40 hover:bg-primary/5'
                        )}
                      >
                        {isSelected && (
                          <div className="absolute top-2 right-2">
                            <CheckCircle2 className="w-4 h-4 text-white" />
                          </div>
                        )}
                        <Package className={cn('w-4 h-4 mb-1', isSelected ? 'text-white/80' : 'text-primary')} />
                        <span className={cn('font-semibold text-sm leading-tight', isSelected ? 'text-white' : 'text-gray-900')}>{deal.name}</span>
                        <span className={cn('text-xs mt-0.5 line-clamp-1', isSelected ? 'text-white/70' : 'text-gray-500')}>
                          {deal.deal_services.map(ds => ds.services?.name).filter(Boolean).join(', ')}
                        </span>
                        <span className={cn('text-sm font-bold mt-2', isSelected ? 'text-white' : 'text-primary')}>
                          {formatCurrency(Number(deal.price), currency)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Services section */}
            {(activeTab === 'all' || activeTab === 'services') && (
              <div>
                {activeTab === 'all' && filteredDeals.length > 0 && <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Services</p>}
                {filteredServices.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">No services found</div>
                ) : serviceViewMode === 'list' ? (
                  <div className="space-y-1">
                    {filteredServices.map(svc => {
                      const qty = serviceQuantities[svc.id] ?? 0
                      const isDealService = dealServiceIds.includes(svc.id)
                      return (
                        <div
                          key={svc.id}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2 rounded-lg border transition-all',
                            qty > 0 ? 'bg-primary/5 border-primary/40' : 'bg-gray-50 border-gray-100 hover:border-primary/20',
                            isDealService && qty === 0 ? 'opacity-50' : ''
                          )}
                        >
                          <span className="flex-1 text-sm font-medium text-gray-900 truncate">{svc.name}</span>
                          {qty > 0 && <span className="text-xs font-bold text-primary flex-shrink-0">×{qty}</span>}
                          <span className="text-xs text-gray-400 flex-shrink-0">{svc.duration} min</span>
                          <span className="text-sm font-bold text-primary flex-shrink-0 w-24 text-right">{formatCurrency(Number(svc.price), currency)}</span>
                          <button
                            type="button"
                            onClick={() => addService(svc.id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold transition-colors bg-primary text-white hover:bg-primary/80"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                    {filteredServices.map(svc => {
                      const qty = serviceQuantities[svc.id] ?? 0
                      const isDealService = dealServiceIds.includes(svc.id)
                      return (
                        <button
                          key={svc.id}
                          type="button"
                          onClick={() => addService(svc.id)}
                          className={cn(
                            'flex flex-col items-start p-3 rounded-xl text-left transition-all border relative',
                            qty > 0
                              ? 'bg-primary text-white border-primary shadow-md'
                              : 'bg-gray-50 border-gray-200 hover:border-primary/40 hover:bg-primary/5',
                            isDealService && qty === 0 ? 'opacity-50' : ''
                          )}
                        >
                          {qty > 0 && (
                            <div className="absolute top-2 right-2 bg-white text-primary rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shadow-sm">
                              {qty}
                            </div>
                          )}
                          <span className={cn('font-semibold text-sm leading-tight truncate w-full pr-5', qty > 0 ? 'text-white' : 'text-gray-900')}>{svc.name}</span>
                          <div className={cn('flex items-center gap-1 mt-1', qty > 0 ? 'text-white/70' : 'text-gray-400')}>
                            <Clock className="w-3 h-3" />
                            <span className="text-xs">{svc.duration} min</span>
                          </div>
                          <span className={cn('text-sm font-bold mt-2', qty > 0 ? 'text-white' : 'text-primary')}>
                            {formatCurrency(Number(svc.price), currency)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'deals' && filteredDeals.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm">No deals found</div>
            )}
          </div>
        </div>

        {/* ─── RIGHT PANEL: Order (desktop only) ─── */}
        <div className="hidden md:flex flex-[2] flex-col bg-white overflow-hidden max-w-sm">
          <div className="flex-shrink-0 px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-primary" />
              Current Order
              {orderItemCount > 0 && (
                <Badge className="bg-primary/10 text-primary border-primary/20 text-xs ml-auto">
                  {orderItemCount} item{orderItemCount !== 1 ? 's' : ''}
                </Badge>
              )}
            </h2>
          </div>
          <OrderPanel />
        </div>
      </div>
      )} {/* end activeMainTab === 'pos' */}

      {/* ── Mobile: sticky View Order button (POS mode only) ── */}
      {activeMainTab === 'pos' && orderItemCount > 0 && (
        <div className="md:hidden flex-shrink-0 px-4 py-3 bg-white border-t border-gray-100 safe-area-bottom">
          <button
            onClick={() => setShowOrderSheet(true)}
            className="w-full flex items-center justify-between bg-primary text-white rounded-xl px-4 py-3 font-semibold text-sm shadow-lg"
          >
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              View Order ({orderItemCount} item{orderItemCount !== 1 ? 's' : ''})
            </div>
            <span className="text-lg font-black">{formatCurrency(total, currency)}</span>
          </button>
        </div>
      )}

      {/* ── Mobile: Order Sheet Dialog ── */}
      <Dialog open={showOrderSheet} onOpenChange={setShowOrderSheet}>
        <DialogContent className="sm:max-w-sm h-[90vh] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-primary" />
              Current Order
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <OrderPanel compact />
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Completion Modal ── */}
      <Dialog open={!!completedWalkIn} onOpenChange={(o) => { if (!o) setCompletedWalkIn(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="w-5 h-5" />
              Walk-In Complete!
            </DialogTitle>
          </DialogHeader>
          {completedWalkIn && (
            <ReceiptView walkin={completedWalkIn} currency={currency} salonName={salonName} serviceNames={completedServiceNames} />
          )}
          <DialogFooter className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5 flex-1">
              <Printer className="w-4 h-4" /> Print
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 flex-1"
              onClick={() => {
                if (!completedWalkIn) return
                const msg = encodeURIComponent(
                  `Thank you for visiting ${salonName}!\nYour receipt: ${formatCurrency(completedWalkIn.total, currency)}`
                )
                window.open(`https://wa.me/?text=${msg}`, '_blank')
              }}
            >
              WhatsApp
            </Button>
            <Button
              size="sm"
              className="bg-primary hover:bg-primary/90 flex-1"
              onClick={() => {
                if (completedWalkIn) {
                  setInvoiceData({
                    id: completedWalkIn.id,
                    invoiceType: 'walkin',
                    salonName, salonAddress,
                    clientName: completedWalkIn.client_name ?? undefined,
                    clientPhone: completedWalkIn.client_phone ?? undefined,
                    staffName: (completedWalkIn.staff as StaffMember | undefined)?.name,
                    serviceName: completedServiceNames.join(', ') || undefined,
                    date: completedWalkIn.created_at.slice(0, 10),
                    subtotal: completedWalkIn.subtotal,
                    discountAmount: completedWalkIn.discount_amount,
                    taxPercentage,
                    total: completedWalkIn.total,
                    paymentMethod: completedWalkIn.payment_method,
                    currency,
                  })
                }
                setCompletedWalkIn(null)
              }}
            >
              <Receipt className="w-4 h-4 mr-1" /> Invoice
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCompletedWalkIn(null)}
            >
              New Walk-In
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FeedbackModal
        open={!!feedbackWalkIn}
        onClose={() => setFeedbackWalkIn(null)}
        ownerId={ownerId}
        staffId={feedbackWalkIn?.staff_id ?? null}
        staffName={(feedbackWalkIn?.staff as StaffMember | undefined)?.name ?? 'Staff'}
        clientName={feedbackWalkIn?.client_name ?? ''}
        walkInId={feedbackWalkIn?.id}
      />

      <InvoiceModal open={!!invoiceData} onClose={() => setInvoiceData(null)} data={invoiceData} />

      {/* ── Order Detail Dialog ── */}
      <Dialog open={!!selectedOrderDetail} onOpenChange={(o) => { if (!o) setSelectedOrderDetail(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-800">
              <Receipt className="w-4 h-4 text-primary" />
              Order Details
            </DialogTitle>
          </DialogHeader>
          {selectedOrderDetail && (
            <div className="space-y-3 text-sm">
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Time</span>
                  <span className="font-medium">{format(new Date(selectedOrderDetail.created_at), 'h:mm a')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Client</span>
                  <span className="font-medium">{selectedOrderDetail.client_name || 'Walk-in'}</span>
                </div>
                {selectedOrderDetail.client_phone && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Phone</span>
                    <span className="font-medium">{selectedOrderDetail.client_phone}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Payment</span>
                  <span className="font-medium capitalize">{selectedOrderDetail.payment_method}</span>
                </div>
              </div>
              {selectedOrderDetail.walk_in_services.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-1.5 uppercase tracking-wide font-semibold">Services</p>
                  <div className="space-y-1">
                    {selectedOrderDetail.walk_in_services.map((ws, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <Zap className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        <span>{ws.services?.name ?? 'Service'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-between items-center border-t border-gray-100 pt-3">
                <span className="font-bold text-gray-900">Total</span>
                <span className="text-xl font-black text-primary">{formatCurrency(selectedOrderDetail.total, currency)}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSelectedOrderDetail(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

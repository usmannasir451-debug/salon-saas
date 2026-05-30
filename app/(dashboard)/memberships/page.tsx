'use client'

import { useEffect, useState, useCallback } from 'react'
import { format, addDays, addMonths, addQuarters, addYears } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { useUserContext } from '@/components/RoleContext'
import { useCurrency } from '@/hooks/useCurrency'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Crown,
  Plus,
  Search,
  Loader2,
  Package,
  Users,
  TrendingUp,
  AlertTriangle,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Edit,
  X,
  Check,
  RefreshCw,
  Calendar,
  Phone,
} from 'lucide-react'
import type { MembershipPlan, Package as PkgType, ClientMembership, ClientPackage, Service } from '@/lib/types'

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = 'plans' | 'packages' | 'members'

type PlanFormData = {
  name: string
  description: string
  type: 'service_based' | 'balance_based'
  price: string
  billing_period: 'monthly' | 'quarterly' | 'yearly'
  discount_percentage: string
  services_included: Array<{ service_id: string; service_name: string; quantity_per_period: number }>
}

type PkgFormData = {
  name: string
  description: string
  price: string
  validity_days: string
  services_included: Array<{ service_id: string; service_name: string; quantity: number }>
}

type AssignMembershipForm = {
  client_phone: string
  client_name: string
  plan_id: string
  payment_amount: string
}

type AssignPackageForm = {
  client_phone: string
  client_name: string
  package_id: string
  payment_amount: string
}

const BILLING_LABEL: Record<string, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-50 text-green-700 border-green-200',
  paused: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
  expired: 'bg-red-50 text-red-600 border-red-200',
  used: 'bg-purple-50 text-purple-700 border-purple-200',
}

// ─── Empty form defaults ──────────────────────────────────────────────────────

const emptyPlanForm = (): PlanFormData => ({
  name: '',
  description: '',
  type: 'service_based',
  price: '',
  billing_period: 'monthly',
  discount_percentage: '0',
  services_included: [],
})

const emptyPkgForm = (): PkgFormData => ({
  name: '',
  description: '',
  price: '',
  validity_days: '365',
  services_included: [],
})

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MembershipsPage() {
  const { ownerId } = useUserContext()
  const { formatAmount } = useCurrency()

  const [activeTab, setActiveTab] = useState<Tab>('plans')
  const [loading, setLoading] = useState(true)
  const [services, setServices] = useState<Service[]>([])

  // Plans
  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [planSearch, setPlanSearch] = useState('')
  const [planFormOpen, setPlanFormOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<MembershipPlan | null>(null)
  const [planForm, setPlanForm] = useState<PlanFormData>(emptyPlanForm())
  const [savingPlan, setSavingPlan] = useState(false)
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null)
  const [togglingPlanId, setTogglingPlanId] = useState<string | null>(null)

  // Packages
  const [packages, setPackages] = useState<PkgType[]>([])
  const [pkgSearch, setPkgSearch] = useState('')
  const [pkgFormOpen, setPkgFormOpen] = useState(false)
  const [editingPkg, setEditingPkg] = useState<PkgType | null>(null)
  const [pkgForm, setPkgForm] = useState<PkgFormData>(emptyPkgForm())
  const [savingPkg, setSavingPkg] = useState(false)
  const [deletingPkgId, setDeletingPkgId] = useState<string | null>(null)
  const [togglingPkgId, setTogglingPkgId] = useState<string | null>(null)

  // Members
  const [memberships, setMemberships] = useState<ClientMembership[]>([])
  const [clientPackages, setClientPackages] = useState<ClientPackage[]>([])
  const [memberSearch, setMemberSearch] = useState('')
  const [memberTab, setMemberTab] = useState<'memberships' | 'packages'>('memberships')

  // Assign membership
  const [assignMemberOpen, setAssignMemberOpen] = useState(false)
  const [assignMemberForm, setAssignMemberForm] = useState<AssignMembershipForm>({
    client_phone: '', client_name: '', plan_id: '', payment_amount: '',
  })
  const [assigningMember, setAssigningMember] = useState(false)

  // Assign package
  const [assignPkgOpen, setAssignPkgOpen] = useState(false)
  const [assignPkgForm, setAssignPkgForm] = useState<AssignPackageForm>({
    client_phone: '', client_name: '', package_id: '', payment_amount: '',
  })
  const [assigningPkg, setAssigningPkg] = useState(false)

  // Status update
  const [updatingMembershipId, setUpdatingMembershipId] = useState<string | null>(null)
  const [updatingPackageId, setUpdatingPackageId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!ownerId) return
    setLoading(true)
    const supabase = createClient()

    const [plansRes, pkgsRes, svcsRes, membershipsRes, clientPkgsRes] = await Promise.all([
      supabase.from('membership_plans').select('*').eq('owner_id', ownerId).order('created_at', { ascending: false }),
      supabase.from('packages').select('*').eq('owner_id', ownerId).order('created_at', { ascending: false }),
      supabase.from('services').select('id, name, price').eq('user_id', ownerId).order('name'),
      supabase.from('client_memberships')
        .select('*, membership_plans(id, name, type, price, billing_period, discount_percentage)')
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: false }),
      supabase.from('client_packages')
        .select('*, packages(id, name, price, validity_days)')
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: false }),
    ])

    setPlans((plansRes.data ?? []) as unknown as MembershipPlan[])
    setPackages((pkgsRes.data ?? []) as unknown as PkgType[])
    setServices((svcsRes.data ?? []) as Service[])
    setMemberships((membershipsRes.data ?? []) as unknown as ClientMembership[])
    setClientPackages((clientPkgsRes.data ?? []) as unknown as ClientPackage[])
    setLoading(false)
  }, [ownerId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ── Stats ─────────────────────────────────────────────────────────────────

  const activeMemberships = memberships.filter(m => m.status === 'active')
  const activePackages = clientPackages.filter(p => p.status === 'active')

  const mrr = activeMemberships.reduce((sum, m) => {
    const plan = m.membership_plans
    if (!plan) return sum
    const monthly = plan.billing_period === 'monthly' ? plan.price
      : plan.billing_period === 'quarterly' ? plan.price / 3
      : plan.price / 12
    return sum + monthly
  }, 0)

  const thisMonth = format(new Date(), 'yyyy-MM')
  const pkgsSoldThisMonth = clientPackages.filter(p => p.created_at.startsWith(thisMonth)).length

  const sevenDaysLater = addDays(new Date(), 7)
  const expiringMemberships = activeMemberships.filter(m => {
    if (!m.next_billing_date) return false
    const d = new Date(m.next_billing_date)
    return d <= sevenDaysLater && d >= new Date()
  })

  // ── Plan CRUD ─────────────────────────────────────────────────────────────

  function openCreatePlan() {
    setEditingPlan(null)
    setPlanForm(emptyPlanForm())
    setPlanFormOpen(true)
  }

  function openEditPlan(plan: MembershipPlan) {
    setEditingPlan(plan)
    setPlanForm({
      name: plan.name,
      description: plan.description ?? '',
      type: plan.type,
      price: String(plan.price),
      billing_period: plan.billing_period,
      discount_percentage: String(plan.discount_percentage),
      services_included: plan.services_included ?? [],
    })
    setPlanFormOpen(true)
  }

  async function savePlan(e: React.FormEvent) {
    e.preventDefault()
    setSavingPlan(true)
    const supabase = createClient()
    const payload = {
      owner_id: ownerId,
      name: planForm.name.trim(),
      description: planForm.description.trim() || null,
      type: planForm.type,
      price: parseFloat(planForm.price) || 0,
      billing_period: planForm.billing_period,
      discount_percentage: parseFloat(planForm.discount_percentage) || 0,
      services_included: planForm.services_included,
    }
    try {
      if (editingPlan) {
        const { error } = await supabase.from('membership_plans').update(payload).eq('id', editingPlan.id)
        if (error) throw error
        toast.success('Membership plan updated')
      } else {
        const { error } = await supabase.from('membership_plans').insert(payload)
        if (error) throw error
        toast.success('Membership plan created')
      }
      setPlanFormOpen(false)
      loadData()
    } catch {
      toast.error('Failed to save plan')
    } finally {
      setSavingPlan(false)
    }
  }

  async function togglePlan(plan: MembershipPlan) {
    setTogglingPlanId(plan.id)
    const supabase = createClient()
    const { error } = await supabase.from('membership_plans').update({ is_active: !plan.is_active }).eq('id', plan.id)
    if (error) toast.error('Failed to update plan')
    else setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, is_active: !p.is_active } : p))
    setTogglingPlanId(null)
  }

  async function deletePlan(id: string) {
    setDeletingPlanId(id)
    const supabase = createClient()
    const { error } = await supabase.from('membership_plans').delete().eq('id', id)
    if (error) toast.error('Failed to delete plan')
    else { toast.success('Plan deleted'); setPlans(prev => prev.filter(p => p.id !== id)) }
    setDeletingPlanId(null)
  }

  // ── Package CRUD ──────────────────────────────────────────────────────────

  function openCreatePkg() {
    setEditingPkg(null)
    setPkgForm(emptyPkgForm())
    setPkgFormOpen(true)
  }

  function openEditPkg(pkg: PkgType) {
    setEditingPkg(pkg)
    setPkgForm({
      name: pkg.name,
      description: pkg.description ?? '',
      price: String(pkg.price),
      validity_days: String(pkg.validity_days),
      services_included: pkg.services_included ?? [],
    })
    setPkgFormOpen(true)
  }

  async function savePkg(e: React.FormEvent) {
    e.preventDefault()
    setSavingPkg(true)
    const supabase = createClient()
    const payload = {
      owner_id: ownerId,
      name: pkgForm.name.trim(),
      description: pkgForm.description.trim() || null,
      price: parseFloat(pkgForm.price) || 0,
      validity_days: parseInt(pkgForm.validity_days) || 365,
      services_included: pkgForm.services_included,
    }
    try {
      if (editingPkg) {
        const { error } = await supabase.from('packages').update(payload).eq('id', editingPkg.id)
        if (error) throw error
        toast.success('Package updated')
      } else {
        const { error } = await supabase.from('packages').insert(payload)
        if (error) throw error
        toast.success('Package created')
      }
      setPkgFormOpen(false)
      loadData()
    } catch {
      toast.error('Failed to save package')
    } finally {
      setSavingPkg(false)
    }
  }

  async function togglePkg(pkg: PkgType) {
    setTogglingPkgId(pkg.id)
    const supabase = createClient()
    const { error } = await supabase.from('packages').update({ is_active: !pkg.is_active }).eq('id', pkg.id)
    if (error) toast.error('Failed to update package')
    else setPackages(prev => prev.map(p => p.id === pkg.id ? { ...p, is_active: !p.is_active } : p))
    setTogglingPkgId(null)
  }

  async function deletePkg(id: string) {
    setDeletingPkgId(id)
    const supabase = createClient()
    const { error } = await supabase.from('packages').delete().eq('id', id)
    if (error) toast.error('Failed to delete package')
    else { toast.success('Package deleted'); setPackages(prev => prev.filter(p => p.id !== id)) }
    setDeletingPkgId(null)
  }

  // ── Assign membership to client ───────────────────────────────────────────

  async function assignMembership(e: React.FormEvent) {
    e.preventDefault()
    if (!assignMemberForm.plan_id) { toast.error('Select a plan'); return }
    setAssigningMember(true)
    const supabase = createClient()
    const plan = plans.find(p => p.id === assignMemberForm.plan_id)
    if (!plan) { toast.error('Plan not found'); setAssigningMember(false); return }

    const nextBillingDate = plan.billing_period === 'monthly'
      ? format(addMonths(new Date(), 1), 'yyyy-MM-dd')
      : plan.billing_period === 'quarterly'
      ? format(addQuarters(new Date(), 1), 'yyyy-MM-dd')
      : format(addYears(new Date(), 1), 'yyyy-MM-dd')

    // Build initial services_remaining for service-based plans
    const servicesRemaining: Record<string, number> = {}
    if (plan.type === 'service_based') {
      plan.services_included.forEach(s => {
        servicesRemaining[s.service_id] = s.quantity_per_period
      })
    }

    try {
      const { data: membership, error } = await supabase.from('client_memberships').insert({
        owner_id: ownerId,
        client_phone: assignMemberForm.client_phone.trim(),
        client_name: assignMemberForm.client_name.trim() || null,
        plan_id: assignMemberForm.plan_id,
        status: 'active',
        start_date: format(new Date(), 'yyyy-MM-dd'),
        next_billing_date: nextBillingDate,
        balance: plan.type === 'balance_based' ? parseFloat(assignMemberForm.payment_amount) || plan.price : 0,
        services_remaining: servicesRemaining,
      }).select().single()

      if (error) throw error

      // Record payment transaction
      if (membership) {
        await supabase.from('membership_transactions').insert({
          owner_id: ownerId,
          membership_id: membership.id,
          type: 'payment',
          amount: parseFloat(assignMemberForm.payment_amount) || plan.price,
          description: `Membership started: ${plan.name}`,
        })
      }

      toast.success('Membership assigned successfully')
      setAssignMemberOpen(false)
      setAssignMemberForm({ client_phone: '', client_name: '', plan_id: '', payment_amount: '' })
      loadData()
    } catch {
      toast.error('Failed to assign membership')
    } finally {
      setAssigningMember(false)
    }
  }

  // ── Assign package to client ──────────────────────────────────────────────

  async function assignPackage(e: React.FormEvent) {
    e.preventDefault()
    if (!assignPkgForm.package_id) { toast.error('Select a package'); return }
    setAssigningPkg(true)
    const supabase = createClient()
    const pkg = packages.find(p => p.id === assignPkgForm.package_id)
    if (!pkg) { toast.error('Package not found'); setAssigningPkg(false); return }

    const expiryDate = format(addDays(new Date(), pkg.validity_days), 'yyyy-MM-dd')

    const servicesRemaining: Record<string, number> = {}
    pkg.services_included.forEach(s => {
      servicesRemaining[s.service_id] = s.quantity
    })

    try {
      const { error } = await supabase.from('client_packages').insert({
        owner_id: ownerId,
        client_phone: assignPkgForm.client_phone.trim(),
        client_name: assignPkgForm.client_name.trim() || null,
        package_id: assignPkgForm.package_id,
        purchase_date: format(new Date(), 'yyyy-MM-dd'),
        expiry_date: expiryDate,
        services_remaining: servicesRemaining,
        status: 'active',
      })

      if (error) throw error
      toast.success('Package assigned successfully')
      setAssignPkgOpen(false)
      setAssignPkgForm({ client_phone: '', client_name: '', package_id: '', payment_amount: '' })
      loadData()
    } catch {
      toast.error('Failed to assign package')
    } finally {
      setAssigningPkg(false)
    }
  }

  // ── Update membership status ──────────────────────────────────────────────

  async function updateMembershipStatus(id: string, status: ClientMembership['status']) {
    setUpdatingMembershipId(id)
    const supabase = createClient()
    const { error } = await supabase.from('client_memberships').update({ status }).eq('id', id)
    if (error) toast.error('Failed to update status')
    else {
      setMemberships(prev => prev.map(m => m.id === id ? { ...m, status } : m))
      toast.success('Status updated')
    }
    setUpdatingMembershipId(null)
  }

  async function updatePackageStatus(id: string, status: ClientPackage['status']) {
    setUpdatingPackageId(id)
    const supabase = createClient()
    const { error } = await supabase.from('client_packages').update({ status }).eq('id', id)
    if (error) toast.error('Failed to update status')
    else {
      setClientPackages(prev => prev.map(p => p.id === id ? { ...p, status } : p))
      toast.success('Status updated')
    }
    setUpdatingPackageId(null)
  }

  // ── Service selector helpers ──────────────────────────────────────────────

  function addServiceToPlan(serviceId: string) {
    const svc = services.find(s => s.id === serviceId)
    if (!svc) return
    if (planForm.services_included.some(s => s.service_id === serviceId)) return
    setPlanForm(prev => ({
      ...prev,
      services_included: [...prev.services_included, { service_id: serviceId, service_name: svc.name, quantity_per_period: 1 }],
    }))
  }

  function removeServiceFromPlan(serviceId: string) {
    setPlanForm(prev => ({
      ...prev,
      services_included: prev.services_included.filter(s => s.service_id !== serviceId),
    }))
  }

  function updatePlanServiceQty(serviceId: string, qty: number) {
    setPlanForm(prev => ({
      ...prev,
      services_included: prev.services_included.map(s =>
        s.service_id === serviceId ? { ...s, quantity_per_period: qty } : s
      ),
    }))
  }

  function addServiceToPkg(serviceId: string) {
    const svc = services.find(s => s.id === serviceId)
    if (!svc) return
    if (pkgForm.services_included.some(s => s.service_id === serviceId)) return
    setPkgForm(prev => ({
      ...prev,
      services_included: [...prev.services_included, { service_id: serviceId, service_name: svc.name, quantity: 1 }],
    }))
  }

  function removeServiceFromPkg(serviceId: string) {
    setPkgForm(prev => ({
      ...prev,
      services_included: prev.services_included.filter(s => s.service_id !== serviceId),
    }))
  }

  function updatePkgServiceQty(serviceId: string, qty: number) {
    setPkgForm(prev => ({
      ...prev,
      services_included: prev.services_included.map(s =>
        s.service_id === serviceId ? { ...s, quantity: qty } : s
      ),
    }))
  }

  // ── Filtered lists ────────────────────────────────────────────────────────

  const filteredPlans = plans.filter(p =>
    p.name.toLowerCase().includes(planSearch.toLowerCase())
  )

  const filteredPkgs = packages.filter(p =>
    p.name.toLowerCase().includes(pkgSearch.toLowerCase())
  )

  const filteredMemberships = memberships.filter(m =>
    (m.client_name ?? '').toLowerCase().includes(memberSearch.toLowerCase()) ||
    m.client_phone.includes(memberSearch)
  )

  const filteredClientPkgs = clientPackages.filter(p =>
    (p.client_name ?? '').toLowerCase().includes(memberSearch.toLowerCase()) ||
    p.client_phone.includes(memberSearch)
  )

  const planMemberCount = (planId: string) => memberships.filter(m => m.plan_id === planId && m.status === 'active').length
  const pkgSalesCount = (pkgId: string) => clientPackages.filter(p => p.package_id === pkgId).length

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Crown className="w-5 h-5 text-primary" /> Memberships & Packages
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Manage recurring memberships and service bundles
          </p>
        </div>
        <button
          onClick={loadData}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-gray-100">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{activeMemberships.length}</p>
                <p className="text-xs text-gray-500">Active Members</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-100">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatAmount(mrr)}</p>
                <p className="text-xs text-gray-500">Monthly Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-100">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Package className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{pkgsSoldThisMonth}</p>
                <p className="text-xs text-gray-500">Pkgs This Month</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-100">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                expiringMemberships.length > 0 ? 'bg-amber-50' : 'bg-gray-50'
              )}>
                <AlertTriangle className={cn('w-4 h-4', expiringMemberships.length > 0 ? 'text-amber-500' : 'text-gray-400')} />
              </div>
              <div>
                <p className={cn('text-2xl font-bold', expiringMemberships.length > 0 ? 'text-amber-600' : 'text-gray-900 dark:text-gray-100')}>
                  {expiringMemberships.length}
                </p>
                <p className="text-xs text-gray-500">Expiring (7 days)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expiring alert */}
      {expiringMemberships.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <span className="font-semibold">{expiringMemberships.length} membership{expiringMemberships.length !== 1 ? 's' : ''}</span> expiring in the next 7 days:{' '}
            {expiringMemberships.slice(0, 3).map(m => m.client_name || m.client_phone).join(', ')}
            {expiringMemberships.length > 3 && ` +${expiringMemberships.length - 3} more`}
          </div>
        </div>
      )}

      {/* Main Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-0">
          {([['plans', 'Membership Plans'], ['packages', 'Packages'], ['members', 'Active Members']] as const).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Plans Tab ──────────────────────────────────────────────────────── */}
      {activeTab === 'plans' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search plans..."
                value={planSearch}
                onChange={e => setPlanSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button onClick={openCreatePlan} className="bg-primary hover:bg-primary/90 shrink-0">
              <Plus className="w-4 h-4 mr-1.5" /> New Plan
            </Button>
          </div>

          {filteredPlans.length === 0 ? (
            <Card className="border-gray-100">
              <CardContent className="py-16 text-center">
                <Crown className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">No membership plans yet. Create your first plan to get started.</p>
                <Button onClick={openCreatePlan} className="mt-4 bg-primary hover:bg-primary/90">
                  <Plus className="w-4 h-4 mr-1.5" /> Create Plan
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPlans.map(plan => (
                <Card key={plan.id} className="border-gray-100">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{plan.name}</h3>
                          <Badge className={plan.type === 'service_based'
                            ? 'bg-blue-50 text-blue-700 border-blue-200 text-xs'
                            : 'bg-purple-50 text-purple-700 border-purple-200 text-xs'
                          }>
                            {plan.type === 'service_based' ? 'Service Based' : 'Balance Based'}
                          </Badge>
                          {!plan.is_active && (
                            <Badge className="bg-gray-100 text-gray-500 border-gray-200 text-xs">Inactive</Badge>
                          )}
                        </div>
                        {plan.description && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{plan.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <span className="text-base font-bold text-primary">
                            {formatAmount(plan.price)} / {BILLING_LABEL[plan.billing_period]}
                          </span>
                          {plan.discount_percentage > 0 && (
                            <span className="text-xs text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">
                              {plan.discount_percentage}% off other services
                            </span>
                          )}
                        </div>
                        {plan.type === 'service_based' && plan.services_included.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {plan.services_included.map(s => (
                              <span key={s.service_id} className="text-[10px] bg-primary/5 text-primary border border-primary/15 px-1.5 py-0.5 rounded-full">
                                {s.service_name} ×{s.quantity_per_period}/{plan.billing_period === 'monthly' ? 'mo' : plan.billing_period === 'quarterly' ? 'qtr' : 'yr'}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                          <Users className="w-3 h-3" />
                          {planMemberCount(plan.id)} active member{planMemberCount(plan.id) !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => togglePlan(plan)}
                          disabled={togglingPlanId === plan.id}
                          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                          title={plan.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {togglingPlanId === plan.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                          ) : plan.is_active ? (
                            <ToggleRight className="w-4 h-4 text-green-500" />
                          ) : (
                            <ToggleLeft className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                        <button
                          onClick={() => openEditPlan(plan)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <Edit className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                        </button>
                        <button
                          onClick={() => deletePlan(plan.id)}
                          disabled={deletingPlanId === plan.id}
                          className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          {deletingPlanId === plan.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                          ) : (
                            <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                          )}
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Packages Tab ──────────────────────────────────────────────────── */}
      {activeTab === 'packages' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search packages..."
                value={pkgSearch}
                onChange={e => setPkgSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button onClick={openCreatePkg} className="bg-primary hover:bg-primary/90 shrink-0">
              <Plus className="w-4 h-4 mr-1.5" /> New Package
            </Button>
          </div>

          {filteredPkgs.length === 0 ? (
            <Card className="border-gray-100">
              <CardContent className="py-16 text-center">
                <Package className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">No packages yet. Create service bundles for your clients.</p>
                <Button onClick={openCreatePkg} className="mt-4 bg-primary hover:bg-primary/90">
                  <Plus className="w-4 h-4 mr-1.5" /> Create Package
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPkgs.map(pkg => (
                <Card key={pkg.id} className="border-gray-100">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{pkg.name}</h3>
                          {!pkg.is_active && (
                            <Badge className="bg-gray-100 text-gray-500 border-gray-200 text-xs">Inactive</Badge>
                          )}
                        </div>
                        {pkg.description && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{pkg.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-base font-bold text-primary">{formatAmount(pkg.price)}</span>
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Valid {pkg.validity_days} days
                          </span>
                        </div>
                        {pkg.services_included.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {pkg.services_included.map(s => (
                              <span key={s.service_id} className="text-[10px] bg-primary/5 text-primary border border-primary/15 px-1.5 py-0.5 rounded-full">
                                {s.service_name} ×{s.quantity}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                          <Package className="w-3 h-3" />
                          {pkgSalesCount(pkg.id)} sold
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => togglePkg(pkg)}
                          disabled={togglingPkgId === pkg.id}
                          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          {togglingPkgId === pkg.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                          ) : pkg.is_active ? (
                            <ToggleRight className="w-4 h-4 text-green-500" />
                          ) : (
                            <ToggleLeft className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                        <button onClick={() => openEditPkg(pkg)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                          <Edit className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                        </button>
                        <button
                          onClick={() => deletePkg(pkg.id)}
                          disabled={deletingPkgId === pkg.id}
                          className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          {deletingPkgId === pkg.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                          ) : (
                            <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                          )}
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Active Members Tab ────────────────────────────────────────────── */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by name or phone..."
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => { setAssignMemberOpen(true); setAssignMemberForm({ client_phone: '', client_name: '', plan_id: '', payment_amount: '' }) }}
                className="shrink-0"
              >
                <Crown className="w-4 h-4 mr-1.5" /> Assign Membership
              </Button>
              <Button
                variant="outline"
                onClick={() => { setAssignPkgOpen(true); setAssignPkgForm({ client_phone: '', client_name: '', package_id: '', payment_amount: '' }) }}
                className="shrink-0"
              >
                <Package className="w-4 h-4 mr-1.5" /> Sell Package
              </Button>
            </div>
          </div>

          {/* Sub-tabs */}
          <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
            {(['memberships', 'packages'] as const).map(t => (
              <button
                key={t}
                onClick={() => setMemberTab(t)}
                className={cn(
                  'px-3 py-2 text-sm font-medium border-b-2 transition-colors capitalize',
                  memberTab === t
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                )}
              >
                {t === 'memberships' ? `Memberships (${memberships.length})` : `Packages (${clientPackages.length})`}
              </button>
            ))}
          </div>

          {/* Memberships sub-tab */}
          {memberTab === 'memberships' && (
            filteredMemberships.length === 0 ? (
              <Card className="border-gray-100">
                <CardContent className="py-12 text-center">
                  <Users className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">No client memberships yet.</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-gray-100">
                <CardContent className="p-0">
                  <div className="divide-y divide-gray-50">
                    {filteredMemberships.map(m => (
                      <div key={m.id} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-primary text-xs font-bold">
                            {(m.client_name || m.client_phone)?.[0]?.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {m.client_name || 'Unknown'}
                            </span>
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <Phone className="w-3 h-3" />{m.client_phone}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-xs text-gray-500">
                              {m.membership_plans?.name ?? 'Unknown plan'}
                            </span>
                            {m.next_billing_date && (
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Renews {format(new Date(m.next_billing_date + 'T00:00:00'), 'MMM d, yyyy')}
                              </span>
                            )}
                          </div>
                          {m.membership_plans?.type === 'service_based' && Object.keys(m.services_remaining).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {Object.entries(m.services_remaining).map(([svcId, qty]) => {
                                const plan = plans.find(p => p.id === m.plan_id)
                                const svcName = plan?.services_included.find(s => s.service_id === svcId)?.service_name ?? svcId
                                return (
                                  <span key={svcId} className="text-[10px] bg-primary/5 text-primary border border-primary/15 px-1.5 py-0.5 rounded-full">
                                    {svcName}: {qty} left
                                  </span>
                                )
                              })}
                            </div>
                          )}
                          {m.membership_plans?.type === 'balance_based' && (
                            <span className="text-xs text-green-600 mt-0.5 block">Balance: {formatAmount(m.balance)}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge className={STATUS_STYLES[m.status] ?? ''}>{m.status}</Badge>
                          {updatingMembershipId === m.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                          ) : (
                            <Select
                              value={m.status}
                              onValueChange={v => updateMembershipStatus(m.id, v as ClientMembership['status'])}
                            >
                              <SelectTrigger className="h-7 w-28 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="paused">Paused</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                                <SelectItem value="expired">Expired</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          )}

          {/* Packages sub-tab */}
          {memberTab === 'packages' && (
            filteredClientPkgs.length === 0 ? (
              <Card className="border-gray-100">
                <CardContent className="py-12 text-center">
                  <Package className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">No client packages sold yet.</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-gray-100">
                <CardContent className="p-0">
                  <div className="divide-y divide-gray-50">
                    {filteredClientPkgs.map(p => (
                      <div key={p.id} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <Package className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {p.client_name || 'Unknown'}
                            </span>
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <Phone className="w-3 h-3" />{p.client_phone}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-xs text-gray-500">{p.packages?.name ?? 'Unknown package'}</span>
                            {p.expiry_date && (
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Expires {format(new Date(p.expiry_date + 'T00:00:00'), 'MMM d, yyyy')}
                              </span>
                            )}
                          </div>
                          {Object.keys(p.services_remaining).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {Object.entries(p.services_remaining).map(([svcId, qty]) => {
                                const pkg = packages.find(pk => pk.id === p.package_id)
                                const svcName = pkg?.services_included.find(s => s.service_id === svcId)?.service_name ?? svcId
                                return (
                                  <span key={svcId} className="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded-full">
                                    {svcName}: {qty} left
                                  </span>
                                )
                              })}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge className={STATUS_STYLES[p.status] ?? ''}>{p.status}</Badge>
                          {updatingPackageId === p.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                          ) : (
                            <Select
                              value={p.status}
                              onValueChange={v => updatePackageStatus(p.id, v as ClientPackage['status'])}
                            >
                              <SelectTrigger className="h-7 w-28 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="expired">Expired</SelectItem>
                                <SelectItem value="used">Used</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          )}
        </div>
      )}

      {/* ── Plan Create/Edit Dialog ───────────────────────────────────────── */}
      <Dialog open={planFormOpen} onOpenChange={open => { if (!open) setPlanFormOpen(false) }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-primary" />
              {editingPlan ? 'Edit Membership Plan' : 'Create Membership Plan'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={savePlan} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Plan Name *</Label>
              <Input
                value={planForm.name}
                onChange={e => setPlanForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Gold Membership"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                value={planForm.description}
                onChange={e => setPlanForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Brief description of this plan"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Plan Type *</Label>
                <Select value={planForm.type} onValueChange={v => setPlanForm(p => ({ ...p, type: v as PlanFormData['type'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="service_based">Service Based</SelectItem>
                    <SelectItem value="balance_based">Balance Based</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Billing Period *</Label>
                <Select value={planForm.billing_period} onValueChange={v => setPlanForm(p => ({ ...p, billing_period: v as PlanFormData['billing_period'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Price *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={planForm.price}
                  onChange={e => setPlanForm(p => ({ ...p, price: e.target.value }))}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Discount on Other Services (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={planForm.discount_percentage}
                  onChange={e => setPlanForm(p => ({ ...p, discount_percentage: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>

            {planForm.type === 'service_based' && (
              <div className="space-y-2 border border-gray-100 rounded-lg p-3 bg-gray-50">
                <Label className="text-sm font-medium">Included Services per Period</Label>
                <Select onValueChange={(v) => { if (v != null) addServiceToPlan(v as string) }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Add a service..." />
                  </SelectTrigger>
                  <SelectContent>
                    {services
                      .filter(s => !planForm.services_included.some(ps => ps.service_id === s.id))
                      .map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {planForm.services_included.length > 0 && (
                  <div className="space-y-1.5">
                    {planForm.services_included.map(s => (
                      <div key={s.service_id} className="flex items-center gap-2">
                        <span className="flex-1 text-sm text-gray-700">{s.service_name}</span>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min="1"
                            value={s.quantity_per_period}
                            onChange={e => updatePlanServiceQty(s.service_id, parseInt(e.target.value) || 1)}
                            className="w-16 h-7 text-sm text-center"
                          />
                          <span className="text-xs text-gray-400">/{planForm.billing_period === 'monthly' ? 'mo' : planForm.billing_period === 'quarterly' ? 'qtr' : 'yr'}</span>
                        </div>
                        <button type="button" onClick={() => removeServiceFromPlan(s.service_id)} className="p-0.5 text-gray-400 hover:text-red-500">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={savingPlan}>
              {savingPlan ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Check className="w-4 h-4 mr-1.5" />}
              {savingPlan ? 'Saving...' : editingPlan ? 'Save Changes' : 'Create Plan'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Package Create/Edit Dialog ────────────────────────────────────── */}
      <Dialog open={pkgFormOpen} onOpenChange={open => { if (!open) setPkgFormOpen(false) }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              {editingPkg ? 'Edit Package' : 'Create Package'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={savePkg} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Package Name *</Label>
              <Input
                value={pkgForm.name}
                onChange={e => setPkgForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. 10-Session Haircut Bundle"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                value={pkgForm.description}
                onChange={e => setPkgForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Brief description"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Package Price *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={pkgForm.price}
                  onChange={e => setPkgForm(p => ({ ...p, price: e.target.value }))}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Validity (days)</Label>
                <Input
                  type="number"
                  min="1"
                  value={pkgForm.validity_days}
                  onChange={e => setPkgForm(p => ({ ...p, validity_days: e.target.value }))}
                  placeholder="365"
                />
              </div>
            </div>

            <div className="space-y-2 border border-gray-100 rounded-lg p-3 bg-gray-50">
              <Label className="text-sm font-medium">Included Services</Label>
              <Select onValueChange={(v) => { if (v != null) addServiceToPkg(v as string) }}>
                <SelectTrigger>
                  <SelectValue placeholder="Add a service..." />
                </SelectTrigger>
                <SelectContent>
                  {services
                    .filter(s => !pkgForm.services_included.some(ps => ps.service_id === s.id))
                    .map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {pkgForm.services_included.length > 0 && (
                <div className="space-y-1.5">
                  {pkgForm.services_included.map(s => (
                    <div key={s.service_id} className="flex items-center gap-2">
                      <span className="flex-1 text-sm text-gray-700">{s.service_name}</span>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min="1"
                          value={s.quantity}
                          onChange={e => updatePkgServiceQty(s.service_id, parseInt(e.target.value) || 1)}
                          className="w-16 h-7 text-sm text-center"
                        />
                        <span className="text-xs text-gray-400">sessions</span>
                      </div>
                      <button type="button" onClick={() => removeServiceFromPkg(s.service_id)} className="p-0.5 text-gray-400 hover:text-red-500">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={savingPkg}>
              {savingPkg ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Check className="w-4 h-4 mr-1.5" />}
              {savingPkg ? 'Saving...' : editingPkg ? 'Save Changes' : 'Create Package'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Assign Membership Dialog ──────────────────────────────────────── */}
      <Dialog open={assignMemberOpen} onOpenChange={open => { if (!open) setAssignMemberOpen(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-primary" /> Assign Membership to Client
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={assignMembership} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Client Phone *</Label>
              <Input
                value={assignMemberForm.client_phone}
                onChange={e => setAssignMemberForm(f => ({ ...f, client_phone: e.target.value }))}
                placeholder="+92 300 0000000"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Client Name</Label>
              <Input
                value={assignMemberForm.client_name}
                onChange={e => setAssignMemberForm(f => ({ ...f, client_name: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Membership Plan *</Label>
              <Select
                value={assignMemberForm.plan_id}
                onValueChange={v => {
                  const plan = plans.find(p => p.id === (v ?? ''))
                  setAssignMemberForm(f => ({ ...f, plan_id: v ?? '', payment_amount: plan ? String(plan.price) : '' }))
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select a plan..." /></SelectTrigger>
                <SelectContent>
                  {plans.filter(p => p.is_active).map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {formatAmount(p.price)}/{BILLING_LABEL[p.billing_period]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Payment Amount</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={assignMemberForm.payment_amount}
                onChange={e => setAssignMemberForm(f => ({ ...f, payment_amount: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={assigningMember}>
              {assigningMember ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              {assigningMember ? 'Assigning...' : 'Assign Membership'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Assign Package Dialog ─────────────────────────────────────────── */}
      <Dialog open={assignPkgOpen} onOpenChange={open => { if (!open) setAssignPkgOpen(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" /> Sell Package to Client
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={assignPackage} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Client Phone *</Label>
              <Input
                value={assignPkgForm.client_phone}
                onChange={e => setAssignPkgForm(f => ({ ...f, client_phone: e.target.value }))}
                placeholder="+92 300 0000000"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Client Name</Label>
              <Input
                value={assignPkgForm.client_name}
                onChange={e => setAssignPkgForm(f => ({ ...f, client_name: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Package *</Label>
              <Select
                value={assignPkgForm.package_id}
                onValueChange={v => {
                  const pkg = packages.find(p => p.id === (v ?? ''))
                  setAssignPkgForm(f => ({ ...f, package_id: v ?? '', payment_amount: pkg ? String(pkg.price) : '' }))
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select a package..." /></SelectTrigger>
                <SelectContent>
                  {packages.filter(p => p.is_active).map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {formatAmount(p.price)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Payment Amount</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={assignPkgForm.payment_amount}
                onChange={e => setAssignPkgForm(f => ({ ...f, payment_amount: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={assigningPkg}>
              {assigningPkg ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              {assigningPkg ? 'Processing...' : 'Sell Package'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

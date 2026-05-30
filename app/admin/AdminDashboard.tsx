'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  toggleSalonStatus,
  createSalonAccount,
  resetSalonPassword,
  deleteSalonAccount,
  changeSalonEmail,
  getSalonDetails,
  getLeads,
  updateLead,
  updateSalonLimits,
  updateSalonModules,
} from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
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
  Scissors,
  Search,
  UserPlus,
  Copy,
  Check,
  Eye,
  EyeOff,
  ExternalLink,
  Link2,
  KeyRound,
  Trash2,
  Mail,
  Building2,
  Inbox,
  Users,
  CalendarDays,
  DollarSign,
  Loader2,
  X,
  AlertTriangle,
  Phone,
  MapPin,
  MessageSquare,
  LayoutGrid,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Lead } from '@/lib/types'

const ALL_MODULES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'appointments', label: 'Appointments' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'walkin', label: 'Walk-In POS' },
  { key: 'services', label: 'Services' },
  { key: 'memberships', label: 'Memberships' },
  { key: 'staff', label: 'Staff' },
  { key: 'performance', label: 'Staff Performance' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'clients', label: 'Clients' },
  { key: 'branches', label: 'Branches' },
  { key: 'team_members', label: 'Team Members' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'payroll', label: 'Payroll' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'reports_pnl', label: 'P&L Reports' },
  { key: 'settings', label: 'Settings' },
]

const ALL_MODULE_KEYS = ALL_MODULES.map((m) => m.key)

type Salon = {
  id: string
  email: string
  salon_name: string | null
  subscription_status: string | null
  created_at: string
  last_set_password: string | null
  member_count?: number
  max_branches?: number | null
  max_staff?: number | null
  enabled_modules?: string[] | null
}

type CreatedCredentials = {
  salonName: string
  email: string
  password: string
}

type SalonDetailData = {
  members: Array<{
    id: string
    email: string
    role: string
    display_name: string | null
    status: string
    joined_at: string | null
    last_set_password: string | null
    permissions: string[] | null
  }>
  appointmentCount: number
  revenue: number
}

const STATUS_STYLES: Record<string, string> = {
  new: 'bg-amber-50 text-amber-700 border-amber-200',
  contacted: 'bg-blue-50 text-blue-700 border-blue-200',
  converted: 'bg-green-50 text-green-700 border-green-200',
  lost: 'bg-gray-100 text-gray-500 border-gray-200',
}

export default function AdminDashboard({ salons: initialSalons }: { salons: Salon[] }) {
  const router = useRouter()
  const [salons, setSalons] = useState(initialSalons)
  const [activeView, setActiveView] = useState<'salons' | 'leads'>('salons')
  const [search, setSearch] = useState('')
  const [isPending, startTransition] = useTransition()
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Create account
  const [createOpen, setCreateOpen] = useState(false)
  const [newSalonName, setNewSalonName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newMaxBranches, setNewMaxBranches] = useState('1')
  const [newMaxStaff, setNewMaxStaff] = useState('10')
  const [newModules, setNewModules] = useState<string[]>(ALL_MODULE_KEYS)
  const [creating, setCreating] = useState(false)
  const [credentials, setCredentials] = useState<CreatedCredentials | null>(null)
  const [copied, setCopied] = useState(false)

  // Edit limits
  const [limitsOpen, setLimitsOpen] = useState(false)
  const [limitsSalonId, setLimitsSalonId] = useState<string | null>(null)
  const [limitsMaxBranches, setLimitsMaxBranches] = useState('1')
  const [limitsMaxStaff, setLimitsMaxStaff] = useState('10')
  const [savingLimits, setSavingLimits] = useState(false)

  // Edit modules
  const [modulesOpen, setModulesOpen] = useState(false)
  const [modulesSalonId, setModulesSalonId] = useState<string | null>(null)
  const [modulesSalonName, setModulesSalonName] = useState('')
  const [selectedModules, setSelectedModules] = useState<string[]>(ALL_MODULE_KEYS)
  const [savingModules, setSavingModules] = useState(false)

  // Per-salon inline state
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set())
  const [copiedEmailId, setCopiedEmailId] = useState<string | null>(null)
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null)

  // Reset password
  const [resetSalonId, setResetSalonId] = useState<string | null>(null)
  const [resetPw, setResetPw] = useState('')
  const [resetting, setResetting] = useState(false)

  // Delete salon
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Change email
  const [changeEmailSalonId, setChangeEmailSalonId] = useState<string | null>(null)
  const [changeEmailNew, setChangeEmailNew] = useState('')
  const [changingEmail, setChangingEmail] = useState(false)

  // Salon detail
  const [detailSalon, setDetailSalon] = useState<Salon | null>(null)
  const [salonDetail, setSalonDetail] = useState<SalonDetailData | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailVisiblePws, setDetailVisiblePws] = useState<Set<string>>(new Set())

  // Leads
  const [leads, setLeads] = useState<Lead[]>([])
  const [leadsLoading, setLeadsLoading] = useState(false)
  const [newLeadsCount, setNewLeadsCount] = useState(0)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [noteValue, setNoteValue] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  useEffect(() => {
    loadNewLeadsCount()
  }, [])

  async function loadNewLeadsCount() {
    const res = await getLeads()
    if ('data' in res) {
      setNewLeadsCount((res.data as Lead[]).filter((l) => l.status === 'new').length)
    }
  }

  async function handleOpenLeads() {
    setActiveView('leads')
    if (leads.length === 0) {
      setLeadsLoading(true)
      const res = await getLeads()
      if ('data' in res) {
        setLeads(res.data as Lead[])
        setNewLeadsCount((res.data as Lead[]).filter((l) => l.status === 'new').length)
      }
      setLeadsLoading(false)
    }
  }

  const filtered = salons.filter((s) => {
    const q = search.toLowerCase()
    return (s.salon_name ?? '').toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
  })

  async function openDetail(salon: Salon) {
    setDetailSalon(salon)
    setSalonDetail(null)
    setDetailVisiblePws(new Set())
    setDetailLoading(true)
    const res = await getSalonDetails(salon.id)
    if ('error' in res) {
      toast.error(res.error)
    } else {
      setSalonDetail(res as SalonDetailData)
    }
    setDetailLoading(false)
  }

  function openEditModules(salon: Salon) {
    setModulesSalonId(salon.id)
    setModulesSalonName(salon.salon_name || salon.email)
    setSelectedModules(salon.enabled_modules ?? ALL_MODULE_KEYS)
    setModulesOpen(true)
  }

  function handleToggle(salon: Salon) {
    const next = salon.subscription_status === 'suspended' ? 'active' : 'suspended'
    setTogglingId(salon.id)
    startTransition(async () => {
      try {
        const res = await toggleSalonStatus(salon.id, next)
        if ('error' in res) {
          toast.error(res.error)
        } else {
          toast.success(`${salon.salon_name || salon.email} is now ${next}`)
          setSalons((prev) =>
            prev.map((s) => (s.id === salon.id ? { ...s, subscription_status: next } : s))
          )
          router.refresh()
        }
      } catch {
        toast.error('Failed to update status')
      } finally {
        setTogglingId(null)
      }
    })
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      const res = await createSalonAccount(
        newSalonName, newEmail, newPassword,
        parseInt(newMaxBranches) || 1,
        parseInt(newMaxStaff) || 10,
        newModules,
      )
      if ('error' in res) {
        toast.error(res.error)
      } else {
        setCredentials({ salonName: newSalonName, email: newEmail, password: newPassword })
        setNewSalonName('')
        setNewEmail('')
        setNewPassword('')
        setNewMaxBranches('1')
        setNewMaxStaff('10')
        setNewModules(ALL_MODULE_KEYS)
        router.refresh()
      }
    } catch {
      toast.error('Failed to create account')
    } finally {
      setCreating(false)
    }
  }

  function openEditLimits(salon: Salon) {
    setLimitsSalonId(salon.id)
    setLimitsMaxBranches(String(salon.max_branches ?? 1))
    setLimitsMaxStaff(String(salon.max_staff ?? 10))
    setLimitsOpen(true)
  }

  async function handleSaveLimits(e: React.FormEvent) {
    e.preventDefault()
    if (!limitsSalonId) return
    setSavingLimits(true)
    try {
      const res = await updateSalonLimits(limitsSalonId, parseInt(limitsMaxBranches) || 1, parseInt(limitsMaxStaff) || 10)
      if ('error' in res) {
        toast.error(res.error)
      } else {
        toast.success('Limits updated')
        setSalons(prev => prev.map(s => s.id === limitsSalonId
          ? { ...s, max_branches: parseInt(limitsMaxBranches) || 1, max_staff: parseInt(limitsMaxStaff) || 10 }
          : s
        ))
        setLimitsOpen(false)
      }
    } catch {
      toast.error('Failed to update limits')
    } finally {
      setSavingLimits(false)
    }
  }

  async function handleSaveModules(e: React.FormEvent) {
    e.preventDefault()
    if (!modulesSalonId) return
    setSavingModules(true)
    try {
      const res = await updateSalonModules(modulesSalonId, selectedModules)
      if ('error' in res) {
        toast.error(res.error)
      } else {
        toast.success('Modules updated')
        setSalons(prev => prev.map(s => s.id === modulesSalonId
          ? { ...s, enabled_modules: selectedModules }
          : s
        ))
        setModulesOpen(false)
      }
    } catch {
      toast.error('Failed to update modules')
    } finally {
      setSavingModules(false)
    }
  }

  function toggleModule(key: string) {
    setSelectedModules(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  function toggleNewModule(key: string) {
    setNewModules(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  async function handleDelete() {
    if (!deleteConfirmId) return
    setDeleting(true)
    try {
      const res = await deleteSalonAccount(deleteConfirmId)
      if ('error' in res) {
        toast.error(res.error)
      } else {
        toast.success('Salon deleted')
        setSalons((prev) => prev.filter((s) => s.id !== deleteConfirmId))
        setDeleteConfirmId(null)
      }
    } catch {
      toast.error('Failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!changeEmailSalonId || !changeEmailNew.trim()) return
    setChangingEmail(true)
    try {
      const res = await changeSalonEmail(changeEmailSalonId, changeEmailNew.trim())
      if ('error' in res) {
        toast.error(res.error)
      } else {
        toast.success('Email updated')
        setSalons((prev) =>
          prev.map((s) => (s.id === changeEmailSalonId ? { ...s, email: changeEmailNew.trim() } : s))
        )
        setChangeEmailSalonId(null)
        setChangeEmailNew('')
      }
    } catch {
      toast.error('Failed to update email')
    } finally {
      setChangingEmail(false)
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!resetSalonId) return
    setResetting(true)
    try {
      const res = await resetSalonPassword(resetSalonId, resetPw)
      if ('error' in res) {
        toast.error(res.error)
      } else {
        toast.success('Password reset')
        setSalons((prev) =>
          prev.map((s) => (s.id === resetSalonId ? { ...s, last_set_password: resetPw } : s))
        )
        setResetSalonId(null)
        setResetPw('')
      }
    } catch {
      toast.error('Failed to reset password')
    } finally {
      setResetting(false)
    }
  }

  async function handleLeadStatus(id: string, status: Lead['status']) {
    const res = await updateLead(id, { status })
    if ('error' in res) {
      toast.error(res.error)
    } else {
      const wasNew = leads.find((l) => l.id === id)?.status === 'new'
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)))
      if (wasNew && status !== 'new') setNewLeadsCount((n) => Math.max(0, n - 1))
      if (!wasNew && status === 'new') setNewLeadsCount((n) => n + 1)
    }
  }

  async function handleSaveNote(leadId: string) {
    setSavingNote(true)
    const res = await updateLead(leadId, { notes: noteValue })
    if ('error' in res) {
      toast.error(res.error)
    } else {
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, notes: noteValue } : l)))
      setEditingNoteId(null)
    }
    setSavingNote(false)
  }

  function copyCredentials() {
    if (!credentials) return
    const origin = window.location.origin
    navigator.clipboard.writeText(
      `Welcome to Snipforce!\nLogin URL: ${origin}/login\nEmail: ${credentials.email}\nPassword: ${credentials.password}\nPlease change your password after first login.`
    )
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function copyEmail(salon: Salon) {
    navigator.clipboard.writeText(salon.email)
    setCopiedEmailId(salon.id)
    setTimeout(() => setCopiedEmailId(null), 2000)
  }

  function copyLoginLink(salon: Salon) {
    const origin = window.location.origin
    const pw = salon.last_set_password ?? '[reset password first]'
    navigator.clipboard.writeText(
      `Welcome to Snipforce!\nLogin URL: ${origin}/login\nEmail: ${salon.email}\nPassword: ${pw}\nPlease change your password after first login.`
    )
    setCopiedLinkId(salon.id)
    setTimeout(() => setCopiedLinkId(null), 2000)
    toast.success('Login message copied')
  }

  function togglePw(id: string) {
    setVisiblePasswords((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleDetailPw(id: string) {
    setDetailVisiblePws((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const resetSalon = salons.find((s) => s.id === resetSalonId)
  const deleteSalon = salons.find((s) => s.id === deleteConfirmId)
  const changeEmailSalon = salons.find((s) => s.id === changeEmailSalonId)

  // Module checklist component (shared between Create and Edit dialogs)
  const ModuleChecklist = ({
    modules,
    onChange,
  }: {
    modules: string[]
    onChange: (key: string) => void
  }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500 font-medium">Enabled Modules ({modules.length}/{ALL_MODULES.length})</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => ALL_MODULES.forEach(m => !modules.includes(m.key) && onChange(m.key))}
            className="text-xs text-primary hover:underline"
          >
            All
          </button>
          <span className="text-gray-300">|</span>
          <button
            type="button"
            onClick={() => ALL_MODULES.forEach(m => modules.includes(m.key) && onChange(m.key))}
            className="text-xs text-red-500 hover:underline"
          >
            None
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5 max-h-64 overflow-y-auto pr-1">
        {ALL_MODULES.map((mod) => {
          const enabled = modules.includes(mod.key)
          return (
            <label
              key={mod.key}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors',
                enabled
                  ? 'bg-primary/5 border-primary/30 text-primary'
                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
              )}
            >
              <input
                type="checkbox"
                checked={enabled}
                onChange={() => onChange(mod.key)}
                className="rounded accent-primary"
              />
              {mod.label}
            </label>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex w-52 bg-white border-r border-gray-200 fixed h-screen flex-col z-10">
        <div className="px-4 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
              <Scissors className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-sm text-gray-900">Snipforce</span>
            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">Admin</Badge>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <button
            onClick={() => setActiveView('salons')}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              activeView === 'salons'
                ? 'bg-primary text-white'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            <Building2 className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 text-left">All Salons</span>
            <span
              className={cn(
                'text-xs px-1.5 py-0.5 rounded-full font-medium',
                activeView === 'salons'
                  ? 'bg-white/20 text-white'
                  : 'bg-gray-100 text-gray-500'
              )}
            >
              {salons.length}
            </span>
          </button>
          <button
            onClick={handleOpenLeads}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              activeView === 'leads'
                ? 'bg-primary text-white'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            <Inbox className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 text-left">Leads</span>
            {newLeadsCount > 0 && (
              <span
                className={cn(
                  'text-xs px-1.5 py-0.5 rounded-full font-bold',
                  activeView === 'leads' ? 'bg-white/20 text-white' : 'bg-rose-500 text-white'
                )}
              >
                {newLeadsCount}
              </span>
            )}
          </button>
        </nav>
      </aside>

      {/* ── Mobile tab bar ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-10 bg-white border-b border-gray-200">
        <div className="px-4 py-3 flex items-center gap-2 border-b border-gray-100">
          <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
            <Scissors className="w-3 h-3 text-white" />
          </div>
          <span className="font-bold text-sm text-gray-900">Snipforce Admin</span>
        </div>
        <div className="flex">
          <button
            onClick={() => setActiveView('salons')}
            className={cn(
              'flex-1 py-2.5 text-sm font-medium transition-colors',
              activeView === 'salons'
                ? 'text-primary border-b-2 border-primary'
                : 'text-gray-500'
            )}
          >
            All Salons ({salons.length})
          </button>
          <button
            onClick={handleOpenLeads}
            className={cn(
              'flex-1 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-1.5',
              activeView === 'leads'
                ? 'text-primary border-b-2 border-primary'
                : 'text-gray-500'
            )}
          >
            Leads
            {newLeadsCount > 0 && (
              <span className="bg-rose-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {newLeadsCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Main content ── */}
      <main className="md:ml-52 flex-1 min-h-screen">
        {activeView === 'salons' ? (
          <div className="p-4 md:p-6 pt-28 md:pt-6 space-y-4 max-w-5xl">
            {/* Salons toolbar */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <button
                onClick={() => setCreateOpen(true)}
                className="shrink-0 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-xs transition-colors hover:bg-primary/90"
              >
                <UserPlus className="w-4 h-4" />
                Create New Salon
              </button>
            </div>

            {/* Salons card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">
                  All Salons ({filtered.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {filtered.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-12">No salons found</p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {filtered.map((salon) => {
                      const isSuspended = salon.subscription_status === 'suspended'
                      const isToggling = togglingId === salon.id && isPending
                      const showPw = visiblePasswords.has(salon.id)
                      const enabledCount = salon.enabled_modules?.length ?? ALL_MODULE_KEYS.length
                      return (
                        <div
                          key={salon.id}
                          className="flex items-start justify-between px-5 py-4 hover:bg-gray-50 transition-colors gap-4"
                        >
                          <div className="min-w-0 flex-1">
                            <button
                              onClick={() => openDetail(salon)}
                              className="font-medium text-gray-900 truncate hover:text-primary hover:underline transition-colors text-left block"
                            >
                              {salon.salon_name || '(No salon name)'}
                            </button>
                            <div className="flex items-center gap-1 mt-0.5">
                              <p className="text-sm text-gray-500 truncate">{salon.email}</p>
                              <button
                                onClick={() => copyEmail(salon)}
                                className="shrink-0 text-gray-400 hover:text-gray-600 p-0.5"
                              >
                                {copiedEmailId === salon.id ? (
                                  <Check className="w-3 h-3 text-green-500" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <p className="text-xs text-gray-400">
                                Joined{' '}
                                {new Date(salon.created_at).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </p>
                              {(salon.member_count ?? 0) > 0 && (
                                <span className="inline-flex items-center gap-1 text-xs text-primary bg-primary/5 border border-primary/20 px-1.5 py-0.5 rounded-full">
                                  <Users className="w-3 h-3" />
                                  {salon.member_count} sub-user{salon.member_count !== 1 ? 's' : ''}
                                </span>
                              )}
                              {(salon.max_branches != null || salon.max_staff != null) && (
                                <button
                                  onClick={() => openEditLimits(salon)}
                                  className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded-full hover:bg-gray-100 transition-colors"
                                >
                                  Limits: {salon.max_branches ?? 1}B / {salon.max_staff ?? 10}S
                                </button>
                              )}
                              <button
                                onClick={() => openEditModules(salon)}
                                className="inline-flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-full hover:bg-indigo-100 transition-colors"
                              >
                                <LayoutGrid className="w-3 h-3" />
                                {enabledCount}/{ALL_MODULE_KEYS.length} modules
                              </button>
                            </div>
                            {salon.last_set_password && (
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-xs text-gray-400">PW:</span>
                                <span className="text-xs font-mono text-gray-600">
                                  {showPw ? salon.last_set_password : '••••••••'}
                                </span>
                                <button
                                  onClick={() => togglePw(salon.id)}
                                  className="text-gray-400 hover:text-gray-600 p-0.5"
                                >
                                  {showPw ? (
                                    <EyeOff className="w-3 h-3" />
                                  ) : (
                                    <Eye className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                            <Badge
                              className={
                                isSuspended
                                  ? 'bg-red-50 text-red-600 border-red-200'
                                  : 'bg-green-50 text-green-600 border-green-200'
                              }
                            >
                              {isSuspended ? 'Suspended' : 'Active'}
                            </Badge>

                            <button
                              onClick={() => window.open(`${window.location.origin}/login?email=${encodeURIComponent(salon.email)}`, '_blank')}
                              title="Open portal"
                              className="text-gray-400 hover:text-gray-700 p-1 rounded hover:bg-gray-100"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => copyLoginLink(salon)}
                              title="Copy login message"
                              className="text-gray-400 hover:text-gray-700 p-1 rounded hover:bg-gray-100"
                            >
                              {copiedLinkId === salon.id ? (
                                <Check className="w-4 h-4 text-green-500" />
                              ) : (
                                <Link2 className="w-4 h-4" />
                              )}
                            </button>

                            <button
                              onClick={() => { setResetSalonId(salon.id); setResetPw('') }}
                              title="Reset password"
                              className="text-gray-400 hover:text-gray-700 p-1 rounded hover:bg-gray-100"
                            >
                              <KeyRound className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => { setChangeEmailSalonId(salon.id); setChangeEmailNew('') }}
                              title="Change email"
                              className="text-gray-400 hover:text-gray-700 p-1 rounded hover:bg-gray-100"
                            >
                              <Mail className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => setDeleteConfirmId(salon.id)}
                              title="Delete salon"
                              className="text-gray-400 hover:text-red-600 p-1 rounded hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>

                            <Button
                              size="sm"
                              variant={isSuspended ? 'default' : 'outline'}
                              className={
                                isSuspended
                                  ? 'bg-primary hover:bg-primary/90'
                                  : 'border-red-200 text-red-600 hover:bg-red-50'
                              }
                              onClick={() => handleToggle(salon)}
                              disabled={isToggling}
                            >
                              {isToggling ? '...' : isSuspended ? 'Activate' : 'Suspend'}
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          /* ── Leads view ── */
          <div className="p-4 md:p-6 pt-28 md:pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Demo Requests</h2>
                <p className="text-sm text-gray-500 mt-0.5">Leads submitted from the landing page</p>
              </div>
              {newLeadsCount > 0 && (
                <Badge className="bg-amber-50 text-amber-700 border-amber-200">
                  {newLeadsCount} new
                </Badge>
              )}
            </div>

            {leadsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : leads.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <Inbox className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">No leads yet — they will appear here after visitors submit the demo form.</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50/80">
                          {['Contact', 'Business', 'Source', 'Date', 'Status', 'Notes'].map((h) => (
                            <th key={h} className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {leads.map((lead) => (
                          <tr key={lead.id} className="hover:bg-gray-50/60 transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-900">{lead.name}</p>
                              <div className="flex items-center gap-1 mt-0.5 text-gray-500">
                                <Phone className="w-3 h-3" />
                                <span className="text-xs">{lead.phone}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-gray-900">{lead.salon_name}</p>
                              <div className="flex items-center gap-1 mt-0.5 text-gray-500">
                                <MapPin className="w-3 h-3" />
                                <span className="text-xs">{lead.city} · {lead.branches} branches</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-600 text-xs">{lead.source}</td>
                            <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                              {new Date(lead.created_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </td>
                            <td className="px-4 py-3">
                              <Select
                                value={lead.status}
                                onValueChange={(v) => handleLeadStatus(lead.id, v as Lead['status'])}
                              >
                                <SelectTrigger
                                  className={cn(
                                    'h-7 w-28 text-xs border',
                                    STATUS_STYLES[lead.status]
                                  )}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="new">New</SelectItem>
                                  <SelectItem value="contacted">Contacted</SelectItem>
                                  <SelectItem value="converted">Converted</SelectItem>
                                  <SelectItem value="lost">Lost</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="px-4 py-3">
                              {editingNoteId === lead.id ? (
                                <div className="flex items-start gap-1">
                                  <Textarea
                                    value={noteValue}
                                    onChange={(e) => setNoteValue(e.target.value)}
                                    className="text-xs min-h-[60px] w-36"
                                    autoFocus
                                  />
                                  <div className="flex flex-col gap-1 shrink-0">
                                    <button
                                      onClick={() => handleSaveNote(lead.id)}
                                      disabled={savingNote}
                                      className="p-1 rounded bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
                                    >
                                      {savingNote ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <Check className="w-3 h-3" />
                                      )}
                                    </button>
                                    <button
                                      onClick={() => setEditingNoteId(null)}
                                      className="p-1 rounded hover:bg-gray-100"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setEditingNoteId(lead.id); setNoteValue(lead.notes ?? '') }}
                                  className="flex items-start gap-1 text-xs text-gray-500 hover:text-gray-800 max-w-[160px] text-left group"
                                >
                                  <MessageSquare className="w-3 h-3 shrink-0 mt-0.5 group-hover:text-primary" />
                                  <span className="truncate">{lead.notes || 'Add notes...'}</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>

      {/* ── Create Account Dialog ── */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => { setCreateOpen(open); if (!open) setCredentials(null) }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Salon Account</DialogTitle>
          </DialogHeader>
          {credentials ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
                <p className="text-sm font-semibold text-green-800">Account created!</p>
                <div className="text-sm text-green-700 space-y-1 font-mono">
                  <p>Salon: {credentials.salonName}</p>
                  <p>Email: {credentials.email}</p>
                  <p>Password: {credentials.password}</p>
                </div>
              </div>
              <Button onClick={copyCredentials} variant="outline" className="w-full">
                {copied ? (
                  <><Check className="w-4 h-4 mr-2 text-green-600" /> Copied!</>
                ) : (
                  <><Copy className="w-4 h-4 mr-2" /> Copy WhatsApp Message</>
                )}
              </Button>
              <Button className="w-full bg-primary hover:bg-primary/90" onClick={() => setCredentials(null)}>
                Create Another
              </Button>
            </div>
          ) : (
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Salon Name</Label>
                <Input value={newSalonName} onChange={(e) => setNewSalonName(e.target.value)} placeholder="e.g. Glamour Beauty Lounge" required />
              </div>
              <div className="space-y-1.5">
                <Label>Owner Email</Label>
                <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="owner@example.com" required />
              </div>
              <div className="space-y-1.5">
                <Label>Temporary Password</Label>
                <Input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 6 characters" minLength={6} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Max Branches</Label>
                  <Input type="number" min="1" value={newMaxBranches} onChange={(e) => setNewMaxBranches(e.target.value)} placeholder="1" />
                </div>
                <div className="space-y-1.5">
                  <Label>Max Staff</Label>
                  <Input type="number" min="1" value={newMaxStaff} onChange={(e) => setNewMaxStaff(e.target.value)} placeholder="10" />
                </div>
              </div>

              {/* Module access checklist */}
              <div className="space-y-2 border border-gray-100 rounded-lg p-3 bg-gray-50">
                <ModuleChecklist modules={newModules} onChange={toggleNewModule} />
              </div>

              <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={creating}>
                {creating ? 'Creating...' : 'Create Account'}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Edit Modules Dialog ── */}
      <Dialog open={modulesOpen} onOpenChange={(open) => { if (!open) setModulesOpen(false) }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-primary" />
              Module Access — {modulesSalonName}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveModules} className="space-y-4">
            <ModuleChecklist modules={selectedModules} onChange={toggleModule} />
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={savingModules}>
              {savingModules ? 'Saving...' : 'Save Module Access'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Reset Password Dialog ── */}
      <Dialog
        open={resetSalonId !== null}
        onOpenChange={(open) => { if (!open) { setResetSalonId(null); setResetPw('') } }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset Password — {resetSalon?.salon_name || resetSalon?.email}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label>New Password</Label>
              <Input
                type="text"
                value={resetPw}
                onChange={(e) => setResetPw(e.target.value)}
                placeholder="Min. 6 characters"
                minLength={6}
                required
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={resetting}>
              {resetting ? 'Resetting...' : 'Reset Password'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => { if (!open) setDeleteConfirmId(null) }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Delete Salon Account
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to permanently delete{' '}
              <span className="font-semibold text-gray-900">
                {deleteSalon?.salon_name || deleteSalon?.email}
              </span>
              ? This will delete{' '}
              <span className="font-semibold">all their data</span> — appointments, staff, clients, and settings. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirmId(null)}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-1.5" />
                )}
                {deleting ? 'Deleting...' : 'Delete Forever'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Change Email Dialog ── */}
      <Dialog
        open={changeEmailSalonId !== null}
        onOpenChange={(open) => { if (!open) { setChangeEmailSalonId(null); setChangeEmailNew('') } }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Change Email Address</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleChangeEmail} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Current Email</Label>
              <Input value={changeEmailSalon?.email ?? ''} disabled className="bg-gray-50 text-gray-500" />
            </div>
            <div className="space-y-1.5">
              <Label>New Email Address</Label>
              <Input
                type="email"
                value={changeEmailNew}
                onChange={(e) => setChangeEmailNew(e.target.value)}
                placeholder="newemail@example.com"
                required
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={changingEmail}>
              {changingEmail ? 'Updating...' : 'Update Email'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit Limits Dialog ── */}
      <Dialog open={limitsOpen} onOpenChange={(open) => { if (!open) setLimitsOpen(false) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Plan Limits</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveLimits} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Max Branches</Label>
                <Input
                  type="number" min="1"
                  value={limitsMaxBranches}
                  onChange={(e) => setLimitsMaxBranches(e.target.value)}
                  placeholder="1" required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Max Staff</Label>
                <Input
                  type="number" min="1"
                  value={limitsMaxStaff}
                  onChange={(e) => setLimitsMaxStaff(e.target.value)}
                  placeholder="10" required
                />
              </div>
            </div>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={savingLimits}>
              {savingLimits ? 'Saving...' : 'Save Limits'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Salon Detail Dialog ── */}
      <Dialog
        open={detailSalon !== null}
        onOpenChange={(open) => {
          if (!open) { setDetailSalon(null); setSalonDetail(null); setDetailVisiblePws(new Set()) }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              {detailSalon?.salon_name || 'Salon Details'}
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="py-16 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : (
            <div className="space-y-5">
              {/* Basic info */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Email', value: detailSalon?.email },
                  {
                    label: 'Status',
                    value: (
                      <Badge
                        className={
                          detailSalon?.subscription_status === 'suspended'
                            ? 'bg-red-50 text-red-600 border-red-200'
                            : 'bg-green-50 text-green-600 border-green-200'
                        }
                      >
                        {detailSalon?.subscription_status === 'suspended' ? 'Suspended' : 'Active'}
                      </Badge>
                    ),
                  },
                  {
                    label: 'Date Joined',
                    value: detailSalon?.created_at
                      ? new Date(detailSalon.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                      : '—',
                  },
                  {
                    label: 'Modules Enabled',
                    value: `${detailSalon?.enabled_modules?.length ?? ALL_MODULE_KEYS.length}/${ALL_MODULE_KEYS.length}`,
                  },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">{label}</p>
                    <div className="text-sm font-medium text-gray-900">{value}</div>
                  </div>
                ))}
              </div>

              {/* Enabled modules summary */}
              {detailSalon?.enabled_modules && detailSalon.enabled_modules.length < ALL_MODULE_KEYS.length && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-amber-800 mb-2">Disabled Modules</p>
                  <div className="flex flex-wrap gap-1">
                    {ALL_MODULES.filter(m => !detailSalon.enabled_modules!.includes(m.key)).map(m => (
                      <span key={m.key} className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                        {m.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Stats */}
              {salonDetail && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-primary/5 rounded-lg p-3 text-center">
                    <Users className="w-5 h-5 text-primary mx-auto mb-1" />
                    <p className="text-2xl font-bold text-primary">{salonDetail.members.length}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Sub-users</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <CalendarDays className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-blue-600">{salonDetail.appointmentCount}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Appointments</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <DollarSign className="w-5 h-5 text-green-600 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-green-600">
                      ${salonDetail.revenue.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">Revenue</p>
                  </div>
                </div>
              )}

              {/* Team members */}
              {salonDetail && salonDetail.members.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Team Members ({salonDetail.members.length})</h3>
                  <div className="rounded-lg border border-gray-100 divide-y divide-gray-50">
                    {salonDetail.members.map((m) => (
                      <div key={m.id} className="px-3 py-2.5 flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-primary text-xs font-bold">
                            {m.email[0].toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-medium text-gray-900 truncate">{m.email}</span>
                            <Badge className="text-xs bg-gray-50 text-gray-600 border-gray-200 shrink-0">
                              {m.display_name || m.role}
                            </Badge>
                            <Badge
                              className={cn(
                                'text-xs shrink-0',
                                m.status === 'active'
                                  ? 'bg-green-50 text-green-700 border-green-200'
                                  : m.status === 'inactive'
                                  ? 'bg-gray-100 text-gray-500 border-gray-200'
                                  : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                              )}
                            >
                              {m.status}
                            </Badge>
                          </div>
                          {m.permissions && m.permissions.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {m.permissions.map((p: string) => (
                                <span
                                  key={p}
                                  className="text-[10px] bg-primary/5 text-primary border border-primary/15 px-1.5 py-0.5 rounded-full"
                                >
                                  {p}
                                </span>
                              ))}
                            </div>
                          )}
                          {m.last_set_password && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-xs text-gray-400">PW:</span>
                              <span className="text-xs font-mono text-gray-600">
                                {detailVisiblePws.has(m.id) ? m.last_set_password : '••••••••'}
                              </span>
                              <button
                                onClick={() => toggleDetailPw(m.id)}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                {detailVisiblePws.has(m.id) ? (
                                  <EyeOff className="w-3 h-3" />
                                ) : (
                                  <Eye className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick actions */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Quick Actions</h3>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                    onClick={() => {
                      const s = detailSalon
                      setDetailSalon(null)
                      setTimeout(() => { if (s) openEditModules(s) }, 50)
                    }}
                  >
                    <LayoutGrid className="w-3.5 h-3.5 mr-1.5" /> Edit Modules
                  </Button>
                  {detailSalon?.subscription_status === 'suspended' ? (
                    <Button
                      size="sm"
                      className="bg-primary hover:bg-primary/90"
                      onClick={() => {
                        if (detailSalon) handleToggle(detailSalon)
                        setDetailSalon(null)
                      }}
                    >
                      Activate
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-orange-200 text-orange-600 hover:bg-orange-50"
                      onClick={() => {
                        if (detailSalon) handleToggle(detailSalon)
                        setDetailSalon(null)
                      }}
                    >
                      Suspend
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const s = detailSalon
                      setDetailSalon(null)
                      setTimeout(() => { if (s) { setChangeEmailSalonId(s.id); setChangeEmailNew('') } }, 50)
                    }}
                  >
                    <Mail className="w-3.5 h-3.5 mr-1.5" /> Change Email
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const s = detailSalon
                      setDetailSalon(null)
                      setTimeout(() => { if (s) { setResetSalonId(s.id); setResetPw('') } }, 50)
                    }}
                  >
                    <KeyRound className="w-3.5 h-3.5 mr-1.5" /> Reset Password
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => {
                      const s = detailSalon
                      setDetailSalon(null)
                      setTimeout(() => { if (s) setDeleteConfirmId(s.id) }, 50)
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

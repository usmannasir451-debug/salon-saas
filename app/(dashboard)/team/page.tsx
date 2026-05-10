'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useUserContext } from '@/components/RoleContext'
import { useRouter } from 'next/navigation'
import { ROLE_NAV, ROLE_LABELS, ROLE_COLORS } from '@/lib/roles'
import type { SalonMember, UserRole } from '@/lib/types'
import { createTeamMember, updateTeamMember, resetTeamMemberPassword, deleteTeamMember } from './actions'
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
  UserCog,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Pencil,
  ShieldCheck,
} from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

const HREF_TO_PERM: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/appointments': 'appointments',
  '/calendar': 'calendar',
  '/walkin': 'walkin',
  '/services': 'services',
  '/staff': 'staff',
  '/staff/performance': 'performance',
  '/reviews': 'reviews',
  '/clients': 'clients',
  '/inventory': 'inventory',
  '/expenses': 'expenses',
  '/payroll': 'payroll',
  '/reports/pnl': 'reports',
  '/team': 'team',
  '/settings': 'settings',
}

const ALL_PERMISSIONS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'appointments', label: 'Appointments' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'walkin', label: 'Walk-In' },
  { key: 'services', label: 'Services' },
  { key: 'staff', label: 'Staff' },
  { key: 'performance', label: 'Performance' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'clients', label: 'Clients' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'payroll', label: 'Payroll' },
  { key: 'reports', label: 'Reports / P&L' },
  { key: 'team', label: 'Team Members' },
  { key: 'settings', label: 'Settings' },
]

function getDefaultPermsForRole(role: string): string[] {
  const hrefs = ROLE_NAV[role as UserRole] ?? []
  return hrefs.map((h) => HREF_TO_PERM[h]).filter(Boolean)
}

const emptyCreate = { displayName: '', email: '', password: '', permissions: [] as string[] }

export default function TeamPage() {
  const { role } = useUserContext()
  const router = useRouter()

  const [members, setMembers] = useState<SalonMember[]>([])
  const [loading, setLoading] = useState(true)

  // Add dialog
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState(emptyCreate)
  const [adding, setAdding] = useState(false)
  const [showAddPw, setShowAddPw] = useState(false)

  // Edit dialog
  const [editMember, setEditMember] = useState<SalonMember | null>(null)
  const [editName, setEditName] = useState('')
  const [editPerms, setEditPerms] = useState<string[]>([])
  const [editing, setEditing] = useState(false)

  // Reset password dialog
  const [resetMember, setResetMember] = useState<SalonMember | null>(null)
  const [resetPw, setResetPw] = useState('')
  const [resetting, setResetting] = useState(false)
  const [showResetPw, setShowResetPw] = useState(false)

  // Delete
  const [removing, setRemoving] = useState<string | null>(null)

  // Inline password toggle per row
  const [visiblePws, setVisiblePws] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (role !== 'owner') {
      router.replace('/dashboard')
      return
    }
    loadMembers()
  }, [role, router])

  async function loadMembers() {
    const supabase = createClient()
    const { data } = await supabase
      .from('salon_members')
      .select('*')
      .order('invited_at', { ascending: false })
    setMembers((data as SalonMember[]) ?? [])
    setLoading(false)
  }

  function openEdit(m: SalonMember) {
    setEditMember(m)
    setEditName(m.display_name ?? ROLE_LABELS[m.role as UserRole] ?? m.role)
    setEditPerms(m.permissions ?? getDefaultPermsForRole(m.role))
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!addForm.displayName.trim() || !addForm.email.trim() || !addForm.password.trim()) {
      toast.error('Display name, email, and password are required')
      return
    }
    if (addForm.permissions.length === 0) {
      toast.error('Select at least one permission')
      return
    }
    setAdding(true)
    const res = await createTeamMember(
      addForm.displayName,
      addForm.email,
      addForm.password,
      addForm.permissions
    )
    if ('error' in res) {
      toast.error(res.error)
    } else {
      toast.success(`Team member created`)
      setAddOpen(false)
      setAddForm(emptyCreate)
      setShowAddPw(false)
      await loadMembers()
    }
    setAdding(false)
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editMember) return
    if (editPerms.length === 0) {
      toast.error('Select at least one permission')
      return
    }
    setEditing(true)
    const res = await updateTeamMember(editMember.id, editName, editPerms)
    if ('error' in res) {
      toast.error(res.error)
    } else {
      toast.success('Permissions updated')
      setEditMember(null)
      await loadMembers()
    }
    setEditing(false)
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (!resetMember || !resetMember.member_user_id) return
    if (resetPw.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    setResetting(true)
    const res = await resetTeamMemberPassword(resetMember.id, resetMember.member_user_id, resetPw)
    if ('error' in res) {
      toast.error(res.error)
    } else {
      toast.success('Password reset successfully')
      setResetMember(null)
      setResetPw('')
      await loadMembers()
    }
    setResetting(false)
  }

  async function handleDelete(member: SalonMember) {
    if (!confirm(`Remove ${member.display_name || member.email} from your team? They will lose access immediately.`)) return
    setRemoving(member.id)
    const res = await deleteTeamMember(member.id)
    if ('error' in res) {
      toast.error(res.error)
    } else {
      toast.success('Team member removed')
      setMembers((prev) => prev.filter((m) => m.id !== member.id))
    }
    setRemoving(null)
  }

  function togglePw(id: string) {
    setVisiblePws((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function togglePerm(key: string, current: string[], setter: (p: string[]) => void) {
    setter(current.includes(key) ? current.filter((k) => k !== key) : [...current, key])
  }

  if (role !== 'owner') return null

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <UserCog className="w-6 h-6 text-primary" />
            Team Members
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Create portal accounts with custom page access for your team
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="bg-primary hover:bg-primary/90 gap-2">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Team Member</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>

      {/* Members list */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : members.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <UserCog className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No team members yet</h3>
          <p className="text-gray-400 text-sm mb-6">Create accounts for your staff with custom access rights</p>
          <Button onClick={() => setAddOpen(true)} className="bg-primary hover:bg-primary/90 gap-2">
            <Plus className="w-4 h-4" /> Add First Member
          </Button>
        </div>
      ) : (
        <Card className="border-gray-100">
          <CardHeader className="pb-2 border-b border-gray-50">
            <CardTitle className="text-base">
              {members.length} team member{members.length !== 1 ? 's' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-50">
              {members.map((member) => {
                const label = member.display_name || ROLE_LABELS[member.role as UserRole] || member.role
                const hasCustomPerms = member.permissions && member.permissions.length > 0
                const showPw = visiblePws.has(member.id)
                return (
                  <div key={member.id} className="flex items-start sm:items-center gap-3 px-4 py-3.5">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary font-bold text-sm">
                        {label[0]?.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-800">{label}</p>
                        <p className="text-sm text-gray-500 truncate">{member.email}</p>
                        {hasCustomPerms ? (
                          <Badge className="text-xs bg-primary/5 text-primary border-primary/20 gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            {member.permissions!.length} pages
                          </Badge>
                        ) : (
                          <Badge className={cn('text-xs', ROLE_COLORS[member.role as UserRole])}>
                            {ROLE_LABELS[member.role as UserRole]}
                          </Badge>
                        )}
                        {member.status === 'active' ? (
                          <Badge className="text-xs bg-green-50 text-green-700 border-green-200 gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Active
                          </Badge>
                        ) : (
                          <Badge className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                            Pending
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
                        <span>Added {format(new Date(member.invited_at), 'MMM d, yyyy')}</span>
                        {member.last_set_password && (
                          <span className="flex items-center gap-1">
                            <span>PW:</span>
                            <span className="font-mono">
                              {showPw ? member.last_set_password : '••••••••'}
                            </span>
                            <button onClick={() => togglePw(member.id)} className="hover:text-gray-600">
                              {showPw ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEdit(member)}
                        title="Edit permissions"
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-primary transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {member.member_user_id && (
                        <button
                          onClick={() => { setResetMember(member); setResetPw(''); setShowResetPw(false) }}
                          title="Reset password"
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(member)}
                        disabled={removing === member.id}
                        title="Remove member"
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        {removing === member.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Add Team Member Dialog ── */}
      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) { setAddForm(emptyCreate); setShowAddPw(false) } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" />
              Add Team Member
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Display Name</Label>
              <Input
                placeholder="e.g. Front Desk, Cashier, Manager"
                value={addForm.displayName}
                onChange={(e) => setAddForm({ ...addForm, displayName: e.target.value })}
                required
              />
              <p className="text-xs text-gray-400">This is how they will appear in the team list</p>
            </div>
            <div className="space-y-1.5">
              <Label>Email Address</Label>
              <Input
                type="email"
                placeholder="staff@example.com"
                value={addForm.email}
                onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <div className="relative">
                <Input
                  type={showAddPw ? 'text' : 'password'}
                  placeholder="Min. 6 characters"
                  value={addForm.password}
                  onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                  minLength={6}
                  required
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowAddPw((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showAddPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Permissions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Access Rights</Label>
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setAddForm({ ...addForm, permissions: ALL_PERMISSIONS.map((p) => p.key) })}
                    className="text-primary hover:underline"
                  >
                    Select all
                  </button>
                  <span className="text-gray-300">·</span>
                  <button
                    type="button"
                    onClick={() => setAddForm({ ...addForm, permissions: [] })}
                    className="text-gray-500 hover:underline"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 rounded-lg border border-gray-100 p-3 bg-gray-50/50">
                {ALL_PERMISSIONS.map((p) => (
                  <label
                    key={p.key}
                    className="flex items-center gap-2 cursor-pointer py-1 px-1.5 rounded hover:bg-white transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={addForm.permissions.includes(p.key)}
                      onChange={() =>
                        togglePerm(p.key, addForm.permissions, (perms) =>
                          setAddForm({ ...addForm, permissions: perms })
                        )
                      }
                      className="w-4 h-4 rounded border-gray-300 text-primary accent-primary cursor-pointer"
                    />
                    <span className="text-sm text-gray-700">{p.label}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-400">
                {addForm.permissions.length} of {ALL_PERMISSIONS.length} pages selected
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)} size="sm">
                Cancel
              </Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90" size="sm" disabled={adding}>
                {adding && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                Create Account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit Permissions Dialog ── */}
      <Dialog open={editMember !== null} onOpenChange={(o) => { if (!o) setEditMember(null) }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4 text-primary" />
              Edit — {editMember?.display_name || editMember?.email}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Display Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Access Rights</Label>
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setEditPerms(ALL_PERMISSIONS.map((p) => p.key))}
                    className="text-primary hover:underline"
                  >
                    Select all
                  </button>
                  <span className="text-gray-300">·</span>
                  <button
                    type="button"
                    onClick={() => setEditPerms([])}
                    className="text-gray-500 hover:underline"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 rounded-lg border border-gray-100 p-3 bg-gray-50/50">
                {ALL_PERMISSIONS.map((p) => (
                  <label
                    key={p.key}
                    className="flex items-center gap-2 cursor-pointer py-1 px-1.5 rounded hover:bg-white transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={editPerms.includes(p.key)}
                      onChange={() => togglePerm(p.key, editPerms, setEditPerms)}
                      className="w-4 h-4 rounded border-gray-300 text-primary accent-primary cursor-pointer"
                    />
                    <span className="text-sm text-gray-700">{p.label}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-400">
                {editPerms.length} of {ALL_PERMISSIONS.length} pages selected
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditMember(null)} size="sm">
                Cancel
              </Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90" size="sm" disabled={editing}>
                {editing && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Reset Password Dialog ── */}
      <Dialog
        open={resetMember !== null}
        onOpenChange={(o) => { if (!o) { setResetMember(null); setResetPw('') } }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-primary" />
              Reset Password — {resetMember?.display_name || resetMember?.email}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-1.5">
              <Label>New Password</Label>
              <div className="relative">
                <Input
                  type={showResetPw ? 'text' : 'password'}
                  value={resetPw}
                  onChange={(e) => setResetPw(e.target.value)}
                  placeholder="Min. 6 characters"
                  minLength={6}
                  required
                  autoFocus
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowResetPw((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showResetPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResetMember(null)} size="sm">
                Cancel
              </Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90" size="sm" disabled={resetting}>
                {resetting && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                Reset Password
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

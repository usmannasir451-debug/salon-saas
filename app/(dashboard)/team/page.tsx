'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useUserContext } from '@/components/RoleContext'
import { useRouter } from 'next/navigation'
import type { SalonMember, StaffMember, UserRole } from '@/lib/types'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/roles'
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
import {
  UserCog,
  Plus,
  Trash2,
  Loader2,
  Mail,
  Clock,
  CheckCircle2,
  AlertCircle,
  Link2,
} from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

const INVITE_ROLES: Array<{ value: Exclude<UserRole, 'owner'>; desc: string }> = [
  { value: 'regional_manager', desc: 'Dashboard & reports, all branches, no settings' },
  { value: 'manager', desc: 'Full access except billing & team management' },
  { value: 'receptionist', desc: 'Appointments, walk-ins & clients only' },
  { value: 'cashier', desc: 'Payments, discounts & feedback' },
  { value: 'staff', desc: 'Own appointments for today only' },
]

const emptyForm = { email: '', role: '' as Exclude<UserRole, 'owner'> | '', staff_id: '' }

export default function TeamPage() {
  const { role } = useUserContext()
  const router = useRouter()
  const [members, setMembers] = useState<SalonMember[]>([])
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [inviting, setInviting] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    if (role !== 'owner') {
      router.replace('/appointments')
      return
    }
    loadData()
  }, [role, router])

  async function loadData() {
    const supabase = createClient()
    const [membersRes, staffRes] = await Promise.all([
      supabase
        .from('salon_members')
        .select('*, staff:staff_id(id, name)')
        .order('invited_at', { ascending: false }),
      supabase.from('staff').select('id, name').order('name'),
    ])
    setMembers((membersRes.data as SalonMember[]) ?? [])
    setStaffList((staffRes.data as StaffMember[]) ?? [])
    setLoading(false)
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!form.email.trim() || !form.role) {
      toast.error('Email and role are required')
      return
    }
    setInviting(true)
    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim().toLowerCase(),
          role: form.role,
          staff_id: form.staff_id || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to send invite')
      } else {
        if (data.warning) {
          toast.warning(data.warning)
        } else {
          toast.success(`Invite sent to ${form.email}`)
        }
        setDialogOpen(false)
        setForm(emptyForm)
        await loadData()
      }
    } catch {
      toast.error('Network error — please try again')
    }
    setInviting(false)
  }

  async function handleRemove(memberId: string, memberEmail: string) {
    if (!confirm(`Remove ${memberEmail} from your team? They will lose access immediately.`)) return
    setRemoving(memberId)
    const supabase = createClient()
    const { error } = await supabase.from('salon_members').delete().eq('id', memberId)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Member removed')
      setMembers((prev) => prev.filter((m) => m.id !== memberId))
    }
    setRemoving(null)
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
            Invite staff to access the portal with role-based permissions
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-primary hover:bg-primary/90 gap-2">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Invite Member</span>
          <span className="sm:hidden">Invite</span>
        </Button>
      </div>

      {/* Role Guide */}
      <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {INVITE_ROLES.map((r) => (
          <div key={r.value} className="rounded-xl border border-gray-100 bg-white p-3">
            <Badge className={cn('text-xs mb-2', ROLE_COLORS[r.value])}>{ROLE_LABELS[r.value]}</Badge>
            <p className="text-xs text-gray-500">{r.desc}</p>
          </div>
        ))}
      </div>

      {/* Members List */}
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
          <p className="text-gray-400 text-sm mb-6">Invite staff to let them log in with role-based access</p>
          <Button onClick={() => setDialogOpen(true)} className="bg-primary hover:bg-primary/90 gap-2">
            <Plus className="w-4 h-4" /> Invite First Member
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
              {members.map((member) => (
                <div key={member.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary font-bold text-sm">
                      {member.email[0]?.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-800 truncate">{member.email}</p>
                      <Badge className={cn('text-xs', ROLE_COLORS[member.role as UserRole])}>
                        {ROLE_LABELS[member.role as UserRole]}
                      </Badge>
                      {member.status === 'pending' ? (
                        <Badge className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200 gap-1">
                          <Clock className="w-3 h-3" />
                          Pending
                        </Badge>
                      ) : (
                        <Badge className="text-xs bg-green-50 text-green-700 border-green-200 gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Active
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
                      <span>Invited {format(new Date(member.invited_at), 'MMM d, yyyy')}</span>
                      {member.staff && (
                        <span className="flex items-center gap-1">
                          <Link2 className="w-3 h-3" />
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          Linked to {(member.staff as any).name}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemove(member.id, member.email)}
                    disabled={removing === member.id}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                    title="Remove member"
                  >
                    {removing === member.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invite Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              Invite Team Member
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="inviteEmail">Email Address</Label>
              <Input
                id="inviteEmail"
                type="email"
                placeholder="staff@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select
                value={form.role}
                onValueChange={(v) =>
                  setForm({ ...form, role: (v ?? '') as typeof form.role, staff_id: '' })
                }
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {INVITE_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      <span className="font-medium">{ROLE_LABELS[r.value]}</span>
                      <span className="text-xs text-gray-400 ml-2">— {r.desc}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.role === 'staff' && staffList.length > 0 && (
              <div className="space-y-1.5">
                <Label>
                  Link to Staff Record
                  <span className="ml-1 text-xs text-gray-400 font-normal">(optional)</span>
                </Label>
                <Select
                  value={form.staff_id}
                  onValueChange={(v) => setForm({ ...form, staff_id: v ?? '' })}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Select staff member" />
                  </SelectTrigger>
                  <SelectContent>
                    {staffList.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-400">
                  They&apos;ll only see today&apos;s appointments assigned to this staff record.
                </p>
              </div>
            )}

            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700 flex gap-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>
                Requires <code className="bg-amber-100 px-0.5 rounded">SUPABASE_SERVICE_ROLE_KEY</code> in{' '}
                <code className="bg-amber-100 px-0.5 rounded">.env.local</code> for email delivery.
              </span>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} size="sm">
                Cancel
              </Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90" size="sm" disabled={inviting}>
                {inviting && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                Send Invite
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

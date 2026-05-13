'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useUserContext } from '@/components/RoleContext'
import type { StaffMember, SalaryType } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Users, Plus, Pencil, Trash2, Loader2, Phone, CalendarDays, UserCheck, UserX, DollarSign, Percent } from 'lucide-react'

const SALARY_TYPES: { value: SalaryType; label: string; color: string }[] = [
  { value: 'fixed',      label: 'Fixed',      color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'commission', label: 'Commission',  color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'both',       label: 'Fixed + %',   color: 'bg-green-50 text-green-700 border-green-200' },
]

const emptyForm = {
  name:                    '',
  phone:                   '',
  joining_date:            '',
  gender:                  '' as 'male' | 'female' | 'other' | '',
  designation:             '',
  emergency_contact_name:  '',
  emergency_contact_phone: '',
  salary_type:             'fixed' as SalaryType,
  fixed_amount:            '',
  commission_percentage:   '',
  is_active:               true,
}

export default function StaffPage() {
  const { role, ownerId } = useUserContext()
  const router = useRouter()

  const [staff, setStaff] = useState<StaffMember[]>([])
  const [staffLimit, setStaffLimit] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [showInactive, setShowInactive] = useState(false)

  useEffect(() => {
    if (!['owner', 'manager'].includes(role)) { router.replace('/appointments'); return }
    loadStaff()
  }, [role, router]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!['owner', 'manager'].includes(role)) return null

  async function loadStaff() {
    const supabase = createClient()
    const [staffRes, profileRes] = await Promise.all([
      supabase.from('staff').select('*').eq('user_id', ownerId).order('name'),
      supabase.from('profiles').select('max_staff').eq('id', ownerId).single(),
    ])
    setStaff((staffRes.data as StaffMember[]) ?? [])
    setStaffLimit(profileRes.data?.max_staff ?? null)
    setLoading(false)
  }

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(member: StaffMember) {
    setEditingId(member.id)
    setForm({
      name:                    member.name,
      phone:                   member.phone,
      joining_date:            member.joining_date ?? '',
      gender:                  (member.gender as 'male' | 'female' | 'other') ?? '',
      designation:             member.designation ?? '',
      emergency_contact_name:  member.emergency_contact_name ?? '',
      emergency_contact_phone: member.emergency_contact_phone ?? '',
      salary_type:             member.salary_type ?? 'fixed',
      fixed_amount:            member.fixed_amount != null ? String(member.fixed_amount) : '',
      commission_percentage:   member.commission_percentage != null ? String(member.commission_percentage) : '',
      is_active:               member.is_active,
    })
    setDialogOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error('Name and phone are required')
      return
    }
    setSaving(true)
    const supabase = createClient()

    const payload = {
      name:                    form.name.trim(),
      phone:                   form.phone.trim(),
      joining_date:            form.joining_date || null,
      gender:                  form.gender || null,
      designation:             form.designation.trim() || null,
      emergency_contact_name:  form.emergency_contact_name.trim() || null,
      emergency_contact_phone: form.emergency_contact_phone.trim() || null,
      salary_type:             form.salary_type,
      fixed_amount:            ['fixed', 'both'].includes(form.salary_type) && form.fixed_amount
        ? parseFloat(form.fixed_amount) : 0,
      commission_percentage:   ['commission', 'both'].includes(form.salary_type) && form.commission_percentage
        ? parseFloat(form.commission_percentage) : 0,
      is_active:               form.is_active,
      user_id:                 ownerId,
    }

    if (editingId) {
      const { error } = await supabase.from('staff').update(payload).eq('id', editingId)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Staff member updated')
    } else {
      const activeCount = staff.filter(s => s.is_active).length
      const limit = staffLimit ?? 999
      if (activeCount >= limit) {
        toast.error(`You have reached your staff limit (${activeCount}/${limit}). Please contact support to upgrade your plan.`)
        setSaving(false)
        return
      }
      const { error } = await supabase.from('staff').insert(payload)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Staff member added')
    }

    setDialogOpen(false)
    await loadStaff()
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this staff member? This cannot be undone.')) return
    setDeleting(id)
    const supabase = createClient()
    const { error } = await supabase.from('staff').delete().eq('id', id)
    if (error) { toast.error(error.message) } else { toast.success('Staff member removed') }
    await loadStaff()
    setDeleting(null)
  }

  async function toggleActive(member: StaffMember) {
    const supabase = createClient()
    const { error } = await supabase.from('staff').update({ is_active: !member.is_active }).eq('id', member.id)
    if (error) { toast.error(error.message) } else {
      toast.success(member.is_active ? 'Marked as inactive' : 'Marked as active')
      await loadStaff()
    }
  }

  function getInitials(name: string) {
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
  }

  function getSalaryLabel(member: StaffMember): string {
    const type = member.salary_type ?? 'fixed'
    const fixed = Number(member.fixed_amount ?? 0)
    const pct   = Number(member.commission_percentage ?? 0)
    if (type === 'fixed')      return fixed > 0 ? `${fixed.toLocaleString()}/mo` : ''
    if (type === 'commission') return pct > 0 ? `${pct}% commission` : ''
    if (type === 'both') {
      const parts = []
      if (fixed > 0) parts.push(`${fixed.toLocaleString()}/mo`)
      if (pct > 0)   parts.push(`${pct}%`)
      return parts.join(' + ')
    }
    return ''
  }

  const avatarColors = [
    'bg-rose-100 text-rose-600',
    'bg-blue-100 text-blue-600',
    'bg-purple-100 text-purple-600',
    'bg-green-100 text-green-600',
    'bg-orange-100 text-orange-600',
    'bg-teal-100 text-teal-600',
  ]

  const filtered      = showInactive ? staff : staff.filter(m => m.is_active)
  const inactiveCount = staff.filter(m => !m.is_active).length

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" /> Staff
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your salon team</p>
          {staffLimit != null && (() => {
            const activeCount = staff.filter(s => s.is_active).length
            const isAtLimit = activeCount >= staffLimit
            const isNearLimit = activeCount >= staffLimit * 0.8
            return (
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${isAtLimit ? 'bg-red-50 text-red-600 border-red-200' : isNearLimit ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                  {activeCount}/{staffLimit} staff
                </span>
                {isNearLimit && !isAtLimit && <span className="text-xs text-yellow-600">Approaching limit</span>}
                {isAtLimit && <span className="text-xs text-red-600">Limit reached</span>}
              </div>
            )
          })()}
        </div>
        <div className="flex items-center gap-2">
          {inactiveCount > 0 && (
            <button onClick={() => setShowInactive(v => !v)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                showInactive ? 'bg-gray-200 text-gray-700 border-gray-300' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}>
              {showInactive ? 'Hide Inactive' : `Show Inactive (${inactiveCount})`}
            </button>
          )}
          <Button onClick={openCreate} className="bg-primary hover:bg-primary/90 gap-2">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Staff</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No staff yet</h3>
          <p className="text-gray-400 text-sm mb-6">Add your first team member to get started</p>
          <Button onClick={openCreate} className="bg-primary hover:bg-primary/90 gap-2">
            <Plus className="w-4 h-4" /> Add First Team Member
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((member, idx) => {
            const salaryType = SALARY_TYPES.find(t => t.value === (member.salary_type ?? 'fixed'))
            const salaryLabel = getSalaryLabel(member)
            return (
              <Card key={member.id}
                className={`border-gray-100 hover:shadow-md transition-shadow group ${!member.is_active ? 'opacity-60' : ''}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-base font-bold flex-shrink-0 ${avatarColors[idx % avatarColors.length]}`}>
                      {getInitials(member.name)}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(member)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-primary transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(member.id)} disabled={deleting === member.id}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                        {deleting === member.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <CardTitle className="text-sm mt-3 text-gray-900">{member.name}</CardTitle>
                  {member.designation && <p className="text-xs text-gray-500 -mt-1">{member.designation}</p>}
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Phone className="w-3.5 h-3.5 text-gray-400" />
                    <span>{member.phone}</span>
                  </div>
                  {member.joining_date && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <CalendarDays className="w-3.5 h-3.5 text-gray-400" />
                      <span>Joined {new Date(member.joining_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  )}
                  {/* Salary badge */}
                  {salaryType && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge className={`text-[10px] border ${salaryType.color}`}>{salaryType.label}</Badge>
                      {salaryLabel && (
                        <span className="text-[10px] text-gray-500 font-medium">{salaryLabel}</span>
                      )}
                    </div>
                  )}
                  {/* Active/Inactive toggle */}
                  <button onClick={() => toggleActive(member)}
                    className={`flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 border transition-colors ${
                      member.is_active
                        ? 'bg-primary/10 text-primary border-primary/20 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                        : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-green-50 hover:text-green-600 hover:border-green-200'
                    }`}>
                    {member.is_active
                      ? <><UserCheck className="w-3 h-3" /> Active</>
                      : <><UserX className="w-3 h-3" /> Inactive</>
                    }
                  </button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Staff Member' : 'Add Staff Member'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            {/* Basic info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="staffName">Full Name *</Label>
                <Input id="staffName" placeholder="e.g. Sarah Johnson" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} required className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone *</Label>
                <Input id="phone" type="tel" placeholder="+1-555-0123" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })} required className="h-9" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Designation / Title</Label>
                <Input placeholder="e.g. Senior Stylist" value={form.designation}
                  onChange={(e) => setForm({ ...form, designation: e.target.value })} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label>Gender</Label>
                <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v as typeof form.gender })}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select gender" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="joining">Date of Joining</Label>
              <input id="joining" type="date" value={form.joining_date}
                onChange={(e) => setForm({ ...form, joining_date: e.target.value })}
                className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20" />
            </div>

            {/* Salary section */}
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 space-y-3">
              <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-primary" /> Salary Configuration
              </p>
              <div className="space-y-1.5">
                <Label>Salary Type</Label>
                <Select value={form.salary_type} onValueChange={(v) => setForm({ ...form, salary_type: v as SalaryType })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed Monthly</SelectItem>
                    <SelectItem value="commission">Commission Only (% of revenue)</SelectItem>
                    <SelectItem value="both">Fixed + Commission</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {['fixed', 'both'].includes(form.salary_type) && (
                <div className="space-y-1.5">
                  <Label>Fixed Monthly Amount</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <Input type="number" step="0.01" min="0" value={form.fixed_amount}
                      onChange={(e) => setForm({ ...form, fixed_amount: e.target.value })}
                      placeholder="0.00" className="h-9 pl-7" />
                  </div>
                </div>
              )}
              {['commission', 'both'].includes(form.salary_type) && (
                <div className="space-y-1.5">
                  <Label>Commission Percentage</Label>
                  <div className="relative">
                    <Input type="number" step="0.1" min="0" max="100" value={form.commission_percentage}
                      onChange={(e) => setForm({ ...form, commission_percentage: e.target.value })}
                      placeholder="0" className="h-9 pr-7" />
                    <Percent className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  </div>
                  <p className="text-[10px] text-gray-400">% of revenue generated by this staff member</p>
                </div>
              )}
            </div>

            {/* Emergency contact */}
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 space-y-3">
              <p className="text-xs font-semibold text-gray-600">Emergency Contact</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input placeholder="Contact name" value={form.emergency_contact_name}
                    onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value })} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input placeholder="Contact phone" value={form.emergency_contact_phone}
                    onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value })} className="h-9" />
                </div>
              </div>
            </div>

            {editingId && (
              <div className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
                <span className="text-sm text-gray-700">Status</span>
                <button type="button" onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                  className={`flex items-center gap-1.5 text-xs rounded-full px-3 py-1.5 border transition-colors ${
                    form.is_active ? 'bg-primary/10 text-primary border-primary/20' : 'bg-gray-200 text-gray-600 border-gray-300'
                  }`}>
                  {form.is_active ? <><UserCheck className="w-3 h-3" /> Active</> : <><UserX className="w-3 h-3" /> Inactive</>}
                </button>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} size="sm">Cancel</Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90" size="sm" disabled={saving}>
                {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                {editingId ? 'Update' : 'Add Staff'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

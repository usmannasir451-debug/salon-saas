'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useUserContext } from '@/components/RoleContext'
import type { Branch } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  MapPin,
  Phone,
  CalendarDays,
} from 'lucide-react'

const emptyForm = { name: '', address: '', phone: '' }

export default function BranchesPage() {
  const { role, ownerId } = useUserContext()
  const router = useRouter()

  const [branches, setBranches] = useState<Branch[]>([])
  const [apptCounts, setApptCounts] = useState<Record<string, number>>({})
  const [branchLimit, setBranchLimit] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    if (!['owner', 'manager'].includes(role)) { router.replace('/appointments'); return }
    loadData()
  }, [role, router]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!['owner', 'manager'].includes(role)) return null

  async function loadData() {
    const supabase = createClient()

    const [branchRes, apptRes, profileRes] = await Promise.all([
      supabase.from('branches').select('*').eq('user_id', ownerId).order('created_at', { ascending: true }),
      supabase.from('appointments').select('branch_id').eq('user_id', ownerId).not('branch_id', 'is', null),
      supabase.from('profiles').select('max_branches').eq('id', ownerId).single(),
    ])

    setBranches((branchRes.data as Branch[]) ?? [])
    setBranchLimit(profileRes.data?.max_branches ?? null)

    const counts: Record<string, number> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(apptRes.data ?? []).forEach((row: any) => {
      if (row.branch_id) counts[row.branch_id] = (counts[row.branch_id] ?? 0) + 1
    })
    setApptCounts(counts)
    setLoading(false)
  }

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(branch: Branch) {
    setEditingId(branch.id)
    setForm({ name: branch.name, address: branch.address ?? '', phone: branch.phone ?? '' })
    setDialogOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Branch name is required'); return }
    setSaving(true)
    const supabase = createClient()

    const payload = {
      name: form.name.trim(),
      address: form.address.trim() || null,
      phone: form.phone.trim() || null,
      user_id: ownerId,
    }

    if (editingId) {
      const { error } = await supabase.from('branches').update(payload).eq('id', editingId)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Branch updated')
    } else {
      const { data: profile } = await supabase.from('profiles').select('max_branches').eq('id', ownerId).single()
      const limit = profile?.max_branches ?? 999
      if (branches.length >= limit) {
        toast.error(`You have reached your branch limit (${branches.length}/${limit}). Please contact support to upgrade your plan.`)
        setSaving(false)
        return
      }
      const { error } = await supabase.from('branches').insert(payload)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Branch added')
    }

    setDialogOpen(false)
    await loadData()
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this branch? Appointments linked to it will become unassigned.')) return
    setDeleting(id)
    const supabase = createClient()
    const { error } = await supabase.from('branches').delete().eq('id', id)
    if (error) { toast.error(error.message) } else { toast.success('Branch deleted') }
    await loadData()
    setDeleting(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            Branches
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your salon locations</p>
          {branchLimit != null && (
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${branches.length >= branchLimit ? 'bg-red-50 text-red-600 border-red-200' : branches.length >= branchLimit * 0.8 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                {branches.length}/{branchLimit} branches used
              </span>
              {branches.length >= branchLimit * 0.8 && branches.length < branchLimit && (
                <span className="text-xs text-yellow-600">Approaching limit</span>
              )}
            </div>
          )}
        </div>
        <Button onClick={openCreate} className="bg-primary hover:bg-primary/90 gap-2">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Branch</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>

      {/* Info Banner */}
      <div className="mb-6 p-4 rounded-xl bg-primary/5 border border-primary/15 text-sm text-gray-600">
        <p className="font-medium text-gray-800 mb-1">Multi-Branch Management</p>
        <p>Add all your salon locations here. You can assign appointments to specific branches and filter your dashboard analytics by branch.</p>
      </div>

      {/* Branch List */}
      {branches.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No branches yet</h3>
          <p className="text-gray-400 text-sm mb-6">Add your first branch to start managing multiple locations</p>
          <Button onClick={openCreate} className="bg-primary hover:bg-primary/90 gap-2">
            <Plus className="w-4 h-4" /> Add Branch
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {branches.map((branch) => (
            <Card key={branch.id} className="border-gray-100 hover:shadow-md transition-shadow group">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 truncate">{branch.name}</p>

                      {branch.address && (
                        <div className="flex items-start gap-1.5 mt-1.5">
                          <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-gray-500 leading-relaxed">{branch.address}</p>
                        </div>
                      )}

                      {branch.phone && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <Phone className="w-3 h-3 text-gray-400 flex-shrink-0" />
                          <p className="text-xs text-gray-500">{branch.phone}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 mt-2">
                        <CalendarDays className="w-3 h-3 text-gray-400 flex-shrink-0" />
                        <p className="text-xs text-gray-500">
                          {apptCounts[branch.id] ?? 0} appointment{(apptCounts[branch.id] ?? 0) !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openEdit(branch)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-primary transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(branch.id)}
                      disabled={deleting === branch.id}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      {deleting === branch.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              {editingId ? 'Edit Branch' : 'Add Branch'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="branchName">Branch Name *</Label>
              <Input
                id="branchName"
                placeholder="e.g. Main Branch, DHA Branch"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="branchAddress">
                Address
                <span className="ml-1 text-xs text-gray-400 font-normal">(optional)</span>
              </Label>
              <div className="relative">
                <MapPin className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <textarea
                  id="branchAddress"
                  placeholder="Street, Area, City"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-input bg-transparent pl-8 pr-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 resize-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="branchPhone">
                Phone
                <span className="ml-1 text-xs text-gray-400 font-normal">(optional)</span>
              </Label>
              <div className="relative">
                <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <Input
                  id="branchPhone"
                  placeholder="03001234567"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="h-9 pl-8"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} size="sm">
                Cancel
              </Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90" size="sm" disabled={saving}>
                {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                {editingId ? 'Update Branch' : 'Add Branch'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

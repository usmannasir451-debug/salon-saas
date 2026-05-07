'use client'

import { useEffect, useState, useMemo } from 'react'
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useUserContext } from '@/components/RoleContext'
import type { Expense, ExpenseCategory } from '@/lib/types'
import {
  DollarSign, Plus, Pencil, Trash2, Loader2, RefreshCw, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string; color: string }[] = [
  { value: 'staff_refreshments', label: 'Staff Refreshments', color: '#f43f5e' },
  { value: 'salon_materials', label: 'Salon Materials', color: '#ec4899' },
  { value: 'inventory', label: 'Inventory', color: '#a855f7' },
  { value: 'utilities', label: 'Utilities', color: '#3b82f6' },
  { value: 'rent', label: 'Rent', color: '#f97316' },
  { value: 'marketing', label: 'Marketing', color: '#10b981' },
  { value: 'miscellaneous', label: 'Miscellaneous', color: '#6b7280' },
]

const catMap = Object.fromEntries(EXPENSE_CATEGORIES.map(c => [c.value, c]))

function formatCurrency(n: number, currency = 'USD') {
  return `${currency} ${Math.round(n).toLocaleString()}`
}

const emptyForm = {
  category: '' as ExpenseCategory | '',
  description: '',
  amount: '',
  expense_date: format(new Date(), 'yyyy-MM-dd'),
  paid_by: '',
  notes: '',
  is_recurring: false,
}

export default function ExpensesPage() {
  const { ownerId } = useUserContext()

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [currency, setCurrency] = useState('USD')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()))

  useEffect(() => { loadAll() }, [ownerId, selectedMonth]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAll() {
    setLoading(true)
    const supabase = createClient()
    const monthStart = format(selectedMonth, 'yyyy-MM-dd')
    const monthEnd = format(endOfMonth(selectedMonth), 'yyyy-MM-dd')

    const [profileRes, expenseRes] = await Promise.all([
      supabase.from('profiles').select('salon_currency').eq('id', ownerId).single(),
      supabase.from('expenses').select('*').eq('user_id', ownerId)
        .gte('expense_date', monthStart).lte('expense_date', monthEnd)
        .order('expense_date', { ascending: false }),
    ])

    setCurrency(profileRes.data?.salon_currency ?? 'USD')
    setExpenses((expenseRes.data as Expense[]) ?? [])
    setLoading(false)
  }

  function openCreate() {
    setEditingId(null)
    setForm({ ...emptyForm, expense_date: format(new Date(), 'yyyy-MM-dd') })
    setDialogOpen(true)
  }

  function openEdit(exp: Expense) {
    setEditingId(exp.id)
    setForm({
      category: exp.category,
      description: exp.description,
      amount: String(exp.amount),
      expense_date: exp.expense_date,
      paid_by: exp.paid_by ?? '',
      notes: exp.notes ?? '',
      is_recurring: exp.is_recurring,
    })
    setDialogOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.category || !form.description.trim() || !form.amount || !form.expense_date) {
      toast.error('Please fill required fields')
      return
    }
    setSaving(true)
    const supabase = createClient()
    const payload = {
      user_id: ownerId,
      category: form.category as ExpenseCategory,
      description: form.description.trim(),
      amount: parseFloat(form.amount),
      expense_date: form.expense_date,
      paid_by: form.paid_by.trim() || null,
      notes: form.notes.trim() || null,
      is_recurring: form.is_recurring,
    }

    if (editingId) {
      const { error } = await supabase.from('expenses').update(payload).eq('id', editingId)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Expense updated')
    } else {
      const { error } = await supabase.from('expenses').insert(payload)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Expense added')
    }

    setDialogOpen(false)
    await loadAll()
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this expense?')) return
    setDeleting(id)
    const supabase = createClient()
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) toast.error(error.message)
    else toast.success('Expense deleted')
    setDeleting(null)
    await loadAll()
  }

  const totalExpenses = useMemo(() => expenses.reduce((s, e) => s + Number(e.amount), 0), [expenses])
  const recurringCount = useMemo(() => expenses.filter(e => e.is_recurring).length, [expenses])

  const categoryData = useMemo(() =>
    EXPENSE_CATEGORIES.map(cat => ({
      name: cat.label,
      total: expenses.filter(e => e.category === cat.value).reduce((s, e) => s + Number(e.amount), 0),
      color: cat.color,
    })).filter(d => d.total > 0).sort((a, b) => b.total - a.total),
    [expenses]
  )

  function prevMonth() { setSelectedMonth(m => startOfMonth(subMonths(m, 1))) }
  function nextMonth() { setSelectedMonth(m => startOfMonth(subMonths(m, -1))) }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          </div>
          <p className="text-gray-500 text-sm">Track and manage salon expenses</p>
        </div>
        <Button onClick={openCreate} className="bg-primary hover:bg-primary/90 gap-2">
          <Plus className="w-4 h-4" /> Add Expense
        </Button>
      </div>

      {/* Month navigation */}
      <div className="flex items-center gap-3">
        <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>
        <span className="font-semibold text-gray-900 min-w-[130px] text-center">{format(selectedMonth, 'MMMM yyyy')}</span>
        <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-gray-100">
          <CardContent className="pt-5 pb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
            <p className="text-xl font-bold text-gray-900 leading-tight">{formatCurrency(totalExpenses, currency)}</p>
            <p className="text-xs text-gray-500">Total This Month</p>
          </CardContent>
        </Card>
        <Card className="border-gray-100">
          <CardContent className="pt-5 pb-4">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center mb-3">
              <RefreshCw className="w-5 h-5 text-orange-500" />
            </div>
            <p className="text-xl font-bold text-gray-900 leading-tight">{recurringCount}</p>
            <p className="text-xs text-gray-500">Recurring</p>
          </CardContent>
        </Card>
        <Card className="border-gray-100">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-gray-500 mb-2">Top Category</p>
            {categoryData[0] ? (
              <>
                <p className="text-xl font-bold text-gray-900 leading-tight">{formatCurrency(categoryData[0].total, currency)}</p>
                <p className="text-xs text-gray-500 truncate">{categoryData[0].name}</p>
              </>
            ) : (
              <p className="text-sm text-gray-400">No expenses</p>
            )}
          </CardContent>
        </Card>
        <Card className="border-gray-100">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-gray-500 mb-2">Entries</p>
            <p className="text-xl font-bold text-gray-900 leading-tight">{expenses.length}</p>
            <p className="text-xs text-gray-500">This month</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      {categoryData.length > 0 && (
        <Card className="border-gray-100">
          <CardHeader className="pb-2 border-b border-gray-50">
            <CardTitle className="text-base">Expenses by Category</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <ResponsiveContainer width="100%" height={Math.max(120, categoryData.length * 44)}>
              <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={120} />
                <Tooltip formatter={(v) => [formatCurrency(Number(v ?? 0), currency), 'Amount']} />
                <Bar dataKey="total" fill="#f43f5e" radius={[0, 4, 4, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* List */}
      <Card className="border-gray-100">
        <CardHeader className="pb-3 border-b border-gray-50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Expense Records</CardTitle>
            <Badge className="bg-primary/10 text-primary border-primary/20">{expenses.length} entries</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            </div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-10">
              <DollarSign className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500">No expenses this month</p>
              <Button onClick={openCreate} variant="outline" size="sm" className="mt-3">Add Expense</Button>
            </div>
          ) : (
            <div className="space-y-2">
              {expenses.map(exp => {
                const cat = catMap[exp.category]
                return (
                  <div key={exp.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100/80 transition-colors group">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: (cat?.color ?? '#f43f5e') + '20' }}>
                      <DollarSign className="w-4 h-4" style={{ color: cat?.color ?? '#f43f5e' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900">{exp.description}</p>
                        {exp.is_recurring && (
                          <Badge className="bg-orange-50 text-orange-600 border-orange-200 text-xs">Recurring</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-gray-400">{format(parseISO(exp.expense_date), 'MMM d, yyyy')}</span>
                        <span className="text-gray-300">·</span>
                        <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: (cat?.color ?? '#f43f5e') + '15', color: cat?.color ?? '#f43f5e' }}>
                          {cat?.label}
                        </span>
                        {exp.paid_by && (
                          <>
                            <span className="text-gray-300">·</span>
                            <span className="text-xs text-gray-400">Paid by: {exp.paid_by}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-bold text-gray-900">{formatCurrency(Number(exp.amount), currency)}</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(exp)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(exp.id)} disabled={deleting === exp.id}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors">
                          {deleting === exp.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v as ExpenseCategory }))}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Description *</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="e.g. Monthly rent payment" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount *</Label>
                <Input type="number" step="0.01" min="0" value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label>Date *</Label>
                <Input type="date" value={form.expense_date}
                  onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Paid By</Label>
              <Input value={form.paid_by} onChange={e => setForm(f => ({ ...f, paid_by: e.target.value }))}
                placeholder="e.g. Manager" />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Optional notes..."
                rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_recurring}
                onChange={e => setForm(f => ({ ...f, is_recurring: e.target.checked }))}
                className="w-4 h-4 accent-primary" />
              <span className="text-sm text-gray-700">Recurring expense</span>
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? 'Update' : 'Add Expense'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

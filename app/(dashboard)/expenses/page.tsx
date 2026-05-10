'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useUserContext } from '@/components/RoleContext'
import type { Expense, Branch } from '@/lib/types'
import {
  DollarSign, Plus, Pencil, Trash2, Loader2, RefreshCw, ChevronLeft, ChevronRight,
  Building2, CheckCircle2, Clock, Upload, X, Tag, TrendingUp, TrendingDown, Settings2,
  ImageIcon,
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

// ─── Preset categories ────────────────────────────────────────────────────────

const PRESET_CATEGORIES: { value: string; label: string; color: string }[] = [
  { value: 'staff_refreshments', label: 'Staff Refreshments', color: '#f43f5e' },
  { value: 'salon_materials',    label: 'Salon Materials',    color: '#ec4899' },
  { value: 'inventory',          label: 'Inventory',          color: '#a855f7' },
  { value: 'utilities',          label: 'Utilities',          color: '#3b82f6' },
  { value: 'rent',               label: 'Rent',               color: '#f97316' },
  { value: 'marketing',          label: 'Marketing',          color: '#10b981' },
  { value: 'miscellaneous',      label: 'Miscellaneous',      color: '#6b7280' },
]

const PAID_BY_OPTIONS = ['Owner', 'Petty Cash', 'Card', 'Bank Transfer', 'Other']

function getCategoryMeta(cat: string, customCategories: string[]) {
  const preset = PRESET_CATEGORIES.find(c => c.value === cat)
  if (preset) return preset
  if (customCategories.includes(cat)) return { value: cat, label: cat, color: '#8b5cf6' }
  return { value: cat, label: cat, color: '#6b7280' }
}

function formatCurrency(n: number, currency = 'USD') {
  return `${currency} ${Math.round(n).toLocaleString()}`
}

const emptyForm = {
  category:        '',
  description:     '',
  amount:          '',
  expense_date:    format(new Date(), 'yyyy-MM-dd'),
  branch_id:       '',
  paid_by:         '',
  notes:           '',
  is_recurring:    false,
  approval_status: 'pending' as 'pending' | 'approved',
  receipt_url:     '' as string,
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const { ownerId, isOwner } = useUserContext()

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [customCategories, setCustomCategories] = useState<string[]>([])
  const [budgets, setBudgets] = useState<Record<string, number>>({})
  const [lastMonthTotal, setLastMonthTotal] = useState(0)
  const [currency, setCurrency] = useState('USD')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()))
  const [selectedBranch, setSelectedBranch] = useState('all')
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Custom category management
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [newCustomCat, setNewCustomCat] = useState('')
  const [savingCat, setSavingCat] = useState(false)
  const [manageCatsOpen, setManageCatsOpen] = useState(false)

  useEffect(() => { loadAll() }, [ownerId, selectedMonth]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAll() {
    setLoading(true)
    const supabase = createClient()
    const monthStart = format(selectedMonth, 'yyyy-MM-dd')
    const monthEnd   = format(endOfMonth(selectedMonth), 'yyyy-MM-dd')
    const lmStart    = format(startOfMonth(subMonths(selectedMonth, 1)), 'yyyy-MM-dd')
    const lmEnd      = format(endOfMonth(subMonths(selectedMonth, 1)), 'yyyy-MM-dd')

    const [profileRes, branchRes, expenseRes, lmExpenseRes] = await Promise.all([
      supabase.from('profiles').select('salon_currency, expense_categories, expense_budgets').eq('id', ownerId).single(),
      supabase.from('branches').select('*').eq('user_id', ownerId).order('name'),
      supabase.from('expenses').select('*').eq('user_id', ownerId)
        .gte('expense_date', monthStart).lte('expense_date', monthEnd)
        .order('expense_date', { ascending: false }),
      supabase.from('expenses').select('amount').eq('user_id', ownerId)
        .gte('expense_date', lmStart).lte('expense_date', lmEnd),
    ])

    setCurrency(profileRes.data?.salon_currency ?? 'USD')
    setCustomCategories((profileRes.data?.expense_categories as string[]) ?? [])
    setBudgets((profileRes.data?.expense_budgets as Record<string, number>) ?? {})
    setBranches((branchRes.data as Branch[]) ?? [])
    setExpenses((expenseRes.data as Expense[]) ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setLastMonthTotal((lmExpenseRes.data ?? []).reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0))
    setLoading(false)
  }

  // ─── Branch-filtered expenses ────────────────────────────────────────────────

  const filteredExpenses = useMemo(() => {
    if (selectedBranch === 'all') return expenses
    return expenses.filter(e => e.branch_id === selectedBranch)
  }, [expenses, selectedBranch])

  // ─── Stats ───────────────────────────────────────────────────────────────────

  const totalExpenses = useMemo(() => filteredExpenses.reduce((s, e) => s + Number(e.amount), 0), [filteredExpenses])
  const recurringCount = useMemo(() => filteredExpenses.filter(e => e.is_recurring).length, [filteredExpenses])
  const pendingApproval = useMemo(() => filteredExpenses.filter(e => e.approval_status === 'pending').length, [filteredExpenses])

  const categoryData = useMemo(() => {
    const allCats = [...PRESET_CATEGORIES.map(c => c.value), ...customCategories]
    return allCats.map(cat => {
      const meta = getCategoryMeta(cat, customCategories)
      return {
        name: meta.label,
        total: filteredExpenses.filter(e => e.category === cat).reduce((s, e) => s + Number(e.amount), 0),
        color: meta.color,
        budget: budgets[cat] ?? 0,
      }
    }).filter(d => d.total > 0).sort((a, b) => b.total - a.total)
  }, [filteredExpenses, customCategories, budgets])

  // ─── Month comparison ────────────────────────────────────────────────────────

  const monthChangePct = lastMonthTotal > 0
    ? Math.round(((totalExpenses - lastMonthTotal) / lastMonthTotal) * 100)
    : null

  // ─── Receipt upload ───────────────────────────────────────────────────────────

  async function handleReceiptFile(file: File) {
    setUploadingReceipt(true)
    const supabase = createClient()
    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `${ownerId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('expense-receipts').upload(path, file, { upsert: true })
    if (error) {
      toast.error('Receipt upload failed — ensure "expense-receipts" bucket exists')
      setUploadingReceipt(false)
      return
    }
    const { data: urlData } = supabase.storage.from('expense-receipts').getPublicUrl(path)
    setForm(f => ({ ...f, receipt_url: urlData.publicUrl ?? '' }))
    setReceiptPreview(URL.createObjectURL(file))
    setUploadingReceipt(false)
    toast.success('Receipt uploaded')
  }

  // ─── Form helpers ─────────────────────────────────────────────────────────────

  function openCreate() {
    setEditingId(null)
    setForm({ ...emptyForm, expense_date: format(new Date(), 'yyyy-MM-dd') })
    setReceiptPreview(null)
    setShowCustomInput(false)
    setDialogOpen(true)
  }

  function openEdit(exp: Expense) {
    setEditingId(exp.id)
    setForm({
      category:        exp.category,
      description:     exp.description,
      amount:          String(exp.amount),
      expense_date:    exp.expense_date,
      branch_id:       exp.branch_id ?? '',
      paid_by:         exp.paid_by ?? '',
      notes:           exp.notes ?? '',
      is_recurring:    exp.is_recurring,
      approval_status: exp.approval_status ?? 'pending',
      receipt_url:     exp.receipt_url ?? '',
    })
    setReceiptPreview(exp.receipt_url ?? null)
    setShowCustomInput(false)
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
      user_id:         ownerId,
      category:        form.category,
      description:     form.description.trim(),
      amount:          parseFloat(form.amount),
      expense_date:    form.expense_date,
      branch_id:       form.branch_id || null,
      paid_by:         form.paid_by || null,
      notes:           form.notes.trim() || null,
      is_recurring:    form.is_recurring,
      approval_status: form.approval_status,
      receipt_url:     form.receipt_url || null,
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

  async function handleApprove(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('expenses').update({ approval_status: 'approved' }).eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Expense approved'); await loadAll() }
  }

  // ─── Custom categories ────────────────────────────────────────────────────────

  async function handleAddCustomCategory() {
    const name = newCustomCat.trim()
    if (!name) return
    if (customCategories.includes(name) || PRESET_CATEGORIES.some(c => c.label.toLowerCase() === name.toLowerCase())) {
      toast.error('Category already exists')
      return
    }
    setSavingCat(true)
    const supabase = createClient()
    const updated = [...customCategories, name]
    const { error } = await supabase.from('profiles').update({ expense_categories: updated }).eq('id', ownerId)
    if (error) { toast.error(error.message); setSavingCat(false); return }
    setCustomCategories(updated)
    setNewCustomCat('')
    setShowCustomInput(false)
    // Set the new category in the form
    setForm(f => ({ ...f, category: name }))
    setSavingCat(false)
    toast.success('Custom category added')
  }

  async function handleDeleteCustomCategory(cat: string) {
    const supabase = createClient()
    const updated = customCategories.filter(c => c !== cat)
    const { error } = await supabase.from('profiles').update({ expense_categories: updated }).eq('id', ownerId)
    if (error) { toast.error(error.message); return }
    setCustomCategories(updated)
    toast.success('Category removed')
  }

  function prevMonth() { setSelectedMonth(m => startOfMonth(subMonths(m, 1))) }
  function nextMonth() { setSelectedMonth(m => startOfMonth(subMonths(m, -1))) }

  const allCategoryOptions = [
    ...PRESET_CATEGORIES,
    ...customCategories.map(c => ({ value: c, label: c, color: '#8b5cf6' })),
  ]

  // ─── Render ───────────────────────────────────────────────────────────────────

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
        <div className="flex items-center gap-2">
          <Button onClick={() => setManageCatsOpen(true)} variant="outline" size="sm"
            className="gap-1.5 text-gray-600 border-gray-200 hover:bg-gray-50">
            <Settings2 className="w-3.5 h-3.5" /> Categories
          </Button>
          <Button onClick={openCreate} className="bg-primary hover:bg-primary/90 gap-2">
            <Plus className="w-4 h-4" /> Add Expense
          </Button>
        </div>
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

      {/* Branch filter (only if multiple branches) */}
      {branches.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
          {[{ id: 'all', name: 'All Branches' }, ...branches].map(b => (
            <button key={b.id} onClick={() => setSelectedBranch(b.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                selectedBranch === b.id
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'
              }`}>
              {b.name}
            </button>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-gray-100">
          <CardContent className="pt-5 pb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
            <p className="text-xl font-bold text-gray-900 leading-tight">{formatCurrency(totalExpenses, currency)}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <p className="text-xs text-gray-500">Total This Month</p>
              {monthChangePct !== null && (
                <span className={`text-xs font-medium flex items-center gap-0.5 ${monthChangePct >= 0 ? 'text-red-500' : 'text-green-600'}`}>
                  {monthChangePct >= 0
                    ? <TrendingUp className="w-3 h-3" />
                    : <TrendingDown className="w-3 h-3" />}
                  {Math.abs(monthChangePct)}%
                </span>
              )}
            </div>
            {lastMonthTotal > 0 && (
              <p className="text-[10px] text-gray-400 mt-0.5">Last month: {formatCurrency(lastMonthTotal, currency)}</p>
            )}
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
                {categoryData[0].budget > 0 && categoryData[0].total > categoryData[0].budget && (
                  <Badge className="mt-1 bg-red-50 text-red-600 border-red-200 text-[10px]">Over budget</Badge>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-400">No expenses</p>
            )}
          </CardContent>
        </Card>
        <Card className="border-gray-100">
          <CardContent className="pt-5 pb-4">
            {isOwner && pendingApproval > 0 ? (
              <>
                <div className="w-10 h-10 rounded-xl bg-yellow-50 flex items-center justify-center mb-3">
                  <Clock className="w-5 h-5 text-yellow-500" />
                </div>
                <p className="text-xl font-bold text-gray-900 leading-tight">{pendingApproval}</p>
                <p className="text-xs text-gray-500">Pending Approval</p>
              </>
            ) : (
              <>
                <p className="text-xs text-gray-500 mb-2">Entries</p>
                <p className="text-xl font-bold text-gray-900 leading-tight">{filteredExpenses.length}</p>
                <p className="text-xs text-gray-500">This month</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Budget warnings */}
      {Object.entries(budgets).some(([cat, budget]) => {
        const spent = filteredExpenses.filter(e => e.category === cat).reduce((s, e) => s + Number(e.amount), 0)
        return budget > 0 && spent > budget * 0.8
      }) && (
        <div className="space-y-1.5">
          {Object.entries(budgets).map(([cat, budget]) => {
            const spent = filteredExpenses.filter(e => e.category === cat).reduce((s, e) => s + Number(e.amount), 0)
            if (budget <= 0 || spent < budget * 0.8) return null
            const meta = getCategoryMeta(cat, customCategories)
            const pct  = Math.round((spent / budget) * 100)
            return (
              <div key={cat} className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${
                spent > budget ? 'bg-red-50 border-red-200 text-red-700' : 'bg-yellow-50 border-yellow-200 text-yellow-700'
              }`}>
                <Tag className="w-3.5 h-3.5 flex-shrink-0" />
                <span><strong>{meta.label}</strong>: {formatCurrency(spent, currency)} / {formatCurrency(budget, currency)} budget ({pct}%)</span>
                {spent > budget && <Badge className="bg-red-100 text-red-700 border-red-300 text-[10px] ml-auto">Over Budget!</Badge>}
              </div>
            )
          })}
        </div>
      )}

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

      {/* Expense List */}
      <Card className="border-gray-100">
        <CardHeader className="pb-3 border-b border-gray-50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Expense Records</CardTitle>
            <Badge className="bg-primary/10 text-primary border-primary/20">{filteredExpenses.length} entries</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="text-center py-10">
              <DollarSign className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500">No expenses this month</p>
              <Button onClick={openCreate} variant="outline" size="sm" className="mt-3">Add Expense</Button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredExpenses.map(exp => {
                const meta = getCategoryMeta(exp.category, customCategories)
                const branchName = branches.find(b => b.id === exp.branch_id)?.name
                return (
                  <div key={exp.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100/80 transition-colors group">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: meta.color + '20' }}>
                      <DollarSign className="w-4 h-4" style={{ color: meta.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900">{exp.description}</p>
                        {exp.is_recurring && (
                          <Badge className="bg-orange-50 text-orange-600 border-orange-200 text-xs">Recurring</Badge>
                        )}
                        {exp.approval_status === 'approved' ? (
                          <Badge className="bg-green-50 text-green-700 border-green-200 text-xs flex items-center gap-0.5">
                            <CheckCircle2 className="w-3 h-3" /> Approved
                          </Badge>
                        ) : (
                          <Badge className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs flex items-center gap-0.5">
                            <Clock className="w-3 h-3" /> Pending
                          </Badge>
                        )}
                        {exp.receipt_url && (
                          <a href={exp.receipt_url} target="_blank" rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-700">
                            <ImageIcon className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-gray-400">{format(parseISO(exp.expense_date), 'MMM d, yyyy')}</span>
                        <span className="text-gray-300">·</span>
                        <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: meta.color + '15', color: meta.color }}>
                          {meta.label}
                        </span>
                        {exp.paid_by && (
                          <>
                            <span className="text-gray-300">·</span>
                            <span className="text-xs text-gray-400">Paid by: {exp.paid_by}</span>
                          </>
                        )}
                        {branchName && (
                          <>
                            <span className="text-gray-300">·</span>
                            <span className="text-xs text-gray-400">{branchName}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-bold text-gray-900">{formatCurrency(Number(exp.amount), currency)}</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isOwner && exp.approval_status !== 'approved' && (
                          <button onClick={() => handleApprove(exp.id)}
                            className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors" title="Approve">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        )}
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

      {/* Add/Edit Expense Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">

            {/* Category */}
            <div className="space-y-1.5">
              <Label>Category *</Label>
              {showCustomInput ? (
                <div className="flex gap-2">
                  <Input value={newCustomCat} onChange={e => setNewCustomCat(e.target.value)}
                    placeholder="New category name" autoFocus />
                  <Button type="button" size="sm" onClick={handleAddCustomCategory} disabled={savingCat}
                    className="bg-primary hover:bg-primary/90 flex-shrink-0">
                    {savingCat ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Add'}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setShowCustomInput(false)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <Select value={form.category} onValueChange={v => {
                  if (!v || v === '__add_custom__') { setShowCustomInput(true); return }
                  setForm(f => ({ ...f, category: v }))
                }}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {allCategoryOptions.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                    <SelectItem value="__add_custom__" className="text-primary font-medium border-t mt-1 pt-2">
                      + Add Custom Category
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label>Description *</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="e.g. Monthly rent payment" />
            </div>

            {/* Amount + Date */}
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

            {/* Branch (only if multi-branch) */}
            {branches.length > 1 && (
              <div className="space-y-1.5">
                <Label>Branch</Label>
                <Select value={form.branch_id} onValueChange={v => setForm(f => ({ ...f, branch_id: (!v || v === 'none') ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select branch (optional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No specific branch</SelectItem>
                    {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Paid By */}
            <div className="space-y-1.5">
              <Label>Paid By</Label>
              <Select value={form.paid_by} onValueChange={v => setForm(f => ({ ...f, paid_by: (!v || v === 'none') ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Who paid?" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  {PAID_BY_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Approval status (owner only) */}
            {isOwner && (
              <div className="space-y-1.5">
                <Label>Approval Status</Label>
                <Select value={form.approval_status} onValueChange={v => setForm(f => ({ ...f, approval_status: v as 'pending' | 'approved' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Receipt upload */}
            <div className="space-y-1.5">
              <Label>Receipt (optional)</Label>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingReceipt}
                  className="gap-1.5 text-gray-600">
                  {uploadingReceipt ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {uploadingReceipt ? 'Uploading…' : 'Upload Photo'}
                </Button>
                {receiptPreview && (
                  <div className="flex items-center gap-1.5">
                    <img src={receiptPreview} alt="Receipt" className="h-8 w-8 object-cover rounded-md border" />
                    <button type="button" onClick={() => { setReceiptPreview(null); setForm(f => ({ ...f, receipt_url: '' })) }}
                      className="text-gray-400 hover:text-red-500">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleReceiptFile(f) }}
              />
            </div>

            {/* Notes */}
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

            {/* Recurring */}
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

      {/* Manage Custom Categories Dialog */}
      <Dialog open={manageCatsOpen} onOpenChange={setManageCatsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Custom Expense Categories</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <p className="text-xs text-gray-500 font-medium">Preset categories (cannot be removed)</p>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_CATEGORIES.map(c => (
                  <Badge key={c.value} style={{ backgroundColor: c.color + '20', color: c.color, borderColor: c.color + '40' }}
                    className="text-xs border">{c.label}</Badge>
                ))}
              </div>
            </div>

            {customCategories.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 font-medium">Custom categories</p>
                <div className="space-y-1.5">
                  {customCategories.map(cat => (
                    <div key={cat} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <span className="text-sm text-gray-700">{cat}</span>
                      <button onClick={() => handleDeleteCustomCategory(cat)}
                        className="text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5 border-t pt-3">
              <p className="text-xs text-gray-500 font-medium">Add new category</p>
              <div className="flex gap-2">
                <Input value={newCustomCat} onChange={e => setNewCustomCat(e.target.value)}
                  placeholder="Category name" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomCategory() } }} />
                <Button type="button" onClick={handleAddCustomCategory} disabled={savingCat}
                  className="bg-primary hover:bg-primary/90 flex-shrink-0">
                  {savingCat ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageCatsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

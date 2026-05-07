'use client'

import { useEffect, useState, useMemo } from 'react'
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useUserContext } from '@/components/RoleContext'
import type { StaffMember, StaffSalary, PayrollEntry, SalaryType } from '@/lib/types'
import {
  Wallet, Plus, Pencil, Loader2, CheckCircle2, ChevronLeft, ChevronRight, RefreshCw, DollarSign,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const SALARY_TYPES: { value: SalaryType; label: string }[] = [
  { value: 'fixed', label: 'Fixed Monthly' },
  { value: 'commission', label: 'Commission Only' },
  { value: 'both', label: 'Fixed + Commission' },
]

const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'JazzCash', 'EasyPaisa', 'Other']

function formatCurrency(n: number, currency = 'USD') {
  return `${currency} ${Math.round(n).toLocaleString()}`
}

export default function PayrollPage() {
  const { ownerId } = useUserContext()

  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [salaries, setSalaries] = useState<StaffSalary[]>([])
  const [payroll, setPayroll] = useState<PayrollEntry[]>([])
  const [currency, setCurrency] = useState('USD')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()))

  // Salary setup dialog
  const [salaryDialogOpen, setSalaryDialogOpen] = useState(false)
  const [editingSalaryId, setEditingSalaryId] = useState<string | null>(null)
  const [salaryForm, setSalaryForm] = useState({ staff_id: '', salary_type: 'fixed' as SalaryType, fixed_amount: '', commission_pct: '' })
  const [salarySaving, setSalarySaving] = useState(false)

  // Mark paid dialog
  const [payrollDialogOpen, setPayrollDialogOpen] = useState(false)
  const [editingPayroll, setEditingPayroll] = useState<PayrollEntry | null>(null)
  const [payrollForm, setPayrollForm] = useState({
    fixed_salary: '', revenue_generated: '', commission_earned: '', total_payable: '',
    paid_method: 'Cash', paid_date: format(new Date(), 'yyyy-MM-dd'), notes: '',
  })
  const [payrollSaving, setPayrollSaving] = useState(false)

  useEffect(() => { loadAll() }, [ownerId, selectedMonth]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAll() {
    setLoading(true)
    const supabase = createClient()
    const monthStr = format(selectedMonth, 'yyyy-MM-01')

    const [profileRes, staffRes, salaryRes, payrollRes] = await Promise.all([
      supabase.from('profiles').select('salon_currency').eq('id', ownerId).single(),
      supabase.from('staff').select('*').eq('user_id', ownerId).order('name'),
      supabase.from('staff_salaries').select('*, staff(id,name)').eq('user_id', ownerId),
      supabase.from('payroll_entries').select('*, staff(id,name)').eq('user_id', ownerId).eq('month', monthStr),
    ])

    setCurrency(profileRes.data?.salon_currency ?? 'USD')
    setStaffList((staffRes.data as StaffMember[]) ?? [])
    setSalaries((salaryRes.data as unknown as StaffSalary[]) ?? [])
    setPayroll((payrollRes.data as unknown as PayrollEntry[]) ?? [])
    setLoading(false)
  }

  function prevMonth() { setSelectedMonth(m => startOfMonth(subMonths(m, 1))) }
  function nextMonth() { setSelectedMonth(m => startOfMonth(subMonths(m, -1))) }

  // Salary setup
  function openAddSalary(preStaffId?: string) {
    setEditingSalaryId(null)
    setSalaryForm({ staff_id: preStaffId ?? '', salary_type: 'fixed', fixed_amount: '', commission_pct: '' })
    setSalaryDialogOpen(true)
  }

  function openEditSalary(sal: StaffSalary) {
    setEditingSalaryId(sal.id)
    setSalaryForm({
      staff_id: sal.staff_id,
      salary_type: sal.salary_type,
      fixed_amount: String(sal.fixed_amount),
      commission_pct: String(sal.commission_pct),
    })
    setSalaryDialogOpen(true)
  }

  async function handleSalarySave(e: React.FormEvent) {
    e.preventDefault()
    if (!salaryForm.staff_id) { toast.error('Select a staff member'); return }
    setSalarySaving(true)
    const supabase = createClient()
    const payload = {
      user_id: ownerId,
      staff_id: salaryForm.staff_id,
      salary_type: salaryForm.salary_type,
      fixed_amount: parseFloat(salaryForm.fixed_amount || '0'),
      commission_pct: parseFloat(salaryForm.commission_pct || '0'),
    }
    if (editingSalaryId) {
      const { error } = await supabase.from('staff_salaries').update(payload).eq('id', editingSalaryId)
      if (error) { toast.error(error.message); setSalarySaving(false); return }
      toast.success('Salary updated')
    } else {
      const { error } = await supabase.from('staff_salaries').upsert(payload, { onConflict: 'user_id,staff_id' })
      if (error) { toast.error(error.message); setSalarySaving(false); return }
      toast.success('Salary configured')
    }
    setSalaryDialogOpen(false)
    await loadAll()
    setSalarySaving(false)
  }

  async function generatePayroll() {
    if (salaries.length === 0) {
      toast.error('No salary configurations found. Set up staff salaries first.')
      return
    }
    setGenerating(true)
    const supabase = createClient()
    const monthStart = format(selectedMonth, 'yyyy-MM-dd')
    const monthEnd = format(endOfMonth(selectedMonth), 'yyyy-MM-dd')
    const monthStr = format(selectedMonth, 'yyyy-MM-01')

    // Revenue per staff from appointments + walk-ins
    const [apptRes, walkinRes] = await Promise.all([
      supabase.from('appointments')
        .select('staff_id, services(price)')
        .eq('user_id', ownerId)
        .eq('status', 'completed')
        .gte('appointment_date', monthStart)
        .lte('appointment_date', monthEnd),
      supabase.from('walk_ins')
        .select('staff_id, total')
        .eq('user_id', ownerId)
        .gte('created_at', monthStart + 'T00:00:00')
        .lte('created_at', monthEnd + 'T23:59:59'),
    ])

    const revenueMap: Record<string, number> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(apptRes.data ?? []).forEach((a: any) => {
      if (a.staff_id) revenueMap[a.staff_id] = (revenueMap[a.staff_id] ?? 0) + Number(a.services?.price ?? 0)
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(walkinRes.data ?? []).forEach((w: any) => {
      if (w.staff_id) revenueMap[w.staff_id] = (revenueMap[w.staff_id] ?? 0) + Number(w.total ?? 0)
    })

    const entries = salaries.map(sal => {
      const revenue = revenueMap[sal.staff_id] ?? 0
      const fixed = ['fixed', 'both'].includes(sal.salary_type) ? Number(sal.fixed_amount) : 0
      const commission = ['commission', 'both'].includes(sal.salary_type)
        ? Math.round((revenue * Number(sal.commission_pct)) / 100) : 0
      return {
        user_id: ownerId,
        staff_id: sal.staff_id,
        month: monthStr,
        fixed_salary: fixed,
        revenue_generated: revenue,
        commission_earned: commission,
        total_payable: fixed + commission,
        is_paid: false,
      }
    })

    const { error } = await supabase.from('payroll_entries')
      .upsert(entries, { onConflict: 'user_id,staff_id,month', ignoreDuplicates: false })

    if (error) toast.error(error.message)
    else toast.success(`Payroll generated for ${entries.length} staff member(s)`)
    setGenerating(false)
    await loadAll()
  }

  function openMarkPaid(entry: PayrollEntry) {
    setEditingPayroll(entry)
    setPayrollForm({
      fixed_salary: String(entry.fixed_salary),
      revenue_generated: String(entry.revenue_generated),
      commission_earned: String(entry.commission_earned),
      total_payable: String(entry.total_payable),
      paid_method: 'Cash',
      paid_date: format(new Date(), 'yyyy-MM-dd'),
      notes: entry.notes ?? '',
    })
    setPayrollDialogOpen(true)
  }

  async function handleMarkPaid(e: React.FormEvent) {
    e.preventDefault()
    if (!editingPayroll) return
    setPayrollSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('payroll_entries').update({
      fixed_salary: parseFloat(payrollForm.fixed_salary || '0'),
      revenue_generated: parseFloat(payrollForm.revenue_generated || '0'),
      commission_earned: parseFloat(payrollForm.commission_earned || '0'),
      total_payable: parseFloat(payrollForm.total_payable || '0'),
      is_paid: true,
      paid_date: payrollForm.paid_date,
      paid_method: payrollForm.paid_method,
      notes: payrollForm.notes.trim() || null,
    }).eq('id', editingPayroll.id)

    if (error) toast.error(error.message)
    else toast.success('Salary marked as paid')
    setPayrollDialogOpen(false)
    setPayrollSaving(false)
    await loadAll()
  }

  const totalPayable = useMemo(() => payroll.reduce((s, p) => s + Number(p.total_payable), 0), [payroll])
  const totalPaid = useMemo(() => payroll.filter(p => p.is_paid).reduce((s, p) => s + Number(p.total_payable), 0), [payroll])
  const salaryByStaff = useMemo(() => Object.fromEntries(salaries.map(s => [s.staff_id, s])), [salaries])

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-gray-900">Payroll</h1>
          </div>
          <p className="text-gray-500 text-sm">Manage staff salaries and monthly payroll</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => openAddSalary()} variant="outline" className="border-primary/30 text-primary hover:bg-primary/5 gap-2">
            <Plus className="w-4 h-4" /> Setup Salary
          </Button>
          <Button onClick={generatePayroll} className="bg-primary hover:bg-primary/90 gap-2" disabled={generating}>
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Generate Payroll
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

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Payable', value: formatCurrency(totalPayable, currency), icon: Wallet, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Paid', value: formatCurrency(totalPaid, currency), icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Pending', value: formatCurrency(totalPayable - totalPaid, currency), icon: DollarSign, color: 'text-orange-500', bg: 'bg-orange-50' },
          { label: 'Staff on Payroll', value: String(payroll.length), icon: RefreshCw, color: 'text-blue-500', bg: 'bg-blue-50' },
        ].map(s => (
          <Card key={s.label} className="border-gray-100">
            <CardContent className="pt-5 pb-4">
              <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <p className="text-xl font-bold text-gray-900 leading-tight">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="payroll">
        <TabsList className="bg-gray-100">
          <TabsTrigger value="payroll">Monthly Payroll</TabsTrigger>
          <TabsTrigger value="setup">Salary Setup</TabsTrigger>
        </TabsList>

        <TabsContent value="payroll" className="mt-4">
          <Card className="border-gray-100">
            <CardHeader className="pb-3 border-b border-gray-50">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base">Payroll — {format(selectedMonth, 'MMMM yyyy')}</CardTitle>
                <Button onClick={generatePayroll} variant="outline" size="sm" disabled={generating}
                  className="gap-1.5 text-primary border-primary/30 hover:bg-primary/5">
                  {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Regenerate
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                </div>
              ) : payroll.length === 0 ? (
                <div className="text-center py-10">
                  <Wallet className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-500">No payroll entries for this month</p>
                  <p className="text-xs text-gray-400 mt-1">Click &quot;Generate Payroll&quot; to create entries</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {payroll.map(entry => (
                    <div key={entry.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100/80 transition-colors">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${entry.is_paid ? 'bg-green-100' : 'bg-orange-50'}`}>
                        <span className={`text-sm font-bold ${entry.is_paid ? 'text-green-700' : 'text-orange-600'}`}>
                          {entry.staff?.name?.[0]?.toUpperCase() ?? '?'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-900">{entry.staff?.name}</p>
                          <Badge className={entry.is_paid
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-orange-50 text-orange-700 border-orange-200'}>
                            {entry.is_paid ? 'Paid' : 'Pending'}
                          </Badge>
                          {entry.is_paid && entry.paid_date && (
                            <span className="text-xs text-gray-400">
                              {format(parseISO(entry.paid_date), 'MMM d')} via {entry.paid_method}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
                          {Number(entry.fixed_salary) > 0 && <span>Fixed: {formatCurrency(Number(entry.fixed_salary), currency)}</span>}
                          {Number(entry.revenue_generated) > 0 && <span>Revenue: {formatCurrency(Number(entry.revenue_generated), currency)}</span>}
                          {Number(entry.commission_earned) > 0 && <span>Commission: {formatCurrency(Number(entry.commission_earned), currency)}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-base font-bold text-gray-900">{formatCurrency(Number(entry.total_payable), currency)}</span>
                        {!entry.is_paid && (
                          <Button onClick={() => openMarkPaid(entry)} size="sm"
                            className="bg-primary hover:bg-primary/90 text-xs h-7 px-2.5">
                            Mark Paid
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="setup" className="mt-4">
          <Card className="border-gray-100">
            <CardHeader className="pb-3 border-b border-gray-50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Staff Salary Configuration</CardTitle>
                <Button onClick={() => openAddSalary()} size="sm" className="bg-primary hover:bg-primary/90 gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Add
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {staffList.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No staff found. Add staff members first.</p>
              ) : (
                <div className="space-y-2">
                  {staffList.map(staff => {
                    const sal = salaryByStaff[staff.id]
                    return (
                      <div key={staff.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-primary text-sm font-bold">{staff.name[0]?.toUpperCase()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{staff.name}</p>
                          {sal ? (
                            <p className="text-xs text-gray-400">
                              {sal.salary_type === 'fixed' && `Fixed: ${formatCurrency(Number(sal.fixed_amount), currency)}/month`}
                              {sal.salary_type === 'commission' && `Commission: ${sal.commission_pct}%`}
                              {sal.salary_type === 'both' && `Fixed: ${formatCurrency(Number(sal.fixed_amount), currency)} + ${sal.commission_pct}% commission`}
                            </p>
                          ) : (
                            <p className="text-xs text-gray-400 italic">No salary configured</p>
                          )}
                        </div>
                        <button
                          onClick={() => sal ? openEditSalary(sal) : openAddSalary(staff.id)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Salary Setup Dialog */}
      <Dialog open={salaryDialogOpen} onOpenChange={setSalaryDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingSalaryId ? 'Edit Salary' : 'Setup Staff Salary'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSalarySave} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Staff Member *</Label>
              <Select value={salaryForm.staff_id} onValueChange={v => setSalaryForm(f => ({ ...f, staff_id: v || '' }))}>
                <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                <SelectContent>
                  {staffList.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Salary Type</Label>
              <Select value={salaryForm.salary_type} onValueChange={v => setSalaryForm(f => ({ ...f, salary_type: v as SalaryType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SALARY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {['fixed', 'both'].includes(salaryForm.salary_type) && (
              <div className="space-y-1.5">
                <Label>Fixed Monthly Amount</Label>
                <Input type="number" step="0.01" min="0" value={salaryForm.fixed_amount}
                  onChange={e => setSalaryForm(f => ({ ...f, fixed_amount: e.target.value }))} placeholder="0.00" />
              </div>
            )}
            {['commission', 'both'].includes(salaryForm.salary_type) && (
              <div className="space-y-1.5">
                <Label>Commission %</Label>
                <Input type="number" step="0.1" min="0" max="100" value={salaryForm.commission_pct}
                  onChange={e => setSalaryForm(f => ({ ...f, commission_pct: e.target.value }))} placeholder="0" />
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSalaryDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={salarySaving}>
                {salarySaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Mark Paid Dialog */}
      <Dialog open={payrollDialogOpen} onOpenChange={setPayrollDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Mark Paid — {editingPayroll?.staff?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleMarkPaid} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Fixed Salary</Label>
                <Input type="number" step="0.01" value={payrollForm.fixed_salary}
                  onChange={e => {
                    const v = e.target.value
                    setPayrollForm(f => ({ ...f, fixed_salary: v, total_payable: String(parseFloat(v || '0') + parseFloat(f.commission_earned || '0')) }))
                  }} />
              </div>
              <div className="space-y-1.5">
                <Label>Commission</Label>
                <Input type="number" step="0.01" value={payrollForm.commission_earned}
                  onChange={e => {
                    const v = e.target.value
                    setPayrollForm(f => ({ ...f, commission_earned: v, total_payable: String(parseFloat(f.fixed_salary || '0') + parseFloat(v || '0')) }))
                  }} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Revenue Generated</Label>
              <Input type="number" step="0.01" value={payrollForm.revenue_generated}
                onChange={e => setPayrollForm(f => ({ ...f, revenue_generated: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="font-semibold">Total Payable</Label>
              <Input type="number" step="0.01" value={payrollForm.total_payable}
                onChange={e => setPayrollForm(f => ({ ...f, total_payable: e.target.value }))} className="font-bold" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Method</Label>
                <Select value={payrollForm.paid_method} onValueChange={v => setPayrollForm(f => ({ ...f, paid_method: v || 'Cash' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={payrollForm.paid_date}
                  onChange={e => setPayrollForm(f => ({ ...f, paid_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <textarea value={payrollForm.notes} onChange={e => setPayrollForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                placeholder="Optional notes..." />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPayrollDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={payrollSaving}>
                {payrollSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Mark as Paid'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

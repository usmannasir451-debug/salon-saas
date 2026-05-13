'use client'

import { useEffect, useState, useMemo } from 'react'
import { format, startOfMonth, endOfMonth, subMonths, parseISO, getDaysInMonth } from 'date-fns'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useUserContext } from '@/components/RoleContext'
import type { StaffMember, PayrollEntry } from '@/lib/types'
import {
  Wallet, Loader2, CheckCircle2, ChevronLeft, ChevronRight, RefreshCw, DollarSign,
  TrendingUp, Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const SALARY_TYPE_CONFIG = {
  fixed:      { label: 'Fixed',     color: 'bg-blue-50 text-blue-700 border-blue-200' },
  commission: { label: 'Commission', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  both:       { label: 'Fixed + %',  color: 'bg-green-50 text-green-700 border-green-200' },
}

const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Other']

function formatCurrency(n: number, currency = 'USD') {
  return `${currency} ${Math.round(n).toLocaleString()}`
}

function getWorkingDaysInMonth(year: number, month: number): number {
  const days = getDaysInMonth(new Date(year, month, 1))
  let count = 0
  for (let d = 1; d <= days; d++) {
    if (new Date(year, month, d).getDay() !== 0) count++
  }
  return count
}

export default function PayrollPage() {
  const { ownerId } = useUserContext()

  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [payroll, setPayroll] = useState<PayrollEntry[]>([])
  const [currency, setCurrency] = useState('USD')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()))

  // Mark paid dialog
  const [payrollDialogOpen, setPayrollDialogOpen] = useState(false)
  const [editingPayroll, setEditingPayroll] = useState<PayrollEntry | null>(null)
  const [payrollForm, setPayrollForm] = useState({
    fixed_salary:      '',
    revenue_generated: '',
    commission_earned: '',
    total_payable:     '',
    paid_method:       'Cash',
    paid_date:         format(new Date(), 'yyyy-MM-dd'),
    notes:             '',
  })
  const [payrollSaving, setPayrollSaving] = useState(false)

  useEffect(() => { loadAll() }, [ownerId, selectedMonth]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAll() {
    setLoading(true)
    const supabase = createClient()
    const monthStr = format(selectedMonth, 'yyyy-MM-01')

    const [profileRes, staffRes, payrollRes] = await Promise.all([
      supabase.from('profiles').select('salon_currency').eq('id', ownerId).single(),
      supabase.from('staff').select('*').eq('user_id', ownerId).eq('is_active', true).order('name'),
      supabase.from('payroll_entries').select('*, staff(id,name)').eq('user_id', ownerId).eq('month', monthStr),
    ])

    setCurrency(profileRes.data?.salon_currency ?? 'USD')
    setStaffList((staffRes.data as StaffMember[]) ?? [])
    setPayroll((payrollRes.data as unknown as PayrollEntry[]) ?? [])
    setLoading(false)
  }

  function prevMonth() { setSelectedMonth(m => startOfMonth(subMonths(m, 1))) }
  function nextMonth() { setSelectedMonth(m => startOfMonth(subMonths(m, -1))) }

  async function generatePayroll() {
    const staffWithSalary = staffList.filter(s => s.salary_type && (
      (s.salary_type === 'fixed' && Number(s.fixed_amount ?? 0) > 0) ||
      (s.salary_type === 'commission' && Number(s.commission_percentage ?? 0) > 0) ||
      (s.salary_type === 'both' && (Number(s.fixed_amount ?? 0) > 0 || Number(s.commission_percentage ?? 0) > 0))
    ))

    if (staffWithSalary.length === 0) {
      toast.error('No staff with salary configuration. Set up salaries on the Staff page.')
      return
    }

    setGenerating(true)
    const supabase = createClient()
    const monthStart = format(selectedMonth, 'yyyy-MM-dd')
    const monthEnd   = format(endOfMonth(selectedMonth), 'yyyy-MM-dd')
    const monthStr   = format(selectedMonth, 'yyyy-MM-01')
    const totalDays  = endOfMonth(selectedMonth).getDate()

    // Revenue per staff and attendance for the month
    const [apptRes, walkinRes, attendanceRes] = await Promise.all([
      supabase.from('appointments')
        .select('staff_id, services(price)')
        .eq('user_id', ownerId).eq('status', 'completed')
        .gte('appointment_date', monthStart).lte('appointment_date', monthEnd),
      supabase.from('walk_ins')
        .select('staff_id, total')
        .eq('user_id', ownerId)
        .gte('created_at', monthStart + 'T00:00:00').lte('created_at', monthEnd + 'T23:59:59'),
      supabase.from('attendance')
        .select('staff_id, status')
        .eq('owner_id', ownerId)
        .gte('date', monthStart).lte('date', monthEnd),
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

    // Build attendance map per staff
    type AttStatus = 'present' | 'half_day' | 'absent' | 'leave' | 'holiday'
    const attMap: Record<string, Record<AttStatus, number>> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(attendanceRes.data ?? []).forEach((r: any) => {
      if (!attMap[r.staff_id]) attMap[r.staff_id] = { present: 0, half_day: 0, absent: 0, leave: 0, holiday: 0 }
      attMap[r.staff_id][r.status as AttStatus]++
    })
    const workingDays = getWorkingDaysInMonth(selectedMonth.getFullYear(), selectedMonth.getMonth())

    const entries = staffWithSalary.map(staff => {
      const revenue   = revenueMap[staff.id] ?? 0
      const fixedBase = ['fixed', 'both'].includes(staff.salary_type ?? '') ? Number(staff.fixed_amount ?? 0) : 0
      const commission = ['commission', 'both'].includes(staff.salary_type ?? '')
        ? Math.round((revenue * Number(staff.commission_percentage ?? 0)) / 100) : 0

      let prorataPct: number | null = null
      let prorataDetail: string | null = null
      let attendancePresentDays: number | null = null
      let attendanceWorkingDays: number | null = null
      let attendanceDeduction: number | null = null
      let attendanceDetail: string | null = null

      // Check attendance records for this staff
      const att = attMap[staff.id]
      if (att && Object.values(att).some(v => v > 0)) {
        const effectiveDays = att.present + att.leave + att.holiday + att.half_day * 0.5
        const staffWorkingDays = workingDays
        if (fixedBase > 0 && staffWorkingDays > 0) {
          const dailySalary = fixedBase / staffWorkingDays
          const adjustedFixed = Math.round(dailySalary * Math.min(effectiveDays, staffWorkingDays))
          const deduction = Math.max(0, fixedBase - adjustedFixed)
          attendancePresentDays = Math.round(effectiveDays)
          attendanceWorkingDays = staffWorkingDays
          attendanceDeduction = deduction > 0 ? deduction : null
          attendanceDetail = `Present: ${att.present} + Leave: ${att.leave} + Holiday: ${att.holiday} + Half Day: ${att.half_day}×½ = ${effectiveDays}/${staffWorkingDays} days`
          const fixed2 = adjustedFixed
          const total = fixed2 + commission
          return {
            user_id: ownerId, staff_id: staff.id, month: monthStr,
            fixed_salary: fixed2, revenue_generated: revenue, commission_earned: commission, total_payable: total,
            prorata_pct: null, prorata_detail: null,
            attendance_present_days: attendancePresentDays,
            attendance_working_days: attendanceWorkingDays,
            attendance_deduction: attendanceDeduction,
            attendance_detail: attendanceDetail,
            is_paid: false,
          }
        }
      }

      // Fall back to prorata calculation for joining month
      if (staff.joining_date) {
        const joiningDate = parseISO(staff.joining_date)
        const isJoinedThisMonth =
          joiningDate.getFullYear() === selectedMonth.getFullYear() &&
          joiningDate.getMonth() === selectedMonth.getMonth()
        if (isJoinedThisMonth) {
          const joiningDay = joiningDate.getDate()
          const daysWorked = totalDays - joiningDay + 1
          prorataPct = Math.round((daysWorked / totalDays) * 1000) / 10
          prorataDetail = `Joined: ${format(joiningDate, 'dd MMM')}, Days worked: ${daysWorked}/${totalDays}, Pro-rata: ${prorataPct}%`
        }
      }

      const fixed = prorataPct != null ? Math.round(fixedBase * prorataPct / 100) : fixedBase
      return {
        user_id: ownerId, staff_id: staff.id, month: monthStr,
        fixed_salary: fixed, revenue_generated: revenue, commission_earned: commission, total_payable: fixed + commission,
        prorata_pct: prorataPct, prorata_detail: prorataDetail,
        attendance_present_days: attendancePresentDays,
        attendance_working_days: attendanceWorkingDays,
        attendance_deduction: attendanceDeduction,
        attendance_detail: attendanceDetail,
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
      fixed_salary:      String(entry.fixed_salary),
      revenue_generated: String(entry.revenue_generated),
      commission_earned: String(entry.commission_earned),
      total_payable:     String(entry.total_payable),
      paid_method:       'Cash',
      paid_date:         format(new Date(), 'yyyy-MM-dd'),
      notes:             entry.notes ?? '',
    })
    setPayrollDialogOpen(true)
  }

  async function handleMarkPaid(e: React.FormEvent) {
    e.preventDefault()
    if (!editingPayroll) return
    setPayrollSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('payroll_entries').update({
      fixed_salary:      parseFloat(payrollForm.fixed_salary || '0'),
      revenue_generated: parseFloat(payrollForm.revenue_generated || '0'),
      commission_earned: parseFloat(payrollForm.commission_earned || '0'),
      total_payable:     parseFloat(payrollForm.total_payable || '0'),
      is_paid:           true,
      paid_date:         payrollForm.paid_date,
      paid_method:       payrollForm.paid_method,
      notes:             payrollForm.notes.trim() || null,
    }).eq('id', editingPayroll.id)

    if (error) toast.error(error.message)
    else toast.success('Salary marked as paid')
    setPayrollDialogOpen(false)
    setPayrollSaving(false)
    await loadAll()
  }

  const totalPayable  = useMemo(() => payroll.reduce((s, p) => s + Number(p.total_payable), 0), [payroll])
  const totalPaid     = useMemo(() => payroll.filter(p => p.is_paid).reduce((s, p) => s + Number(p.total_payable), 0), [payroll])
  const staffSalaryMap = useMemo(() => Object.fromEntries(staffList.map(s => [s.id, s])), [staffList])

  // Staff without salary configuration
  const unconfiguredStaff = useMemo(() =>
    staffList.filter(s => !s.salary_type || (
      Number(s.fixed_amount ?? 0) === 0 && Number(s.commission_percentage ?? 0) === 0
    )), [staffList])

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-gray-900">Payroll</h1>
          </div>
          <p className="text-gray-500 text-sm">Calculate and manage monthly staff salaries</p>
        </div>
        <Button onClick={generatePayroll} className="bg-primary hover:bg-primary/90 gap-2" disabled={generating}>
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Generate Payroll
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

      {/* Unconfigured staff warning */}
      {unconfiguredStaff.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex items-start gap-3">
          <Users className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-yellow-800 font-medium">
              {unconfiguredStaff.length} staff member{unconfiguredStaff.length !== 1 ? 's' : ''} without salary configuration:
            </p>
            <p className="text-xs text-yellow-700 mt-0.5">
              {unconfiguredStaff.map(s => s.name).join(', ')}
            </p>
          </div>
          <a href="/staff" className="text-xs text-yellow-700 underline font-medium whitespace-nowrap">Set up on Staff page →</a>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Payable',    value: formatCurrency(totalPayable, currency),          icon: Wallet,       color: 'text-primary',    bg: 'bg-primary/10' },
          { label: 'Paid',             value: formatCurrency(totalPaid, currency),              icon: CheckCircle2, color: 'text-green-600',  bg: 'bg-green-50' },
          { label: 'Pending',          value: formatCurrency(totalPayable - totalPaid, currency), icon: DollarSign,  color: 'text-orange-500', bg: 'bg-orange-50' },
          { label: 'Staff on Payroll', value: String(payroll.length),                          icon: TrendingUp,   color: 'text-blue-500',   bg: 'bg-blue-50' },
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

      {/* Payroll entries */}
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
              <p className="text-xs text-gray-400 mt-1">
                Click &quot;Generate Payroll&quot; to auto-calculate based on staff salary settings
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {payroll.map(entry => {
                const staffRecord = staffSalaryMap[entry.staff_id]
                const salaryTypeCfg = SALARY_TYPE_CONFIG[staffRecord?.salary_type ?? 'fixed']
                return (
                  <div key={entry.id} className="p-4 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${entry.is_paid ? 'bg-green-100' : 'bg-orange-50'}`}>
                        <span className={`text-sm font-bold ${entry.is_paid ? 'text-green-700' : 'text-orange-600'}`}>
                          {entry.staff?.name?.[0]?.toUpperCase() ?? '?'}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Name + badges */}
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="text-sm font-semibold text-gray-900">{entry.staff?.name}</p>
                          {staffRecord?.salary_type && (
                            <Badge className={`text-[10px] border ${salaryTypeCfg.color}`}>{salaryTypeCfg.label}</Badge>
                          )}
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

                        {/* Salary breakdown */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                          {Number(entry.fixed_salary) > 0 && (
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <span className="text-gray-400">Fixed:</span>
                              <span className="font-medium text-gray-700">{formatCurrency(Number(entry.fixed_salary), currency)}</span>
                            </div>
                          )}
                          {Number(entry.revenue_generated) > 0 && (
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <span className="text-gray-400">Revenue:</span>
                              <span className="font-medium text-gray-700">{formatCurrency(Number(entry.revenue_generated), currency)}</span>
                            </div>
                          )}
                          {Number(entry.commission_earned) > 0 && (
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <span className="text-gray-400">Commission:</span>
                              <span className="font-medium text-green-700">{formatCurrency(Number(entry.commission_earned), currency)}</span>
                            </div>
                          )}
                          {staffRecord?.joining_date && (
                            <div className="flex items-center gap-1 text-xs text-gray-400">
                              <span>Joined: {new Date(staffRecord.joining_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                            </div>
                          )}
                        </div>

                        {/* Attendance detail */}
                        {entry.attendance_detail && (
                          <div className="text-xs text-indigo-600 font-medium mt-1">
                            {entry.attendance_detail}
                          </div>
                        )}
                        {Number(entry.attendance_deduction ?? 0) > 0 && (
                          <div className="text-xs text-red-500 font-medium">
                            Attendance deduction: -{formatCurrency(Number(entry.attendance_deduction), currency)}
                          </div>
                        )}
                        {/* Pro-rata detail */}
                        {entry.prorata_detail && !entry.attendance_detail && (
                          <p className="text-xs text-orange-500 font-medium mt-1">{entry.prorata_detail}</p>
                        )}
                      </div>

                      {/* Total + action */}
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <span className="text-base font-bold text-gray-900">{formatCurrency(Number(entry.total_payable), currency)}</span>
                        {!entry.is_paid && (
                          <Button onClick={() => openMarkPaid(entry)} size="sm"
                            className="bg-primary hover:bg-primary/90 text-xs h-7 px-3">
                            Mark Paid
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mark Paid Dialog */}
      <Dialog open={payrollDialogOpen} onOpenChange={setPayrollDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Mark Paid — {editingPayroll?.staff?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleMarkPaid} className="space-y-4">
            {/* Breakdown */}
            <div className="bg-gray-50 rounded-xl p-3 space-y-2 border border-gray-100">
              <p className="text-xs font-semibold text-gray-600">Salary Breakdown</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Fixed Salary</Label>
                  <Input type="number" step="0.01" value={payrollForm.fixed_salary}
                    onChange={e => {
                      const v = e.target.value
                      setPayrollForm(f => ({ ...f, fixed_salary: v, total_payable: String(parseFloat(v || '0') + parseFloat(f.commission_earned || '0')) }))
                    }} className="h-8 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Commission Earned</Label>
                  <Input type="number" step="0.01" value={payrollForm.commission_earned}
                    onChange={e => {
                      const v = e.target.value
                      setPayrollForm(f => ({ ...f, commission_earned: v, total_payable: String(parseFloat(f.fixed_salary || '0') + parseFloat(v || '0')) }))
                    }} className="h-8 text-sm" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Revenue Generated</Label>
                <Input type="number" step="0.01" value={payrollForm.revenue_generated}
                  onChange={e => setPayrollForm(f => ({ ...f, revenue_generated: e.target.value }))} className="h-8 text-sm" />
              </div>
              <div className="pt-1 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Total Payable</Label>
                  <Input type="number" step="0.01" value={payrollForm.total_payable}
                    onChange={e => setPayrollForm(f => ({ ...f, total_payable: e.target.value }))}
                    className="h-8 text-sm font-bold w-32 text-right" />
                </div>
              </div>
            </div>

            {/* Payment details */}
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

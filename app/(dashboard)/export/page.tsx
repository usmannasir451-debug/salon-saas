'use client'

import { useState } from 'react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useUserContext } from '@/components/RoleContext'
import { Download, FileText, Users, CalendarDays, DollarSign, Wallet, Loader2 } from 'lucide-react'
import { useCurrency } from '@/hooks/useCurrency'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type ExportType = 'appointments' | 'clients' | 'expenses' | 'payroll'
type SupabaseRelation<T> = T | T[] | null | undefined

interface ExportConfig {
  id: ExportType
  label: string
  desc: string
  icon: React.ElementType
  color: string
}

type AppointmentExportRow = {
  appointment_date: string | null
  appointment_time: string | null
  client_name: string | null
  client_phone: string | null
  services?: SupabaseRelation<{ name: string | null; price: number | null }>
  staff?: SupabaseRelation<{ name: string | null }>
  status: string | null
  notes: string | null
}

type ClientExportRow = {
  client_name: string | null
  client_phone: string | null
  appointment_date: string | null
  status: string | null
  services?: SupabaseRelation<{ price: number | null }>
}

type ExpenseExportRow = {
  expense_date: string | null
  category: string | null
  description: string | null
  amount: number | null
  paid_by: string | null
  is_recurring: boolean | null
  notes: string | null
}

type PayrollExportRow = {
  staff?: SupabaseRelation<{ name: string | null }>
  month: number | null
  year: number | null
  base_salary: number | null
  commission_amount: number | null
  bonus: number | null
  deductions: number | null
  net_salary: number | null
  status: string | null
}

function relationOne<T>(value: SupabaseRelation<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

const EXPORTS: ExportConfig[] = [
  {
    id: 'appointments',
    label: 'Appointments',
    desc: 'All appointment records with client, service, staff and status',
    icon: CalendarDays,
    color: 'text-blue-600 bg-blue-50',
  },
  {
    id: 'clients',
    label: 'Clients',
    desc: 'Client list with visit counts, total spend, and last visit date',
    icon: Users,
    color: 'text-purple-600 bg-purple-50',
  },
  {
    id: 'expenses',
    label: 'Expenses',
    desc: 'All expense records by category with amounts and dates',
    icon: DollarSign,
    color: 'text-red-600 bg-red-50',
  },
  {
    id: 'payroll',
    label: 'Payroll',
    desc: 'Payroll entries with staff, salary type and amounts paid',
    icon: Wallet,
    color: 'text-green-600 bg-green-50',
  },
]

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map((row) =>
    row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')
  ).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function ExportPage() {
  const { ownerId, role } = useUserContext()
  const { currency } = useCurrency()

  const defaultFrom = format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const defaultTo = format(endOfMonth(new Date()), 'yyyy-MM-dd')

  const [dateFrom, setDateFrom] = useState(defaultFrom)
  const [dateTo, setDateTo] = useState(defaultTo)
  const [loading, setLoading] = useState<ExportType | null>(null)

  if (!['owner', 'manager'].includes(role)) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p>Access restricted to owners and managers.</p>
      </div>
    )
  }

  async function exportAppointments() {
    setLoading('appointments')
    const supabase = createClient()
    const { data, error } = await supabase
      .from('appointments')
      .select('*, services(name, price), staff(name)')
      .eq('user_id', ownerId)
      .gte('appointment_date', dateFrom)
      .lte('appointment_date', dateTo)
      .order('appointment_date', { ascending: false })

    if (error || !data) { toast.error('Export failed'); setLoading(null); return }

    const headers = ['Date', 'Time', 'Client', 'Phone', 'Service', `Price (${currency})`, 'Staff', 'Status', 'Notes']
    const rows = (data as AppointmentExportRow[]).map((a) => {
      const service = relationOne(a.services)
      const staff = relationOne(a.staff)
      return [
        a.appointment_date ?? '',
        a.appointment_time?.slice(0, 5) ?? '',
        a.client_name ?? '',
        a.client_phone ?? '',
        service?.name ?? '',
        String(service?.price ?? 0),
        staff?.name ?? '',
        a.status ?? '',
        a.notes ?? '',
      ]
    })

    downloadCSV(`appointments-${dateFrom}-to-${dateTo}.csv`, [headers, ...rows])
    toast.success(`Exported ${data.length} appointments`)
    setLoading(null)
  }

  async function exportClients() {
    setLoading('clients')
    const supabase = createClient()
    const { data, error } = await supabase
      .from('appointments')
      .select('client_name, client_phone, appointment_date, status, services(price)')
      .eq('user_id', ownerId)
      .gte('appointment_date', dateFrom)
      .lte('appointment_date', dateTo)
      .order('appointment_date', { ascending: false })

    if (error || !data) { toast.error('Export failed'); setLoading(null); return }

    const map = new Map<string, { phone: string; visits: number; completed: number; spend: number; last: string }>()
    ;(data as ClientExportRow[]).forEach((a) => {
      if (!a.client_name) return
      if (!map.has(a.client_name)) map.set(a.client_name, { phone: '', visits: 0, completed: 0, spend: 0, last: '' })
      const c = map.get(a.client_name)!
      c.visits++
      if (a.client_phone) c.phone = a.client_phone
      if (a.status === 'completed') { c.completed++; c.spend += relationOne(a.services)?.price ?? 0 }
      if (a.appointment_date && (!c.last || a.appointment_date > c.last)) c.last = a.appointment_date
    })

    const headers = ['Client Name', 'Phone', 'Total Visits', 'Completed', `Total Spend (${currency})`, 'Last Visit']
    const rows = Array.from(map.entries()).map(([name, c]) => [
      name, c.phone, String(c.visits), String(c.completed), String(Math.round(c.spend)), c.last,
    ])

    downloadCSV(`clients-${dateFrom}-to-${dateTo}.csv`, [headers, ...rows])
    toast.success(`Exported ${map.size} clients`)
    setLoading(null)
  }

  async function exportExpenses() {
    setLoading('expenses')
    const supabase = createClient()
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', ownerId)
      .gte('expense_date', dateFrom)
      .lte('expense_date', dateTo)
      .order('expense_date', { ascending: false })

    if (error || !data) { toast.error('Export failed'); setLoading(null); return }

    const headers = ['Date', 'Category', 'Description', `Amount (${currency})`, 'Paid By', 'Recurring', 'Notes']
    const rows = (data as ExpenseExportRow[]).map((e) => [
      e.expense_date ?? '',
      e.category?.replace(/_/g, ' ') ?? '',
      e.description ?? '',
      String(Math.round(e.amount ?? 0)),
      e.paid_by ?? '',
      e.is_recurring ? 'Yes' : 'No',
      e.notes ?? '',
    ])

    downloadCSV(`expenses-${dateFrom}-to-${dateTo}.csv`, [headers, ...rows])
    toast.success(`Exported ${data.length} expenses`)
    setLoading(null)
  }

  async function exportPayroll() {
    setLoading('payroll')
    const supabase = createClient()
    const { data, error } = await supabase
      .from('payroll_entries')
      .select('*, staff(name)')
      .eq('user_id', ownerId)
      .order('created_at', { ascending: false })

    if (error || !data) { toast.error('Export failed'); setLoading(null); return }

    const headers = ['Staff', 'Month', 'Year', `Base Salary (${currency})`, `Commission (${currency})`, `Bonus (${currency})`, `Deductions (${currency})`, `Net Salary (${currency})`, 'Status']
    const rows = (data as PayrollExportRow[]).map((p) => [
      relationOne(p.staff)?.name ?? '',
      String(p.month ?? ''),
      String(p.year ?? ''),
      String(Math.round(p.base_salary ?? 0)),
      String(Math.round(p.commission_amount ?? 0)),
      String(Math.round(p.bonus ?? 0)),
      String(Math.round(p.deductions ?? 0)),
      String(Math.round(p.net_salary ?? 0)),
      p.status ?? '',
    ])

    downloadCSV(`payroll-export.csv`, [headers, ...rows])
    toast.success(`Exported ${data.length} payroll entries`)
    setLoading(null)
  }

  const handlers: Record<ExportType, () => Promise<void>> = {
    appointments: exportAppointments,
    clients: exportClients,
    expenses: exportExpenses,
    payroll: exportPayroll,
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Download className="w-6 h-6 text-primary" />
          Data Export
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Download your salon data as CSV files</p>
      </div>

      {/* Date range */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Date Range</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div className="flex-1">
              <Label htmlFor="from">From</Label>
              <Input
                id="from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="to">To</Label>
              <Input
                id="to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex gap-2">
              {[
                { label: 'This Month', from: format(startOfMonth(new Date()), 'yyyy-MM-dd'), to: format(endOfMonth(new Date()), 'yyyy-MM-dd') },
                { label: 'This Year', from: `${new Date().getFullYear()}-01-01`, to: `${new Date().getFullYear()}-12-31` },
              ].map(({ label, from, to }) => (
                <Button
                  key={label}
                  variant="outline"
                  size="sm"
                  onClick={() => { setDateFrom(from); setDateTo(to) }}
                  className="whitespace-nowrap"
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Export cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        {EXPORTS.map((exp) => {
          const Icon = exp.icon
          const isLoading = loading === exp.id
          return (
            <Card key={exp.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className={`p-2.5 rounded-xl ${exp.color} flex-shrink-0`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900">{exp.label}</h3>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{exp.desc}</p>
                    <Button
                      size="sm"
                      onClick={handlers[exp.id]}
                      disabled={isLoading || loading !== null}
                      className="mt-3 bg-primary hover:bg-primary/90 gap-2"
                    >
                      {isLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      {isLoading ? 'Exporting...' : 'Export CSV'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Note */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700">
        <FileText className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p>Exports are filtered by the selected date range (except payroll which exports all records). Files are saved as CSV and can be opened in Excel or Google Sheets.</p>
      </div>
    </div>
  )
}

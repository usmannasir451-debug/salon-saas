'use client'

import { useEffect, useState } from 'react'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { useUserContext } from '@/components/RoleContext'
import {
  TrendingUp, TrendingDown, ChevronLeft, ChevronRight, Download, Loader2, BarChart2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

function fmt(n: number, currency = 'USD') {
  return `${currency} ${Math.round(n).toLocaleString()}`
}

type OtherExpenses = {
  staff_refreshments: number
  salon_materials: number
  inventory: number
  utilities: number
  rent: number
  marketing: number
  miscellaneous: number
}

const emptyOther: OtherExpenses = {
  staff_refreshments: 0, salon_materials: 0, inventory: 0, utilities: 0, rent: 0, marketing: 0, miscellaneous: 0,
}

type TrendMonth = { month: string; revenue: number; expenses: number; profit: number }

export default function PnLPage() {
  const { ownerId } = useUserContext()

  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()))
  const [currency, setCurrency] = useState('USD')
  const [salonName, setSalonName] = useState('')
  const [loading, setLoading] = useState(true)
  const [pdfLoading, setPdfLoading] = useState(false)

  const [apptRevenue, setApptRevenue] = useState(0)
  const [walkinRevenue, setWalkinRevenue] = useState(0)
  const [membershipRevenue, setMembershipRevenue] = useState(0)
  const [apptDiscounts, setApptDiscounts] = useState(0)
  const [walkinDiscounts, setWalkinDiscounts] = useState(0)
  const [salaryExpense, setSalaryExpense] = useState(0)
  const [otherExpenses, setOtherExpenses] = useState<OtherExpenses>(emptyOther)
  const [trendData, setTrendData] = useState<TrendMonth[]>([])
  const [paymentBreakdown, setPaymentBreakdown] = useState<{ method: string; amount: number }[]>([])

  useEffect(() => { loadAll() }, [ownerId, selectedMonth]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadMonthData(supabase: ReturnType<typeof createClient>, month: Date) {
    const mStart = format(month, 'yyyy-MM-dd')
    const mEnd = format(endOfMonth(month), 'yyyy-MM-dd')
    const mStr = format(month, 'yyyy-MM-01')

    const [ta, tw, te, tp, tm] = await Promise.all([
      supabase.from('appointments').select('total_amount, services(price), discount_amount, status')
        .eq('user_id', ownerId).gte('appointment_date', mStart).lte('appointment_date', mEnd),
      supabase.from('walk_ins').select('subtotal, discount_amount, total')
        .eq('user_id', ownerId).gte('created_at', mStart + 'T00:00:00').lte('created_at', mEnd + 'T23:59:59'),
      supabase.from('expenses').select('category, amount')
        .eq('user_id', ownerId).gte('expense_date', mStart).lte('expense_date', mEnd),
      supabase.from('payroll_entries').select('total_payable')
        .eq('user_id', ownerId).eq('month', mStr),
      supabase.from('membership_transactions').select('amount')
        .eq('owner_id', ownerId).eq('type', 'payment')
        .gte('created_at', mStart + 'T00:00:00').lte('created_at', mEnd + 'T23:59:59'),
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const completedAppts = (ta.data ?? []).filter((a: any) => a.status === 'completed')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const aRev = completedAppts.reduce((s: number, a: any) => s + Number(a.total_amount ?? a.services?.price ?? 0), 0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const aDisc = completedAppts.reduce((s: number, a: any) => s + Number(a.discount_amount ?? 0), 0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wRev = (tw.data ?? []).reduce((s: number, w: any) => s + Number(w.subtotal ?? 0), 0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wDisc = (tw.data ?? []).reduce((s: number, w: any) => s + Number(w.discount_amount ?? 0), 0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mRev = (tm.data ?? []).reduce((s: number, t: any) => s + Number(t.amount ?? 0), 0)

    const expMap = { ...emptyOther }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(te.data ?? []).forEach((e: any) => {
      if (e.category in expMap) (expMap as Record<string, number>)[e.category] += Number(e.amount ?? 0)
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sal = (tp.data ?? []).reduce((s: number, p: any) => s + Number(p.total_payable ?? 0), 0)
    const totalExp = sal + Object.values(expMap).reduce((s, v) => s + v, 0)
    const netRev = aRev + wRev + mRev - aDisc - wDisc

    return { aRev, wRev, mRev, aDisc, wDisc, expMap, sal, totalExp, netRev }
  }

  async function loadAll() {
    setLoading(true)
    const supabase = createClient()

    const profileRes = await supabase.from('profiles')
      .select('salon_name, salon_currency').eq('id', ownerId).single()
    setSalonName(profileRes.data?.salon_name ?? '')
    setCurrency(profileRes.data?.salon_currency ?? 'USD')

    const { aRev, wRev, mRev, aDisc, wDisc, expMap, sal } = await loadMonthData(supabase, selectedMonth)
    setApptRevenue(aRev)
    setWalkinRevenue(wRev)
    setMembershipRevenue(mRev)
    setApptDiscounts(aDisc)
    setWalkinDiscounts(wDisc)
    setOtherExpenses(expMap)
    setSalaryExpense(sal)

    // Payment method breakdown for the selected month
    const mStart = format(selectedMonth, 'yyyy-MM-dd')
    const mEnd = format(endOfMonth(selectedMonth), 'yyyy-MM-dd')
    const [pmAppt, pmWalkin] = await Promise.all([
      supabase.from('appointments').select('payment_method, total_amount, services(price), status')
        .eq('user_id', ownerId).gte('appointment_date', mStart).lte('appointment_date', mEnd),
      supabase.from('walk_ins').select('payment_method, total')
        .eq('user_id', ownerId).gte('created_at', mStart + 'T00:00:00').lte('created_at', mEnd + 'T23:59:59'),
    ])
    const pmMap = new Map<string, number>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(pmAppt.data ?? []).filter((a: any) => a.status === 'completed').forEach((a: any) => {
      const m = a.payment_method ?? 'cash'
      pmMap.set(m, (pmMap.get(m) ?? 0) + Number(a.total_amount ?? a.services?.price ?? 0))
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(pmWalkin.data ?? []).forEach((w: any) => {
      const m = w.payment_method ?? 'cash'
      pmMap.set(m, (pmMap.get(m) ?? 0) + Number(w.total ?? 0))
    })
    const breakdown = Array.from(pmMap.entries())
      .map(([method, amount]) => ({ method: method.charAt(0).toUpperCase() + method.slice(1).replace(/_/g, ' '), amount }))
      .filter(e => e.amount > 0)
      .sort((a, b) => b.amount - a.amount)
    setPaymentBreakdown(breakdown)

    // 6-month trend
    const months = Array.from({ length: 6 }, (_, i) => subMonths(selectedMonth, 5 - i))
    const trend: TrendMonth[] = await Promise.all(months.map(async m => {
      const d = await loadMonthData(supabase, m)
      const rev = Math.round(d.netRev)
      return {
        month: format(m, 'MMM yy'),
        revenue: rev,
        expenses: Math.round(d.totalExp),
        profit: Math.round(rev - d.totalExp),
      }
    }))
    setTrendData(trend)
    setLoading(false)
  }

  const grossRevenue = apptRevenue + walkinRevenue + membershipRevenue
  const totalDiscounts = apptDiscounts + walkinDiscounts
  const netRevenue = grossRevenue - totalDiscounts
  const totalOtherExpenses = Object.values(otherExpenses).reduce((s, v) => s + v, 0)
  const totalExpenses = salaryExpense + totalOtherExpenses
  const netProfit = netRevenue - totalExpenses
  const profitMargin = netRevenue > 0 ? Math.round((netProfit / netRevenue) * 100) : 0

  const expenseRows = [
    { label: 'Salaries & Commissions', value: salaryExpense },
    { label: 'Staff Refreshments', value: otherExpenses.staff_refreshments },
    { label: 'Salon Materials', value: otherExpenses.salon_materials },
    { label: 'Inventory', value: otherExpenses.inventory },
    { label: 'Utilities', value: otherExpenses.utilities },
    { label: 'Rent', value: otherExpenses.rent },
    { label: 'Marketing', value: otherExpenses.marketing },
    { label: 'Miscellaneous', value: otherExpenses.miscellaneous },
  ]

  async function downloadPDF() {
    setPdfLoading(true)
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const doc = new jsPDF() as any
      const W = doc.internal.pageSize.width

      doc.setFillColor(244, 63, 94)
      doc.rect(0, 0, W, 38, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(20)
      doc.setFont('helvetica', 'bold')
      doc.text('Profit & Loss Report', 14, 16)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.text(format(selectedMonth, 'MMMM yyyy'), 14, 26)
      if (salonName) doc.text(salonName, 14, 34)

      doc.setTextColor(30, 30, 30)
      let y = 48

      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text('INCOME', 14, y)
      autoTable(doc, {
        startY: y + 4,
        head: [['Item', `Amount (${currency})`]],
        body: [
          ['Appointment Revenue', fmt(apptRevenue, currency)],
          ['Walk-In Revenue', fmt(walkinRevenue, currency)],
          ...(membershipRevenue > 0 ? [['Membership Revenue', fmt(membershipRevenue, currency)]] : []),
          ['Gross Revenue', fmt(grossRevenue, currency)],
          ['Less: Discounts', `(${fmt(totalDiscounts, currency)})`],
          ['Net Revenue', fmt(netRevenue, currency)],
        ],
        theme: 'striped',
        headStyles: { fillColor: [244, 63, 94] },
        styles: { fontSize: 10 },
      })

      y = doc.lastAutoTable.finalY + 10
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text('EXPENSES', 14, y)
      autoTable(doc, {
        startY: y + 4,
        head: [['Item', `Amount (${currency})`]],
        body: [
          ...expenseRows.map(r => [r.label, fmt(r.value, currency)]),
          ['Total Expenses', fmt(totalExpenses, currency)],
        ],
        theme: 'striped',
        headStyles: { fillColor: [244, 63, 94] },
        styles: { fontSize: 10 },
      })

      y = doc.lastAutoTable.finalY + 12
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      const isProfit = netProfit >= 0
      doc.setTextColor(isProfit ? 16 : 220, isProfit ? 185 : 38, isProfit ? 129 : 38)
      doc.text(`NET ${isProfit ? 'PROFIT' : 'LOSS'}: ${fmt(Math.abs(netProfit), currency)}  (${profitMargin}% margin)`, 14, y)

      if (paymentBreakdown.length > 0) {
        y += 14
        doc.setTextColor(30, 30, 30)
        doc.setFontSize(13)
        doc.setFont('helvetica', 'bold')
        doc.text('REVENUE BY PAYMENT METHOD', 14, y)
        autoTable(doc, {
          startY: y + 4,
          head: [['Payment Method', `Amount (${currency})`]],
          body: paymentBreakdown.map(p => [p.method, fmt(p.amount, currency)]),
          theme: 'striped',
          headStyles: { fillColor: [244, 63, 94] },
          styles: { fontSize: 10 },
        })
      }

      doc.save(`Snipforce-PnL-${format(selectedMonth, 'MMMM-yyyy')}.pdf`)
    } finally {
      setPdfLoading(false)
    }
  }

  function prevMonth() { setSelectedMonth(m => startOfMonth(subMonths(m, 1))) }
  function nextMonth() { setSelectedMonth(m => startOfMonth(subMonths(m, -1))) }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart2 className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-gray-900">P&amp;L Report</h1>
          </div>
          <p className="text-gray-500 text-sm">Profit &amp; Loss Statement</p>
        </div>
        <Button onClick={downloadPDF} disabled={pdfLoading} variant="outline"
          className="border-primary/30 text-primary hover:bg-primary/5 gap-2">
          {pdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Export PDF
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

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : (
        <>
          {/* Net Profit Hero */}
          <Card className={`border-2 ${netProfit >= 0 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
            <CardContent className="pt-6 pb-6 text-center">
              {netProfit >= 0
                ? <TrendingUp className="w-10 h-10 text-green-600 mx-auto mb-3" />
                : <TrendingDown className="w-10 h-10 text-red-500 mx-auto mb-3" />}
              <p className="text-sm font-medium text-gray-600 mb-1">
                Net {netProfit >= 0 ? 'Profit' : 'Loss'} — {format(selectedMonth, 'MMMM yyyy')}
              </p>
              <p className={`text-4xl font-bold ${netProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {fmt(Math.abs(netProfit), currency)}
              </p>
              <p className="text-sm text-gray-500 mt-2">Profit Margin: {profitMargin}%</p>
            </CardContent>
          </Card>

          {/* Income + Expenses */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Income */}
            <Card className="border-gray-100">
              <CardHeader className="pb-2 border-b border-gray-50">
                <CardTitle className="text-base text-green-700 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Income
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                <div className="space-y-0">
                  {[
                    { label: 'Appointment Revenue', value: apptRevenue, sub: false },
                    { label: 'Walk-In Revenue', value: walkinRevenue, sub: false },
                    ...(membershipRevenue > 0 ? [{ label: 'Membership Revenue', value: membershipRevenue, sub: false }] : []),
                    { label: 'Gross Revenue', value: grossRevenue, bold: true },
                    { label: 'Less: Discounts', value: totalDiscounts, sub: true },
                    { label: 'Net Revenue', value: netRevenue, bold: true, highlight: true },
                  ].map(row => (
                    <div key={row.label} className={`flex items-center justify-between py-2 ${row.highlight ? 'border-t border-green-200 mt-1' : ''}`}>
                      <span className={`text-sm ${row.bold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>{row.label}</span>
                      <span className={`text-sm font-mono ${row.highlight ? 'font-bold text-green-700' : row.bold ? 'font-bold text-gray-900' : row.sub ? 'text-red-500' : 'text-gray-900'}`}>
                        {row.sub ? `(${fmt(row.value, currency)})` : fmt(row.value, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Expenses */}
            <Card className="border-gray-100">
              <CardHeader className="pb-2 border-b border-gray-50">
                <CardTitle className="text-base text-red-600 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4" /> Expenses
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                <div className="space-y-0">
                  {expenseRows.map(row => (
                    <div key={row.label} className="flex items-center justify-between py-2">
                      <span className="text-sm text-gray-600">{row.label}</span>
                      <span className={`text-sm font-mono ${row.value > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                        {fmt(row.value, currency)}
                      </span>
                    </div>
                  ))}
                  <div className="border-t border-red-200 mt-1 pt-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900">Total Expenses</span>
                    <span className="text-sm font-bold font-mono text-red-600">{fmt(totalExpenses, currency)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payment Method Breakdown */}
          {paymentBreakdown.length > 0 && (
            <Card className="border-gray-100">
              <CardHeader className="pb-2 border-b border-gray-50">
                <CardTitle className="text-base text-primary flex items-center gap-2">
                  <BarChart2 className="w-4 h-4" /> Revenue by Payment Method
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {paymentBreakdown.map(({ method, amount }) => {
                    const max = paymentBreakdown[0].amount || 1
                    return (
                      <div key={method} className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-gray-500 mb-1">{method}</p>
                        <p className="text-sm font-bold text-gray-900">{fmt(amount, currency)}</p>
                        <div className="h-1.5 bg-gray-200 rounded-full mt-2">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${(amount / max) * 100}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 6-Month Trend */}
          <Card className="border-gray-100">
            <CardHeader className="pb-2 border-b border-gray-50">
              <CardTitle className="text-base">6-Month Trend</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={trendData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                    tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} width={36} />
                  <Tooltip formatter={(v, name) => [
                    fmt(Number(v ?? 0), currency),
                    name === 'revenue' ? 'Net Revenue' : name === 'expenses' ? 'Expenses' : 'Profit',
                  ]} />
                  <Legend formatter={v => v === 'revenue' ? 'Revenue' : v === 'expenses' ? 'Expenses' : 'Profit'} />
                  <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="profit" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

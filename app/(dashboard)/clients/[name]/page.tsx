'use client'

import { use, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { useUserContext } from '@/components/RoleContext'
import { useCurrency } from '@/hooks/useCurrency'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  CalendarDays,
  TrendingUp,
  Scissors,
  Users,
  Clock,
  Loader2,
  MessageCircle,
  ReceiptText,
} from 'lucide-react'
import Link from 'next/link'

type AppRow = {
  id: string
  appointment_date: string
  appointment_time: string
  status: string
  notes?: string
  client_phone?: string
  services?: { name: string; price: number } | null
  staff?: { name: string } | null
}

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  confirmed: { label: 'Confirmed', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  completed: { label: 'Completed', className: 'bg-green-50 text-green-700 border-green-200' },
  cancelled: { label: 'Cancelled', className: 'bg-red-50 text-red-700 border-red-200' },
}

function whatsappUrl(phone: string, clientName: string) {
  const digits = phone.replace(/\D/g, '')
  const wa = digits.startsWith('0') ? '92' + digits.slice(1) : digits.startsWith('92') ? digits : '92' + digits
  const msg = `Hello ${clientName}! We miss you at the salon. Come visit us soon! 🌸`
  return `https://wa.me/${wa}?text=${encodeURIComponent(msg)}`
}

export default function ClientProfilePage({ params }: { params: Promise<{ name: string }> }) {
  const { ownerId } = useUserContext()
  const { name } = use(params)
  const clientName = decodeURIComponent(name)
  const { formatAmount } = useCurrency()

  const [appointments, setAppointments] = useState<AppRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadClient()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientName])

  async function loadClient() {
    const supabase = createClient()

    const { data } = await supabase
      .from('appointments')
      .select('id, appointment_date, appointment_time, status, notes, client_phone, services(name, price), staff(name)')
      .eq('user_id', ownerId)
      .eq('client_name', clientName)
      .order('appointment_date', { ascending: false })
      .order('appointment_time', { ascending: false })

    setAppointments((data as unknown as AppRow[]) ?? [])
    setLoading(false)
  }

  const completed = appointments.filter((a) => a.status === 'completed')
  const totalSpent = completed.reduce((sum, a) => sum + Number(a.services?.price ?? 0), 0)
  const avgBill = completed.length > 0 ? Math.round(totalSpent / completed.length) : 0
  const lastVisit = appointments[0]?.appointment_date
  const clientPhone = appointments.find((a) => a.client_phone)?.client_phone

  const favoriteService = (() => {
    const map = new Map<string, number>()
    completed.forEach((a) => {
      if (!a.services) return
      map.set(a.services.name, (map.get(a.services.name) ?? 0) + 1)
    })
    let best = ''
    let bestCount = 0
    map.forEach((count, name) => { if (count > bestCount) { best = name; bestCount = count } })
    return best
  })()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Back */}
      <Link
        href="/clients"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        All Clients
      </Link>

      {/* Profile Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <span className="text-primary text-2xl font-bold">{clientName[0]?.toUpperCase()}</span>
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{clientName}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {appointments.length} appointment{appointments.length !== 1 ? 's' : ''} •{' '}
            {lastVisit
              ? `Last visit ${format(new Date(lastVisit + 'T00:00:00'), 'MMMM d, yyyy')}`
              : 'No visits yet'
            }
          </p>
          {clientPhone && (
            <a
              href={whatsappUrl(clientPhone, clientName)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-2 text-xs text-green-600 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-full transition-colors font-medium"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              {clientPhone} · WhatsApp
            </a>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Visits', value: appointments.length, icon: CalendarDays, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Completed', value: completed.length, icon: Scissors, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Total Spent', value: formatAmount(totalSpent), icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Avg Bill', value: formatAmount(avgBill), icon: ReceiptText, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map((s) => (
          <Card key={s.label} className="border-gray-100">
            <CardContent className="pt-4 pb-3">
              <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center mb-2`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <p className="text-lg font-bold text-gray-900 leading-tight">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Favourite service */}
      {favoriteService && (
        <div className="flex items-center gap-3 p-4 mb-6 rounded-xl bg-primary/5 border border-primary/15">
          <Scissors className="w-5 h-5 text-primary flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-gray-800">Favourite Service</p>
            <p className="text-xs text-gray-500">{favoriteService}</p>
          </div>
        </div>
      )}

      {/* Appointment History */}
      <Card className="border-gray-100">
        <CardHeader className="pb-3 border-b border-gray-50">
          <CardTitle className="text-base">Appointment History</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {appointments.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">No appointments found</p>
          ) : (
            <div className="space-y-2">
              {appointments.map((appt) => {
                const sc = statusConfig[appt.status] ?? statusConfig.pending
                return (
                  <div
                    key={appt.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100/80 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-900">
                          {format(new Date(appt.appointment_date + 'T00:00:00'), 'EEEE, MMMM d, yyyy')}
                        </p>
                        <span className="text-xs text-gray-400">{appt.appointment_time.slice(0, 5)}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {appt.services && (
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Scissors className="w-3 h-3 text-gray-400" />
                            <span>{appt.services.name}</span>
                            <span className="font-medium text-primary">
                              {formatAmount(appt.services.price)}
                            </span>
                          </div>
                        )}
                        {appt.staff && (
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Users className="w-3 h-3 text-gray-400" />
                            <span>{appt.staff.name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <Badge className={`text-xs border flex-shrink-0 ${sc.className}`}>{sc.label}</Badge>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

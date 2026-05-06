'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { useUserContext } from '@/components/RoleContext'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  UserSearch,
  TrendingUp,
  CalendarDays,
  Loader2,
  ChevronRight,
  Search,
} from 'lucide-react'
import Link from 'next/link'

type ClientSummary = {
  client_name: string
  total_appointments: number
  completed: number
  total_spent: number
  last_visit: string
  first_visit: string
}

function formatPKR(n: number) {
  return `PKR ${Math.round(n).toLocaleString('en-PK')}`
}

export default function ClientsPage() {
  const { role, ownerId } = useUserContext()
  const router = useRouter()

  const [clients, setClients] = useState<ClientSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!['owner', 'manager', 'receptionist'].includes(role)) { router.replace('/appointments'); return }
    loadClients()
  }, [role, router]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!['owner', 'manager', 'receptionist'].includes(role)) return null

  async function loadClients() {
    const supabase = createClient()

    const { data } = await supabase
      .from('appointments')
      .select('client_name, status, appointment_date, services(price)')
      .eq('user_id', ownerId)
      .order('appointment_date', { ascending: false })

    if (!data) { setLoading(false); return }

    const map = new Map<string, ClientSummary>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data.forEach((row: any) => {
      const name = row.client_name as string
      const price = Number(row.services?.price ?? 0)
      const isCompleted = row.status === 'completed'
      const existing = map.get(name)
      if (existing) {
        existing.total_appointments++
        if (isCompleted) { existing.completed++; existing.total_spent += price }
        if (row.appointment_date > existing.last_visit) existing.last_visit = row.appointment_date
        if (row.appointment_date < existing.first_visit) existing.first_visit = row.appointment_date
      } else {
        map.set(name, {
          client_name: name,
          total_appointments: 1,
          completed: isCompleted ? 1 : 0,
          total_spent: isCompleted ? price : 0,
          last_visit: row.appointment_date,
          first_visit: row.appointment_date,
        })
      }
    })

    const sorted = Array.from(map.values()).sort((a, b) => b.total_spent - a.total_spent)
    setClients(sorted)
    setLoading(false)
  }

  const filtered = clients.filter((c) =>
    c.client_name.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <UserSearch className="w-6 h-6 text-primary" />
          Clients
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          <span className="font-urdu">کلائنٹ پروفائل</span> — View client history and spending
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <Card className="border-gray-100">
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-bold text-gray-900">{clients.length}</p>
            <p className="text-xs text-gray-500">Total Clients</p>
            <p className="font-urdu text-xs text-gray-400">کل کلائنٹس</p>
          </CardContent>
        </Card>
        <Card className="border-gray-100">
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-bold text-gray-900">
              {formatPKR(clients.reduce((s, c) => s + c.total_spent, 0))}
            </p>
            <p className="text-xs text-gray-500">Total Revenue</p>
            <p className="font-urdu text-xs text-gray-400">کل آمدنی</p>
          </CardContent>
        </Card>
        <Card className="border-gray-100 hidden sm:block">
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-bold text-gray-900">
              {clients.length > 0
                ? formatPKR(clients.reduce((s, c) => s + c.total_spent, 0) / clients.filter(c => c.completed > 0).length || 0)
                : 'PKR 0'}
            </p>
            <p className="text-xs text-gray-500">Avg Spending</p>
            <p className="font-urdu text-xs text-gray-400">اوسط خرچ</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search clients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-10"
        />
      </div>

      {/* Client List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <UserSearch className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {search ? 'No clients found' : 'No clients yet'}
          </h3>
          <p className="font-urdu text-sm text-gray-400">
            {search ? 'تلاش میں کوئی نتیجہ نہیں' : 'کوئی کلائنٹ نہیں'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((client, i) => (
            <Link
              key={client.client_name}
              href={`/clients/${encodeURIComponent(client.client_name)}`}
              className="block bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md hover:border-primary/20 transition-all group"
            >
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary font-bold text-base">
                    {client.client_name[0]?.toUpperCase()}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900 text-sm">{client.client_name}</p>
                    {i === 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                        Top Client
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <CalendarDays className="w-3 h-3 text-gray-400" />
                      <span>{client.total_appointments} visits</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <TrendingUp className="w-3 h-3 text-gray-400" />
                      <span className="font-medium text-primary">{formatPKR(client.total_spent)}</span>
                    </div>
                    {client.last_visit && (
                      <span className="text-xs text-gray-400">
                        Last: {format(new Date(client.last_visit + 'T00:00:00'), 'MMM d, yyyy')}
                      </span>
                    )}
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary transition-colors flex-shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

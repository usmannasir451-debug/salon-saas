'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { useUserContext } from '@/components/RoleContext'
import { Shield, Loader2, ArrowLeft, Search, Filter } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { cn } from '@/lib/utils'

type AuditEntry = {
  id: string
  actor_email: string | null
  actor_role: string | null
  action: string
  entity_type: string
  entity_id: string | null
  details: Record<string, unknown> | null
  created_at: string
}

const actionColor: Record<string, string> = {
  create: 'bg-green-50 text-green-700 border-green-200',
  update: 'bg-blue-50 text-blue-700 border-blue-200',
  delete: 'bg-red-50 text-red-700 border-red-200',
  payment: 'bg-purple-50 text-purple-700 border-purple-200',
  discount: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  login: 'bg-gray-50 text-gray-600 border-gray-200',
  settings: 'bg-orange-50 text-orange-700 border-orange-200',
}

function getActionColor(action: string) {
  const key = Object.keys(actionColor).find((k) => action.toLowerCase().includes(k))
  return key ? actionColor[key] : 'bg-gray-50 text-gray-600 border-gray-200'
}

export default function AuditLogPage() {
  const { role, ownerId } = useUserContext()
  const router = useRouter()

  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 50

  useEffect(() => {
    if (role !== 'owner') { router.replace('/settings'); return }
    loadEntries()
  }, [role, router]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadEntries() {
    setLoading(true)
    const supabase = createClient()
    let query = supabase
      .from('audit_log')
      .select('*')
      .eq('user_id', ownerId)
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (dateFrom) query = query.gte('created_at', dateFrom)
    if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59')

    const { data } = await query
    setEntries((data ?? []) as AuditEntry[])
    setLoading(false)
  }

  useEffect(() => { loadEntries() }, [page, dateFrom, dateTo]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = entries.filter((e) => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      e.actor_email?.toLowerCase().includes(s) ||
      e.action.toLowerCase().includes(s) ||
      e.entity_type.toLowerCase().includes(s) ||
      e.actor_role?.toLowerCase().includes(s)
    )
  })

  if (role !== 'owner') return null

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            Audit Log
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Complete activity trail — owner only</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by user, action, or entity..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Filter className="w-4 h-4 text-gray-400" />
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(0) }}
                className="w-36 text-sm"
                placeholder="From"
              />
              <span className="text-gray-400 text-sm">—</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(0) }}
                className="w-36 text-sm"
                placeholder="To"
              />
              {(dateFrom || dateTo) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setDateFrom(''); setDateTo(''); setPage(0) }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['Date & Time', 'User', 'Role', 'Action', 'Entity', 'Details'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((e) => (
                    <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {format(new Date(e.created_at), 'MMM d, yyyy')}
                        <br />
                        {format(new Date(e.created_at), 'h:mm a')}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800 text-xs truncate max-w-[140px]">
                          {e.actor_email ?? 'System'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {e.actor_role && (
                          <Badge className="text-[10px] capitalize bg-gray-100 text-gray-600 border-gray-200">
                            {e.actor_role}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={cn('text-[10px]', getActionColor(e.action))}>
                          {e.action}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-700 text-xs">
                        <span className="capitalize">{e.entity_type.replace(/_/g, ' ')}</span>
                        {e.entity_id && (
                          <span className="text-gray-400 block text-[10px]">#{e.entity_id.slice(-8)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px]">
                        {e.details ? (
                          <div className="truncate">
                            {Object.entries(e.details).map(([k, v]) => (
                              <span key={k} className="mr-2">
                                <span className="text-gray-400">{k}:</span>{' '}
                                <span>{String(v)}</span>
                              </span>
                            ))}
                          </div>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                        <Shield className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                        <p className="text-sm">
                          {entries.length === 0
                            ? 'No audit entries yet. Actions are logged automatically.'
                            : 'No entries match your filter.'}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {!loading && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Showing {filtered.length} of {entries.length} entries</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={entries.length < PAGE_SIZE}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

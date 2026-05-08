'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { toggleSalonStatus, createSalonAccount } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Scissors, Search, UserPlus, Copy, Check } from 'lucide-react'

type Salon = {
  id: string
  email: string
  salon_name: string | null
  subscription_status: string | null
  created_at: string
}

type CreatedCredentials = {
  salonName: string
  email: string
  password: string
}

export default function AdminDashboard({ salons }: { salons: Salon[] }) {
  const [search, setSearch] = useState('')
  const [isPending, startTransition] = useTransition()
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [salonName, setSalonName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [creating, setCreating] = useState(false)
  const [credentials, setCredentials] = useState<CreatedCredentials | null>(null)
  const [copied, setCopied] = useState(false)

  const filtered = salons.filter((s) => {
    const q = search.toLowerCase()
    return (
      (s.salon_name ?? '').toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q)
    )
  })

  function handleToggle(salon: Salon) {
    const newStatus = salon.subscription_status === 'suspended' ? 'active' : 'suspended'
    setTogglingId(salon.id)
    startTransition(async () => {
      try {
        await toggleSalonStatus(salon.id, newStatus)
        toast.success(`${salon.salon_name || salon.email} is now ${newStatus}`)
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Failed to update status')
      } finally {
        setTogglingId(null)
      }
    })
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      await createSalonAccount(salonName, email, password)
      setCredentials({ salonName, email, password })
      setSalonName('')
      setEmail('')
      setPassword('')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to create account')
    } finally {
      setCreating(false)
    }
  }

  function copyCredentials() {
    if (!credentials) return
    const text = `Salon: ${credentials.salonName}\nEmail: ${credentials.email}\nPassword: ${credentials.password}\nLogin: ${window.location.origin}/login`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Scissors className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-bold text-gray-900">SalonPro</span>
              <Badge className="ml-2 bg-primary/10 text-primary border-primary/20 text-xs">Admin</Badge>
            </div>
          </div>
          <p className="text-sm text-gray-500">{salons.length} salons total</p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by salon name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Dialog
            open={createOpen}
            onOpenChange={(open) => {
              setCreateOpen(open)
              if (!open) setCredentials(null)
            }}
          >
            <DialogTrigger
              className="shrink-0 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-xs transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <UserPlus className="w-4 h-4" />
              Create New Salon Account
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create Salon Account</DialogTitle>
              </DialogHeader>

              {credentials ? (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
                    <p className="text-sm font-semibold text-green-800">Account created successfully!</p>
                    <div className="text-sm text-green-700 space-y-1 font-mono">
                      <p>Salon: {credentials.salonName}</p>
                      <p>Email: {credentials.email}</p>
                      <p>Password: {credentials.password}</p>
                    </div>
                  </div>
                  <Button onClick={copyCredentials} variant="outline" className="w-full">
                    {copied ? (
                      <><Check className="w-4 h-4 mr-2 text-green-600" /> Copied!</>
                    ) : (
                      <><Copy className="w-4 h-4 mr-2" /> Copy Credentials</>
                    )}
                  </Button>
                  <Button
                    className="w-full bg-primary hover:bg-primary/90"
                    onClick={() => setCredentials(null)}
                  >
                    Create Another Account
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="salonName">Salon Name</Label>
                    <Input
                      id="salonName"
                      value={salonName}
                      onChange={(e) => setSalonName(e.target.value)}
                      placeholder="e.g. Glamour Beauty Lounge"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ownerEmail">Owner Email</Label>
                    <Input
                      id="ownerEmail"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="owner@example.com"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tempPassword">Temporary Password</Label>
                    <Input
                      id="tempPassword"
                      type="text"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 6 characters"
                      minLength={6}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-primary hover:bg-primary/90"
                    disabled={creating}
                  >
                    {creating ? 'Creating...' : 'Create Account'}
                  </Button>
                </form>
              )}
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">All Salons</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-12">No salons found</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {filtered.map((salon) => {
                  const isSuspended = salon.subscription_status === 'suspended'
                  const isToggling = togglingId === salon.id && isPending
                  return (
                    <div key={salon.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 truncate">
                          {salon.salon_name || '(No salon name)'}
                        </p>
                        <p className="text-sm text-gray-500 truncate">{salon.email}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Joined {new Date(salon.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 ml-4 shrink-0">
                        <Badge
                          className={
                            isSuspended
                              ? 'bg-red-50 text-red-600 border-red-200'
                              : 'bg-green-50 text-green-600 border-green-200'
                          }
                        >
                          {isSuspended ? 'Suspended' : 'Active'}
                        </Badge>
                        <Button
                          size="sm"
                          variant={isSuspended ? 'default' : 'outline'}
                          className={isSuspended ? 'bg-primary hover:bg-primary/90' : 'border-red-200 text-red-600 hover:bg-red-50'}
                          onClick={() => handleToggle(salon)}
                          disabled={isToggling}
                        >
                          {isToggling ? '...' : isSuspended ? 'Activate' : 'Suspend'}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

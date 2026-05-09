'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { toggleSalonStatus, createSalonAccount, resetSalonPassword } from './actions'
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
import {
  Scissors,
  Search,
  UserPlus,
  Copy,
  Check,
  Eye,
  EyeOff,
  ExternalLink,
  Link2,
  KeyRound,
} from 'lucide-react'

type Salon = {
  id: string
  email: string
  salon_name: string | null
  subscription_status: string | null
  created_at: string
  last_set_password: string | null
}

type CreatedCredentials = {
  salonName: string
  email: string
  password: string
}

export default function AdminDashboard({ salons }: { salons: Salon[] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [isPending, startTransition] = useTransition()
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Create account dialog state
  const [createOpen, setCreateOpen] = useState(false)
  const [salonName, setSalonName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [creating, setCreating] = useState(false)
  const [credentials, setCredentials] = useState<CreatedCredentials | null>(null)
  const [copied, setCopied] = useState(false)

  // Per-salon UI state
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set())
  const [copiedEmailId, setCopiedEmailId] = useState<string | null>(null)
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null)

  // Reset password dialog state
  const [resetSalonId, setResetSalonId] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetting, setResetting] = useState(false)

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
        const result = await toggleSalonStatus(salon.id, newStatus)
        if ('error' in result) {
          toast.error(result.error)
        } else {
          toast.success(`${salon.salon_name || salon.email} is now ${newStatus}`)
          router.refresh()
        }
      } catch {
        toast.error('Failed to update status')
      } finally {
        setTogglingId(null)
      }
    })
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      const result = await createSalonAccount(salonName, email, password)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        setCredentials({ salonName, email, password })
        setSalonName('')
        setEmail('')
        setPassword('')
        router.refresh()
      }
    } catch {
      toast.error('Failed to create account')
    } finally {
      setCreating(false)
    }
  }

  function copyCredentials() {
    if (!credentials) return
    const origin = window.location.origin
    const text = `Welcome to Snipforce!\nLogin URL: ${origin}/login\nEmail: ${credentials.email}\nPassword: ${credentials.password}\nPlease change your password after first login.`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function copyEmail(salon: Salon) {
    navigator.clipboard.writeText(salon.email)
    setCopiedEmailId(salon.id)
    setTimeout(() => setCopiedEmailId(null), 2000)
  }

  function copyLoginLink(salon: Salon) {
    const origin = window.location.origin
    const pw = salon.last_set_password ?? '[reset password first]'
    const text = `Welcome to Snipforce!\nLogin URL: ${origin}/login\nEmail: ${salon.email}\nPassword: ${pw}\nPlease change your password after first login.`
    navigator.clipboard.writeText(text)
    setCopiedLinkId(salon.id)
    setTimeout(() => setCopiedLinkId(null), 2000)
    toast.success('Login message copied — ready to paste to WhatsApp')
  }

  function openPortal(salon: Salon) {
    const origin = window.location.origin
    window.open(`${origin}/login?email=${encodeURIComponent(salon.email)}`, '_blank')
  }

  function togglePasswordVisibility(salonId: string) {
    setVisiblePasswords((prev) => {
      const next = new Set(prev)
      if (next.has(salonId)) {
        next.delete(salonId)
      } else {
        next.add(salonId)
      }
      return next
    })
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!resetSalonId) return
    setResetting(true)
    try {
      const result = await resetSalonPassword(resetSalonId, newPassword)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success('Password reset successfully')
        setResetSalonId(null)
        setNewPassword('')
        router.refresh()
      }
    } catch {
      toast.error('Failed to reset password')
    } finally {
      setResetting(false)
    }
  }

  const resetSalon = salons.find((s) => s.id === resetSalonId)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Scissors className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-bold text-gray-900">Snipforce</span>
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
            <DialogTrigger className="shrink-0 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-xs transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
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
                      <><Copy className="w-4 h-4 mr-2" /> Copy WhatsApp Message</>
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
                  const showPw = visiblePasswords.has(salon.id)
                  const emailCopied = copiedEmailId === salon.id
                  const linkCopied = copiedLinkId === salon.id
                  return (
                    <div
                      key={salon.id}
                      className="flex items-start justify-between px-6 py-4 hover:bg-gray-50 transition-colors gap-4"
                    >
                      {/* Info block */}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 truncate">
                          {salon.salon_name || '(No salon name)'}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <p className="text-sm text-gray-500 truncate">{salon.email}</p>
                          <button
                            onClick={() => copyEmail(salon)}
                            title="Copy email"
                            className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors p-0.5"
                          >
                            {emailCopied ? (
                              <Check className="w-3 h-3 text-green-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Joined{' '}
                          {new Date(salon.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                        {salon.last_set_password && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-xs text-gray-400">PW:</span>
                            <span className="text-xs font-mono text-gray-600">
                              {showPw ? salon.last_set_password : '••••••••'}
                            </span>
                            <button
                              onClick={() => togglePasswordVisibility(salon.id)}
                              title={showPw ? 'Hide password' : 'Show password'}
                              className="text-gray-400 hover:text-gray-600 transition-colors p-0.5"
                            >
                              {showPw ? (
                                <EyeOff className="w-3 h-3" />
                              ) : (
                                <Eye className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Actions block */}
                      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                        <Badge
                          className={
                            isSuspended
                              ? 'bg-red-50 text-red-600 border-red-200'
                              : 'bg-green-50 text-green-600 border-green-200'
                          }
                        >
                          {isSuspended ? 'Suspended' : 'Active'}
                        </Badge>

                        <button
                          onClick={() => openPortal(salon)}
                          title="Open portal (login page with email pre-filled)"
                          className="text-gray-400 hover:text-gray-700 transition-colors p-1 rounded hover:bg-gray-100"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => copyLoginLink(salon)}
                          title="Copy WhatsApp login message"
                          className="text-gray-400 hover:text-gray-700 transition-colors p-1 rounded hover:bg-gray-100"
                        >
                          {linkCopied ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Link2 className="w-4 h-4" />
                          )}
                        </button>

                        <button
                          onClick={() => {
                            setResetSalonId(salon.id)
                            setNewPassword('')
                          }}
                          title="Reset password"
                          className="text-gray-400 hover:text-gray-700 transition-colors p-1 rounded hover:bg-gray-100"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>

                        <Button
                          size="sm"
                          variant={isSuspended ? 'default' : 'outline'}
                          className={
                            isSuspended
                              ? 'bg-primary hover:bg-primary/90'
                              : 'border-red-200 text-red-600 hover:bg-red-50'
                          }
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

      {/* Reset Password Dialog */}
      <Dialog
        open={resetSalonId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setResetSalonId(null)
            setNewPassword('')
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Reset Password — {resetSalon?.salon_name || resetSalon?.email}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 6 characters"
                minLength={6}
                required
                autoFocus
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90"
              disabled={resetting}
            >
              {resetting ? 'Resetting...' : 'Reset Password'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

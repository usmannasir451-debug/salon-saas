'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useUserContext } from '@/components/RoleContext'
import {
  CheckCircle2, ChevronRight, Scissors, Users, UserPlus, Settings, Loader2, X, Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const STEPS = [
  { id: 1, title: 'Salon Info', desc: 'Set your salon name and branding', icon: Settings },
  { id: 2, title: 'First Service', desc: 'Add your first service offering', icon: Scissors },
  { id: 3, title: 'First Staff', desc: 'Add your first team member', icon: Users },
  { id: 4, title: 'Invite Team', desc: 'Invite a team member to join', icon: UserPlus },
]

export default function OnboardingPage() {
  const { role, ownerId } = useUserContext()
  const router = useRouter()

  const [step, setStep] = useState(1)
  const [completed, setCompleted] = useState<number[]>([])
  const [saving, setSaving] = useState(false)

  // Step 1
  const [salonName, setSalonName] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  // Step 2
  const [serviceName, setServiceName] = useState('')
  const [servicePrice, setServicePrice] = useState('')
  const [serviceDuration, setServiceDuration] = useState('30')

  // Step 3
  const [staffName, setStaffName] = useState('')
  const [staffPhone, setStaffPhone] = useState('')

  // Step 4
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('receptionist')

  useEffect(() => {
    if (role !== 'owner') { router.replace('/dashboard'); return }
    loadCurrentData()
  }, [role, router]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadCurrentData() {
    const supabase = createClient()
    const { data } = await supabase
      .from('profiles')
      .select('salon_name, salon_logo_url')
      .eq('id', ownerId)
      .single()
    if (data?.salon_name) setSalonName(data.salon_name)
    if (data?.salon_logo_url) setLogoPreview(data.salon_logo_url)
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  async function handleStep1() {
    if (!salonName.trim()) { toast.error('Please enter your salon name'); return }
    setSaving(true)
    const supabase = createClient()
    let logoUrl: string | undefined

    if (logoFile) {
      const ext = logoFile.name.split('.').pop()
      const path = `${ownerId}/logo.${ext}`
      const { error: uploadErr } = await supabase.storage.from('logos').upload(path, logoFile, { upsert: true })
      if (uploadErr) { toast.error('Logo upload failed'); setSaving(false); return }
      const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path)
      logoUrl = publicUrl
    }

    const { error } = await supabase
      .from('profiles')
      .update({ salon_name: salonName.trim(), ...(logoUrl ? { salon_logo_url: logoUrl } : {}) })
      .eq('id', ownerId)

    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success('Salon info saved!')
    markDone(1)
    setSaving(false)
  }

  async function handleStep2() {
    if (!serviceName.trim()) { toast.error('Please enter a service name'); return }
    const price = parseFloat(servicePrice)
    if (!price || price < 0) { toast.error('Please enter a valid price'); return }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('services').insert({
      user_id: ownerId,
      name: serviceName.trim(),
      price,
      duration: parseInt(serviceDuration) || 30,
    })
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success('Service added!')
    markDone(2)
    setSaving(false)
  }

  async function handleStep3() {
    if (!staffName.trim()) { toast.error('Please enter staff name'); return }
    if (!staffPhone.trim()) { toast.error('Please enter staff phone'); return }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('staff').insert({
      user_id: ownerId,
      name: staffName.trim(),
      phone: staffPhone.trim(),
    })
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success('Staff member added!')
    markDone(3)
    setSaving(false)
  }

  async function handleStep4() {
    if (!inviteEmail.trim()) { toast.error('Please enter an email address'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Invite failed'); setSaving(false); return }
      toast.success('Invitation sent!')
      markDone(4)
    } catch {
      toast.error('Failed to send invite')
    }
    setSaving(false)
  }

  async function finishOnboarding() {
    const supabase = createClient()
    await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', ownerId)
    toast.success('Setup complete! Welcome to Snipforce 🎉')
    router.push('/dashboard')
  }

  function markDone(stepId: number) {
    setCompleted((prev) => [...new Set([...prev, stepId])])
    if (stepId < 4) setStep(stepId + 1)
  }

  function skipStep() {
    if (step < 4) setStep(step + 1)
    else finishOnboarding()
  }

  const progress = (completed.length / 4) * 100

  if (role !== 'owner') return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-pink-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-primary/30">
            <Scissors className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome to Snipforce!</h1>
          <p className="text-gray-500 text-sm mt-1">Let&apos;s get your salon set up in 4 quick steps</p>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
            <span>Setup Progress</span>
            <span>{completed.length}/4 steps completed</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-2 bg-primary rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Step indicators */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          {STEPS.map((s) => {
            const isCompleted = completed.includes(s.id)
            const isActive = step === s.id
            const Icon = s.icon
            return (
              <button
                key={s.id}
                onClick={() => setStep(s.id)}
                className={cn(
                  'flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all text-left',
                  isCompleted
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : isActive
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-gray-200 bg-white text-gray-400'
                )}
              >
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center',
                  isCompleted ? 'bg-green-500' : isActive ? 'bg-primary' : 'bg-gray-100'
                )}>
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  ) : (
                    <Icon className={cn('w-4 h-4', isActive ? 'text-white' : 'text-gray-400')} />
                  )}
                </div>
                <div className="text-center hidden sm:block">
                  <p className={cn('text-[11px] font-semibold leading-tight', isActive ? 'text-primary' : isCompleted ? 'text-green-700' : 'text-gray-500')}>
                    {s.title}
                  </p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Step card */}
        <Card className="shadow-sm">
          <CardContent className="p-6">
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Salon Information</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Set your salon name and upload a logo</p>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="salon-name">Salon Name *</Label>
                    <Input
                      id="salon-name"
                      value={salonName}
                      onChange={(e) => setSalonName(e.target.value)}
                      placeholder="e.g. Glamour Beauty Studio"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Logo (optional)</Label>
                    <div className="mt-1 flex items-center gap-3">
                      {logoPreview && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logoPreview} alt="Logo preview" className="w-14 h-14 object-contain rounded-lg border border-gray-200" />
                      )}
                      <label className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors text-sm text-gray-600">
                        <Upload className="w-4 h-4" />
                        {logoFile ? logoFile.name : 'Upload Logo'}
                        <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                      </label>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <Button variant="ghost" size="sm" onClick={skipStep} className="text-gray-400">
                    Skip <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                  <Button onClick={handleStep1} disabled={saving} className="bg-primary hover:bg-primary/90">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Save & Continue
                  </Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Add Your First Service</h2>
                  <p className="text-sm text-gray-500 mt-0.5">What services does your salon offer?</p>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="svc-name">Service Name *</Label>
                    <Input
                      id="svc-name"
                      value={serviceName}
                      onChange={(e) => setServiceName(e.target.value)}
                      placeholder="e.g. Haircut & Blow Dry"
                      className="mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="svc-price">Price (PKR) *</Label>
                      <Input
                        id="svc-price"
                        type="number"
                        min="0"
                        value={servicePrice}
                        onChange={(e) => setServicePrice(e.target.value)}
                        placeholder="1500"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="svc-dur">Duration (mins)</Label>
                      <Input
                        id="svc-dur"
                        type="number"
                        min="5"
                        value={serviceDuration}
                        onChange={(e) => setServiceDuration(e.target.value)}
                        placeholder="30"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <Button variant="ghost" size="sm" onClick={skipStep} className="text-gray-400">
                    Skip <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                  <Button onClick={handleStep2} disabled={saving} className="bg-primary hover:bg-primary/90">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Add Service
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Add Your First Staff Member</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Who works at your salon?</p>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="staff-name">Full Name *</Label>
                    <Input
                      id="staff-name"
                      value={staffName}
                      onChange={(e) => setStaffName(e.target.value)}
                      placeholder="e.g. Fatima Malik"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="staff-phone">Phone Number *</Label>
                    <Input
                      id="staff-phone"
                      value={staffPhone}
                      onChange={(e) => setStaffPhone(e.target.value)}
                      placeholder="03xxxxxxxxx"
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <Button variant="ghost" size="sm" onClick={skipStep} className="text-gray-400">
                    Skip <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                  <Button onClick={handleStep3} disabled={saving} className="bg-primary hover:bg-primary/90">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Add Staff
                  </Button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Invite a Team Member</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Give your team access to Snipforce</p>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="inv-email">Email Address *</Label>
                    <Input
                      id="inv-email"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="colleague@email.com"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="inv-role">Role</Label>
                    <select
                      id="inv-role"
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    >
                      <option value="manager">Manager</option>
                      <option value="receptionist">Receptionist</option>
                      <option value="cashier">Cashier</option>
                      <option value="staff">Staff</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <Button variant="ghost" size="sm" onClick={finishOnboarding} className="text-gray-400">
                    Skip & Finish <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                  <Button onClick={handleStep4} disabled={saving} className="bg-primary hover:bg-primary/90">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Send Invite
                  </Button>
                </div>
              </div>
            )}

            {completed.length === 4 && (
              <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                <p className="text-sm text-green-600 font-medium">🎉 All steps completed!</p>
                <Button onClick={finishOnboarding} className="mt-3 bg-primary hover:bg-primary/90">
                  Go to Dashboard
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-gray-400 mt-4">
          You can always come back to complete setup later from the dashboard.{' '}
          <button onClick={finishOnboarding} className="text-primary hover:underline">
            Skip all
          </button>
        </p>
      </div>
    </div>
  )
}

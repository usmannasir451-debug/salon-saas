'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useUserContext } from '@/components/RoleContext'
import {
  Settings,
  Loader2,
  Upload,
  Save,
  Building2,
  Phone,
  Mail,
  Globe,
  DollarSign,
  Palette,
  Image as ImageIcon,
  Percent,
  Gift,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Istanbul',
  'Asia/Karachi', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Bangkok', 'Asia/Singapore',
  'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland',
]

const CURRENCIES = [
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'PKR', label: 'PKR — Pakistani Rupee' },
  { code: 'INR', label: 'INR — Indian Rupee' },
  { code: 'AED', label: 'AED — UAE Dirham' },
  { code: 'SAR', label: 'SAR — Saudi Riyal' },
  { code: 'CAD', label: 'CAD — Canadian Dollar' },
  { code: 'AUD', label: 'AUD — Australian Dollar' },
  { code: 'SGD', label: 'SGD — Singapore Dollar' },
]

type FormState = {
  salon_name: string
  salon_address: string
  salon_phone: string
  salon_email: string
  salon_timezone: string
  salon_currency: string
  salon_primary_color: string
  salon_logo_url: string
  max_discount_owner: string
  max_discount_manager: string
  max_discount_cashier: string
  tax_percentage: string
  loyalty_enabled: boolean
  loyalty_earn_pct: string
  loyalty_expiry_days: string
}

const defaultForm: FormState = {
  salon_name: '',
  salon_address: '',
  salon_phone: '',
  salon_email: '',
  salon_timezone: 'UTC',
  salon_currency: 'USD',
  salon_primary_color: '#f43f5e',
  salon_logo_url: '',
  max_discount_owner: '100',
  max_discount_manager: '30',
  max_discount_cashier: '15',
  tax_percentage: '0',
  loyalty_enabled: false,
  loyalty_earn_pct: '10',
  loyalty_expiry_days: '',
}

export default function SettingsPage() {
  const { role, ownerId } = useUserContext()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<FormState>(defaultForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [logoPreview, setLogoPreview] = useState('')

  useEffect(() => {
    if (role !== 'owner') {
      router.replace('/dashboard')
      return
    }
    loadProfile()
  }, [role, router]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadProfile() {
    const supabase = createClient()
    const { data } = await supabase
      .from('profiles')
      .select('salon_name, salon_address, salon_phone, salon_email, salon_timezone, salon_currency, salon_primary_color, salon_logo_url, max_discount_owner, max_discount_manager, max_discount_cashier, tax_percentage, loyalty_enabled, loyalty_earn_pct, loyalty_expiry_days')
      .eq('id', ownerId)
      .single()

    if (data) {
      setForm({
        salon_name: data.salon_name ?? '',
        salon_address: data.salon_address ?? '',
        salon_phone: data.salon_phone ?? '',
        salon_email: data.salon_email ?? '',
        salon_timezone: data.salon_timezone ?? 'UTC',
        salon_currency: data.salon_currency ?? 'USD',
        salon_primary_color: data.salon_primary_color ?? '#f43f5e',
        salon_logo_url: data.salon_logo_url ?? '',
        max_discount_owner: String(data.max_discount_owner ?? 100),
        max_discount_manager: String(data.max_discount_manager ?? 30),
        max_discount_cashier: String(data.max_discount_cashier ?? 15),
        tax_percentage: String(data.tax_percentage ?? 0),
        loyalty_enabled: data.loyalty_enabled ?? false,
        loyalty_earn_pct: String(data.loyalty_earn_pct ?? 10),
        loyalty_expiry_days: data.loyalty_expiry_days != null ? String(data.loyalty_expiry_days) : '',
      })
      setLogoPreview(data.salon_logo_url ?? '')
    }
    setLoading(false)
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo must be under 2MB')
      return
    }

    setUploading(true)
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `${ownerId}/logo.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from('logos')
      .upload(path, file, { upsert: true })

    if (uploadErr) {
      toast.error(uploadErr.message)
      setUploading(false)
      return
    }

    const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path)
    const logoUrl = urlData.publicUrl

    setForm((f) => ({ ...f, salon_logo_url: logoUrl }))
    setLogoPreview(logoUrl)
    toast.success('Logo uploaded')
    setUploading(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()

    const { error } = await supabase
      .from('profiles')
      .update({
        salon_name: form.salon_name.trim() || null,
        salon_address: form.salon_address.trim() || null,
        salon_phone: form.salon_phone.trim() || null,
        salon_email: form.salon_email.trim() || null,
        salon_timezone: form.salon_timezone || null,
        salon_currency: form.salon_currency || null,
        salon_primary_color: form.salon_primary_color || null,
        salon_logo_url: form.salon_logo_url || null,
        max_discount_owner: parseInt(form.max_discount_owner) || 100,
        max_discount_manager: parseInt(form.max_discount_manager) || 30,
        max_discount_cashier: parseInt(form.max_discount_cashier) || 15,
        tax_percentage: parseFloat(form.tax_percentage) || 0,
        loyalty_enabled: form.loyalty_enabled,
        loyalty_earn_pct: parseFloat(form.loyalty_earn_pct) || 10,
        loyalty_expiry_days: form.loyalty_expiry_days ? parseInt(form.loyalty_expiry_days) : null,
      })
      .eq('id', ownerId)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Settings saved!')
      void supabase.from('audit_log').insert({
        user_id: ownerId,
        actor_role: role,
        action: 'update_settings',
        entity_type: 'settings',
        details: { salon_name: form.salon_name.trim(), tax_percentage: form.tax_percentage },
      })
      router.refresh()
    }
    setSaving(false)
  }

  function set(key: keyof FormState, value: string | boolean) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  if (role !== 'owner') return null

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" />
          Salon Settings
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Configure your salon branding and preferences</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">

        {/* ── Logo ── */}
        <Card className="border-gray-100">
          <CardHeader className="pb-3 border-b border-gray-50">
            <CardTitle className="text-base flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-primary" />
              Salon Logo
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="flex items-center gap-5 flex-wrap">
              <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-gray-300" />
                )}
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-600">Upload your salon logo (PNG, JPG — max 2MB)</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="gap-2"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? 'Uploading...' : 'Choose File'}
                </Button>
                {form.salon_logo_url && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => { setForm((f) => ({ ...f, salon_logo_url: '' })); setLogoPreview('') }}
                  >
                    Remove logo
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Salon Information ── */}
        <Card className="border-gray-100">
          <CardHeader className="pb-3 border-b border-gray-50">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              Salon Information
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="salonName">Salon Name</Label>
              <Input
                id="salonName"
                value={form.salon_name}
                onChange={(e) => set('salon_name', e.target.value)}
                placeholder="e.g. Glamour Beauty Lounge"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="salonAddress">
                <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Address</span>
              </Label>
              <Input
                id="salonAddress"
                value={form.salon_address}
                onChange={(e) => set('salon_address', e.target.value)}
                placeholder="123 Main Street, City"
                className="h-10"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="salonPhone">
                  <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Phone</span>
                </Label>
                <Input
                  id="salonPhone"
                  type="tel"
                  value={form.salon_phone}
                  onChange={(e) => set('salon_phone', e.target.value)}
                  placeholder="+1 555 000 0000"
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="salonEmail">
                  <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Email</span>
                </Label>
                <Input
                  id="salonEmail"
                  type="email"
                  value={form.salon_email}
                  onChange={(e) => set('salon_email', e.target.value)}
                  placeholder="hello@yoursalon.com"
                  className="h-10"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Regional Settings ── */}
        <Card className="border-gray-100">
          <CardHeader className="pb-3 border-b border-gray-50">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary" />
              Regional Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="timezone">
                  <span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> Timezone</span>
                </Label>
                <select
                  id="timezone"
                  value={form.salon_timezone}
                  onChange={(e) => set('salon_timezone', e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="currency">
                  <span className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> Currency</span>
                </Label>
                <select
                  id="currency"
                  value={form.salon_currency}
                  onChange={(e) => set('salon_currency', e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Brand Color ── */}
        <Card className="border-gray-100">
          <CardHeader className="pb-3 border-b border-gray-50">
            <CardTitle className="text-base flex items-center gap-2">
              <Palette className="w-4 h-4 text-primary" />
              Brand Color
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="flex items-center gap-4">
              <input
                type="color"
                value={form.salon_primary_color}
                onChange={(e) => set('salon_primary_color', e.target.value)}
                className="w-12 h-12 rounded-xl border border-gray-200 cursor-pointer p-1 bg-white"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">{form.salon_primary_color}</p>
                <p className="text-xs text-gray-500 mt-0.5">Choose your salon&apos;s primary brand color</p>
              </div>
              <div
                className="w-10 h-10 rounded-xl shadow-sm flex-shrink-0"
                style={{ backgroundColor: form.salon_primary_color }}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Discount Limits ── */}
        <Card className="border-gray-100">
          <CardHeader className="pb-3 border-b border-gray-50">
            <CardTitle className="text-base flex items-center gap-2">
              <Percent className="w-4 h-4 text-primary" />
              Max Discount Limits
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <p className="text-xs text-gray-500">Set the maximum discount percentage each role can apply.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { key: 'max_discount_owner' as const, label: 'Owner', color: 'text-primary' },
                { key: 'max_discount_manager' as const, label: 'Manager', color: 'text-blue-600' },
                { key: 'max_discount_cashier' as const, label: 'Cashier', color: 'text-green-600' },
              ].map((item) => (
                <div key={item.key} className="space-y-1.5">
                  <Label htmlFor={item.key}>
                    <span className={`font-semibold ${item.color}`}>{item.label}</span> (%)
                  </Label>
                  <div className="relative">
                    <Input
                      id={item.key}
                      type="number"
                      min="0"
                      max="100"
                      value={form[item.key]}
                      onChange={(e) => set(item.key, e.target.value)}
                      className="h-10 pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tax percentage */}
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Percent className="w-4 h-4 text-primary" />
              Tax Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <p className="text-xs text-gray-500">Set the tax percentage applied to invoices. Set to 0 to disable tax.</p>
            <div className="max-w-xs">
              <Label htmlFor="tax_percentage">Tax Rate (%)</Label>
              <div className="relative mt-1.5">
                <Input
                  id="tax_percentage"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={form.tax_percentage}
                  onChange={(e) => set('tax_percentage', e.target.value)}
                  className="h-10 pr-8"
                  placeholder="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Loyalty System ── */}
        <Card className="border-gray-100">
          <CardHeader className="pb-3 border-b border-gray-50">
            <CardTitle className="text-base flex items-center gap-2">
              <Gift className="w-4 h-4 text-primary" />
              Loyalty System
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Enable Loyalty Points</p>
                <p className="text-xs text-gray-500 mt-0.5">Clients earn points as a percentage of each bill</p>
              </div>
              <button
                type="button"
                onClick={() => set('loyalty_enabled', !form.loyalty_enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  form.loyalty_enabled ? 'bg-primary' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    form.loyalty_enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {form.loyalty_enabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="space-y-1.5">
                  <Label htmlFor="loyalty_earn_pct">Earn Rate (%)</Label>
                  <p className="text-xs text-gray-500">% of bill value credited as loyalty points (in currency)</p>
                  <div className="relative">
                    <Input
                      id="loyalty_earn_pct"
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={form.loyalty_earn_pct}
                      onChange={(e) => set('loyalty_earn_pct', e.target.value)}
                      className="h-10 pr-8"
                      placeholder="10"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="loyalty_expiry_days">Points Expiry (days)</Label>
                  <p className="text-xs text-gray-500">Leave blank for points that never expire</p>
                  <Input
                    id="loyalty_expiry_days"
                    type="number"
                    min="1"
                    value={form.loyalty_expiry_days}
                    onChange={(e) => set('loyalty_expiry_days', e.target.value)}
                    className="h-10"
                    placeholder="e.g. 365 (or leave blank)"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Audit Log link */}
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900 text-sm">Audit Log</p>
              <p className="text-xs text-gray-500 mt-0.5">View all actions taken by team members</p>
            </div>
            <a
              href="/settings/audit"
              className="text-sm font-medium text-primary hover:underline"
            >
              View Audit Log →
            </a>
          </CardContent>
        </Card>

        <Separator />

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={saving}
            className="bg-primary hover:bg-primary/90 gap-2 px-8"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </form>
    </div>
  )
}

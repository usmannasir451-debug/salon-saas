'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useUserContext } from '@/components/RoleContext'
import { useCurrency } from '@/hooks/useCurrency'
import type { Service, Deal } from '@/lib/types'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Scissors, Plus, Pencil, Trash2, Loader2, Clock, Banknote, Tag, Gift, FileSpreadsheet, Download, Upload, ChevronDown } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ServicesBulkModal, downloadServiceTemplate, exportServices } from '@/components/ServicesBulkModal'
import { DealsBulkModal, downloadDealTemplate, exportDeals } from '@/components/DealsBulkModal'

const emptyServiceForm = { name: '', duration: '', price: '' }
const emptyDealForm = { name: '', description: '', price: '', validity_days: '', service_ids: [] as string[] }

export default function ServicesPage() {
  const { role, ownerId, isOwner } = useUserContext()
  const router = useRouter()
  const { formatAmount } = useCurrency()

  const [services, setServices] = useState<Service[]>([])
  const [deals, setDeals] = useState<(Deal & { deal_services?: { services: Service }[] })[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Service dialog
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false)
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null)
  const [serviceForm, setServiceForm] = useState(emptyServiceForm)

  // Bulk modals
  const [serviceBulkOpen, setServiceBulkOpen] = useState(false)
  const [dealBulkOpen, setDealBulkOpen] = useState(false)

  // Deal dialog
  const [dealDialogOpen, setDealDialogOpen] = useState(false)
  const [editingDealId, setEditingDealId] = useState<string | null>(null)
  const [dealForm, setDealForm] = useState(emptyDealForm)

  useEffect(() => {
    if (!['owner', 'manager'].includes(role)) { router.replace('/appointments'); return }
    loadAll()
  }, [role, router]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!['owner', 'manager'].includes(role)) return null

  async function loadAll() {
    const supabase = createClient()
    const [svcRes, dealRes] = await Promise.all([
      supabase.from('services').select('*').eq('user_id', ownerId).order('name'),
      supabase.from('deals').select('*, deal_services(services(*))').eq('user_id', ownerId).order('name'),
    ])
    setServices(svcRes.data ?? [])
    setDeals((dealRes.data as unknown as (Deal & { deal_services: { services: Service }[] })[]) ?? [])
    setLoading(false)
  }

  // ── Services CRUD ──

  function openCreateService() {
    setEditingServiceId(null)
    setServiceForm(emptyServiceForm)
    setServiceDialogOpen(true)
  }

  function openEditService(service: Service) {
    setEditingServiceId(service.id)
    setServiceForm({ name: service.name, duration: String(service.duration), price: String(service.price) })
    setServiceDialogOpen(true)
  }

  async function handleSaveService(e: React.FormEvent) {
    e.preventDefault()
    if (!serviceForm.name.trim() || !serviceForm.duration || !serviceForm.price) {
      toast.error('Please fill all fields')
      return
    }
    setSaving(true)
    const supabase = createClient()

    const payload = {
      name: serviceForm.name.trim(),
      duration: parseInt(serviceForm.duration),
      price: parseFloat(serviceForm.price),
      user_id: ownerId,
    }

    if (editingServiceId) {
      const { error } = await supabase.from('services').update(payload).eq('id', editingServiceId)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Service updated')
    } else {
      const { error } = await supabase.from('services').insert(payload)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Service added')
    }

    setServiceDialogOpen(false)
    await loadAll()
    setSaving(false)
  }

  async function handleDeleteService(id: string) {
    if (!confirm('Delete this service? This cannot be undone.')) return
    setDeleting(id)
    const supabase = createClient()
    const { error } = await supabase.from('services').delete().eq('id', id)
    if (error) { toast.error(error.message) } else { toast.success('Service deleted') }
    await loadAll()
    setDeleting(null)
  }

  // ── Deals CRUD ──

  function openCreateDeal() {
    setEditingDealId(null)
    setDealForm(emptyDealForm)
    setDealDialogOpen(true)
  }

  function openEditDeal(deal: Deal & { deal_services?: { services: Service }[] }) {
    setEditingDealId(deal.id)
    const svcIds = (deal.deal_services ?? []).map(ds => ds.services?.id).filter(Boolean) as string[]
    setDealForm({
      name: deal.name,
      description: deal.description ?? '',
      price: String(deal.price),
      validity_days: deal.validity_days != null ? String(deal.validity_days) : '',
      service_ids: svcIds,
    })
    setDealDialogOpen(true)
  }

  function toggleDealService(id: string) {
    setDealForm(f => ({
      ...f,
      service_ids: f.service_ids.includes(id) ? f.service_ids.filter(s => s !== id) : [...f.service_ids, id],
    }))
  }

  async function handleSaveDeal(e: React.FormEvent) {
    e.preventDefault()
    if (!dealForm.name.trim() || !dealForm.price) {
      toast.error('Name and price are required')
      return
    }
    setSaving(true)
    const supabase = createClient()

    const payload = {
      name: dealForm.name.trim(),
      description: dealForm.description.trim() || null,
      price: parseFloat(dealForm.price),
      validity_days: dealForm.validity_days ? parseInt(dealForm.validity_days) : null,
      user_id: ownerId,
    }

    if (editingDealId) {
      const { error } = await supabase.from('deals').update(payload).eq('id', editingDealId)
      if (error) { toast.error(error.message); setSaving(false); return }
      await supabase.from('deal_services').delete().eq('deal_id', editingDealId)
      if (dealForm.service_ids.length > 0) {
        await supabase.from('deal_services').insert(
          dealForm.service_ids.map(sid => ({ deal_id: editingDealId, service_id: sid, user_id: ownerId }))
        )
      }
      toast.success('Deal updated')
    } else {
      const { data: newDeal, error } = await supabase.from('deals').insert(payload).select('id').single()
      if (error) { toast.error(error.message); setSaving(false); return }
      if (dealForm.service_ids.length > 0 && newDeal) {
        await supabase.from('deal_services').insert(
          dealForm.service_ids.map(sid => ({ deal_id: newDeal.id, service_id: sid, user_id: ownerId }))
        )
      }
      toast.success('Deal created')
    }

    setDealDialogOpen(false)
    await loadAll()
    setSaving(false)
  }

  async function handleDeleteDeal(id: string) {
    if (!confirm('Delete this deal?')) return
    setDeleting(id)
    const supabase = createClient()
    const { error } = await supabase.from('deals').delete().eq('id', id)
    if (error) { toast.error(error.message) } else { toast.success('Deal deleted') }
    await loadAll()
    setDeleting(null)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Scissors className="w-6 h-6 text-primary" />
            Services & Deals
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your menu and packages</p>
        </div>
      </div>

      <Tabs defaultValue="services">
        <TabsList className="mb-6">
          <TabsTrigger value="services" className="gap-2">
            <Scissors className="w-4 h-4" /> Services ({services.length})
          </TabsTrigger>
          <TabsTrigger value="deals" className="gap-2">
            <Gift className="w-4 h-4" /> Deals & Packages ({deals.length})
          </TabsTrigger>
        </TabsList>

        {/* ── SERVICES TAB ── */}
        <TabsContent value="services">
          <div className="flex justify-end items-center gap-2 mb-4">
            {isOwner && (
              <DropdownMenu>
                <DropdownMenuTrigger className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  <FileSpreadsheet className="w-4 h-4" />
                  <span className="hidden sm:inline">CSV</span>
                  <ChevronDown className="w-3 h-3" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={downloadServiceTemplate}>
                    <Download className="w-3.5 h-3.5 mr-2" />
                    Download Template
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportServices(services)}>
                    <Download className="w-3.5 h-3.5 mr-2" />
                    Export Current Services
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setServiceBulkOpen(true)}>
                    <Upload className="w-3.5 h-3.5 mr-2" />
                    Upload CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button onClick={openCreateService} className="bg-primary hover:bg-primary/90 gap-2">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Service</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : services.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Scissors className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">No services yet</h3>
              <p className="text-gray-400 text-sm mb-6">Add your first service to get started</p>
              <Button onClick={openCreateService} className="bg-primary hover:bg-primary/90 gap-2">
                <Plus className="w-4 h-4" /> Add Your First Service
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {services.map((service) => (
                <Card key={service.id} className="border-gray-100 hover:shadow-md transition-shadow group">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Scissors className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEditService(service)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-primary transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteService(service.id)} disabled={deleting === service.id}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                          {deleting === service.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    <CardTitle className="text-sm mt-2 text-gray-900 leading-tight">{service.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    <Badge className="bg-green-50 text-green-700 border-green-200 gap-1 text-xs">
                      <Banknote className="w-3 h-3" />
                      {formatAmount(service.price)}
                    </Badge>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      {service.duration} minutes
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── DEALS TAB ── */}
        <TabsContent value="deals">
          <div className="flex justify-end items-center gap-2 mb-4">
            {isOwner && (
              <DropdownMenu>
                <DropdownMenuTrigger className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  <FileSpreadsheet className="w-4 h-4" />
                  <span className="hidden sm:inline">CSV</span>
                  <ChevronDown className="w-3 h-3" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={downloadDealTemplate}>
                    <Download className="w-3.5 h-3.5 mr-2" />
                    Download Template
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportDeals(deals)}>
                    <Download className="w-3.5 h-3.5 mr-2" />
                    Export Current Deals
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setDealBulkOpen(true)}>
                    <Upload className="w-3.5 h-3.5 mr-2" />
                    Upload CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button onClick={openCreateDeal} className="bg-primary hover:bg-primary/90 gap-2">
              <Plus className="w-4 h-4" />
              Create Deal
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : deals.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Gift className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">No deals yet</h3>
              <p className="text-gray-400 text-sm mb-6">Create combo packages to attract more clients</p>
              <Button onClick={openCreateDeal} className="bg-primary hover:bg-primary/90 gap-2">
                <Plus className="w-4 h-4" /> Create Your First Deal
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {deals.map((deal) => {
                const includedSvcs = (deal.deal_services ?? []).map(ds => ds.services).filter(Boolean)
                const originalPrice = includedSvcs.reduce((s, svc) => s + Number(svc.price), 0)
                const saving = originalPrice - deal.price
                return (
                  <Card key={deal.id} className="border-gray-100 hover:shadow-md transition-shadow group">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Gift className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEditDeal(deal)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-primary transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDeleteDeal(deal.id)} disabled={deleting === deal.id}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                            {deleting === deal.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                      <CardTitle className="text-sm mt-2 text-gray-900">{deal.name}</CardTitle>
                      {deal.description && <p className="text-xs text-gray-500">{deal.description}</p>}
                    </CardHeader>
                    <CardContent className="pt-0 space-y-2">
                      {/* Included services */}
                      <div className="flex flex-wrap gap-1">
                        {includedSvcs.map((svc) => (
                          <span key={svc.id} className="bg-gray-100 text-gray-600 text-xs rounded px-1.5 py-0.5">{svc.name}</span>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-primary/10 text-primary border-primary/20 gap-1 text-xs font-bold">
                          <Tag className="w-3 h-3" />
                          {formatAmount(deal.price)}
                        </Badge>
                        {saving > 0 && originalPrice > 0 && (
                          <span className="text-xs text-green-600">Save {formatAmount(saving)}</span>
                        )}
                      </div>
                      {originalPrice > 0 && saving > 0 && (
                        <p className="text-xs text-gray-400 line-through">{formatAmount(originalPrice)} normally</p>
                      )}
                      {deal.validity_days && (
                        <p className="text-xs text-gray-500">Valid for {deal.validity_days} days</p>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Service Add/Edit Dialog */}
      <Dialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingServiceId ? 'Edit Service' : 'Add New Service'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveService} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Service Name</Label>
              <Input id="name" placeholder="e.g. Hair Cut, Facial" value={serviceForm.name}
                onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })} required className="h-9" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="duration">Duration (mins)</Label>
                <Input id="duration" type="number" min="5" max="480" placeholder="30" value={serviceForm.duration}
                  onChange={(e) => setServiceForm({ ...serviceForm, duration: e.target.value })} required className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="price">Price (PKR)</Label>
                <Input id="price" type="number" min="0" step="50" placeholder="1500" value={serviceForm.price}
                  onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })} required className="h-9" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setServiceDialogOpen(false)} size="sm">Cancel</Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90" size="sm" disabled={saving}>
                {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                {editingServiceId ? 'Update' : 'Add Service'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk Import/Export Modals */}
      <ServicesBulkModal
        open={serviceBulkOpen}
        onClose={() => setServiceBulkOpen(false)}
        ownerId={ownerId}
        existingServices={services}
        onSuccess={loadAll}
      />
      <DealsBulkModal
        open={dealBulkOpen}
        onClose={() => setDealBulkOpen(false)}
        ownerId={ownerId}
        existingDeals={deals}
        existingServices={services}
        onSuccess={loadAll}
      />

      {/* Deal Add/Edit Dialog */}
      <Dialog open={dealDialogOpen} onOpenChange={setDealDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="w-4 h-4 text-primary" />
              {editingDealId ? 'Edit Deal' : 'Create New Deal'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveDeal} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Deal Name *</Label>
              <Input placeholder="e.g. Groom Package" value={dealForm.name}
                onChange={(e) => setDealForm({ ...dealForm, name: e.target.value })} required className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input placeholder="e.g. Haircut + Beard Trim + Cleansing" value={dealForm.description}
                onChange={(e) => setDealForm({ ...dealForm, description: e.target.value })} className="h-9" />
            </div>

            {/* Services selection */}
            <div className="space-y-2">
              <Label>Included Services</Label>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2 max-h-48 overflow-y-auto">
                {services.map((s) => {
                  const selected = dealForm.service_ids.includes(s.id)
                  return (
                    <button key={s.id} type="button" onClick={() => toggleDealService(s.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
                        selected ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-700 hover:border-primary/40'
                      }`}>
                      <span>{s.name}</span>
                      <span className="text-xs opacity-75">{formatAmount(s.price)}</span>
                    </button>
                  )
                })}
              </div>
              {dealForm.service_ids.length > 0 && (
                <p className="text-xs text-gray-500">
                  Normal total: {formatAmount(services.filter(s => dealForm.service_ids.includes(s.id)).reduce((sum, s) => sum + s.price, 0))}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Deal Price (PKR) *</Label>
                <Input type="number" min="0" step="50" placeholder="1500" value={dealForm.price}
                  onChange={(e) => setDealForm({ ...dealForm, price: e.target.value })} required className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label>Valid for (days)</Label>
                <Input type="number" min="1" placeholder="e.g. 30" value={dealForm.validity_days}
                  onChange={(e) => setDealForm({ ...dealForm, validity_days: e.target.value })} className="h-9" />
              </div>
            </div>

            {dealForm.price && dealForm.service_ids.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Normal price</span>
                  <span className="line-through text-gray-400">
                    {formatAmount(services.filter(s => dealForm.service_ids.includes(s.id)).reduce((sum, s) => sum + s.price, 0))}
                  </span>
                </div>
                <div className="flex justify-between font-bold mt-1">
                  <span className="text-green-700">Deal price</span>
                  <span className="text-green-700">{formatAmount(parseFloat(dealForm.price) || 0)}</span>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDealDialogOpen(false)} size="sm">Cancel</Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90" size="sm" disabled={saving}>
                {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                {editingDealId ? 'Update Deal' : 'Create Deal'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

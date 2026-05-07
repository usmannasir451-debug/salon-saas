'use client'

import { useEffect, useState, useMemo } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useUserContext } from '@/components/RoleContext'
import type { InventoryItem, InventoryCategory, StockAdjustment } from '@/lib/types'
import {
  Package, Plus, Pencil, Trash2, Loader2, AlertTriangle, ArrowUpDown, CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const INVENTORY_CATEGORIES: { value: InventoryCategory; label: string }[] = [
  { value: 'hair_products', label: 'Hair Products' },
  { value: 'skin_products', label: 'Skin Products' },
  { value: 'tools', label: 'Tools' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'consumables', label: 'Consumables' },
]

const UNITS = ['pcs', 'ml', 'g', 'kg', 'L', 'box', 'pack', 'pair', 'set', 'bottle']

function formatCurrency(n: number, currency = 'USD') {
  return `${currency} ${Math.round(n).toLocaleString()}`
}

const catMap = Object.fromEntries(INVENTORY_CATEGORIES.map(c => [c.value, c.label]))

const emptyItemForm = {
  name: '',
  category: '' as InventoryCategory | '',
  quantity: '',
  unit: 'pcs',
  reorder_level: '',
  cost_price: '',
  supplier: '',
}

const emptyAdjForm = { adjustment: '', reason: '', adjusted_by: '' }

export default function InventoryPage() {
  const { ownerId } = useUserContext()

  const [items, setItems] = useState<InventoryItem[]>([])
  const [currency, setCurrency] = useState('USD')
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  const [itemDialogOpen, setItemDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [itemForm, setItemForm] = useState(emptyItemForm)
  const [saving, setSaving] = useState(false)

  const [adjDialogOpen, setAdjDialogOpen] = useState(false)
  const [adjItem, setAdjItem] = useState<InventoryItem | null>(null)
  const [adjForm, setAdjForm] = useState(emptyAdjForm)
  const [adjSaving, setAdjSaving] = useState(false)

  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([])

  useEffect(() => { loadAll() }, [ownerId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAll() {
    setLoading(true)
    const supabase = createClient()
    const [profileRes, itemsRes, adjRes] = await Promise.all([
      supabase.from('profiles').select('salon_currency').eq('id', ownerId).single(),
      supabase.from('inventory_items').select('*').eq('user_id', ownerId).order('name'),
      supabase.from('stock_adjustments').select('*').eq('user_id', ownerId)
        .order('created_at', { ascending: false }).limit(100),
    ])
    setCurrency(profileRes.data?.salon_currency ?? 'USD')
    setItems((itemsRes.data as InventoryItem[]) ?? [])
    setAdjustments((adjRes.data as StockAdjustment[]) ?? [])
    setLoading(false)
  }

  function openCreate() {
    setEditingId(null)
    setItemForm(emptyItemForm)
    setItemDialogOpen(true)
  }

  function openEdit(item: InventoryItem) {
    setEditingId(item.id)
    setItemForm({
      name: item.name,
      category: item.category,
      quantity: String(item.quantity),
      unit: item.unit,
      reorder_level: String(item.reorder_level),
      cost_price: String(item.cost_price),
      supplier: item.supplier ?? '',
    })
    setItemDialogOpen(true)
  }

  async function handleItemSave(e: React.FormEvent) {
    e.preventDefault()
    if (!itemForm.name.trim() || !itemForm.category || !itemForm.quantity || !itemForm.cost_price) {
      toast.error('Please fill required fields')
      return
    }
    setSaving(true)
    const supabase = createClient()
    const payload = {
      user_id: ownerId,
      name: itemForm.name.trim(),
      category: itemForm.category as InventoryCategory,
      quantity: parseFloat(itemForm.quantity),
      unit: itemForm.unit,
      reorder_level: parseFloat(itemForm.reorder_level || '0'),
      cost_price: parseFloat(itemForm.cost_price),
      supplier: itemForm.supplier.trim() || null,
    }
    if (editingId) {
      const { error } = await supabase.from('inventory_items').update(payload).eq('id', editingId)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Item updated')
    } else {
      const { error } = await supabase.from('inventory_items').insert(payload)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Item added')
    }
    setItemDialogOpen(false)
    await loadAll()
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this inventory item?')) return
    setDeleting(id)
    const supabase = createClient()
    const { error } = await supabase.from('inventory_items').delete().eq('id', id)
    if (error) toast.error(error.message)
    else toast.success('Item deleted')
    setDeleting(null)
    await loadAll()
  }

  function openAdjust(item: InventoryItem) {
    setAdjItem(item)
    setAdjForm(emptyAdjForm)
    setAdjDialogOpen(true)
  }

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault()
    if (!adjForm.adjustment || !adjForm.reason.trim() || !adjItem) {
      toast.error('Please fill required fields')
      return
    }
    setAdjSaving(true)
    const supabase = createClient()
    const adjustment = parseFloat(adjForm.adjustment)
    const newQty = Math.max(0, Number(adjItem.quantity) + adjustment)

    const [adjRes, updateRes] = await Promise.all([
      supabase.from('stock_adjustments').insert({
        user_id: ownerId,
        item_id: adjItem.id,
        adjustment,
        reason: adjForm.reason.trim(),
        adjusted_by: adjForm.adjusted_by.trim() || null,
      }),
      supabase.from('inventory_items').update({ quantity: newQty }).eq('id', adjItem.id),
    ])

    if (adjRes.error || updateRes.error) {
      toast.error(adjRes.error?.message ?? updateRes.error?.message ?? 'Error saving')
    } else {
      toast.success('Stock adjusted')
    }
    setAdjDialogOpen(false)
    setAdjSaving(false)
    await loadAll()
  }

  const totalValuation = useMemo(() =>
    items.reduce((s, i) => s + Number(i.quantity) * Number(i.cost_price), 0), [items])
  const lowStockItems = useMemo(() =>
    items.filter(i => Number(i.quantity) <= Number(i.reorder_level)), [items])

  const newQtyPreview = adjItem
    ? Math.max(0, Number(adjItem.quantity) + parseFloat(adjForm.adjustment || '0'))
    : 0

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          </div>
          <p className="text-gray-500 text-sm">Track products, stock levels, and valuations</p>
        </div>
        <Button onClick={openCreate} className="bg-primary hover:bg-primary/90 gap-2">
          <Plus className="w-4 h-4" /> Add Product
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-gray-100">
          <CardContent className="pt-5 pb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
              <Package className="w-5 h-5 text-primary" />
            </div>
            <p className="text-xl font-bold text-gray-900">{items.length}</p>
            <p className="text-xs text-gray-500">Total Products</p>
          </CardContent>
        </Card>
        <Card className="border-gray-100">
          <CardContent className="pt-5 pb-4">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center mb-3">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <p className="text-xl font-bold text-red-600">{lowStockItems.length}</p>
            <p className="text-xs text-gray-500">Low Stock</p>
          </CardContent>
        </Card>
        <Card className="border-gray-100 col-span-2">
          <CardContent className="pt-5 pb-4">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(totalValuation, currency)}</p>
            <p className="text-xs text-gray-500">Total Stock Value</p>
          </CardContent>
        </Card>
      </div>

      {/* Low stock alert banner */}
      {lowStockItems.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-sm font-semibold text-red-700">Low Stock — {lowStockItems.length} item(s) need restocking</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStockItems.map(item => (
              <Badge key={item.id} className="bg-red-100 text-red-700 border-red-200 text-xs">
                {item.name}: {item.quantity} {item.unit} left
              </Badge>
            ))}
          </div>
        </div>
      )}

      <Tabs defaultValue="items">
        <TabsList className="bg-gray-100">
          <TabsTrigger value="items">Products</TabsTrigger>
          <TabsTrigger value="history">Stock History</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="mt-4">
          <Card className="border-gray-100">
            <CardContent className="pt-4">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-10">
                  <Package className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-500">No products yet</p>
                  <Button onClick={openCreate} variant="outline" size="sm" className="mt-3">Add Product</Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map(item => {
                    const isLow = Number(item.quantity) <= Number(item.reorder_level)
                    const value = Number(item.quantity) * Number(item.cost_price)
                    return (
                      <div key={item.id}
                        className={`flex items-center gap-3 p-3 rounded-xl transition-colors group ${isLow ? 'bg-red-50 hover:bg-red-100/50' : 'bg-gray-50 hover:bg-gray-100/80'}`}>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isLow ? 'bg-red-100' : 'bg-primary/10'}`}>
                          <Package className={`w-4 h-4 ${isLow ? 'text-red-500' : 'text-primary'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                            <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-xs">{catMap[item.category]}</Badge>
                            {isLow && <Badge className="bg-red-100 text-red-600 border-red-200 text-xs">Low Stock</Badge>}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
                            <span>Qty: <span className={`font-medium ${isLow ? 'text-red-600' : 'text-gray-700'}`}>{item.quantity} {item.unit}</span></span>
                            <span>Reorder: {item.reorder_level} {item.unit}</span>
                            <span>Cost: {formatCurrency(Number(item.cost_price), currency)}</span>
                            <span>Value: {formatCurrency(value, currency)}</span>
                            {item.supplier && <span>Supplier: {item.supplier}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openAdjust(item)}
                            className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors" title="Adjust stock">
                            <ArrowUpDown className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => openEdit(item)}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(item.id)} disabled={deleting === item.id}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors">
                            {deleting === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card className="border-gray-100">
            <CardContent className="pt-4">
              {adjustments.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No adjustments yet</p>
              ) : (
                <div className="space-y-2">
                  {adjustments.map(adj => (
                    <div key={adj.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${Number(adj.adjustment) > 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                        <ArrowUpDown className={`w-3.5 h-3.5 ${Number(adj.adjustment) > 0 ? 'text-green-600' : 'text-red-600'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{adj.reason}</p>
                        <p className="text-xs text-gray-400">
                          {format(new Date(adj.created_at), 'MMM d, yyyy HH:mm')}
                          {adj.adjusted_by ? ` · ${adj.adjusted_by}` : ''}
                        </p>
                      </div>
                      <span className={`text-sm font-bold flex-shrink-0 ${Number(adj.adjustment) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {Number(adj.adjustment) > 0 ? '+' : ''}{adj.adjustment}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Item Dialog */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Product' : 'Add Product'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleItemSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Product Name *</Label>
              <Input value={itemForm.name} onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Shampoo Pro" />
            </div>
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Select value={itemForm.category} onValueChange={v => setItemForm(f => ({ ...f, category: v as InventoryCategory }))}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {INVENTORY_CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Quantity *</Label>
                <Input type="number" step="0.01" min="0" value={itemForm.quantity}
                  onChange={e => setItemForm(f => ({ ...f, quantity: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Select value={itemForm.unit} onValueChange={v => setItemForm(f => ({ ...f, unit: v || 'pcs' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Reorder Level</Label>
                <Input type="number" step="0.01" min="0" value={itemForm.reorder_level}
                  onChange={e => setItemForm(f => ({ ...f, reorder_level: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Cost Price *</Label>
                <Input type="number" step="0.01" min="0" value={itemForm.cost_price}
                  onChange={e => setItemForm(f => ({ ...f, cost_price: e.target.value }))} placeholder="0.00" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Supplier</Label>
              <Input value={itemForm.supplier} onChange={e => setItemForm(f => ({ ...f, supplier: e.target.value }))}
                placeholder="Supplier name" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setItemDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? 'Update' : 'Add Product'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Adjust Stock Dialog */}
      <Dialog open={adjDialogOpen} onOpenChange={setAdjDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adjust Stock — {adjItem?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdjust} className="space-y-4">
            <p className="text-sm text-gray-500">
              Current stock: <strong>{adjItem?.quantity} {adjItem?.unit}</strong>
            </p>
            <div className="space-y-1.5">
              <Label>Adjustment *</Label>
              <Input type="number" step="0.01" value={adjForm.adjustment}
                onChange={e => setAdjForm(f => ({ ...f, adjustment: e.target.value }))}
                placeholder="Use +10 to add, -5 to remove" />
              {adjForm.adjustment && (
                <p className="text-xs text-gray-400">
                  New quantity: <strong>{newQtyPreview} {adjItem?.unit}</strong>
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Reason *</Label>
              <Input value={adjForm.reason} onChange={e => setAdjForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="e.g. Used in service, restocked, damaged" />
            </div>
            <div className="space-y-1.5">
              <Label>Adjusted By</Label>
              <Input value={adjForm.adjusted_by} onChange={e => setAdjForm(f => ({ ...f, adjusted_by: e.target.value }))}
                placeholder="Staff name" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAdjDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={adjSaving}>
                {adjSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Adjust Stock'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

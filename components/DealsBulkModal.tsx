'use client'

import { useState, useRef } from 'react'
import Papa from 'papaparse'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { Service, Deal } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Upload, Download, CheckCircle, XCircle, Loader2, FileSpreadsheet } from 'lucide-react'

type DealWithServices = Deal & { deal_services?: { services: Service }[] }

type ParsedRow = {
  deal_name: string
  description: string
  price: string
  validity_days: string
  included_services: string
  _row: number
  _errors: string[]
  _serviceIds: string[]
}

type Result = { added: number; updated: number; errors: number }

function triggerDownload(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadDealTemplate() {
  const csv = Papa.unparse({
    fields: ['deal_name', 'description', 'price', 'validity_days', 'included_services'],
    data: [
      ['Groom Package', 'Haircut + Beard Trim', '1800', '30', 'Hair Cut,Beard Trim'],
      ['Bridal Glow', 'Facial + Hair Treatment', '4500', '60', 'Facial,Hair Treatment'],
    ],
  })
  triggerDownload(csv, 'deals_template.csv')
}

export function exportDeals(deals: DealWithServices[]) {
  if (deals.length === 0) { toast.error('No deals to export'); return }
  const csv = Papa.unparse(deals.map(d => ({
    deal_name: d.name,
    description: d.description ?? '',
    price: d.price,
    validity_days: d.validity_days ?? '',
    included_services: (d.deal_services ?? []).map(ds => ds.services?.name).filter(Boolean).join(','),
  })))
  triggerDownload(csv, 'deals_export.csv')
}

type Props = {
  open: boolean
  onClose: () => void
  ownerId: string
  existingDeals: DealWithServices[]
  existingServices: Service[]
  onSuccess: () => void
}

export function DealsBulkModal({ open, onClose, ownerId, existingDeals, existingServices, onSuccess }: Props) {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [result, setResult] = useState<Result | null>(null)
  const [progress, setProgress] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  function reset() { setStep('upload'); setRows([]); setResult(null); setProgress(0) }
  function handleClose() { reset(); onClose() }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const parsed = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: h => h.trim().toLowerCase().replace(/\s+/g, '_'),
      })
      const rows: ParsedRow[] = parsed.data.map((row, i) => {
        const errors: string[] = []
        const deal_name = row.deal_name?.trim() ?? ''
        const description = row.description?.trim() ?? ''
        const price = row.price?.trim() ?? ''
        const validity_days = row.validity_days?.trim() ?? ''
        const included_services = row.included_services?.trim() ?? ''

        if (!deal_name) errors.push('deal_name is required')
        if (price === '' || isNaN(Number(price)) || Number(price) < 0) errors.push('price must be a valid number')
        if (validity_days && (isNaN(Number(validity_days)) || Number(validity_days) <= 0)) errors.push('validity_days must be a positive number')

        const serviceIds: string[] = []
        if (included_services) {
          const names = included_services.split(',').map(n => n.trim()).filter(Boolean)
          for (const n of names) {
            const match = existingServices.find(s => s.name.toLowerCase() === n.toLowerCase())
            if (!match) {
              errors.push(`Service not found: "${n}"`)
            } else {
              serviceIds.push(match.id)
            }
          }
        }

        return { deal_name, description, price, validity_days, included_services, _row: i + 1, _errors: errors, _serviceIds: serviceIds }
      })
      setRows(rows)
      setStep('preview')
    }
    reader.readAsText(file)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleImport() {
    setStep('importing')
    setProgress(0)
    const valid = rows.filter(r => r._errors.length === 0)
    const supabase = createClient()
    let added = 0, updated = 0, errors = rows.filter(r => r._errors.length > 0).length

    for (let i = 0; i < valid.length; i++) {
      const row = valid[i]
      setProgress(Math.round(((i + 1) / valid.length) * 100))

      const payload = {
        name: row.deal_name,
        description: row.description || null,
        price: parseFloat(row.price),
        validity_days: row.validity_days ? parseInt(row.validity_days) : null,
        user_id: ownerId,
      }

      const existing = existingDeals.find(d => d.name.toLowerCase() === row.deal_name.toLowerCase())

      if (existing) {
        const { error } = await supabase.from('deals').update(payload).eq('id', existing.id)
        if (error) { errors++; continue }
        await supabase.from('deal_services').delete().eq('deal_id', existing.id)
        if (row._serviceIds.length > 0) {
          await supabase.from('deal_services').insert(
            row._serviceIds.map(sid => ({ deal_id: existing.id, service_id: sid, user_id: ownerId }))
          )
        }
        updated++
      } else {
        const { data: newDeal, error } = await supabase.from('deals').insert(payload).select('id').single()
        if (error || !newDeal) { errors++; continue }
        if (row._serviceIds.length > 0) {
          await supabase.from('deal_services').insert(
            row._serviceIds.map(sid => ({ deal_id: newDeal.id, service_id: sid, user_id: ownerId }))
          )
        }
        added++
      }
    }

    setResult({ added, updated, errors })
    setStep('done')
    if (added > 0 || updated > 0) onSuccess()
  }

  const validCount = rows.filter(r => r._errors.length === 0).length
  const invalidCount = rows.filter(r => r._errors.length > 0).length

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose() }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-primary" />
            Bulk Import / Export — Deals
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button onClick={downloadDealTemplate}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-primary/50 hover:bg-primary/5 transition-colors text-center">
                <Download className="w-6 h-6 text-primary" />
                <span className="text-sm font-medium text-gray-700">Download Template</span>
                <span className="text-xs text-gray-400">deal_name, price, services…</span>
              </button>
              <button onClick={() => exportDeals(existingDeals)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-green-500/50 hover:bg-green-50 transition-colors text-center">
                <Download className="w-6 h-6 text-green-600" />
                <span className="text-sm font-medium text-gray-700">Export Current</span>
                <span className="text-xs text-gray-400">{existingDeals.length} deals</span>
              </button>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700">
              <strong>Tip:</strong> The <code className="bg-amber-100 px-1 rounded">included_services</code> column must contain comma-separated service names that exactly match your existing services.
            </div>
            <div className="border-t pt-4">
              <label className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed border-gray-200 hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer">
                <Upload className="w-8 h-8 text-gray-400" />
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700">Click to upload CSV</p>
                  <p className="text-xs text-gray-400 mt-1">Must match template columns</p>
                </div>
                <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
              </label>
            </div>
            <p className="text-xs text-gray-500">Existing deals matched by name will be updated. New deal names will be created.</p>
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={handleClose}>Cancel</Button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge className="bg-green-50 text-green-700 border-green-200">{validCount} valid</Badge>
              {invalidCount > 0 && <Badge className="bg-red-50 text-red-700 border-red-200">{invalidCount} with errors</Badge>}
              <span className="text-xs text-gray-500">{rows.length} rows total</span>
            </div>

            <div className="rounded-xl border border-gray-200 overflow-x-auto max-h-64">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    {['#', 'Deal Name', 'Price', 'Valid (days)', 'Services', 'Status'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row._row} className={row._errors.length > 0 ? 'bg-red-50' : 'hover:bg-gray-50'}>
                      <td className="px-3 py-1.5 text-gray-400">{row._row}</td>
                      <td className="px-3 py-1.5 text-gray-700">{row.deal_name || <span className="text-red-400 italic">missing</span>}</td>
                      <td className="px-3 py-1.5 text-gray-700">{row.price}</td>
                      <td className="px-3 py-1.5 text-gray-500">{row.validity_days || '—'}</td>
                      <td className="px-3 py-1.5 text-gray-500 max-w-[120px] truncate">{row.included_services || '—'}</td>
                      <td className="px-3 py-1.5">
                        {row._errors.length > 0
                          ? <span className="text-red-600 flex items-center gap-1"><XCircle className="w-3 h-3 flex-shrink-0" />{row._errors[0]}</span>
                          : <span className="text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" />OK</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" size="sm" onClick={() => setStep('upload')}>Back</Button>
              <Button onClick={handleImport} disabled={validCount === 0} className="bg-primary hover:bg-primary/90" size="sm">
                Import {validCount} Deal{validCount !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="py-10 flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-gray-600">Importing deals…</p>
            <div className="w-full bg-gray-100 rounded-full h-2 max-w-xs">
              <div className="bg-primary h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-gray-400">{progress}%</p>
          </div>
        )}

        {step === 'done' && result && (
          <div className="py-6 flex flex-col items-center gap-4">
            <CheckCircle className="w-10 h-10 text-green-500" />
            <h3 className="text-base font-semibold text-gray-900">Import Complete</h3>
            <div className="grid grid-cols-3 gap-3 w-full">
              <div className="text-center p-3 rounded-xl bg-green-50 border border-green-100">
                <p className="text-2xl font-bold text-green-700">{result.added}</p>
                <p className="text-xs text-green-600">Added</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-blue-50 border border-blue-100">
                <p className="text-2xl font-bold text-blue-700">{result.updated}</p>
                <p className="text-xs text-blue-600">Updated</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-red-50 border border-red-100">
                <p className="text-2xl font-bold text-red-700">{result.errors}</p>
                <p className="text-xs text-red-600">Errors / Skipped</p>
              </div>
            </div>
            <Button onClick={handleClose} className="bg-primary hover:bg-primary/90" size="sm">Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

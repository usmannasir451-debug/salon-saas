'use client'

import { useState, useRef } from 'react'
import Papa from 'papaparse'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { Service } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Upload, Download, CheckCircle, XCircle, Loader2, FileSpreadsheet } from 'lucide-react'

type ImportMode = 'add_only' | 'add_update'

type ParsedRow = {
  name: string
  duration_minutes: string
  price: string
  _row: number
  _errors: string[]
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

export function downloadServiceTemplate() {
  const csv = Papa.unparse({
    fields: ['name', 'duration_minutes', 'price'],
    data: [
      ['Hair Cut', '30', '1500'],
      ['Facial', '60', '2500'],
      ['Beard Trim', '20', '500'],
    ],
  })
  triggerDownload(csv, 'services_template.csv')
}

export function exportServices(services: Service[]) {
  if (services.length === 0) { toast.error('No services to export'); return }
  const csv = Papa.unparse(services.map(s => ({ name: s.name, duration_minutes: s.duration, price: s.price })))
  triggerDownload(csv, 'services_export.csv')
}

type Props = {
  open: boolean
  onClose: () => void
  ownerId: string
  existingServices: Service[]
  onSuccess: () => void
}

export function ServicesBulkModal({ open, onClose, ownerId, existingServices, onSuccess }: Props) {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [mode, setMode] = useState<ImportMode>('add_only')
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
        const name = row.name?.trim() ?? ''
        const dur = row.duration_minutes?.trim() ?? ''
        const price = row.price?.trim() ?? ''
        if (!name) errors.push('Name is required')
        if (!dur || isNaN(Number(dur)) || Number(dur) <= 0) errors.push('Duration must be a positive number')
        if (price === '' || isNaN(Number(price)) || Number(price) < 0) errors.push('Price must be a valid number')
        return { name, duration_minutes: dur, price, _row: i + 1, _errors: errors }
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
      const existing = existingServices.find(s => s.name.toLowerCase() === row.name.toLowerCase())
      const payload = { name: row.name, duration: parseInt(row.duration_minutes), price: parseFloat(row.price), user_id: ownerId }
      if (existing) {
        if (mode === 'add_update') {
          const { error } = await supabase.from('services').update(payload).eq('id', existing.id)
          error ? errors++ : updated++
        }
      } else {
        const { error } = await supabase.from('services').insert(payload)
        error ? errors++ : added++
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
            Bulk Import / Export — Services
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button onClick={downloadServiceTemplate}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-primary/50 hover:bg-primary/5 transition-colors text-center">
                <Download className="w-6 h-6 text-primary" />
                <span className="text-sm font-medium text-gray-700">Download Template</span>
                <span className="text-xs text-gray-400">name, duration_minutes, price</span>
              </button>
              <button onClick={() => exportServices(existingServices)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-green-500/50 hover:bg-green-50 transition-colors text-center">
                <Download className="w-6 h-6 text-green-600" />
                <span className="text-sm font-medium text-gray-700">Export Current</span>
                <span className="text-xs text-gray-400">{existingServices.length} services</span>
              </button>
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

            <div className="flex gap-2">
              {(['add_only', 'add_update'] as ImportMode[]).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm border transition-colors ${mode === m ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-primary/40'}`}>
                  {m === 'add_only' ? 'Add New Only' : 'Add & Update'}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              {mode === 'add_only'
                ? 'Only services with new names will be added. Existing names are skipped.'
                : 'New services are added. Existing services (matched by name) will be updated.'}
            </p>

            <div className="rounded-xl border border-gray-200 overflow-x-auto max-h-64">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    {['#', 'Name', 'Duration (min)', 'Price', 'Status'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row._row} className={row._errors.length > 0 ? 'bg-red-50' : 'hover:bg-gray-50'}>
                      <td className="px-3 py-1.5 text-gray-400">{row._row}</td>
                      <td className="px-3 py-1.5 text-gray-700">{row.name || <span className="text-red-400 italic">missing</span>}</td>
                      <td className="px-3 py-1.5 text-gray-700">{row.duration_minutes}</td>
                      <td className="px-3 py-1.5 text-gray-700">{row.price}</td>
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
                Import {validCount} Service{validCount !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="py-10 flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-gray-600">Importing services…</p>
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

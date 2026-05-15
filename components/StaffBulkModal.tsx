'use client'

import { useState, useRef } from 'react'
import Papa from 'papaparse'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { StaffMember } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Upload, Download, CheckCircle, XCircle, Loader2, FileSpreadsheet } from 'lucide-react'

const VALID_SALARY_TYPES = ['fixed', 'commission', 'both']
const VALID_GENDERS = ['male', 'female', 'other', '']
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

type ImportMode = 'add_only' | 'add_update'

type ParsedRow = {
  full_name: string
  phone: string
  designation: string
  gender: string
  date_of_joining: string
  salary_type: string
  fixed_amount: string
  commission_percentage: string
  leave_allowance: string
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

export function downloadStaffTemplate() {
  const csv = Papa.unparse({
    fields: ['full_name', 'phone', 'designation', 'gender', 'date_of_joining', 'salary_type', 'fixed_amount', 'commission_percentage', 'leave_allowance'],
    data: [
      ['Sarah Johnson', '+1-555-0123', 'Senior Stylist', 'female', '2024-01-15', 'fixed', '50000', '0', '1'],
      ['Ali Hassan', '+92-300-1234567', 'Barber', 'male', '2023-06-01', 'commission', '0', '10', '1.5'],
      ['Maya Patel', '+44-7700-900123', 'Receptionist', 'female', '2024-03-10', 'both', '30000', '5', '1'],
    ],
  })
  triggerDownload(csv, 'staff_template.csv')
}

export function exportStaff(staff: StaffMember[]) {
  if (staff.length === 0) { toast.error('No staff to export'); return }
  const csv = Papa.unparse(staff.map(s => ({
    full_name: s.name,
    phone: s.phone,
    designation: s.designation ?? '',
    gender: s.gender ?? '',
    date_of_joining: s.joining_date ?? '',
    salary_type: s.salary_type ?? 'fixed',
    fixed_amount: s.fixed_amount ?? 0,
    commission_percentage: s.commission_percentage ?? 0,
    leave_allowance: s.leave_allowance ?? '',
  })))
  triggerDownload(csv, 'staff_export.csv')
}

type Props = {
  open: boolean
  onClose: () => void
  ownerId: string
  existingStaff: StaffMember[]
  staffLimit: number | null
  onSuccess: () => void
}

export function StaffBulkModal({ open, onClose, ownerId, existingStaff, staffLimit, onSuccess }: Props) {
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
        const full_name = row.full_name?.trim() ?? ''
        const phone = row.phone?.trim() ?? ''
        const designation = row.designation?.trim() ?? ''
        const gender = row.gender?.trim().toLowerCase() ?? ''
        const date_of_joining = row.date_of_joining?.trim() ?? ''
        const salary_type = row.salary_type?.trim().toLowerCase() ?? ''
        const fixed_amount = row.fixed_amount?.trim() ?? ''
        const commission_percentage = row.commission_percentage?.trim() ?? ''
        const leave_allowance = row.leave_allowance?.trim() ?? ''

        if (!full_name) errors.push('full_name is required')
        if (!phone) errors.push('phone is required')
        if (!VALID_SALARY_TYPES.includes(salary_type)) errors.push(`salary_type must be: fixed, commission, or both`)
        if (gender && !VALID_GENDERS.includes(gender)) errors.push('gender must be: male, female, or other')
        if (date_of_joining && !DATE_RE.test(date_of_joining)) errors.push('date_of_joining must be YYYY-MM-DD')
        if (fixed_amount && isNaN(Number(fixed_amount))) errors.push('fixed_amount must be a number')
        if (commission_percentage && isNaN(Number(commission_percentage))) errors.push('commission_percentage must be a number')
        if (leave_allowance && isNaN(Number(leave_allowance))) errors.push('leave_allowance must be a number')

        return { full_name, phone, designation, gender, date_of_joining, salary_type, fixed_amount, commission_percentage, leave_allowance, _row: i + 1, _errors: errors }
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

    const activeCount = existingStaff.filter(s => s.is_active).length
    const limit = staffLimit ?? 999

    for (let i = 0; i < valid.length; i++) {
      const row = valid[i]
      setProgress(Math.round(((i + 1) / valid.length) * 100))

      const existing = existingStaff.find(s => s.phone === row.phone)

      const payload = {
        name: row.full_name,
        phone: row.phone,
        designation: row.designation || null,
        gender: (['male', 'female', 'other'].includes(row.gender) ? row.gender : null) as 'male' | 'female' | 'other' | null,
        joining_date: row.date_of_joining || null,
        salary_type: row.salary_type as 'fixed' | 'commission' | 'both',
        fixed_amount: row.fixed_amount ? parseFloat(row.fixed_amount) : 0,
        commission_percentage: row.commission_percentage ? parseFloat(row.commission_percentage) : 0,
        leave_allowance: row.leave_allowance ? parseFloat(row.leave_allowance) : null,
        is_active: true,
        user_id: ownerId,
      }

      if (existing) {
        if (mode === 'add_update') {
          const { error } = await supabase.from('staff').update(payload).eq('id', existing.id)
          error ? errors++ : updated++
        }
      } else {
        if (activeCount + added >= limit) {
          errors++
          continue
        }
        const { error } = await supabase.from('staff').insert(payload)
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
            Bulk Import / Export — Staff
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button onClick={downloadStaffTemplate}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-primary/50 hover:bg-primary/5 transition-colors text-center">
                <Download className="w-6 h-6 text-primary" />
                <span className="text-sm font-medium text-gray-700">Download Template</span>
                <span className="text-xs text-gray-400">full_name, phone, salary…</span>
              </button>
              <button onClick={() => exportStaff(existingStaff)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-green-500/50 hover:bg-green-50 transition-colors text-center">
                <Download className="w-6 h-6 text-green-600" />
                <span className="text-sm font-medium text-gray-700">Export Current</span>
                <span className="text-xs text-gray-400">{existingStaff.length} staff members</span>
              </button>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700">
              <strong>Tip:</strong> Staff are matched by <strong>phone number</strong>. Existing staff with the same phone will be updated in Add &amp; Update mode.
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
                ? 'Only staff with new phone numbers will be added. Existing phone numbers are skipped.'
                : 'New staff are added. Existing staff (matched by phone) will be updated.'}
            </p>

            <div className="rounded-xl border border-gray-200 overflow-x-auto max-h-64">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    {['#', 'Name', 'Phone', 'Designation', 'Salary Type', 'Status'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row._row} className={row._errors.length > 0 ? 'bg-red-50' : 'hover:bg-gray-50'}>
                      <td className="px-3 py-1.5 text-gray-400">{row._row}</td>
                      <td className="px-3 py-1.5 text-gray-700">{row.full_name || <span className="text-red-400 italic">missing</span>}</td>
                      <td className="px-3 py-1.5 text-gray-600">{row.phone || <span className="text-red-400 italic">missing</span>}</td>
                      <td className="px-3 py-1.5 text-gray-500">{row.designation || '—'}</td>
                      <td className="px-3 py-1.5 text-gray-500">{row.salary_type}</td>
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
                Import {validCount} Staff Member{validCount !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="py-10 flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-gray-600">Importing staff…</p>
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

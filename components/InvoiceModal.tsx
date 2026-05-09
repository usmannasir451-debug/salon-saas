'use client'

import { useRef } from 'react'
import { format } from 'date-fns'
import { Download, Printer, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export interface InvoiceData {
  id: string
  invoiceType: 'appointment' | 'walkin'
  salonName: string
  salonAddress?: string
  salonPhone?: string
  salonLogoUrl?: string
  clientName?: string
  clientPhone?: string
  staffName?: string
  serviceName?: string
  date: string
  time?: string
  subtotal: number
  discountAmount?: number
  discountLabel?: string
  taxPercentage?: number
  total: number
  paymentMethod?: string
  currency?: string
}

function formatMoney(n: number, currency = 'PKR') {
  return `${currency} ${Math.round(n).toLocaleString()}`
}

function InvoicePrintArea({ data }: { data: InvoiceData }) {
  const tax = data.taxPercentage && data.taxPercentage > 0
    ? (data.subtotal - (data.discountAmount ?? 0)) * (data.taxPercentage / 100)
    : 0
  const currency = data.currency ?? 'PKR'

  return (
    <div id="invoice-print-area" className="bg-white font-sans text-gray-900 max-w-sm mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-6 pb-4 border-b border-gray-200">
        {data.salonLogoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.salonLogoUrl} alt="Logo" className="w-14 h-14 object-contain mx-auto mb-2 rounded" />
        )}
        <h1 className="text-xl font-bold text-gray-900">{data.salonName}</h1>
        {data.salonAddress && <p className="text-xs text-gray-500 mt-0.5">{data.salonAddress}</p>}
        {data.salonPhone && <p className="text-xs text-gray-500">{data.salonPhone}</p>}
      </div>

      {/* Invoice Meta */}
      <div className="flex justify-between text-xs text-gray-500 mb-4">
        <div>
          <p className="font-semibold text-gray-700">INVOICE</p>
          <p>#{data.id.slice(-8).toUpperCase()}</p>
        </div>
        <div className="text-right">
          <p>{format(new Date(data.date + 'T00:00:00'), 'MMM d, yyyy')}</p>
          {data.time && <p>{data.time.slice(0, 5)}</p>}
        </div>
      </div>

      {/* Client Info */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg text-xs space-y-1">
        <p className="font-semibold text-gray-700 text-xs uppercase tracking-wide mb-1.5">Bill To</p>
        <p className="font-medium text-gray-900">{data.clientName || 'Walk-In Client'}</p>
        {data.clientPhone && <p className="text-gray-500">{data.clientPhone}</p>}
      </div>

      {/* Services */}
      <div className="mb-4">
        <p className="font-semibold text-gray-700 text-xs uppercase tracking-wide mb-2">Services</p>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <div>
              <p className="font-medium">{data.serviceName ?? 'Service'}</p>
              {data.staffName && <p className="text-xs text-gray-400">by {data.staffName}</p>}
            </div>
            <p className="font-medium">{formatMoney(data.subtotal, currency)}</p>
          </div>
        </div>
      </div>

      {/* Totals */}
      <div className="border-t border-gray-200 pt-3 space-y-1.5 text-sm">
        <div className="flex justify-between text-gray-600">
          <span>Subtotal</span>
          <span>{formatMoney(data.subtotal, currency)}</span>
        </div>
        {(data.discountAmount ?? 0) > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Discount{data.discountLabel ? ` (${data.discountLabel})` : ''}</span>
            <span>-{formatMoney(data.discountAmount!, currency)}</span>
          </div>
        )}
        {tax > 0 && (
          <div className="flex justify-between text-gray-600">
            <span>Tax ({data.taxPercentage}%)</span>
            <span>{formatMoney(tax, currency)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-base border-t border-gray-300 pt-2 mt-2">
          <span>Total</span>
          <span className="text-primary">{formatMoney(data.total + tax, currency)}</span>
        </div>
        {data.paymentMethod && (
          <div className="flex justify-between text-xs text-gray-500 pt-1">
            <span>Payment Method</span>
            <span className="capitalize">{data.paymentMethod}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-dashed border-gray-200 text-center text-xs text-gray-400 space-y-1">
        <p>Thank you for choosing {data.salonName}!</p>
        <p className="text-[10px]">Powered by Snipforce</p>
      </div>
    </div>
  )
}

interface InvoiceModalProps {
  open: boolean
  onClose: () => void
  data: InvoiceData | null
}

export default function InvoiceModal({ open, onClose, data }: InvoiceModalProps) {
  const printRef = useRef<HTMLDivElement>(null)

  function handlePrint() {
    const content = document.getElementById('invoice-print-area')
    if (!content) return
    const win = window.open('', '_blank', 'width=600,height=800')
    if (!win) return
    win.document.write(`
      <html><head><title>Invoice</title>
      <style>
        body { font-family: sans-serif; margin: 0; padding: 20px; color: #111; }
        * { box-sizing: border-box; }
      </style>
      </head><body>${content.innerHTML}</body></html>
    `)
    win.document.close()
    win.focus()
    win.print()
    win.close()
  }

  async function handleDownloadPDF() {
    if (!data) return
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ format: 'a5', orientation: 'portrait' })
    const currency = data.currency ?? 'PKR'
    const tax = data.taxPercentage && data.taxPercentage > 0
      ? (data.subtotal - (data.discountAmount ?? 0)) * (data.taxPercentage / 100)
      : 0

    let y = 20

    // Header
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text(data.salonName, 74, y, { align: 'center' })
    y += 7

    if (data.salonAddress) {
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100)
      doc.text(data.salonAddress, 74, y, { align: 'center' })
      y += 5
    }
    if (data.salonPhone) {
      doc.text(data.salonPhone, 74, y, { align: 'center' })
      y += 5
    }

    y += 4
    doc.setDrawColor(200)
    doc.line(15, y, 133, y)
    y += 6

    // Invoice meta
    doc.setFontSize(10)
    doc.setTextColor(50)
    doc.setFont('helvetica', 'bold')
    doc.text('INVOICE', 15, y)
    doc.setFont('helvetica', 'normal')
    doc.text(`#${data.id.slice(-8).toUpperCase()}`, 15, y + 5)
    doc.text(format(new Date(data.date + 'T00:00:00'), 'MMM d, yyyy'), 133, y, { align: 'right' })
    if (data.time) doc.text(data.time.slice(0, 5), 133, y + 5, { align: 'right' })
    y += 14

    // Client
    doc.setFillColor(248, 248, 248)
    doc.roundedRect(15, y, 118, 20, 2, 2, 'F')
    doc.setFontSize(8)
    doc.setTextColor(120)
    doc.text('BILL TO', 20, y + 7)
    doc.setFontSize(10)
    doc.setTextColor(30)
    doc.setFont('helvetica', 'bold')
    doc.text(data.clientName || 'Walk-In Client', 20, y + 14)
    if (data.clientPhone) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(100)
      doc.text(data.clientPhone, 20, y + 19)
    }
    y += 26

    // Service
    doc.setFontSize(9)
    doc.setTextColor(80)
    doc.text('SERVICE', 15, y)
    y += 5
    doc.line(15, y, 133, y)
    y += 5
    doc.setFontSize(10)
    doc.setTextColor(30)
    doc.setFont('helvetica', 'bold')
    doc.text(data.serviceName ?? 'Service', 15, y)
    doc.text(formatMoney(data.subtotal, currency), 133, y, { align: 'right' })
    if (data.staffName) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(100)
      doc.text(`by ${data.staffName}`, 15, y + 5)
      y += 5
    }
    y += 10

    // Totals
    doc.setDrawColor(200)
    doc.line(15, y, 133, y)
    y += 7

    const rows: [string, string][] = [
      ['Subtotal', formatMoney(data.subtotal, currency)],
    ]
    if ((data.discountAmount ?? 0) > 0) {
      rows.push([`Discount${data.discountLabel ? ` (${data.discountLabel})` : ''}`, `-${formatMoney(data.discountAmount!, currency)}`])
    }
    if (tax > 0) {
      rows.push([`Tax (${data.taxPercentage}%)`, formatMoney(tax, currency)])
    }

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(80)
    rows.forEach(([label, value]) => {
      doc.text(label, 15, y)
      doc.text(value, 133, y, { align: 'right' })
      y += 7
    })

    doc.line(15, y, 133, y)
    y += 7
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(30)
    doc.text('Total', 15, y)
    doc.text(formatMoney(data.total + tax, currency), 133, y, { align: 'right' })
    y += 8

    if (data.paymentMethod) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(120)
      doc.text(`Payment: ${data.paymentMethod}`, 15, y)
      y += 7
    }

    // Footer
    y += 5
    doc.setDrawColor(200)
    doc.setLineDashPattern([2, 2], 0)
    doc.line(15, y, 133, y)
    y += 8
    doc.setFontSize(9)
    doc.setTextColor(150)
    doc.text(`Thank you for choosing ${data.salonName}!`, 74, y, { align: 'center' })
    y += 5
    doc.setFontSize(8)
    doc.text('Powered by Snipforce', 74, y, { align: 'center' })

    doc.save(`invoice-${data.id.slice(-8)}.pdf`)
  }

  if (!data) return null

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Invoice</DialogTitle>
          </div>
        </DialogHeader>

        <div ref={printRef}>
          <InvoicePrintArea data={data} />
        </div>

        <div className="flex gap-2 pt-2 border-t border-gray-100">
          <Button variant="outline" className="flex-1 gap-2" onClick={handlePrint}>
            <Printer className="w-4 h-4" />
            Print
          </Button>
          <Button className="flex-1 gap-2 bg-primary hover:bg-primary/90" onClick={handleDownloadPDF}>
            <Download className="w-4 h-4" />
            Download PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

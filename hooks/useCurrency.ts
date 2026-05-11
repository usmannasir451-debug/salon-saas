'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUserContext } from '@/components/RoleContext'

const CURRENCY_SYMBOLS: Record<string, string> = {
  PKR: '₨',
  USD: '$',
  AED: 'د.إ',
  SAR: '﷼',
  GBP: '£',
  EUR: '€',
  CAD: 'CA$',
  AUD: 'A$',
  INR: '₹',
  SGD: 'S$',
}

const CURRENCY_DECIMALS: Record<string, number> = {
  PKR: 0,
  INR: 0,
  SAR: 0,
  AED: 0,
  USD: 2,
  GBP: 2,
  EUR: 2,
  CAD: 2,
  AUD: 2,
  SGD: 2,
}

export function useCurrency() {
  const { ownerId } = useUserContext()
  const [currency, setCurrency] = useState('PKR')

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('profiles')
      .select('salon_currency')
      .eq('id', ownerId)
      .single()
      .then(({ data }) => {
        if (data?.salon_currency) setCurrency(data.salon_currency)
      })
  }, [ownerId])

  function formatAmount(n: number): string {
    const symbol = CURRENCY_SYMBOLS[currency] ?? currency
    const decimals = CURRENCY_DECIMALS[currency] ?? 0
    const value = decimals === 0 ? Math.round(n) : n
    return `${symbol} ${value.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`
  }

  return { currency, formatAmount }
}

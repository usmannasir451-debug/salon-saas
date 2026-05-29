'use client'

import { useEffect } from 'react'

export default function BrandColorApplier({ primaryColor }: { primaryColor?: string | null }) {
  useEffect(() => {
    const color = primaryColor?.trim() || '#e11d48'
    const root = document.documentElement
    root.style.setProperty('--primary', color)
    root.style.setProperty('--ring', color)
    root.style.setProperty('--sidebar-primary', color)
    root.style.setProperty('--sidebar-ring', color)
    root.style.setProperty('--chart-1', color)
  }, [primaryColor])

  return null
}

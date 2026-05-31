'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import {
  Scissors, Check, Calendar, Zap, Package, TrendingUp,
  Users, X, Loader2, ArrowRight, BarChart2, Shield,
  Smartphone, Globe, MapPin, Star, Crown, ChevronRight,
  Menu, Banknote, ClipboardList, Gift,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type DemoForm = {
  name: string
  phone: string
  salonName: string
  branches: string
  city: string
  source: string
}

const emptyForm: DemoForm = {
  name: '', phone: '', salonName: '', branches: '', city: '', source: '',
}

// ─── Data ────────────────────────────────────────────────────────────────────

const FEATURES_TABS = [
  {
    id: 'appointments',
    icon: Calendar,
    label: 'Smart Appointments',
    desc: 'Calendar-style booking with drag-and-drop scheduling, staff assignment, and automated reminders. Eliminate double-bookings forever.',
    mockupBg: '#f0fdf4',
    mockupAccent: '#16a34a',
  },
  {
    id: 'walkin',
    icon: Zap,
    label: 'Walk-In POS',
    desc: 'Instant checkout with multi-service selection, multiple payment methods, loyalty redemption, and real-time receipt generation.',
    mockupBg: '#fdf4ff',
    mockupAccent: '#9333ea',
  },
  {
    id: 'staff',
    icon: Users,
    label: 'Staff Management',
    desc: 'Performance tracking, attendance, commission-based payroll, and role-based access — all in one place.',
    mockupBg: '#eff6ff',
    mockupAccent: '#2563eb',
  },
  {
    id: 'loyalty',
    icon: Star,
    label: 'Client Loyalty',
    desc: 'Earn and redeem loyalty points, membership plans, and service packages to keep clients coming back.',
    mockupBg: '#fefce8',
    mockupAccent: '#ca8a04',
  },
  {
    id: 'inventory',
    icon: Package,
    label: 'Inventory Control',
    desc: 'Track stock levels, set reorder alerts, and log stock adjustments. Never run out of essentials again.',
    mockupBg: '#fff7ed',
    mockupAccent: '#ea580c',
  },
  {
    id: 'reports',
    icon: BarChart2,
    label: 'Financial Reports',
    desc: 'P&L statements, revenue breakdowns, expense tracking, and 6-month trend analysis with one-click PDF export.',
    mockupBg: '#f0fdf4',
    mockupAccent: '#059669',
  },
  {
    id: 'branches',
    icon: MapPin,
    label: 'Multi-Branch',
    desc: 'Manage all locations from a single dashboard. Branch-level filtering on every report and metric.',
    mockupBg: '#fdf2f8',
    mockupAccent: '#db2777',
  },
  {
    id: 'access',
    icon: Shield,
    label: 'Role-Based Access',
    desc: 'Owner, manager, receptionist, cashier, and staff roles with granular permission controls per team member.',
    mockupBg: '#f8fafc',
    mockupAccent: '#475569',
  },
]

const CHECKLIST_ITEMS = [
  'Appointment booking & calendar',
  'Walk-in POS system',
  'Staff management & attendance',
  'Client profiles & loyalty points',
  'Membership & package plans',
  'Inventory management',
  'Expense tracking',
  'Payroll & commissions',
  'Profit & Loss reports',
  'Multi-branch support',
  'Role-based team access',
  'White-label branding',
  'Dark & light mode',
  'Mobile responsive',
  'PDF invoices & reports',
]

const PRICING = [
  {
    name: 'Starter',
    price: '$49',
    period: '/month',
    desc: 'Perfect for a single-location salon',
    highlight: false,
    features: ['1 Branch', 'Up to 10 Staff', 'All core features', 'Email support'],
  },
  {
    name: 'Growth',
    price: '$100',
    period: '/month',
    desc: 'Ideal for growing multi-location salons',
    highlight: true,
    features: ['Up to 3 Branches', 'Up to 30 Staff', 'All features + reports', 'Priority support'],
  },
  {
    name: 'Enterprise',
    price: '$200',
    period: '/month',
    desc: 'For large chains with unlimited scale',
    highlight: false,
    features: ['Unlimited Branches', 'Unlimited Staff', 'All features + analytics', 'Dedicated support'],
  },
]

const TESTIMONIALS = [
  {
    name: 'Aisha Khan',
    salon: 'Bloom Beauty Studio, Lahore',
    quote: 'Snipforce completely transformed how we manage appointments. No more double-bookings — our staff love it and clients get better service.',
    stars: 5,
  },
  {
    name: 'Sara Ahmed',
    salon: 'Luxe Hair & Spa, Karachi',
    quote: 'The walk-in POS and loyalty system are game changers. We\'ve seen a 30% increase in repeat clients since switching to Snipforce.',
    stars: 5,
  },
  {
    name: 'Nadia Hassan',
    salon: 'Serenity Spa, Dubai',
    quote: 'White-label branding makes our salon stand out. Our clients see our logo and colors everywhere — it feels truly professional.',
    stars: 5,
  },
]

const SALON_NAMES = [
  'Bloom Beauty Studio', 'Luxe Hair & Spa', 'The Glam Room', 'Serenity Spa',
  'Crown & Scissors', 'Velvet Salon', 'Pure Aesthetics', 'Elite Hair Lounge',
  'Radiance Beauty', 'Studio 99', 'The Mane Event', 'Bella Vita Spa',
  'Chic Cuts', 'Prestige Salon', 'Golden Shears', 'Zen Beauty Bar',
]

const ORG_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Snipforce',
  url: 'https://snip-force.com',
  description: 'All-in-one salon and spa management software platform.',
  areaServed: ['PK', 'AE', 'SA', 'GB', 'US'],
  address: { '@type': 'PostalAddress', addressCountry: 'PK' },
}

const SOFTWARE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Snipforce',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: 'https://snip-force.com',
  description: 'All-in-one salon and spa management platform.',
  offers: { '@type': 'AggregateOffer', lowPrice: '49', highPrice: '200', priceCurrency: 'USD', offerCount: 3 },
}

// ─── Dashboard Mockup Component ───────────────────────────────────────────────

function DashboardMockup() {
  return (
    <div className="mockup-float relative">
      <div style={{ borderRadius: 12, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0', background: '#fff' }}>
        {/* Browser chrome */}
        <div style={{ background: '#f8fafc', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 7, borderBottom: '1px solid #e2e8f0' }}>
          {['#ef4444','#f59e0b','#22c55e'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
          <div style={{ flex: 1, margin: '0 10px', background: '#e2e8f0', borderRadius: 5, padding: '3px 10px', fontSize: 10, color: '#94a3b8', textAlign: 'center' }}>
            app.snip-force.com/dashboard
          </div>
        </div>
        {/* App */}
        <div style={{ display: 'flex', minHeight: 320, background: '#f8fafc' }}>
          {/* Sidebar */}
          <div style={{ width: 140, background: '#fff', borderRight: '1px solid #f1f5f9', padding: '12px 8px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
              <div style={{ width: 20, height: 20, background: 'linear-gradient(135deg,#e11d48,#f43f5e)', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Scissors style={{ width: 10, height: 10, color: '#fff' }} />
              </div>
              <span style={{ fontSize: 9, fontWeight: 800, color: '#111' }}>Snipforce</span>
            </div>
            {[
              { label: 'Dashboard', active: true },
              { label: 'Appointments', active: false },
              { label: 'Walk-In POS', active: false },
              { label: 'Clients', active: false },
              { label: 'Staff', active: false },
              { label: 'Reports', active: false },
            ].map(item => (
              <div key={item.label} style={{ padding: '5px 8px', borderRadius: 6, marginBottom: 2, background: item.active ? '#fff1f2' : 'transparent', color: item.active ? '#e11d48' : '#6b7280', fontSize: 8, fontWeight: item.active ? 700 : 400 }}>
                {item.label}
              </div>
            ))}
          </div>
          {/* Content */}
          <div style={{ flex: 1, padding: 12, minWidth: 0 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#111', marginBottom: 8 }}>Good morning, Bloom Studio 👋</div>
            {/* KPI cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
              {[
                { label: 'Total Sales', value: 'PKR 48,200', color: '#e11d48', bg: '#fff1f2' },
                { label: 'Appointments', value: '24', color: '#7c3aed', bg: '#f5f3ff' },
                { label: 'Walk-Ins', value: '18', color: '#0284c7', bg: '#f0f9ff' },
              ].map(card => (
                <div key={card.label} style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: 6, padding: '6px 8px' }}>
                  <div style={{ fontSize: 7, color: '#6b7280', marginBottom: 2 }}>{card.label}</div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: card.color }}>{card.value}</div>
                </div>
              ))}
            </div>
            {/* Chart area */}
            <div style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: 8, padding: 8 }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Revenue (Last 7 Days)</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 48 }}>
                {[35, 55, 42, 68, 48, 82, 74].map((h, i) => (
                  <div key={i} style={{ flex: 1, background: i === 5 ? '#e11d48' : '#fecdd3', borderRadius: '2px 2px 0 0', height: `${h}%` }} />
                ))}
              </div>
              <div style={{ display: 'flex', gap: 3, marginTop: 3 }}>
                {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
                  <div key={d} style={{ flex: 1, textAlign: 'center', fontSize: 6, color: '#94a3b8' }}>{d}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Feature Tab Mockup ───────────────────────────────────────────────────────

function FeatureMockup({ feature }: { feature: typeof FEATURES_TABS[number] }) {
  return (
    <div style={{ background: feature.mockupBg, borderRadius: 16, padding: 24, height: '100%', minHeight: 280, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ width: 72, height: 72, borderRadius: 20, background: feature.mockupAccent, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, boxShadow: `0 8px 24px ${feature.mockupAccent}40` }}>
        <feature.icon style={{ width: 32, height: 32, color: '#fff' }} />
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 8, textAlign: 'center' }}>{feature.label}</div>
      <div style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', lineHeight: 1.6, maxWidth: 280 }}>{feature.desc}</div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [demoOpen, setDemoOpen] = useState(false)
  const [form, setForm] = useState<DemoForm>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [activeFeature, setActiveFeature] = useState(0)
  const marqueeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('sf-visible') }),
      { threshold: 0.08 }
    )
    document.querySelectorAll('.sf-reveal').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const counters = document.querySelectorAll<HTMLElement>('[data-sf-count]')
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement
            const target = parseInt(el.dataset.sfCount ?? '0')
            const suffix = el.dataset.sfSuffix ?? ''
            let count = 0
            const step = Math.max(1, Math.ceil(target / 60))
            const timer = setInterval(() => {
              count = Math.min(count + step, target)
              el.textContent = count.toLocaleString() + suffix
              if (count >= target) clearInterval(timer)
            }, 20)
            obs.unobserve(el)
          }
        })
      },
      { threshold: 0.5 }
    )
    counters.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    document.body.style.overflow = demoOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [demoOpen])

  async function handleDemoSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, phone: form.phone, salon_name: form.salonName, branches: form.branches, city: form.city, source: form.source }),
      })
      if (res.ok) { setSubmitted(true) }
      else { const d = await res.json(); alert(d.error ?? 'Something went wrong.') }
    } catch { alert('Network error. Please try again.') }
    setSubmitting(false)
  }

  function openDemo() {
    setForm(emptyForm)
    setSubmitted(false)
    setDemoOpen(true)
  }

  return (
    <div style={{ background: '#fff', minHeight: '100vh', color: '#111', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_SCHEMA) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SOFTWARE_SCHEMA) }} />
      <style>{`
        @keyframes mockup-float {
          0%,100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .mockup-float { animation: mockup-float 5s ease-in-out infinite; }
        .marquee-track { animation: marquee 28s linear infinite; display: flex; gap: 32px; width: max-content; }
        .marquee-track:hover { animation-play-state: paused; }
        .marquee-wrap { overflow: hidden; mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent); -webkit-mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent); }
        .sf-reveal { opacity: 0; transform: translateY(28px); transition: opacity 0.6s ease, transform 0.6s ease; }
        .sf-reveal.sf-visible { opacity: 1; transform: translateY(0); }
        .sf-d1 { transition-delay: 0.1s; } .sf-d2 { transition-delay: 0.2s; } .sf-d3 { transition-delay: 0.3s; }
        .sf-d4 { transition-delay: 0.4s; } .sf-d5 { transition-delay: 0.5s; }
        .nav-scrolled { background: rgba(255,255,255,0.95); backdrop-filter: blur(12px); box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
        .btn-primary { background: #e11d48; color: #fff; border: none; border-radius: 10px; font-weight: 600; cursor: pointer; transition: background 0.2s, transform 0.1s; }
        .btn-primary:hover { background: #be123c; }
        .btn-primary:active { transform: scale(0.98); }
        .btn-outline { background: transparent; color: #e11d48; border: 2px solid #e11d48; border-radius: 10px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
        .btn-outline:hover { background: #fff1f2; }
        .sf-input { background: #f8fafc; border: 1.5px solid #e2e8f0; color: #111; border-radius: 10px; padding: 11px 14px; font-size: 14px; width: 100%; outline: none; transition: border-color 0.2s; font-family: inherit; }
        .sf-input:focus { border-color: #e11d48; box-shadow: 0 0 0 3px rgba(225,29,72,0.08); background: #fff; }
        .sf-input::placeholder { color: #94a3b8; }
        .sf-select { background: #f8fafc; border: 1.5px solid #e2e8f0; color: #111; border-radius: 10px; padding: 11px 14px; font-size: 14px; width: 100%; outline: none; appearance: none; cursor: pointer; font-family: inherit; transition: border-color 0.2s; }
        .sf-select:focus { border-color: #e11d48; box-shadow: 0 0 0 3px rgba(225,29,72,0.08); background: #fff; }
        .feature-tab { padding: 12px 16px; border-radius: 10px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 10px; border: 1.5px solid transparent; }
        .feature-tab:hover { background: #f8fafc; }
        .feature-tab.active { background: #fff1f2; border-color: #fecdd3; }
        .pricing-card { background: #fff; border-radius: 16px; padding: 32px; border: 1.5px solid #e2e8f0; transition: box-shadow 0.2s, transform 0.2s; }
        .pricing-card:hover { box-shadow: 0 12px 40px rgba(0,0,0,0.1); transform: translateY(-2px); }
        .pricing-card.featured { border: 2px solid #e11d48; box-shadow: 0 8px 32px rgba(225,29,72,0.15); }
        .testimonial-card { background: #fff; border-radius: 16px; padding: 28px; border: 1.5px solid #e2e8f0; }
        .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 16px; backdrop-filter: blur(4px); }
        @media (max-width: 768px) {
          .mockup-float { animation: none; }
          .hero-grid { grid-template-columns: 1fr !important; }
          .features-grid { grid-template-columns: 1fr !important; }
          .pricing-grid { grid-template-columns: 1fr !important; }
          .steps-grid { grid-template-columns: 1fr !important; }
          .testimonials-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ── NAVBAR ── */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100 }} className={scrolled ? 'nav-scrolled' : ''}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64, borderBottom: scrolled ? 'none' : '1px solid rgba(0,0,0,0.04)' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 34, height: 34, background: 'linear-gradient(135deg,#e11d48,#f43f5e)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(225,29,72,0.3)' }}>
              <Scissors style={{ width: 16, height: 16, color: '#fff' }} />
            </div>
            <span style={{ fontWeight: 800, fontSize: 18, color: '#111', letterSpacing: '-0.02em' }}>Snipforce</span>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex" style={{ alignItems: 'center', gap: 32 }}>
            {['Features', 'How It Works', 'Pricing'].map(item => (
              <a key={item} href={`#${item.toLowerCase().replace(/ /g, '-')}`}
                style={{ fontSize: 14, color: '#4b5563', textDecoration: 'none', fontWeight: 500, transition: 'color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#e11d48')}
                onMouseLeave={e => (e.currentTarget.style.color = '#4b5563')}>
                {item}
              </a>
            ))}
            <Link href="/login">
              <button className="btn-primary" style={{ padding: '9px 22px', fontSize: 14 }}>Login</button>
            </Link>
          </div>

          {/* Mobile menu button */}
          <button className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}
            style={{ padding: 8, color: '#4b5563', background: 'none', border: 'none', cursor: 'pointer' }}>
            {mobileOpen ? <X style={{ width: 22, height: 22 }} /> : <Menu style={{ width: 22, height: 22 }} />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div style={{ background: '#fff', borderTop: '1px solid #f1f5f9', padding: '12px 24px 20px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
            {['Features', 'How It Works', 'Pricing'].map(item => (
              <a key={item} href={`#${item.toLowerCase().replace(/ /g, '-')}`} onClick={() => setMobileOpen(false)}
                style={{ display: 'block', padding: '10px 0', color: '#4b5563', fontSize: 15, textDecoration: 'none', borderBottom: '1px solid #f8fafc' }}>
                {item}
              </a>
            ))}
            <Link href="/login">
              <button className="btn-primary" onClick={() => setMobileOpen(false)}
                style={{ marginTop: 14, width: '100%', padding: 13, fontSize: 15 }}>
                Login
              </button>
            </Link>
          </div>
        )}
      </nav>

      <main>

      {/* ── HERO ── */}
      <section style={{ paddingTop: 100, paddingBottom: 80, background: '#fff', position: 'relative', overflow: 'hidden' }}>
        {/* Subtle grid bg */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(225,29,72,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(225,29,72,0.03) 1px, transparent 1px)', backgroundSize: '48px 48px', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '10%', right: '5%', width: 480, height: 480, borderRadius: '50%', background: 'radial-gradient(circle, rgba(225,29,72,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', position: 'relative' }}>
          <div className="hero-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>

            {/* Left */}
            <div className="sf-reveal">
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 100, background: '#fff1f2', border: '1px solid #fecdd3', marginBottom: 24 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#e11d48', display: 'inline-block' }} />
                <span style={{ fontSize: 12, color: '#e11d48', fontWeight: 600 }}>All-in-one Salon Management Platform</span>
              </div>

              <h1 style={{ fontSize: 'clamp(32px, 4.5vw, 56px)', fontWeight: 900, lineHeight: 1.1, marginBottom: 20, letterSpacing: '-0.03em', color: '#0f172a' }}>
                The Complete Management Platform{' '}
                <span style={{ background: 'linear-gradient(135deg,#e11d48,#f43f5e)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  for Modern Salons
                </span>
              </h1>

              <p style={{ fontSize: 18, color: '#4b5563', marginBottom: 36, lineHeight: 1.7, maxWidth: 500 }}>
                Appointments, walk-ins, staff, inventory, payroll and financials — beautifully designed and effortlessly simple.
              </p>

              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 48 }}>
                <button onClick={openDemo} className="btn-primary" style={{ padding: '15px 32px', fontSize: 16 }}>
                  Request a Demo
                </button>
                <a href="#features" className="btn-outline" style={{ padding: '15px 28px', fontSize: 15, display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
                  See Features <ArrowRight style={{ width: 16, height: 16 }} />
                </a>
              </div>

              {/* Stat counters */}
              <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
                {[
                  { count: 500, suffix: '+', label: 'Salons Active' },
                  { count: 99, suffix: '.9%', label: 'Uptime' },
                  { count: 24, suffix: '/7', label: 'Support' },
                ].map(s => (
                  <div key={s.label}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: '#e11d48', lineHeight: 1 }}>
                      <span data-sf-count={s.count} data-sf-suffix={s.suffix}>{s.count}{s.suffix}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — dashboard mockup */}
            <div className="hidden lg:block sf-reveal sf-d2">
              <DashboardMockup />
            </div>
          </div>

          {/* Trust badges */}
          <div className="sf-reveal sf-d3" style={{ marginTop: 56, paddingTop: 32, borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 500 }}>Trusted by salons across</span>
            {['Pakistan 🇵🇰', 'UAE 🇦🇪', 'Saudi Arabia 🇸🇦', 'United Kingdom 🇬🇧'].map(c => (
              <span key={c} style={{ fontSize: 13, color: '#374151', fontWeight: 600, background: '#f8fafc', padding: '4px 12px', borderRadius: 100, border: '1px solid #e2e8f0' }}>{c}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF BANNER ── */}
      <section style={{ background: '#f8fafc', padding: '28px 0', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>Join hundreds of salons already using Snipforce</span>
        </div>
        <div className="marquee-wrap" ref={marqueeRef}>
          <div className="marquee-track">
            {[...SALON_NAMES, ...SALON_NAMES].map((name, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                <Scissors style={{ width: 12, height: 12, color: '#e11d48', flexShrink: 0 }} />
                <span style={{ fontSize: 14, color: '#374151', fontWeight: 600 }}>{name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES (Interactive tabs) ── */}
      <section id="features" style={{ padding: '96px 24px', background: '#fff' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="sf-reveal" style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 100, background: '#fff1f2', border: '1px solid #fecdd3', marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: '#e11d48', fontWeight: 600 }}>FEATURES</span>
            </div>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 42px)', fontWeight: 800, color: '#0f172a', marginBottom: 12, letterSpacing: '-0.02em' }}>Everything your salon needs</h2>
            <p style={{ fontSize: 17, color: '#6b7280', maxWidth: 520, margin: '0 auto' }}>
              One platform to manage every aspect of your salon business.
            </p>
          </div>

          <div className="features-grid sf-reveal" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 32, alignItems: 'start' }}>
            {/* Left tabs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {FEATURES_TABS.map((f, i) => (
                <button key={f.id} type="button" onClick={() => setActiveFeature(i)}
                  className={`feature-tab ${activeFeature === i ? 'active' : ''}`}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: activeFeature === i ? f.mockupAccent : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.2s' }}>
                    <f.icon style={{ width: 16, height: 16, color: activeFeature === i ? '#fff' : '#6b7280' }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: activeFeature === i ? 700 : 500, color: activeFeature === i ? '#0f172a' : '#4b5563' }}>{f.label}</span>
                  {activeFeature === i && <ChevronRight style={{ width: 14, height: 14, color: '#e11d48', marginLeft: 'auto' }} />}
                </button>
              ))}
            </div>

            {/* Right mockup */}
            <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid #e2e8f0', transition: 'all 0.3s ease' }}>
              <FeatureMockup feature={FEATURES_TABS[activeFeature]} />
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" style={{ padding: '96px 24px', background: '#f8fafc' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div className="sf-reveal" style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 100, background: '#fff1f2', border: '1px solid #fecdd3', marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: '#e11d48', fontWeight: 600 }}>HOW IT WORKS</span>
            </div>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 42px)', fontWeight: 800, color: '#0f172a', marginBottom: 12, letterSpacing: '-0.02em' }}>Up and running in 24 hours</h2>
            <p style={{ fontSize: 17, color: '#6b7280', maxWidth: 480, margin: '0 auto' }}>No installation, no setup complexity. We handle everything.</p>
          </div>

          <div className="steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32 }}>
            {[
              { step: 1, icon: ClipboardList, title: 'We set up your account', desc: 'Tell us about your salon. We configure your account, branding, and team access within 24 hours.' },
              { step: 2, icon: Users, title: 'Add your team & services', desc: 'Add your staff, service menu, and branches. Our onboarding wizard guides you every step of the way.' },
              { step: 3, icon: TrendingUp, title: 'Start growing your business', desc: 'Book appointments, process walk-ins, and access financial reports from day one. No learning curve.' },
            ].map((s, i) => (
              <div key={s.step} className={`sf-reveal sf-d${i + 1}`} style={{ background: '#fff', borderRadius: 16, padding: 28, border: '1.5px solid #e2e8f0', position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: '#fff1f2', border: '1.5px solid #fecdd3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <s.icon style={{ width: 20, height: 20, color: '#e11d48' }} />
                  </div>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#e11d48', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>{s.step}</span>
                  </div>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>{s.title}</h3>
                <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURE CHECKLIST ── */}
      <section style={{ padding: '96px 24px', background: '#fff' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div className="sf-reveal" style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 100, background: '#fff1f2', border: '1px solid #fecdd3', marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: '#e11d48', fontWeight: 600 }}>EVERYTHING INCLUDED</span>
            </div>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 42px)', fontWeight: 800, color: '#0f172a', marginBottom: 12, letterSpacing: '-0.02em' }}>Everything included, no hidden extras</h2>
            <p style={{ fontSize: 17, color: '#6b7280' }}>Every feature at every plan. No add-ons, no surprises.</p>
          </div>

          <div className="sf-reveal" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px 48px' }}>
            {CHECKLIST_ITEMS.map(item => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff1f2', border: '1.5px solid #fecdd3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Check style={{ width: 12, height: 12, color: '#e11d48' }} />
                </div>
                <span style={{ fontSize: 14, color: '#374151', fontWeight: 500 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" style={{ padding: '96px 24px', background: '#f8fafc' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div className="sf-reveal" style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 100, background: '#fff1f2', border: '1px solid #fecdd3', marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: '#e11d48', fontWeight: 600 }}>PRICING</span>
            </div>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 42px)', fontWeight: 800, color: '#0f172a', marginBottom: 12, letterSpacing: '-0.02em' }}>Simple, transparent pricing</h2>
            <p style={{ fontSize: 17, color: '#6b7280' }}>Choose the plan that fits your salon. Upgrade or downgrade anytime.</p>
          </div>

          <div className="pricing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {PRICING.map((p, i) => (
              <div key={p.name} className={`sf-reveal sf-d${i + 1} pricing-card ${p.highlight ? 'featured' : ''}`}>
                {p.highlight && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 100, background: '#e11d48', marginBottom: 16 }}>
                    <Star style={{ width: 11, height: 11, color: '#fff' }} />
                    <span style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>MOST POPULAR</span>
                  </div>
                )}
                <div style={{ marginBottom: 8 }}>
                  <span style={{ fontSize: 38, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>{p.price}</span>
                  <span style={{ fontSize: 14, color: '#9ca3af' }}>{p.period}</span>
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 4 }}>{p.name}</div>
                <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>{p.desc}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                  {p.features.map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Check style={{ width: 14, height: 14, color: '#e11d48', flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: '#374151' }}>{f}</span>
                    </div>
                  ))}
                </div>
                <button onClick={openDemo} className={p.highlight ? 'btn-primary' : 'btn-outline'} style={{ width: '100%', padding: '13px', fontSize: 14 }}>
                  Get Started
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section style={{ padding: '96px 24px', background: '#fff' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div className="sf-reveal" style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 100, background: '#fff1f2', border: '1px solid #fecdd3', marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: '#e11d48', fontWeight: 600 }}>TESTIMONIALS</span>
            </div>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 42px)', fontWeight: 800, color: '#0f172a', marginBottom: 12, letterSpacing: '-0.02em' }}>Loved by salon owners</h2>
          </div>

          <div className="testimonials-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {TESTIMONIALS.map((t, i) => (
              <div key={t.name} className={`sf-reveal sf-d${i + 1} testimonial-card`}>
                <div style={{ display: 'flex', gap: 2, marginBottom: 14 }}>
                  {Array.from({ length: t.stars }).map((_, j) => (
                    <Star key={j} style={{ width: 15, height: 15, fill: '#f59e0b', color: '#f59e0b' }} />
                  ))}
                </div>
                <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, marginBottom: 20, fontStyle: 'italic' }}>
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#e11d48,#f43f5e)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{t.name[0]}</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{t.salon}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section style={{ background: 'linear-gradient(135deg,#e11d48 0%,#be123c 100%)', padding: '80px 24px', textAlign: 'center' }}>
        <div className="sf-reveal" style={{ maxWidth: 680, margin: '0 auto' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Scissors style={{ width: 26, height: 26, color: '#fff' }} />
          </div>
          <h2 style={{ fontSize: 'clamp(26px, 4vw, 44px)', fontWeight: 900, color: '#fff', marginBottom: 14, letterSpacing: '-0.02em' }}>
            Ready to transform your salon?
          </h2>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.8)', marginBottom: 32 }}>
            Join hundreds of salons already using Snipforce to grow their business.
          </p>
          <button onClick={openDemo} style={{ padding: '16px 40px', background: '#fff', color: '#e11d48', borderRadius: 12, fontWeight: 700, fontSize: 16, border: 'none', cursor: 'pointer', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', transition: 'transform 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'none')}>
            Request a Demo
          </button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: '#0f172a', padding: '48px 24px 32px', color: '#9ca3af' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 32, marginBottom: 40 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
              <div style={{ width: 30, height: 30, background: 'linear-gradient(135deg,#e11d48,#f43f5e)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Scissors style={{ width: 14, height: 14, color: '#fff' }} />
              </div>
              <span style={{ fontWeight: 800, fontSize: 16, color: '#fff' }}>Snipforce</span>
            </div>
            <p style={{ fontSize: 13, color: '#6b7280', maxWidth: 260, lineHeight: 1.6 }}>
              The complete management platform for modern salons and spas.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Product</div>
              {['Features', 'Pricing', 'How It Works'].map(l => (
                <a key={l} href={`#${l.toLowerCase().replace(/ /g, '-')}`} style={{ display: 'block', fontSize: 13, color: '#6b7280', textDecoration: 'none', marginBottom: 8, transition: 'color 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}>
                  {l}
                </a>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Access</div>
              <Link href="/login" style={{ display: 'block', fontSize: 13, color: '#6b7280', textDecoration: 'none', marginBottom: 8 }}>Login</Link>
              <button onClick={openDemo} style={{ background: 'none', border: 'none', fontSize: 13, color: '#6b7280', cursor: 'pointer', padding: 0, textAlign: 'left' }}>Request Demo</button>
            </div>
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <span style={{ fontSize: 12 }}>© {new Date().getFullYear()} Snipforce. All rights reserved.</span>
          <span style={{ fontSize: 12 }}>Powered by Snipforce</span>
        </div>
      </footer>

      </main>

      {/* ── DEMO REQUEST MODAL ── */}
      {demoOpen && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setDemoOpen(false) }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 32, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 32px 80px rgba(0,0,0,0.2)', position: 'relative' }}>
            <button onClick={() => setDemoOpen(false)} style={{ position: 'absolute', top: 16, right: 16, background: '#f8fafc', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X style={{ width: 16, height: 16, color: '#6b7280' }} />
            </button>

            {submitted ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#dcfce7', border: '2px solid #86efac', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <Check style={{ width: 28, height: 28, color: '#16a34a' }} />
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Request Received!</h3>
                <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>
                  We&apos;ll contact you within 24 hours to set up your Snipforce account.
                </p>
                <button onClick={() => setDemoOpen(false)} className="btn-primary" style={{ marginTop: 24, padding: '12px 28px', fontSize: 14 }}>
                  Close
                </button>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg,#e11d48,#f43f5e)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Scissors style={{ width: 16, height: 16, color: '#fff' }} />
                    </div>
                    <span style={{ fontWeight: 800, fontSize: 16, color: '#111' }}>Snipforce</span>
                  </div>
                  <h3 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>Request a Demo</h3>
                  <p style={{ fontSize: 13, color: '#6b7280' }}>Fill in your details and we&apos;ll get your salon set up within 24 hours.</p>
                </div>

                <form onSubmit={handleDemoSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Full Name *</label>
                    <input required className="sf-input" placeholder="Your full name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Phone Number *</label>
                    <input required type="tel" className="sf-input" placeholder="+92 300 0000000" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Salon Name *</label>
                    <input required className="sf-input" placeholder="Your salon name" value={form.salonName} onChange={e => setForm(f => ({ ...f, salonName: e.target.value }))} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Number of Branches</label>
                      <select className="sf-select" value={form.branches} onChange={e => setForm(f => ({ ...f, branches: e.target.value }))}>
                        <option value="">Select</option>
                        <option value="1">1 Branch</option>
                        <option value="2-3">2–3 Branches</option>
                        <option value="4-10">4–10 Branches</option>
                        <option value="10+">10+ Branches</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>City</label>
                      <input className="sf-input" placeholder="Your city" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>How did you hear about us?</label>
                    <select className="sf-select" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                      <option value="">Select</option>
                      <option value="google">Google</option>
                      <option value="facebook">Facebook / Instagram</option>
                      <option value="referral">Referral / Word of mouth</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <button type="submit" disabled={submitting} className="btn-primary" style={{ padding: '14px', fontSize: 15, marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {submitting ? <Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} /> : null}
                    {submitting ? 'Submitting...' : 'Request Demo →'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

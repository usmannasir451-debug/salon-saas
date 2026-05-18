'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import {
  Scissors, Star, Check, Calendar, Zap, Package, TrendingUp,
  Heart, Users, X, Loader2, ChevronDown, ArrowRight,
  BarChart2, DollarSign, Clock, Shield, Smartphone, Globe
} from 'lucide-react'

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

const FEATURES = [
  {
    Icon: Calendar,
    title: 'Appointment Management',
    desc: 'Google Calendar-style booking with staff scheduling',
    color: '#f43f5e',
    mockup: (
      <div style={{ padding: 12, fontSize: 9 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 10 }}>May 2026</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {['Day', 'Week'].map((v, i) => (
              <span key={v} style={{ padding: '2px 7px', borderRadius: 4, background: i === 0 ? '#f43f5e' : 'rgba(255,255,255,0.08)', color: i === 0 ? '#fff' : '#666', fontSize: 8 }}>{v}</span>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 8 }}>
          {['M','T','W','T','F','S','S'].map((d, i) => (
            <div key={i} style={{ textAlign: 'center', color: '#555', fontSize: 7 }}>{d}</div>
          ))}
          {[18,19,20,21,22,23,24].map((d) => (
            <div key={d} style={{ textAlign: 'center', padding: '3px 0', borderRadius: 4, background: d === 20 ? '#f43f5e' : 'transparent', color: d === 20 ? '#fff' : '#888', fontSize: 8, fontWeight: d === 20 ? 700 : 400 }}>{d}</div>
          ))}
        </div>
        {[
          { time: '10:00', name: 'Emma J.', service: 'Hair Cut', color: '#f43f5e' },
          { time: '11:30', name: 'Sara W.', service: 'Facial', color: '#a855f7' },
          { time: '2:00', name: 'Alex C.', service: 'Manicure', color: '#3b82f6' },
        ].map((a) => (
          <div key={a.time} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 7px', borderRadius: 5, marginBottom: 3, background: 'rgba(255,255,255,0.04)', borderLeft: `2px solid ${a.color}` }}>
            <span style={{ color: '#555', width: 28, fontSize: 8, flexShrink: 0 }}>{a.time}</span>
            <span style={{ color: '#ccc', fontSize: 8, flex: 1 }}>{a.name}</span>
            <span style={{ padding: '1px 5px', background: `${a.color}20`, color: a.color, borderRadius: 20, fontSize: 7 }}>{a.service}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    Icon: Zap,
    title: 'Walk-In POS',
    desc: 'Instant walk-in processing with one-click payments',
    color: '#a855f7',
    mockup: (
      <div style={{ padding: 12 }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 10, marginBottom: 8 }}>Walk-In Checkout</div>
        {['Hair Cut — $45', 'Beard Trim — $20'].map((s) => (
          <div key={s} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 8px', background: 'rgba(168,85,247,0.12)', borderRadius: 5, marginBottom: 4, border: '1px solid rgba(168,85,247,0.2)' }}>
            <span style={{ color: '#ccc', fontSize: 8 }}>{s.split('—')[0]}</span>
            <span style={{ color: '#a855f7', fontSize: 9, fontWeight: 700 }}>{s.split('—')[1]}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: 'rgba(255,255,255,0.04)', borderRadius: 5, marginBottom: 8 }}>
          <span style={{ color: '#888', fontSize: 8 }}>Total</span>
          <span style={{ color: '#fff', fontSize: 11, fontWeight: 800 }}>$65</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {['Cash', 'Card'].map((m, i) => (
            <div key={m} style={{ padding: '6px', textAlign: 'center', borderRadius: 5, background: i === 1 ? '#a855f7' : 'rgba(255,255,255,0.06)', color: i === 1 ? '#fff' : '#888', fontSize: 9, fontWeight: i === 1 ? 700 : 400 }}>{m}</div>
          ))}
        </div>
      </div>
    ),
  },
  {
    Icon: TrendingUp,
    title: 'P&L & Financial Reports',
    desc: 'Real-time profit and loss with expense tracking',
    color: '#22c55e',
    mockup: (
      <div style={{ padding: 12 }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 10, marginBottom: 8 }}>P&L — May 2026</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ color: '#888', fontSize: 8 }}>Revenue</span>
          <span style={{ color: '#22c55e', fontWeight: 700, fontSize: 9 }}>$24,500</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ color: '#888', fontSize: 8 }}>Expenses</span>
          <span style={{ color: '#f43f5e', fontWeight: 700, fontSize: 9 }}>$8,200</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: 'rgba(34,197,94,0.12)', borderRadius: 5, marginBottom: 8, border: '1px solid rgba(34,197,94,0.2)' }}>
          <span style={{ color: '#22c55e', fontSize: 9, fontWeight: 700 }}>Net Profit</span>
          <span style={{ color: '#22c55e', fontSize: 11, fontWeight: 800 }}>$16,300</span>
        </div>
        <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 36 }}>
          {[65, 45, 80, 55, 90, 100].map((h, i) => (
            <div key={i} style={{ flex: 1, background: i === 5 ? '#22c55e' : 'rgba(34,197,94,0.3)', borderRadius: '2px 2px 0 0', height: `${h}%` }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
          {['Dec','Jan','Feb','Mar','Apr','May'].map((m) => (
            <span key={m} style={{ fontSize: 6.5, color: '#555' }}>{m}</span>
          ))}
        </div>
      </div>
    ),
  },
  {
    Icon: Users,
    title: 'Staff & Performance',
    desc: 'Track performance, attendance, commissions and payroll',
    color: '#3b82f6',
    mockup: (
      <div style={{ padding: 12 }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 10, marginBottom: 8 }}>Staff Performance</div>
        {[
          { name: 'Sarah J.', rev: '$5,200', pct: 82 },
          { name: 'Mike R.', rev: '$4,100', pct: 65 },
          { name: 'Emma L.', rev: '$3,800', pct: 60 },
        ].map((s) => (
          <div key={s.name} style={{ marginBottom: 7 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ color: '#ccc', fontSize: 8 }}>{s.name}</span>
              <span style={{ color: '#3b82f6', fontSize: 8, fontWeight: 700 }}>{s.rev}</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 20, height: 4 }}>
              <div style={{ background: '#3b82f6', borderRadius: 20, height: 4, width: `${s.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    Icon: Heart,
    title: 'Client & Loyalty System',
    desc: 'Build loyalty with points system and client history',
    color: '#f59e0b',
    mockup: (
      <div style={{ padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>E</div>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 9 }}>Emma Clarke</div>
            <div style={{ color: '#f59e0b', fontSize: 8 }}>★ 1,240 points</div>
          </div>
        </div>
        <div style={{ padding: '5px 8px', background: 'rgba(245,158,11,0.12)', borderRadius: 5, marginBottom: 6, border: '1px solid rgba(245,158,11,0.2)' }}>
          <span style={{ color: '#f59e0b', fontSize: 8 }}>Loyalty Balance: </span>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 9 }}>$12.40 redeemable</span>
        </div>
        {['Hair Cut — Mar 15', 'Facial — Feb 28', 'Manicure — Feb 10'].map((v) => (
          <div key={v} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ color: '#888', fontSize: 7.5 }}>{v.split('—')[0]}</span>
            <span style={{ color: '#666', fontSize: 7.5 }}>{v.split('—')[1]}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    Icon: Package,
    title: 'Inventory Management',
    desc: 'Track stock levels, get low stock alerts',
    color: '#ec4899',
    mockup: (
      <div style={{ padding: 12 }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 10, marginBottom: 8 }}>Inventory</div>
        {[
          { name: 'Hair Color #5', qty: 12, status: 'ok' },
          { name: 'Shampoo Pro', qty: 3, status: 'low' },
          { name: 'Conditioner', qty: 8, status: 'ok' },
        ].map((item) => (
          <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 7px', borderRadius: 5, marginBottom: 3, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ color: '#ccc', fontSize: 8 }}>{item.name}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ color: '#888', fontSize: 8 }}>Qty: {item.qty}</span>
              {item.status === 'low' && (
                <span style={{ padding: '1px 5px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', borderRadius: 20, fontSize: 7 }}>Low</span>
              )}
            </div>
          </div>
        ))}
      </div>
    ),
  },
]

const ALL_FEATURES_LIST = [
  ['Appointment booking', 'Walk-in POS', 'Calendar view', 'Client management', 'Loyalty points system', 'Multi-branch support', 'Role-based team access', 'Attendance tracking'],
  ['Inventory management', 'Expense tracking', 'Payroll & commissions', 'P&L reports', 'PDF invoice export', 'Dark mode', 'White-label branding', 'Custom payment methods', 'Demo request system'],
]

const TESTIMONIALS = [
  { name: 'Emma Clarke', salon: 'Bloom Beauty Studio, London', quote: 'Snipforce completely transformed how we manage appointments. No more double-bookings and our staff absolutely love it!', stars: 5 },
  { name: 'Sarah Williams', salon: 'Luxe Hair & Spa, New York', quote: 'The walk-in module and calendar view are game-changers. We can see the whole day at a glance and serve clients faster than ever.', stars: 5 },
  { name: 'Nadia Hassan', salon: 'Serenity Spa, Dubai', quote: 'The white-label branding makes our salon stand out. Clients see our logo everywhere — it feels truly professional.', stars: 5 },
]

const FAQS = [
  {
    q: 'What is Snipforce?',
    a: 'Snipforce is an all-in-one salon and spa management platform. It covers appointments, walk-in POS, staff management, inventory, payroll, expense tracking, loyalty points, and financial reporting — all in a single beautifully designed dashboard.',
  },
  {
    q: 'How do I get started with Snipforce?',
    a: 'Simply request a demo using the form on this page. Our team sets up your account, configures your salon branding, and walks you through onboarding. You can be up and running within 24 hours — no installation required.',
  },
  {
    q: 'Does Snipforce support multiple branches?',
    a: 'Yes. Snipforce is built for multi-location salons. You can manage unlimited branches, filter reports by branch, track per-branch attendance and expenses, and give staff access to specific locations.',
  },
  {
    q: 'Can I customize the branding for my salon?',
    a: 'Absolutely. Snipforce is a white-label platform. You can upload your salon logo, set your primary brand color, and configure your salon name, currency, and timezone. Clients and staff see your brand throughout the platform.',
  },
  {
    q: 'What payment methods does Snipforce support?',
    a: 'Snipforce supports multiple payment methods including cash, card, and bank transfer at the point of sale. You can configure custom payment methods to match how your salon operates.',
  },
  {
    q: 'Is my salon data secure?',
    a: 'Yes. Snipforce uses Supabase (PostgreSQL) with Row Level Security (RLS) on every table. Each salon\'s data is completely isolated. All data is encrypted in transit and at rest. Role-based access ensures staff only see what they need to.',
  },
  {
    q: 'Does Snipforce work on mobile?',
    a: 'Yes. The Snipforce dashboard is fully responsive and works on smartphones and tablets. Receptionists can book appointments, process walk-ins, and check schedules from any device with a browser.',
  },
]

const ORG_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Snipforce',
  url: 'https://snip-force.com',
  logo: 'https://snip-force.com/favicon.svg',
  description: 'All-in-one salon and spa management software platform.',
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'sales',
    url: 'https://snip-force.com',
  },
  areaServed: ['PK', 'AE', 'GB', 'US', 'Global'],
  address: {
    '@type': 'PostalAddress',
    addressCountry: 'PK',
  },
}

const SOFTWARE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Snipforce',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: 'https://snip-force.com',
  description:
    'All-in-one salon and spa management platform. Manage appointments, walk-ins, staff, inventory, payroll and finances.',
  offers: {
    '@type': 'AggregateOffer',
    lowPrice: '49',
    highPrice: '200',
    priceCurrency: 'USD',
    offerCount: 3,
  },
  featureList: [
    'Appointment Management',
    'Walk-In POS',
    'Staff Management',
    'Inventory Management',
    'Payroll & Commissions',
    'P&L Reports',
    'Multi-branch Support',
    'Loyalty Points System',
    'White-label Branding',
    'Role-based Access Control',
  ],
}

const WEBSITE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Snipforce',
  url: 'https://snip-force.com',
  description: 'All-in-one salon management platform',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: 'https://snip-force.com/?q={search_term_string}',
    },
    'query-input': 'required name=search_term_string',
  },
}

const BUSINESS_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'Snipforce',
  url: 'https://snip-force.com',
  description: 'Salon management software serving Pakistan and global markets',
  address: {
    '@type': 'PostalAddress',
    addressCountry: 'PK',
  },
  areaServed: [
    { '@type': 'Country', name: 'Pakistan' },
    { '@type': 'Country', name: 'United Arab Emirates' },
    { '@type': 'Country', name: 'United Kingdom' },
    { '@type': 'Country', name: 'United States' },
  ],
}

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [demoOpen, setDemoOpen] = useState(false)
  const [form, setForm] = useState<DemoForm>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const revealRefs = useRef<HTMLElement[]>([])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('sf-visible') }),
      { threshold: 0.1 }
    )
    document.querySelectorAll('.sf-reveal').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const counters = document.querySelectorAll<HTMLElement>('[data-sf-count]')
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement
            const target = parseInt(el.dataset.sfCount ?? '0')
            const suffix = el.dataset.sfSuffix ?? ''
            let count = 0
            const step = Math.max(1, Math.ceil(target / 50))
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
    counters.forEach((el) => obs.observe(el))
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
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          salon_name: form.salonName,
          branches: form.branches,
          city: form.city,
          source: form.source,
        }),
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
    <div style={{ background: '#0a0f1e', minHeight: '100vh', color: '#fff', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_SCHEMA) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SOFTWARE_SCHEMA) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_SCHEMA) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BUSINESS_SCHEMA) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: FAQS.map(({ q, a }) => ({
          '@type': 'Question',
          name: q,
          acceptedAnswer: { '@type': 'Answer', text: a },
        })),
      }) }} />
      <style>{`
        @keyframes sf-float {
          0%,100% { transform: perspective(1200px) rotateY(-8deg) rotateX(3deg) translateY(0px); }
          50%      { transform: perspective(1200px) rotateY(-8deg) rotateX(3deg) translateY(-18px); }
        }
        @keyframes sf-pulse-glow {
          0%,100% { box-shadow: 0 0 20px rgba(244,63,94,0.5), 0 4px 24px rgba(244,63,94,0.35); }
          50%      { box-shadow: 0 0 44px rgba(244,63,94,0.9), 0 4px 40px rgba(244,63,94,0.6); }
        }
        @keyframes sf-spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes sf-badge-in { from { opacity:0; transform: translateY(12px); } to { opacity:1; transform: translateY(0); } }
        .sf-reveal { opacity:0; transform:translateY(36px); transition:opacity 0.65s ease, transform 0.65s ease; }
        .sf-reveal.sf-visible { opacity:1; transform:translateY(0); }
        .sf-d1 { transition-delay:0.1s; } .sf-d2 { transition-delay:0.2s; } .sf-d3 { transition-delay:0.3s; }
        .sf-d4 { transition-delay:0.4s; } .sf-d5 { transition-delay:0.5s; } .sf-d6 { transition-delay:0.6s; }
        .sf-glass { background:rgba(255,255,255,0.04); backdrop-filter:blur(14px); border:1px solid rgba(255,255,255,0.07); }
        .sf-glass-strong { background:rgba(255,255,255,0.07); backdrop-filter:blur(20px); border:1px solid rgba(255,255,255,0.1); }
        .sf-grad-text { background:linear-gradient(135deg,#f43f5e 0%,#a855f7 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .sf-mockup { animation:sf-float 4s ease-in-out infinite; }
        .sf-cta-btn { animation:sf-pulse-glow 3s ease-in-out infinite; }
        .sf-grid-bg { background-image:linear-gradient(rgba(244,63,94,0.03) 1px, transparent 1px),linear-gradient(90deg, rgba(244,63,94,0.03) 1px, transparent 1px); background-size:52px 52px; }
        .sf-nav-blur { background:rgba(10,15,30,0.9); backdrop-filter:blur(20px); border-bottom:1px solid rgba(255,255,255,0.06); }
        .sf-feature-card { position:relative; overflow:hidden; cursor:default; transition:transform 0.3s ease, box-shadow 0.3s ease; }
        .sf-feature-card:hover { transform:translateY(-4px); box-shadow:0 20px 60px rgba(0,0,0,0.4); }
        .sf-feature-front { transition: opacity 0.3s ease, transform 0.3s ease; }
        .sf-feature-back { position:absolute; inset:0; opacity:0; transform:scale(0.96); transition: opacity 0.3s ease, transform 0.3s ease; }
        .sf-feature-card:hover .sf-feature-front { opacity:0; transform:scale(0.95); }
        .sf-feature-card:hover .sf-feature-back { opacity:1; transform:scale(1); }
        .sf-pricing-pop { position:relative; }
        .sf-pricing-pop::before { content:''; position:absolute; inset:-1px; border-radius:17px; background:linear-gradient(135deg,#f43f5e,#a855f7); z-index:-1; }
        .sf-input { background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); color:#fff; border-radius:10px; padding:10px 14px; font-size:14px; width:100%; outline:none; transition:border-color 0.2s; }
        .sf-input::placeholder { color:#4b5563; }
        .sf-input:focus { border-color:rgba(244,63,94,0.5); box-shadow:0 0 0 3px rgba(244,63,94,0.1); }
        .sf-select { background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); color:#fff; border-radius:10px; padding:10px 14px; font-size:14px; width:100%; outline:none; appearance:none; cursor:pointer; }
        .sf-select:focus { border-color:rgba(244,63,94,0.5); }
        .sf-select option { background:#111827; color:#fff; }
        @media (max-width:768px) {
          .sf-mockup { animation:none; }
          .sf-feature-card:hover { transform:none; }
          .sf-feature-card:hover .sf-feature-front { opacity:1; transform:none; }
          .sf-feature-card:hover .sf-feature-back { opacity:0; }
        }
      `}</style>

      {/* ── NAVBAR ── */}
      <nav aria-label="Main navigation" className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'sf-nav-blur' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2.5">
              <div style={{ width: 34, height: 34, background: 'linear-gradient(135deg,#f43f5e,#db2777)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(244,63,94,0.4)' }}>
                <Scissors style={{ width: 16, height: 16, color: '#fff' }} />
              </div>
              <span style={{ fontWeight: 800, fontSize: 18, color: '#fff', letterSpacing: '-0.02em' }}>Snipforce</span>
            </div>

            <div className="hidden md:flex items-center gap-8">
              {['Features', 'How It Works', 'Pricing', 'Contact'].map((item) => (
                <a key={item} href={`#${item.toLowerCase().replace(/ /g, '-')}`} style={{ fontSize: 14, color: '#9ca3af', textDecoration: 'none', transition: 'color 0.2s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#9ca3af')}>
                  {item}
                </a>
              ))}
              <Link href="/login">
                <button style={{ padding: '8px 20px', background: 'linear-gradient(135deg,#f43f5e,#db2777)', color: '#fff', borderRadius: 9, fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(244,63,94,0.3)', transition: 'opacity 0.2s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}>
                  Login
                </button>
              </Link>
            </div>

            <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden" style={{ padding: 8, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}>
              <div style={{ width: 20, height: 2, background: 'currentColor', marginBottom: 5, borderRadius: 2 }} />
              <div style={{ width: 20, height: 2, background: 'currentColor', marginBottom: 5, borderRadius: 2 }} />
              <div style={{ width: 20, height: 2, background: 'currentColor', borderRadius: 2 }} />
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div style={{ background: 'rgba(10,15,30,0.97)', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '12px 20px 16px' }}>
            {['Features', 'How It Works', 'Pricing', 'Contact'].map((item) => (
              <a key={item} href={`#${item.toLowerCase().replace(/ /g, '-')}`} onClick={() => setMobileOpen(false)}
                style={{ display: 'block', padding: '10px 0', color: '#9ca3af', fontSize: 14, textDecoration: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                {item}
              </a>
            ))}
            <Link href="/login"><button onClick={() => setMobileOpen(false)} style={{ marginTop: 12, width: '100%', padding: '12px', background: 'linear-gradient(135deg,#f43f5e,#db2777)', color: '#fff', borderRadius: 10, fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer' }}>Login</button></Link>
          </div>
        )}
      </nav>

      {/* ── MAIN CONTENT ── */}
      <main id="main-content">

      {/* ── HERO ── */}
      <section aria-label="Hero" className="sf-grid-bg" style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', paddingTop: 64, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '20%', left: '15%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(244,63,94,0.14) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '15%', right: '10%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,85,247,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" style={{ width: '100%', paddingTop: 80, paddingBottom: 80 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }} className="lg-two-col">
            {/* Left */}
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 100, background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)', marginBottom: 24 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f43f5e', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                <span style={{ fontSize: 12, color: '#f43f5e', fontWeight: 500 }}>All-in-one Salon Management Platform</span>
              </div>

              <h1 style={{ fontSize: 'clamp(36px, 5vw, 60px)', fontWeight: 900, lineHeight: 1.08, marginBottom: 20, letterSpacing: '-0.03em' }}>
                The Complete Operating System{' '}
                <span className="sf-grad-text">for Modern Salons</span>
              </h1>

              <p style={{ fontSize: 18, color: '#9ca3af', marginBottom: 32, lineHeight: 1.7, maxWidth: 480 }}>
                Appointments, walk-ins, staff, inventory, payroll, and financial reports — all in one beautifully designed platform.
              </p>

              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 48 }}>
                <button onClick={openDemo} aria-label="Request a Snipforce demo" className="sf-cta-btn" style={{ padding: '16px 32px', background: 'linear-gradient(135deg,#f43f5e,#db2777)', color: '#fff', borderRadius: 12, fontWeight: 700, fontSize: 16, border: 'none', cursor: 'pointer' }}>
                  Request a Demo
                </button>
                <a href="#features" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '16px 28px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 15, fontWeight: 600, textDecoration: 'none', transition: 'background 0.2s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}>
                  See it in action <ChevronDown style={{ width: 16, height: 16 }} />
                </a>
              </div>

              {/* Stat badges */}
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                {[
                  { count: 500, suffix: '+', label: 'Salons Active' },
                  { count: 99, suffix: '%', label: 'Uptime' },
                  { count: 30, suffix: '+', label: 'Countries' },
                ].map((s) => (
                  <div key={s.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 32, fontWeight: 800, color: '#fff', lineHeight: 1 }}>
                      <span data-sf-count={s.count} data-sf-suffix={s.suffix}>{s.count}{s.suffix}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — floating dashboard mockup */}
            <div className="hidden lg:block">
              <div className="sf-mockup">
                <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 0 80px rgba(244,63,94,0.18), 0 60px 120px rgba(0,0,0,0.7)', background: '#111827' }}>
                  {/* Browser chrome */}
                  <div style={{ background: '#1f2937', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 7, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {['#ef4444','#f59e0b','#22c55e'].map((c) => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
                    <div style={{ flex: 1, margin: '0 10px', background: 'rgba(255,255,255,0.05)', borderRadius: 5, padding: '3px 10px', fontSize: 10, color: '#4b5563', textAlign: 'center' }}>
                      app.snip-force.com/dashboard
                    </div>
                  </div>
                  {/* App */}
                  <div style={{ display: 'flex', minHeight: 340 }}>
                    {/* Sidebar */}
                    <div style={{ width: 148, background: '#0f172a', borderRight: '1px solid rgba(255,255,255,0.05)', padding: '14px 10px', flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18 }}>
                        <div style={{ width: 22, height: 22, background: 'linear-gradient(135deg,#f43f5e,#db2777)', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Scissors style={{ width: 11, height: 11, color: '#fff' }} />
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 800, color: '#fff' }}>Snipforce</span>
                      </div>
                      {[
                        { label: 'Dashboard', active: true },
                        { label: 'Appointments', active: false },
                        { label: 'Calendar', active: false },
                        { label: 'Walk-In', active: false },
                        { label: 'Staff', active: false },
                        { label: 'Clients', active: false },
                        { label: 'Reports', active: false },
                      ].map(({ label, active }) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 7px', borderRadius: 5, marginBottom: 2, background: active ? 'rgba(244,63,94,0.15)' : 'transparent' }}>
                          <div style={{ width: 4, height: 4, borderRadius: '50%', background: active ? '#f43f5e' : '#374151', flexShrink: 0 }} />
                          <span style={{ fontSize: 9, color: active ? '#f43f5e' : '#6b7280' }}>{label}</span>
                        </div>
                      ))}
                    </div>
                    {/* Main */}
                    <div style={{ flex: 1, padding: 16, background: '#111827' }}>
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 2 }}>Good morning, Sarah</div>
                        <div style={{ fontSize: 9, color: '#6b7280' }}>Monday, May 18, 2026</div>
                      </div>
                      {/* KPI cards */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 12 }}>
                        {[
                          { label: 'Revenue', value: '$24,500', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
                          { label: 'Appointments', value: '47', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
                          { label: 'Walk-Ins', value: '23', color: '#a855f7', bg: 'rgba(168,85,247,0.1)' },
                          { label: 'Net Profit', value: '$8,200', color: '#f43f5e', bg: 'rgba(244,63,94,0.1)' },
                        ].map((k) => (
                          <div key={k.label} style={{ background: k.bg, borderRadius: 7, padding: '8px 8px 6px' }}>
                            <div style={{ fontSize: 7.5, color: '#6b7280', marginBottom: 3 }}>{k.label}</div>
                            <div style={{ fontSize: 11, fontWeight: 800, color: k.color }}>{k.value}</div>
                          </div>
                        ))}
                      </div>
                      {/* Chart */}
                      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 7, padding: '8px 10px', marginBottom: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
                        <div style={{ fontSize: 8, color: '#6b7280', marginBottom: 6 }}>Revenue Trend — Last 6 Months</div>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 40 }}>
                          {[55, 72, 61, 88, 78, 100].map((h, i) => (
                            <div key={i} style={{ flex: 1, background: i === 5 ? '#f43f5e' : 'rgba(244,63,94,0.25)', borderRadius: '2px 2px 0 0', height: `${h}%` }} />
                          ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                          {['Dec','Jan','Feb','Mar','Apr','May'].map((m) => (
                            <span key={m} style={{ fontSize: 7, color: '#4b5563' }}>{m}</span>
                          ))}
                        </div>
                      </div>
                      {/* Appointments list */}
                      <div style={{ fontSize: 8, color: '#6b7280', marginBottom: 5 }}>Today&apos;s Appointments</div>
                      {['Emma J. — Hair Cut — 10:00 AM', 'Sara W. — Facial — 11:30 AM'].map((a) => (
                        <div key={a} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 7px', borderRadius: 5, marginBottom: 3, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.04)' }}>
                          <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#f43f5e', flexShrink: 0 }} />
                          <span style={{ fontSize: 8, color: '#9ca3af', flex: 1 }}>{a}</span>
                          <span style={{ fontSize: 7, padding: '1px 5px', background: 'rgba(34,197,94,0.12)', color: '#22c55e', borderRadius: 20 }}>Done</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES (Interactive) ── */}
      <section id="features" aria-label="Product Features" style={{ padding: '96px 0', background: 'rgba(255,255,255,0.015)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="sf-reveal text-center" style={{ marginBottom: 64 }}>
            <p style={{ color: '#f43f5e', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 12 }}>Product</p>
            <h2 style={{ fontSize: 'clamp(28px,4vw,48px)', fontWeight: 800, marginBottom: 16, letterSpacing: '-0.02em' }}>Everything your salon needs,<br />nothing it doesn&apos;t</h2>
            <p style={{ color: '#6b7280', fontSize: 16, maxWidth: 500, margin: '0 auto' }}>Hover each card to see a live product preview</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px,1fr))', gap: 20 }}>
            {FEATURES.map(({ Icon, title, desc, color, mockup }, idx) => (
              <div key={title} className={`sf-glass sf-feature-card sf-reveal sf-d${(idx % 3) + 1}`} style={{ borderRadius: 16, minHeight: 200 }}
                onMouseEnter={() => setHoveredFeature(idx)}
                onMouseLeave={() => setHoveredFeature(null)}>
                {/* Front */}
                <div className="sf-feature-front" style={{ padding: 24 }}>
                  <div style={{ width: 48, height: 48, background: `${color}18`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, border: `1px solid ${color}25` }}>
                    <Icon style={{ width: 22, height: 22, color }} />
                  </div>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 8 }}>{title}</h3>
                  <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.6 }}>{desc}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 16, color, fontSize: 12, fontWeight: 600 }}>
                    <span>Hover to preview</span>
                    <ArrowRight style={{ width: 14, height: 14 }} />
                  </div>
                </div>
                {/* Back */}
                <div className="sf-feature-back" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', borderRadius: 16, border: `1px solid ${color}30` }}>
                  <div style={{ padding: '8px 12px', borderBottom: `1px solid ${color}20`, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon style={{ width: 12, height: 12, color }} />
                    <span style={{ fontSize: 10, color, fontWeight: 600 }}>{title}</span>
                  </div>
                  {mockup}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DASHBOARD PREVIEW ── */}
      <section id="how-it-works" style={{ padding: '96px 0' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="sf-reveal text-center" style={{ marginBottom: 64 }}>
            <p style={{ color: '#f43f5e', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 12 }}>Dashboard</p>
            <h2 style={{ fontSize: 'clamp(28px,4vw,48px)', fontWeight: 800, marginBottom: 16, letterSpacing: '-0.02em' }}>A dashboard that tells you<br />everything at a glance</h2>
          </div>
          <div className="sf-reveal sf-d1 sf-mockup" style={{ maxWidth: 900, margin: '0 auto' }}>
            <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 0 80px rgba(244,63,94,0.12), 0 40px 100px rgba(0,0,0,0.7)', background: '#111827' }}>
              {/* Browser chrome */}
              <div style={{ background: '#1f2937', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['#ef4444','#f59e0b','#22c55e'].map((c) => <div key={c} style={{ width: 12, height: 12, borderRadius: '50%', background: c }} />)}
                <div style={{ flex: 1, margin: '0 14px', background: 'rgba(255,255,255,0.05)', borderRadius: 7, padding: '5px 14px', fontSize: 12, color: '#4b5563', textAlign: 'center' }}>
                  snip-force.com/dashboard
                </div>
              </div>
              <div style={{ display: 'flex', minHeight: 420 }}>
                {/* Sidebar */}
                <div style={{ width: 200, background: '#0f172a', borderRight: '1px solid rgba(255,255,255,0.05)', padding: '20px 14px', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
                    <div style={{ width: 28, height: 28, background: 'linear-gradient(135deg,#f43f5e,#db2777)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Scissors style={{ width: 13, height: 13, color: '#fff' }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>Snipforce</span>
                  </div>
                  {[
                    { label: 'Dashboard', active: true, Icon: BarChart2 },
                    { label: 'Appointments', active: false, Icon: Calendar },
                    { label: 'Walk-Ins', active: false, Icon: Zap },
                    { label: 'Staff', active: false, Icon: Users },
                    { label: 'Clients', active: false, Icon: Heart },
                    { label: 'Inventory', active: false, Icon: Package },
                    { label: 'Reports', active: false, Icon: TrendingUp },
                    { label: 'Settings', active: false, Icon: Shield },
                  ].map(({ label, active, Icon: NavIcon }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 7, marginBottom: 3, background: active ? 'rgba(244,63,94,0.15)' : 'transparent', cursor: 'default' }}>
                      <NavIcon style={{ width: 14, height: 14, color: active ? '#f43f5e' : '#374151', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: active ? '#f43f5e' : '#6b7280' }}>{label}</span>
                    </div>
                  ))}
                </div>
                {/* Main */}
                <div style={{ flex: 1, padding: '24px 20px', background: '#111827', overflow: 'hidden' }}>
                  <div style={{ marginBottom: 20 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Dashboard Overview</h2>
                    <p style={{ fontSize: 12, color: '#6b7280' }}>Monday, May 18, 2026 · Lahore Branch</p>
                  </div>
                  {/* KPI row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
                    {[
                      { label: 'Revenue', value: '$24,500', sub: '+12% vs last month', color: '#22c55e', Icon: DollarSign },
                      { label: 'Appointments', value: '47', sub: '8 pending', color: '#3b82f6', Icon: Calendar },
                      { label: 'Walk-Ins', value: '23', sub: 'Today', color: '#a855f7', Icon: Zap },
                      { label: 'Net Profit', value: '$8,200', sub: '+8% margin', color: '#f43f5e', Icon: TrendingUp },
                    ].map((k) => (
                      <div key={k.label} style={{ background: `${k.color}0d`, borderRadius: 10, padding: '12px 12px 10px', border: `1px solid ${k.color}20` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: 11, color: '#6b7280' }}>{k.label}</span>
                          <k.Icon style={{ width: 14, height: 14, color: k.color }} />
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: k.color, marginBottom: 3 }}>{k.value}</div>
                        <div style={{ fontSize: 10, color: '#4b5563' }}>{k.sub}</div>
                      </div>
                    ))}
                  </div>
                  {/* Charts row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '12px 14px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 12, fontWeight: 600 }}>Revenue — Last 6 Months</div>
                      <div style={{ display: 'flex', gap: 5, alignItems: 'flex-end', height: 70, marginBottom: 6 }}>
                        {[55, 72, 61, 88, 78, 100].map((h, i) => (
                          <div key={i} style={{ flex: 1, background: i === 5 ? 'linear-gradient(180deg,#f43f5e,#db2777)' : 'rgba(244,63,94,0.2)', borderRadius: '3px 3px 0 0', height: `${h}%` }} />
                        ))}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        {['Dec','Jan','Feb','Mar','Apr','May'].map((m) => (
                          <span key={m} style={{ fontSize: 9, color: '#4b5563' }}>{m}</span>
                        ))}
                      </div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '12px 14px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 12, fontWeight: 600 }}>Top Services</div>
                      {[{ name: 'Hair Cut', pct: 82, color: '#f43f5e' }, { name: 'Facial', pct: 64, color: '#a855f7' }, { name: 'Manicure', pct: 48, color: '#3b82f6' }].map((s) => (
                        <div key={s.name} style={{ marginBottom: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                            <span style={{ fontSize: 9, color: '#9ca3af' }}>{s.name}</span>
                            <span style={{ fontSize: 9, color: s.color }}>{s.pct}%</span>
                          </div>
                          <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 20, height: 4 }}>
                            <div style={{ background: s.color, borderRadius: 20, height: 4, width: `${s.pct}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works-steps" style={{ padding: '96px 0', background: 'rgba(255,255,255,0.015)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="sf-reveal text-center" style={{ marginBottom: 64 }}>
            <p style={{ color: '#f43f5e', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 12 }}>Process</p>
            <h2 style={{ fontSize: 'clamp(28px,4vw,48px)', fontWeight: 800, letterSpacing: '-0.02em' }}>Up and running in minutes</h2>
          </div>
          <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 32 }} className="md-three-col">
            <div style={{ display: 'none' }} className="md:block absolute top-9 left-[22%] right-[22%] h-px" />
            {[
              { num: '01', title: 'We set up your account', desc: 'We configure Snipforce with your salon branding, logo, and settings. Nothing for you to install.', color: '#f43f5e', Icon: Shield },
              { num: '02', title: 'Add your team and services', desc: 'Set up staff roles, services, pricing, and branches in minutes with our guided setup.', color: '#a855f7', Icon: Users },
              { num: '03', title: 'Start managing and growing', desc: 'Real-time insights, happy clients, and a business that practically runs itself.', color: '#22c55e', Icon: TrendingUp },
            ].map(({ num, title, desc, color, Icon: StepIcon }, i) => (
              <div key={num} className={`sf-reveal sf-d${i + 1} text-center`}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: `${color}12`, border: `2px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', position: 'relative' }}>
                  <StepIcon style={{ width: 28, height: 28, color }} />
                  <div style={{ position: 'absolute', top: -4, right: -4, width: 22, height: 22, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#fff' }}>{num}</div>
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 10 }}>{title}</h3>
                <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.7, maxWidth: 260, margin: '0 auto' }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURE LIST ── */}
      <section id="contact" style={{ padding: '96px 0' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="sf-reveal text-center" style={{ marginBottom: 64 }}>
            <p style={{ color: '#f43f5e', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 12 }}>Included</p>
            <h2 style={{ fontSize: 'clamp(28px,4vw,48px)', fontWeight: 800, letterSpacing: '-0.02em' }}>Everything included,<br />no hidden extras</h2>
          </div>
          <div className="sf-reveal" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, maxWidth: 840, margin: '0 auto' }}>
            {ALL_FEATURES_LIST.map((col, colIdx) => (
              <div key={colIdx}>
                {col.map((feat) => (
                  <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Check style={{ width: 11, height: 11, color: '#f43f5e' }} />
                    </div>
                    <span style={{ color: '#d1d5db', fontSize: 14 }}>{feat}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" aria-label="Pricing Plans" style={{ padding: '96px 0', background: 'rgba(255,255,255,0.015)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="sf-reveal text-center" style={{ marginBottom: 64 }}>
            <p style={{ color: '#f43f5e', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 12 }}>Pricing</p>
            <h2 style={{ fontSize: 'clamp(28px,4vw,48px)', fontWeight: 800, marginBottom: 16, letterSpacing: '-0.02em' }}>Simple, transparent pricing</h2>
            <p style={{ color: '#6b7280', fontSize: 16 }}>Contact us to get started with the right plan for your salon</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24, maxWidth: 960, margin: '0 auto' }} className="md-three-col">
            {[
              { name: 'Starter', price: '$49', period: '/month', popular: false, features: ['1 Branch', 'Up to 10 Staff', 'Appointments & walk-ins', 'Payroll & expenses', 'All core features'] },
              { name: 'Growth', price: '$100', period: '/month', popular: true, features: ['Up to 3 Branches', 'Up to 30 Staff', 'Everything in Starter', 'Multi-branch dashboard', 'Advanced analytics', 'Priority support'] },
              { name: 'Enterprise', price: '$200', period: '/month', popular: false, features: ['Unlimited Branches', 'Unlimited Staff', 'Everything in Growth', 'Custom setup', 'Dedicated account manager'] },
            ].map(({ name, price, period, popular, features }, i) => (
              <div key={name} className={`sf-reveal sf-d${i + 1} ${popular ? 'sf-pricing-pop' : 'sf-glass'}`} style={{ borderRadius: 16, padding: 28, position: 'relative', zIndex: 0, background: popular ? 'rgba(244,63,94,0.06)' : undefined }}>
                {popular && (
                  <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', padding: '4px 14px', borderRadius: 100, background: 'linear-gradient(135deg,#f43f5e,#a855f7)', fontSize: 11, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
                    Most Popular
                  </div>
                )}
                <h3 style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 4 }}>{name}</h3>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 24 }}>
                  <span className="sf-grad-text" style={{ fontSize: 40, fontWeight: 900 }}>{price}</span>
                  <span style={{ color: '#6b7280', fontSize: 14 }}>{period}</span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, marginBottom: 24 }}>
                  {features.map((f) => (
                    <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 14, color: '#d1d5db' }}>
                      <Check style={{ width: 15, height: 15, color: '#f43f5e', flexShrink: 0 }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <button onClick={openDemo} style={{ width: '100%', padding: '13px', borderRadius: 10, fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer', transition: 'opacity 0.2s', ...(popular ? { background: 'linear-gradient(135deg,#f43f5e,#a855f7)', color: '#fff' } : { background: 'rgba(255,255,255,0.07)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)' }) }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}>
                  Get Started
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section style={{ padding: '96px 0' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="sf-reveal text-center" style={{ marginBottom: 64 }}>
            <p style={{ color: '#f43f5e', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 12 }}>Testimonials</p>
            <h2 style={{ fontSize: 'clamp(28px,4vw,48px)', fontWeight: 800, letterSpacing: '-0.02em' }}>Loved by salon owners</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }} className="md-three-col">
            {TESTIMONIALS.map(({ name, salon, quote, stars }, i) => (
              <div key={name} className={`sf-glass sf-reveal sf-d${i + 1}`} style={{ borderRadius: 16, padding: 28 }}>
                <div style={{ display: 'flex', gap: 3, marginBottom: 16 }}>
                  {Array.from({ length: stars }).map((_, j) => (
                    <Star key={j} style={{ width: 16, height: 16, fill: '#fbbf24', color: '#fbbf24' }} />
                  ))}
                </div>
                <p style={{ color: '#9ca3af', fontSize: 14, lineHeight: 1.7, marginBottom: 20, fontStyle: 'italic' }}>&ldquo;{quote}&rdquo;</p>
                <p style={{ fontWeight: 700, color: '#fff', fontSize: 14 }}>{name}</p>
                <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{salon}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" aria-label="Frequently Asked Questions" style={{ padding: '96px 0', background: 'rgba(255,255,255,0.015)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="sf-reveal text-center" style={{ marginBottom: 64 }}>
            <p style={{ color: '#f43f5e', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 12 }}>FAQ</p>
            <h2 style={{ fontSize: 'clamp(28px,4vw,48px)', fontWeight: 800, letterSpacing: '-0.02em' }}>Frequently Asked Questions</h2>
          </div>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            {FAQS.map(({ q, a }, i) => (
              <div key={i} className="sf-reveal" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  aria-expanded={openFaq === i}
                  aria-controls={`faq-answer-${i}`}
                  id={`faq-question-${i}`}
                  style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 16 }}
                >
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: openFaq === i ? '#f43f5e' : '#fff', margin: 0, flex: 1, transition: 'color 0.2s' }}>{q}</h3>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: openFaq === i ? 'rgba(244,63,94,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${openFaq === i ? 'rgba(244,63,94,0.3)' : 'rgba(255,255,255,0.1)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.2s, border 0.2s, transform 0.3s', transform: openFaq === i ? 'rotate(45deg)' : 'rotate(0deg)' }}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1v8M1 5h8" stroke={openFaq === i ? '#f43f5e' : '#9ca3af'} strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </div>
                </button>
                <div
                  id={`faq-answer-${i}`}
                  role="region"
                  aria-labelledby={`faq-question-${i}`}
                  style={{ maxHeight: openFaq === i ? 300 : 0, overflow: 'hidden', transition: 'max-height 0.35s ease' }}
                >
                  <p style={{ color: '#9ca3af', fontSize: 15, lineHeight: 1.7, paddingBottom: 20, margin: 0 }}>{a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      </main>

      {/* ── FOOTER ── */}
      <footer style={{ background: 'rgba(0,0,0,0.5)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" style={{ padding: '48px 0 32px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 32, marginBottom: 32 }} className="md-three-col">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg,#f43f5e,#db2777)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Scissors style={{ width: 15, height: 15, color: '#fff' }} />
                </div>
                <span style={{ fontWeight: 800, fontSize: 18, color: '#fff' }}>Snipforce</span>
              </div>
              <p style={{ color: '#4b5563', fontSize: 13, lineHeight: 1.7, maxWidth: 280 }}>The all-in-one platform for modern salons and spas. Appointments, staff, inventory, and financials in one place.</p>
            </div>
            <div>
              <h4 style={{ color: '#fff', fontWeight: 600, fontSize: 13, marginBottom: 14 }}>Product</h4>
              {['Features', 'Pricing', 'Login'].map((item) => (
                <div key={item} style={{ marginBottom: 10 }}>
                  {item === 'Login' ? (
                    <Link href="/login" style={{ color: '#4b5563', fontSize: 13, textDecoration: 'none', transition: 'color 0.2s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#4b5563')}>
                      {item}
                    </Link>
                  ) : (
                    <a href={`#${item.toLowerCase()}`} style={{ color: '#4b5563', fontSize: 13, textDecoration: 'none', transition: 'color 0.2s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#4b5563')}>
                      {item}
                    </a>
                  )}
                </div>
              ))}
            </div>
            <div>
              <h4 style={{ color: '#fff', fontWeight: 600, fontSize: 13, marginBottom: 14 }}>Contact</h4>
              <button onClick={openDemo} style={{ display: 'block', marginBottom: 10, color: '#4b5563', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', padding: 0, transition: 'color 0.2s' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#4b5563')}>
                Request a Demo
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#4b5563', fontSize: 13 }}>
                <Globe style={{ width: 13, height: 13 }} />
                <span>snip-force.com</span>
              </div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <p style={{ fontSize: 12, color: '#374151' }}>© 2026 Snipforce. All rights reserved.</p>
            <p style={{ fontSize: 12, color: '#374151' }}>Powered by Snipforce</p>
          </div>
        </div>
      </footer>

      {/* ── DEMO MODAL ── */}
      {demoOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }} onClick={() => setDemoOpen(false)} />
          <div style={{ position: 'relative', width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto', borderRadius: 20, background: '#111827', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 0 80px rgba(244,63,94,0.2), 0 40px 100px rgba(0,0,0,0.9)' }}>
            <button onClick={() => setDemoOpen(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', zIndex: 10, padding: 4, transition: 'color 0.2s' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#6b7280')}>
              <X style={{ width: 20, height: 20 }} />
            </button>

            <div style={{ padding: '32px 32px 28px' }}>
              {submitted ? (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(34,197,94,0.12)', border: '2px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                    <Check style={{ width: 32, height: 32, color: '#22c55e' }} />
                  </div>
                  <h3 style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Thank you!</h3>
                  <p style={{ color: '#6b7280', marginBottom: 24 }}>We will contact you within 24 hours to schedule your demo.</p>
                  <button onClick={() => setDemoOpen(false)} style={{ padding: '10px 24px', borderRadius: 10, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Close</button>
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                      <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg,#f43f5e,#db2777)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Scissors style={{ width: 15, height: 15, color: '#fff' }} />
                      </div>
                      <span style={{ fontWeight: 800, color: '#fff' }}>Snipforce</span>
                    </div>
                    <h2 style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Request a Demo</h2>
                    <p style={{ color: '#6b7280', fontSize: 14 }}>Fill in your details and we&apos;ll reach out within 24 hours.</p>
                  </div>

                  <form onSubmit={handleDemoSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#9ca3af', marginBottom: 6 }}>Full Name *</label>
                        <input className="sf-input" type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#9ca3af', marginBottom: 6 }}>Phone *</label>
                        <input className="sf-input" type="tel" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1 234 567 8900" />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#9ca3af', marginBottom: 6 }}>Salon / Business Name *</label>
                      <input className="sf-input" type="text" required value={form.salonName} onChange={(e) => setForm({ ...form, salonName: e.target.value })} placeholder="e.g. Glamour Beauty Studio" />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#9ca3af', marginBottom: 6 }}>Number of Branches *</label>
                        <select className="sf-select" required value={form.branches} onChange={(e) => setForm({ ...form, branches: e.target.value })}>
                          <option value="">Select...</option>
                          <option value="1">1 branch</option>
                          <option value="2-5">2–5 branches</option>
                          <option value="5-10">5–10 branches</option>
                          <option value="10+">10+ branches</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#9ca3af', marginBottom: 6 }}>City *</label>
                        <input className="sf-input" type="text" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="e.g. Dubai" />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#9ca3af', marginBottom: 6 }}>How did you hear about us? *</label>
                      <select className="sf-select" required value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                        <option value="">Select...</option>
                        <option value="Social Media">Social Media</option>
                        <option value="Friend/Referral">Friend / Referral</option>
                        <option value="Google Search">Google Search</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <button type="submit" disabled={submitting} style={{ marginTop: 4, padding: '14px', borderRadius: 12, background: 'linear-gradient(135deg,#f43f5e,#db2777)', color: '#fff', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: submitting ? 0.7 : 1, transition: 'opacity 0.2s' }}>
                      {submitting && <Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} />}
                      {submitting ? 'Submitting...' : 'Request Demo'}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile responsive overrides */}
      <style>{`
        @media (max-width: 900px) {
          .lg-two-col { grid-template-columns: 1fr !important; }
          .md-three-col { grid-template-columns: 1fr !important; }
          .hidden.lg\\:block { display: none !important; }
        }
        @media (max-width: 640px) {
          .md-three-col { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

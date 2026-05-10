'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Scissors, Star, Check, Calendar, Zap, Package, BarChart3, Gift, Users, X, Loader2 } from 'lucide-react'

type DemoForm = {
  name: string
  phone: string
  salonName: string
  branches: string
  city: string
  source: string
  message: string
}

const emptyForm: DemoForm = {
  name: '',
  phone: '',
  salonName: '',
  branches: '',
  city: '',
  source: '',
  message: '',
}

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [demoOpen, setDemoOpen] = useState(false)
  const [form, setForm] = useState<DemoForm>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('sf-visible')
        })
      },
      { threshold: 0.1 }
    )
    document.querySelectorAll('.sf-reveal').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const counters = document.querySelectorAll<HTMLElement>('[data-sf-count]')
    const counterObserver = new IntersectionObserver(
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
            counterObserver.unobserve(el)
          }
        })
      },
      { threshold: 0.5 }
    )
    counters.forEach((el) => counterObserver.observe(el))
    return () => counterObserver.disconnect()
  }, [])

  useEffect(() => {
    const cards = document.querySelectorAll<HTMLElement>('.sf-tilt')
    const onMove = (e: Event) => {
      const me = e as MouseEvent
      const card = me.currentTarget as HTMLElement
      const rect = card.getBoundingClientRect()
      const rx = ((me.clientY - rect.top) / rect.height - 0.5) * -12
      const ry = ((me.clientX - rect.left) / rect.width - 0.5) * 12
      card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(8px)`
    }
    const onLeave = (e: Event) => {
      ;(e.currentTarget as HTMLElement).style.transform =
        'perspective(900px) rotateX(0deg) rotateY(0deg) translateZ(0px)'
    }
    cards.forEach((c) => {
      c.addEventListener('mousemove', onMove)
      c.addEventListener('mouseleave', onLeave)
    })
    return () => {
      cards.forEach((c) => {
        c.removeEventListener('mousemove', onMove)
        c.removeEventListener('mouseleave', onLeave)
      })
    }
  }, [])

  // Lock body scroll when modal is open
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
          message: form.message || undefined,
        }),
      })
      if (res.ok) {
        setSubmitted(true)
      } else {
        const d = await res.json()
        alert(d.error ?? 'Something went wrong. Please try again.')
      }
    } catch {
      alert('Network error. Please try again.')
    }
    setSubmitting(false)
  }

  function openDemo() {
    setForm(emptyForm)
    setSubmitted(false)
    setDemoOpen(true)
  }

  return (
    <div style={{ background: '#0a0f1e', minHeight: '100vh', color: '#fff' }}>
      <style>{`
        @keyframes sf-float {
          0%,100% { transform: perspective(1200px) rotateY(-12deg) rotateX(4deg) translateY(0px); }
          50%      { transform: perspective(1200px) rotateY(-12deg) rotateX(4deg) translateY(-20px); }
        }
        @keyframes sf-pulse-glow {
          0%,100% { box-shadow: 0 0 20px rgba(244,63,94,0.4), 0 4px 24px rgba(244,63,94,0.3); }
          50%      { box-shadow: 0 0 40px rgba(244,63,94,0.8), 0 4px 36px rgba(244,63,94,0.5); }
        }
        .sf-reveal {
          opacity: 0;
          transform: translateY(36px);
          transition: opacity 0.65s ease, transform 0.65s ease;
        }
        .sf-reveal.sf-visible { opacity: 1; transform: translateY(0); }
        .sf-d1 { transition-delay: 0.1s; }
        .sf-d2 { transition-delay: 0.2s; }
        .sf-d3 { transition-delay: 0.3s; }
        .sf-glass {
          background: rgba(255,255,255,0.05);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .sf-grad-text {
          background: linear-gradient(135deg, #f43f5e 0%, #a855f7 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .sf-mockup { animation: sf-float 3s ease-in-out infinite; }
        .sf-cta-btn { animation: sf-pulse-glow 3s ease-in-out infinite; }
        .sf-tilt { transition: transform 0.12s ease; }
        .sf-grid-bg {
          background-image:
            linear-gradient(rgba(244,63,94,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(244,63,94,0.04) 1px, transparent 1px);
          background-size: 48px 48px;
        }
        .sf-nav-blur {
          background: rgba(10,15,30,0.88);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .sf-pricing-pop {
          position: relative;
          background: rgba(244,63,94,0.06);
          border-radius: 16px;
        }
        .sf-pricing-pop::before {
          content: '';
          position: absolute;
          inset: -1px;
          border-radius: 17px;
          background: linear-gradient(135deg, #f43f5e, #a855f7);
          z-index: -1;
        }
        @media (max-width: 768px) {
          .sf-mockup { animation: none; }
          .sf-tilt { transform: none !important; }
        }
      `}</style>

      {/* ── NAVBAR ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'sf-nav-blur' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-rose-500 rounded-lg flex items-center justify-center shadow-lg shadow-rose-500/30">
                <Scissors className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-lg text-white tracking-tight">Snipforce</span>
            </div>

            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-gray-400 hover:text-white transition-colors">Features</a>
              <a href="#pricing" className="text-sm text-gray-400 hover:text-white transition-colors">Pricing</a>
              <a href="#about" className="text-sm text-gray-400 hover:text-white transition-colors">About</a>
              <Link href="/login">
                <button className="px-5 py-2 text-sm bg-rose-500 hover:bg-rose-600 text-white rounded-lg font-medium transition-colors shadow-lg shadow-rose-500/25">
                  Login
                </button>
              </Link>
            </div>

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 text-gray-400 hover:text-white transition-colors"
              aria-label="Toggle menu"
            >
              <div style={{ width: 20, height: 2, background: 'currentColor', marginBottom: 5, borderRadius: 2 }} />
              <div style={{ width: 20, height: 2, background: 'currentColor', marginBottom: 5, borderRadius: 2 }} />
              <div style={{ width: 20, height: 2, background: 'currentColor', borderRadius: 2 }} />
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div style={{ background: 'rgba(10,15,30,0.97)', borderTop: '1px solid rgba(255,255,255,0.06)' }} className="md:hidden px-4 py-4 space-y-3">
            <a href="#features" className="block text-sm text-gray-300 py-2" onClick={() => setMobileOpen(false)}>Features</a>
            <a href="#pricing" className="block text-sm text-gray-300 py-2" onClick={() => setMobileOpen(false)}>Pricing</a>
            <a href="#about" className="block text-sm text-gray-300 py-2" onClick={() => setMobileOpen(false)}>About</a>
            <Link href="/login" className="block">
              <button className="w-full py-2.5 bg-rose-500 text-white rounded-lg text-sm font-medium">Login</button>
            </Link>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex items-center pt-16 overflow-hidden sf-grid-bg">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(244,63,94,0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* Left */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full sf-glass text-xs text-rose-400 mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                All-in-one Salon Management Platform
              </div>

              <h1 className="text-5xl lg:text-[3.6rem] font-bold leading-[1.1] mb-6">
                Run Your Salon.{' '}
                <span className="sf-grad-text">Not Your Spreadsheets.</span>
              </h1>

              <p className="text-lg text-gray-400 mb-8 leading-relaxed max-w-lg">
                Snipforce is the all-in-one platform for modern salons and spas — appointments, staff, inventory, and financials in one place.
              </p>

              <div className="flex flex-wrap gap-4">
                <button
                  onClick={openDemo}
                  className="sf-cta-btn px-8 py-4 rounded-xl font-semibold text-base text-white"
                  style={{ background: 'linear-gradient(135deg, #f43f5e, #db2777)' }}
                >
                  Request a Demo
                </button>
                <a href="#features">
                  <button className="sf-glass px-8 py-4 rounded-xl font-semibold text-base text-white hover:bg-white/10 transition-colors">
                    See Features
                  </button>
                </a>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-6 mt-12 pt-8" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                {[
                  { count: 500, suffix: '+', label: 'Salons' },
                  { count: 98, suffix: '%', label: 'Satisfaction' },
                  { count: 30, suffix: '+', label: 'Countries' },
                ].map((s) => (
                  <div key={s.label}>
                    <p className="text-3xl font-bold text-white">
                      <span data-sf-count={s.count} data-sf-suffix={s.suffix}>{s.count}{s.suffix}</span>
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — 3D floating mockup */}
            <div className="hidden lg:block">
              <div className="sf-mockup">
                <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 0 60px rgba(244,63,94,0.15), 0 40px 80px rgba(0,0,0,0.6)', background: 'rgba(255,255,255,0.02)' }}>
                  {/* Browser chrome */}
                  <div style={{ background: 'rgba(255,255,255,0.04)', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e' }} />
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }} />
                    <div style={{ flex: 1, margin: '0 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '3px 10px', fontSize: 10, color: '#555', textAlign: 'center' }}>
                      app.snipforce.com/dashboard
                    </div>
                  </div>
                  {/* App UI */}
                  <div style={{ display: 'flex', minHeight: 290 }}>
                    <div style={{ width: 156, borderRight: '1px solid rgba(255,255,255,0.04)', padding: 14, flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
                        <div style={{ width: 22, height: 22, background: '#f43f5e', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Scissors style={{ width: 11, height: 11, color: '#fff' }} />
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>Snipforce</span>
                      </div>
                      {['Dashboard', 'Appointments', 'Calendar', 'Walk-In', 'Staff'].map((item, i) => (
                        <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 7px', borderRadius: 5, marginBottom: 2, background: i === 0 ? 'rgba(244,63,94,0.15)' : 'transparent' }}>
                          <div style={{ width: 5, height: 5, borderRadius: '50%', background: i === 0 ? '#f43f5e' : '#333', flexShrink: 0 }} />
                          <span style={{ fontSize: 9.5, color: i === 0 ? '#f43f5e' : '#555' }}>{item}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ flex: 1, padding: 18 }}>
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ height: 13, width: 110, background: '#fff', borderRadius: 3, marginBottom: 5 }} />
                        <div style={{ height: 9, width: 150, background: '#1e2740', borderRadius: 3 }} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
                        {[
                          { label: "Appts", value: '14', bg: 'rgba(244,63,94,0.12)', c: '#f43f5e' },
                          { label: 'Revenue', value: '$2,840', bg: 'rgba(34,197,94,0.12)', c: '#22c55e' },
                          { label: 'Services', value: '12', bg: 'rgba(59,130,246,0.12)', c: '#3b82f6' },
                          { label: 'Staff', value: '8', bg: 'rgba(168,85,247,0.12)', c: '#a855f7' },
                        ].map((s) => (
                          <div key={s.label} style={{ background: s.bg, borderRadius: 7, padding: 9 }}>
                            <p style={{ fontSize: 8, color: '#555', marginBottom: 3 }}>{s.label}</p>
                            <p style={{ fontSize: 11, fontWeight: 700, color: s.c }}>{s.value}</p>
                          </div>
                        ))}
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 7, padding: 10, border: '1px solid rgba(255,255,255,0.04)' }}>
                        {['Emma J. — Hair Cut — 10:00 AM', 'Sara W. — Facial — 11:30 AM', 'Alex C. — Manicure — 2:00 PM'].map((a) => (
                          <div key={a} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 7px', borderRadius: 5, marginBottom: 3, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#f43f5e', flexShrink: 0 }} />
                            <span style={{ fontSize: 8.5, color: '#666', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a}</span>
                            <span style={{ fontSize: 7.5, padding: '1px 5px', background: 'rgba(34,197,94,0.12)', color: '#22c55e', borderRadius: 20, flexShrink: 0 }}>Confirmed</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-24" style={{ background: 'rgba(255,255,255,0.015)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 sf-reveal">
            <p className="text-rose-400 font-semibold text-sm uppercase tracking-widest mb-3">Features</p>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Everything your salon needs</h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">A complete platform to run your salon efficiently from day one.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { Icon: Calendar, title: 'Smart Appointments', desc: 'Calendar-based booking with staff scheduling and client history', color: '#f43f5e' },
              { Icon: Zap, title: 'Walk-In POS', desc: 'Instant walk-in processing with one-click payments and receipts', color: '#a855f7' },
              { Icon: Package, title: 'Inventory Control', desc: 'Track products, get low-stock alerts, manage suppliers', color: '#3b82f6' },
              { Icon: BarChart3, title: 'Financial Reports', desc: 'Real-time P&L, expense tracking, payroll and salary management', color: '#22c55e' },
              { Icon: Gift, title: 'Client Loyalty', desc: 'Built-in loyalty points system to retain and reward your best clients', color: '#f59e0b' },
              { Icon: Users, title: 'Team Management', desc: 'Staff profiles, performance tracking, commission and payroll', color: '#ec4899' },
            ].map(({ Icon, title, desc, color }, idx) => (
              <div key={title} className={`sf-glass sf-tilt rounded-2xl p-6 sf-reveal sf-d${(idx % 3) + 1} cursor-default`}>
                <div style={{ width: 48, height: 48, background: `${color}20`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <Icon style={{ width: 24, height: 24, color }} />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 sf-reveal">
            <p className="text-rose-400 font-semibold text-sm uppercase tracking-widest mb-3">Process</p>
            <h2 className="text-4xl md:text-5xl font-bold">How it works</h2>
          </div>
          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
            <div className="hidden md:block absolute top-9 left-[22%] right-[22%] h-px" style={{ background: 'linear-gradient(90deg, #f43f5e, #a855f7, #f43f5e)', opacity: 0.25 }} />
            {[
              { step: '01', title: 'We set up your account', desc: 'We configure Snipforce for your salon — branding, staff, services, all ready to go.', color: '#f43f5e' },
              { step: '02', title: 'Your team gets access', desc: 'Assign roles to your staff instantly. Receptionists, managers, and stylists all get the right permissions.', color: '#a855f7' },
              { step: '03', title: 'Watch your business grow', desc: 'Real-time insights, happy clients, and a team that runs like clockwork.', color: '#f43f5e' },
            ].map(({ step, title, desc, color }, idx) => (
              <div key={step} className={`text-center sf-reveal sf-d${idx + 1}`}>
                <div className="inline-flex items-center justify-center mb-6" style={{ width: 72, height: 72, borderRadius: '50%', background: `${color}15`, border: `2px solid ${color}35` }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color }}>{step}</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed max-w-xs mx-auto">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section id="about" className="py-24" style={{ background: 'rgba(255,255,255,0.015)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 sf-reveal">
            <p className="text-rose-400 font-semibold text-sm uppercase tracking-widest mb-3">Testimonials</p>
            <h2 className="text-4xl md:text-5xl font-bold">Loved by salon owners</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: 'Emma Clarke', salon: 'Bloom Beauty Studio, London', quote: 'Snipforce completely transformed how we manage appointments. No more double bookings and our staff absolutely love it!', stars: 5 },
              { name: 'Sarah Williams', salon: 'Luxe Hair & Spa, New York', quote: 'The walk-in module and calendar view are game-changers. We can see the whole day at a glance and serve clients faster than ever.', stars: 5 },
              { name: 'Nadia Hassan', salon: 'Serenity Spa, Dubai', quote: 'The white-label branding makes our salon stand out. Clients see our logo and brand colors everywhere — it feels truly professional.', stars: 5 },
            ].map(({ name, salon, quote, stars }, idx) => (
              <div key={name} className={`sf-glass rounded-2xl p-6 sf-reveal sf-d${idx + 1}`}>
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: stars }).map((_, i) => (
                    <Star key={i} style={{ width: 15, height: 15, fill: '#fbbf24', color: '#fbbf24' }} />
                  ))}
                </div>
                <p className="text-gray-300 text-sm mb-5 italic leading-relaxed">&quot;{quote}&quot;</p>
                <p className="font-semibold text-white text-sm">{name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{salon}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 sf-reveal">
            <p className="text-rose-400 font-semibold text-sm uppercase tracking-widest mb-3">Pricing</p>
            <h2 className="text-4xl md:text-5xl font-bold">Simple, transparent pricing</h2>
            <p className="text-gray-400 mt-4">Contact us to get started — we will set everything up for you.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { name: 'Starter', price: '$29', period: '/month', highlight: false, features: ['1 location', 'Up to 5 staff', 'Appointments & walk-ins', 'Basic reports', 'Email support'] },
              { name: 'Growth', price: '$59', period: '/month', highlight: true, features: ['3 locations', 'Up to 15 staff', 'Everything in Starter', 'Advanced analytics', 'Loyalty program', 'Priority support'] },
              { name: 'Enterprise', price: '$99', period: '/month', highlight: false, features: ['Unlimited locations', 'Unlimited staff', 'Everything in Growth', 'Custom branding', 'API access', 'Dedicated support'] },
            ].map(({ name, price, period, highlight, features }, idx) => (
              <div key={name} className={`sf-reveal sf-d${idx + 1} rounded-2xl p-6 relative ${highlight ? 'sf-pricing-pop' : 'sf-glass'}`} style={{ zIndex: 0 }}>
                {highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold text-white whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #f43f5e, #a855f7)' }}>
                    Most Popular
                  </div>
                )}
                <h3 className="text-xl font-bold text-white mb-1">{name}</h3>
                <div className="flex items-baseline gap-1 mb-5">
                  <span className="text-4xl font-bold sf-grad-text">{price}</span>
                  <span className="text-gray-400 text-sm">{period}</span>
                </div>
                <ul className="space-y-3 mb-6">
                  {features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                      <Check style={{ width: 15, height: 15, color: '#f43f5e', flexShrink: 0 }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={openDemo}
                  className="w-full py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
                  style={highlight ? { background: 'linear-gradient(135deg, #f43f5e, #a855f7)', color: '#fff' } : { background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  Contact us to get started
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: 'rgba(0,0,0,0.45)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 bg-rose-500 rounded-lg flex items-center justify-center shadow-lg shadow-rose-500/25">
                  <Scissors className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-white text-lg">Snipforce</span>
              </div>
              <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
                The all-in-one platform for modern salons and spas. Appointments, staff, inventory, and financials in one place.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold text-sm mb-4">Product</h4>
              <ul className="space-y-2.5">
                <li><a href="#features" className="text-sm text-gray-500 hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="text-sm text-gray-500 hover:text-white transition-colors">Pricing</a></li>
                <li><Link href="/login" className="text-sm text-gray-500 hover:text-white transition-colors">Login</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold text-sm mb-4">Contact</h4>
              <ul className="space-y-2.5">
                <li>
                  <button onClick={openDemo} className="text-sm text-gray-500 hover:text-white transition-colors">
                    Request a Demo
                  </button>
                </li>
                <li>
                  <Link href="/login" className="text-sm text-gray-500 hover:text-white transition-colors">
                    Client Login
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 24 }} className="flex flex-col md:flex-row items-center justify-between gap-2">
            <p className="text-xs text-gray-600">© 2026 Snipforce. All rights reserved.</p>
            <p className="text-xs text-gray-600">Powered by Snipforce</p>
          </div>
        </div>
      </footer>

      {/* ── DEMO REQUEST MODAL ── */}
      {demoOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setDemoOpen(false)}
          />
          {/* Modal */}
          <div
            className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl"
            style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 0 60px rgba(244,63,94,0.15), 0 40px 80px rgba(0,0,0,0.8)' }}
          >
            <button
              onClick={() => setDemoOpen(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-6 sm:p-8">
              {submitted ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.15)', border: '2px solid rgba(34,197,94,0.3)' }}>
                    <Check className="w-8 h-8 text-green-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Thank you!</h3>
                  <p className="text-gray-400 mb-6">
                    We will contact you within 24 hours to schedule your demo.
                  </p>
                  <button
                    onClick={() => setDemoOpen(false)}
                    className="px-6 py-2.5 rounded-lg text-sm font-medium text-white transition-colors"
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
                  >
                    Close
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-6">
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="w-8 h-8 bg-rose-500 rounded-lg flex items-center justify-center">
                        <Scissors className="w-4 h-4 text-white" />
                      </div>
                      <span className="font-bold text-white">Snipforce</span>
                    </div>
                    <h2 className="text-2xl font-bold text-white">Request a Demo</h2>
                    <p className="text-gray-400 text-sm mt-1">Fill in your details and we will reach out within 24 hours.</p>
                  </div>

                  <form onSubmit={handleDemoSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Full Name *</label>
                        <input
                          type="text"
                          required
                          value={form.name}
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                          placeholder="Your name"
                          className="w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:ring-1 focus:ring-rose-500"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Phone Number *</label>
                        <input
                          type="tel"
                          required
                          value={form.phone}
                          onChange={(e) => setForm({ ...form, phone: e.target.value })}
                          placeholder="+1 234 567 8900"
                          className="w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:ring-1 focus:ring-rose-500"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">Salon / Business Name *</label>
                      <input
                        type="text"
                        required
                        value={form.salonName}
                        onChange={(e) => setForm({ ...form, salonName: e.target.value })}
                        placeholder="e.g. Glamour Beauty Studio"
                        className="w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:ring-1 focus:ring-rose-500"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Number of Branches *</label>
                        <select
                          required
                          value={form.branches}
                          onChange={(e) => setForm({ ...form, branches: e.target.value })}
                          className="w-full rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-rose-500 appearance-none cursor-pointer"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                        >
                          <option value="" style={{ background: '#111827' }}>Select...</option>
                          <option value="1" style={{ background: '#111827' }}>1 branch</option>
                          <option value="2-5" style={{ background: '#111827' }}>2–5 branches</option>
                          <option value="5-10" style={{ background: '#111827' }}>5–10 branches</option>
                          <option value="10+" style={{ background: '#111827' }}>10+ branches</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">City *</label>
                        <input
                          type="text"
                          required
                          value={form.city}
                          onChange={(e) => setForm({ ...form, city: e.target.value })}
                          placeholder="e.g. Dubai"
                          className="w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:ring-1 focus:ring-rose-500"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">How did you hear about us? *</label>
                      <select
                        required
                        value={form.source}
                        onChange={(e) => setForm({ ...form, source: e.target.value })}
                        className="w-full rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-rose-500 appearance-none cursor-pointer"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                      >
                        <option value="" style={{ background: '#111827' }}>Select...</option>
                        <option value="Social Media" style={{ background: '#111827' }}>Social Media</option>
                        <option value="Friend/Referral" style={{ background: '#111827' }}>Friend / Referral</option>
                        <option value="Google Search" style={{ background: '#111827' }}>Google Search</option>
                        <option value="Other" style={{ background: '#111827' }}>Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">Message (optional)</label>
                      <textarea
                        rows={3}
                        value={form.message}
                        onChange={(e) => setForm({ ...form, message: e.target.value })}
                        placeholder="Tell us about your salon..."
                        className="w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:ring-1 focus:ring-rose-500 resize-none"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-3.5 rounded-xl font-semibold text-white text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-70"
                      style={{ background: 'linear-gradient(135deg, #f43f5e, #db2777)' }}
                    >
                      {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                      {submitting ? 'Submitting...' : 'Request Demo'}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

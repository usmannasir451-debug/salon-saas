'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Scissors,
  Calendar,
  Users,
  BarChart3,
  Smartphone,
  Shield,
  Star,
  Menu,
  X,
  Sparkles,
  TrendingUp,
  LogIn,
} from 'lucide-react'

const features = [
  {
    icon: Calendar,
    title: 'Appointment Management',
    desc: 'Easily book, reschedule, and manage all client appointments in one place.',
  },
  {
    icon: Users,
    title: 'Staff Management',
    desc: 'Add and manage your salon staff with their contact details and schedules.',
  },
  {
    icon: Scissors,
    title: 'Service Catalog',
    desc: 'List all your services with prices and durations.',
  },
  {
    icon: BarChart3,
    title: 'Revenue Tracking',
    desc: 'Track your daily and monthly revenue with a real-time dashboard.',
  },
  {
    icon: Smartphone,
    title: 'Mobile Friendly',
    desc: 'Fully responsive — works perfectly on phones, tablets, and desktops.',
  },
  {
    icon: Shield,
    title: 'Secure & Reliable',
    desc: 'Your data is safe with enterprise-grade security powered by Supabase.',
  },
]

const stats = [
  { value: '2,500+', label: 'Salons' },
  { value: '500K+', label: 'Appointments' },
  { value: '10K+', label: 'Staff Managed' },
  { value: '98%', label: 'Satisfaction' },
]

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Scissors className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-lg text-gray-900">SalonPro</span>
            </div>

            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-gray-600 hover:text-primary transition-colors">Features</a>
              <Link href="/login">
                <Button size="sm" className="bg-primary hover:bg-primary/90">Log In</Button>
              </Link>
            </div>

            <button
              className="md:hidden p-2 rounded-lg hover:bg-gray-100"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white px-4 py-4 space-y-3">
            <a href="#features" className="block text-sm text-gray-600 py-2" onClick={() => setMobileMenuOpen(false)}>Features</a>
            <Link href="/login" className="block">
              <Button className="w-full bg-primary hover:bg-primary/90">Log In</Button>
            </Link>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-24 pb-16 md:pt-32 md:pb-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-pink-50 via-white to-rose-50" />
        <div className="absolute top-20 right-0 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-pink-200/30 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <Badge className="mb-6 bg-primary/10 text-primary border-primary/20 hover:bg-primary/10">
              <Sparkles className="w-3 h-3 mr-1" />
              World-Class Salon Management
            </Badge>

            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 leading-tight mb-6">
              Manage Your Salon{' '}
              <span className="text-primary">Smarter</span>
            </h1>

            <p className="text-lg text-gray-600 mb-10 max-w-2xl mx-auto">
              Complete salon management software for modern businesses. Track appointments, manage staff, catalog services, accept walk-ins, and grow your revenue — all in one beautiful dashboard.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              <Link href="/login">
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-white px-8 h-12 text-base shadow-lg shadow-primary/25">
                  <LogIn className="w-4 h-4 mr-2" />
                  Log In to Dashboard
                </Button>
              </Link>
              <a href="#features">
                <Button variant="outline" size="lg" className="px-8 h-12 text-base border-gray-300">
                  See Features
                </Button>
              </a>
            </div>

            {/* Dashboard Preview */}
            <div className="relative mx-auto max-w-5xl">
              <div className="rounded-2xl border border-gray-200 shadow-2xl shadow-gray-300/50 overflow-hidden bg-gray-50">
                <div className="h-8 bg-gray-100 border-b border-gray-200 flex items-center px-4 gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                  <div className="flex-1 mx-4">
                    <div className="bg-white rounded-md mx-auto border border-gray-200 flex items-center justify-center w-48 h-4">
                      <span className="text-[9px] text-gray-400">app.salonpro.com/dashboard</span>
                    </div>
                  </div>
                </div>
                <div className="flex min-h-64 bg-white">
                  <div className="w-44 border-r border-gray-100 bg-white p-4 space-y-1 hidden sm:block">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
                        <Scissors className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-xs font-bold text-gray-800">SalonPro</span>
                    </div>
                    {['Dashboard', 'Appointments', 'Calendar', 'Walk-In'].map((item, i) => (
                      <div key={item} className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs ${i === 0 ? 'bg-primary/10 text-primary font-medium' : 'text-gray-500'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-primary' : 'bg-gray-300'}`} />
                        {item}
                      </div>
                    ))}
                  </div>
                  <div className="flex-1 p-5">
                    <div className="mb-4">
                      <div className="bg-gray-900 rounded mb-2" style={{ height: '14px', width: '120px' }} />
                      <div className="bg-gray-200 rounded" style={{ height: '10px', width: '160px' }} />
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                      {[
                        { label: "Today's Appts", value: '14', bg: 'bg-primary/10', text: 'text-primary' },
                        { label: 'Revenue', value: '$2,840', bg: 'bg-green-50', text: 'text-green-600' },
                        { label: 'Services', value: '12', bg: 'bg-blue-50', text: 'text-blue-600' },
                        { label: 'Staff', value: '8', bg: 'bg-purple-50', text: 'text-purple-600' },
                      ].map((s) => (
                        <div key={s.label} className={`rounded-lg p-3 ${s.bg}`}>
                          <p className="text-[10px] text-gray-500 mb-1">{s.label}</p>
                          <p className={`text-sm font-bold ${s.text}`}>{s.value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                      {['Emma Johnson — Hair Cut — 10:00 AM', 'Sara Williams — Facial — 11:30 AM', 'Alex Chen — Manicure — 2:00 PM'].map((appt) => (
                        <div key={appt} className="flex items-center gap-2 bg-white rounded p-2 border border-gray-100">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                          <span className="text-[10px] text-gray-600 truncate">{appt}</span>
                          <span className="ml-auto text-[9px] px-1.5 py-0.5 bg-green-50 text-green-600 rounded-full flex-shrink-0 whitespace-nowrap">Confirmed</span>
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

      {/* Stats */}
      <section className="py-12 bg-primary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl md:text-4xl font-bold text-white mb-1">{stat.value}</p>
                <p className="text-sm text-pink-100">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">Features</Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Everything Your Salon Needs</h2>
            <p className="text-gray-500">A complete platform to run your salon efficiently</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <Card key={feature.title} className="group hover:shadow-lg hover:-translate-y-1 transition-all duration-200 border-gray-100">
                <CardHeader>
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-gray-900">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">{feature.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">How It Works</h2>
            <p className="text-gray-500">Get up and running in minutes</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '01', icon: Sparkles, title: 'Get Your Account', desc: 'Contact SalonPro to set up your dedicated salon account with your name and branding.' },
              { step: '02', icon: Scissors, title: 'Add Services & Staff', desc: 'Set up your service menu with prices and add your team members.' },
              { step: '03', icon: TrendingUp, title: 'Manage & Grow', desc: 'Book appointments, accept walk-ins, track revenue, and grow your business.' },
            ].map((step) => (
              <div key={step.step} className="text-center">
                <div className="relative inline-block mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/25">
                    <step.icon className="w-8 h-8 text-white" />
                  </div>
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gray-900 text-white text-xs font-bold flex items-center justify-center">
                    {step.step}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-gray-600 text-sm">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Trusted by Salon Owners</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: 'Emma Clarke', salon: 'Bloom Beauty Studio, London', quote: 'SalonPro completely transformed how we manage appointments. No more double bookings and our staff love it!', stars: 5 },
              { name: 'Sarah Williams', salon: 'Luxe Hair & Spa, New York', quote: 'The walk-in module and calendar view are game-changers. We can see the whole day at a glance.', stars: 5 },
              { name: 'Nadia Hassan', salon: 'Serenity Spa, Dubai', quote: 'The white-label branding makes our salon stand out. Clients see our logo and brand colors everywhere.', stars: 5 },
            ].map((t) => (
              <Card key={t.name} className="border-gray-100">
                <CardContent className="pt-6">
                  <div className="flex gap-0.5 mb-3">
                    {Array.from({ length: t.stars }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-gray-700 text-sm mb-4 italic">&quot;{t.quote}&quot;</p>
                  <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                  <p className="text-xs text-gray-500">{t.salon}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Ready to Get Started?</h2>
          <p className="text-pink-100 mb-8">Log in to your SalonPro account and manage your salon from anywhere.</p>
          <Link href="/login">
            <Button size="lg" className="bg-white text-primary hover:bg-pink-50 px-8 h-12 text-base font-semibold shadow-lg">
              <LogIn className="w-4 h-4 mr-2" />
              Log In to Your Account
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <Scissors className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-white">SalonPro</span>
              </div>
              <p className="text-sm mb-2">World-class salon management software for modern businesses.</p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3 text-sm">Account</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/login" className="hover:text-white transition-colors">Log In</Link></li>
                <li><Link href="/reset-password" className="hover:text-white transition-colors">Reset Password</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-6 flex flex-col md:flex-row items-center justify-between gap-2">
            <p className="text-xs">© 2024 SalonPro. All rights reserved.</p>
            <p className="text-xs text-gray-600">Powered by SalonPro</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Loader2, UserPlus } from 'lucide-react'

export default function SignupPage() {
  const router = useRouter()
  const [salonName, setSalonName] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    setLoading(true)

    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, salon_name: salonName },
      },
    })

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: data.user.id,
        email,
        full_name: fullName,
        salon_name: salonName,
      })

      if (profileError) {
        console.error('Profile creation error:', profileError)
      }
    }

    toast.success('Account created! Redirecting to dashboard...')
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <Card className="w-full max-w-md shadow-xl shadow-gray-200/50">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-2xl">Create Your Account</CardTitle>
        <CardDescription>
          Start your 14-day free trial — no credit card required
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="salonName">Salon / Spa Name</Label>
            <Input
              id="salonName"
              type="text"
              placeholder="e.g. Glamour Beauty Lounge"
              value={salonName}
              onChange={(e) => setSalonName(e.target.value)}
              required
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Your Full Name</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="e.g. Fatima Ahmed"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Min. 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="h-10"
            />
          </div>
          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90 h-10"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <UserPlus className="w-4 h-4 mr-2" />
            )}
            {loading ? 'Creating account...' : 'Create Free Account'}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-gray-400">
          By signing up you agree to our Terms of Service and Privacy Policy.
        </p>

        <div className="mt-4 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

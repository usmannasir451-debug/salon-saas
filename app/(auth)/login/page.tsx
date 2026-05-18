import type { Metadata } from 'next'
import LoginForm from './LoginForm'

export const metadata: Metadata = {
  title: 'Login',
  description: 'Sign in to your Snipforce salon management dashboard to manage appointments, staff, and finances.',
  robots: {
    index: false,
    follow: false,
  },
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const { email } = await searchParams
  return <LoginForm initialEmail={email ?? ''} />
}

import Link from 'next/link'
import { Scissors } from 'lucide-react'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-rose-50 flex flex-col">
      <header className="px-4 py-4">
        <Link href="/" className="inline-flex items-center gap-2 group">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Scissors className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-gray-900 group-hover:text-primary transition-colors">
            Snipforce
          </span>
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        {children}
      </main>
      <footer className="text-center text-xs text-gray-400 py-4 space-y-1">
        <p>© 2026 Snipforce. All rights reserved.</p>
        <p className="text-gray-300">Powered by Snipforce</p>
      </footer>
    </div>
  )
}

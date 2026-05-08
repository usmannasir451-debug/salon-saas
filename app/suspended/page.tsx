import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Scissors, MessageCircle } from 'lucide-react'

export default async function SuspendedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-rose-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center gap-2 mb-8">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <Scissors className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl text-gray-900">SalonPro</span>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 p-8 border border-gray-100">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-red-500" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-3">Account Suspended</h1>
          <p className="text-gray-600 mb-8">
            Your account has been suspended. Please contact SalonPro support to restore access.
          </p>

          <a
            href="https://wa.me/923171116067"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button className="w-full bg-green-500 hover:bg-green-600 text-white h-11 text-base">
              <MessageCircle className="w-5 h-5 mr-2" />
              Contact Support on WhatsApp
            </Button>
          </a>
        </div>

        <form action="/auth/signout" method="post" className="mt-4">
          <button type="submit" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
            Sign out
          </button>
        </form>
      </div>
    </div>
  )
}

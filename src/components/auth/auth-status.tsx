"use client"

import { useUser, useClerk } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ShimmerButton } from '@/components/magicui'
import { User, LogIn } from 'lucide-react'

export function AuthStatus() {
  const { isLoaded, isSignedIn, user } = useUser()
  const { signOut } = useClerk()
  const router = useRouter()

  const handleSignOut = async () => {
    try {
      await signOut({ redirectUrl: '/sign-in' })
    } catch (error) {
      console.error('Error signing out:', error)
      // Fallback: redirect manually
      router.push('/sign-in')
    }
  }

  if (!isLoaded) {
    return (
      <div className="p-6 bg-gradient-to-r from-routiq-cloud/20 to-routiq-prompt/10 rounded-xl border border-routiq-cloud/30">
        <div className="flex items-center space-x-3">
          <div className="w-5 h-5 border-2 border-routiq-prompt border-t-transparent rounded-full animate-spin"></div>
          <p className="text-routiq-core font-medium">Loading authentication...</p>
        </div>
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <div className="p-6 bg-gradient-to-r from-routiq-prompt/10 to-routiq-energy/10 rounded-xl border border-routiq-prompt/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-routiq-prompt/20 rounded-lg">
              <LogIn className="h-5 w-5 text-routiq-prompt" />
            </div>
            <div>
              <p className="text-routiq-core font-medium">Ready to access your dashboard</p>
              <p className="text-sm text-routiq-blackberry/70">Sign in to continue</p>
            </div>
          </div>
          <Link href="/sign-in">
            <ShimmerButton variant="primary" className="px-6 py-2">
              Sign In
            </ShimmerButton>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 bg-gradient-to-r from-routiq-prompt/10 to-routiq-energy/10 rounded-xl border border-routiq-prompt/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-routiq-prompt/20 rounded-lg">
            <User className="h-5 w-5 text-routiq-prompt" />
          </div>
          <div>
            <p className="text-routiq-core font-medium">Welcome back!</p>
            <p className="text-sm text-routiq-blackberry/70">{user.emailAddresses[0]?.emailAddress}</p>
          </div>
        </div>
        <ShimmerButton 
          variant="secondary"
          onClick={handleSignOut}
          className="px-6 py-2"
        >
          Sign Out
        </ShimmerButton>
      </div>
    </div>
  )
} 
"use client"

// Force dynamic rendering to prevent SSR issues with Clerk
export const dynamic = 'force-dynamic'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function ConversationsPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to the new phone chat interface
    router.replace('/dashboard/conversations/phone')
  }, [router])

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="relative">
        {/* Outer spinning ring */}
        <div className="absolute inset-0 w-20 h-20 border-4 border-gray-200 border-t-routiq-energy rounded-full animate-routiq-spin"></div>
        
        {/* Inner pulsing ring */}
        <div className="absolute inset-2 w-16 h-16 border-2 border-routiq-cloud/30 rounded-full animate-routiq-pulse"></div>
        
        {/* Routiq Logo */}
        <div className="w-20 h-20 flex items-center justify-center animate-routiq-fade-in">
          <Image
            src="/logos/routiq-logomark-core.svg"
            alt="Routiq"
            width={40}
            height={40}
            className="w-10 h-10"
          />
        </div>
      </div>
    </div>
  )
} 
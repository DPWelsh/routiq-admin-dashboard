"use client"

import { SignIn } from '@clerk/nextjs'

export default function Page() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Blurred Dashboard Background */}
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url('/dashboard-preview.png')`,
          filter: 'blur(8px)',
          transform: 'scale(1.1)', // Slightly scale to avoid blur edges
        }}
      />
      
      {/* Dark overlay for better contrast */}
      <div className="absolute inset-0 bg-black/20" />
      
      {/* Login Form Overlay */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <SignIn 
            appearance={{
              elements: {
                formButtonPrimary: 
                  'bg-routiq-core hover:bg-routiq-core/90 text-white',
                card: 'shadow-2xl backdrop-blur-sm bg-white/95 border border-white/20',
                headerTitle: 'text-routiq-core',
                headerSubtitle: 'text-gray-600',
                socialButtonsBlockButton: 
                  'border-gray-200 hover:border-routiq-core/50 bg-white/80 backdrop-blur-sm',
                formFieldInput: 
                  'border-gray-200 focus:border-routiq-core focus:ring-routiq-core/20 bg-white/90',
                footerActionLink: 'text-routiq-core hover:text-routiq-core/80'
              }
            }}
          />
        </div>
      </div>
    </div>
  )
} 
"use client"

import { ClerkProvider } from '@clerk/nextjs'
import { ReactNode } from 'react'

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  // Get environment variables directly to avoid import issues during build
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

  if (!publishableKey) {
    console.warn('⚠️ Clerk publishable key not found, authentication may not work properly')
    return <>{children}</>
  }

  return (
    <ClerkProvider 
      publishableKey={publishableKey}
      afterSignOutUrl="/sign-in"
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      appearance={{
        baseTheme: undefined,
        variables: {
          colorPrimary: '#000000',
        },
        elements: {
          formButtonPrimary: 'bg-black hover:bg-gray-800 text-sm normal-case',
        },
      }}
    >
      {children}
    </ClerkProvider>
  )
} 
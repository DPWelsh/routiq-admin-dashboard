import { env, debugEnv } from '@/config/env'

// Centralized Clerk configuration
export const clerkConfig = {
  publishableKey: env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  secretKey: env.CLERK_SECRET_KEY,
}

// Debug function to check environment variables
export function debugClerkConfig() {
  console.log('🔑 [CLERK] Environment check:', {
    hasPublishableKey: !!env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    hasSecretKey: !!env.CLERK_SECRET_KEY,
    publishableKeyPrefix: env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.substring(0, 10),
    isProduction: env.NODE_ENV === 'production',
  })
  
  // Also run general env debug
  debugEnv()
} 
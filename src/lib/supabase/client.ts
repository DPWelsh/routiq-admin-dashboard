import { createClient } from '@supabase/supabase-js'
import { useSession } from '@clerk/nextjs'
import { auth } from '@clerk/nextjs/server'

// Browser client for client-side components
export function createBrowserClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Browser client with Clerk auth for client components
export function createClerkSupabaseClient(getToken: () => Promise<string | null>) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      async accessToken() {
        return await getToken() ?? null
      }
    }
  )
}

// Server client with Clerk auth for server components/API routes
export async function createServerClient() {
  const { getToken } = await auth()
  
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      async accessToken() {
        return await getToken() ?? null
      }
    }
  )
}

// Hook for using Supabase in client components
export function useSupabase() {
  const { session } = useSession()
  
  return createClerkSupabaseClient(async () => {
    return session?.getToken() ?? null
  })
} 
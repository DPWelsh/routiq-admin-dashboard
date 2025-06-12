import { NextResponse } from 'next/server'

export async function GET() {
  // Temporarily allow in production for debugging
  // if (process.env.NODE_ENV === 'production') {
  //   return NextResponse.json({ error: 'Debug endpoint disabled in production' }, { status: 403 })
  // updates again
  // }

  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV,
    hasClerkPublishableKey: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    clerkPublishableKeyPrefix: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.substring(0, 15),
    hasClerkSecretKey: !!process.env.CLERK_SECRET_KEY,
    clerkSecretKeyPrefix: process.env.CLERK_SECRET_KEY?.substring(0, 15),
    timestamp: new Date().toISOString(),
  })
} 
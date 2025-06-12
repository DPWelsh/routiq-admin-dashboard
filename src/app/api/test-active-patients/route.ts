import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@clerk/nextjs/server'

export async function GET(request: NextRequest) {
  try {
    const { userId, orgId } = await auth()
    
    console.log('[TEST] Auth:', { userId, orgId })
    
    // Try a simple query first
    const count = await prisma.activePatients.count()
    console.log('[TEST] Total count (no filter):', count)
    
    // Try with organization filter
    const orgCount = await prisma.activePatients.count({
      where: {
        organizationId: orgId!
      }
    })
    console.log('[TEST] Org count:', orgCount)
    
    // Get sample data
    const sample = await prisma.activePatients.findMany({
      take: 5,
      select: {
        id: true,
        organizationId: true,
        name: true
      }
    })
    console.log('[TEST] Sample data:', sample)
    
    return NextResponse.json({
      success: true,
      data: {
        totalCount: count,
        orgCount,
        orgId,
        sample
      }
    })
  } catch (error) {
    console.error('[TEST] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
} 
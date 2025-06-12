'use server'

import { auth } from '@clerk/nextjs/server'
import { getOrganizationContext } from '@/lib/auth/organization-context'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function getDashboardStats() {
  try {
    console.log('📊 SERVER ACTION: Getting dashboard stats...')
    
    // Get authentication (should work in server actions)
    const authResult = await auth()
    console.log('📊 SERVER ACTION: Auth result:', { userId: authResult.userId })
    
    if (!authResult.userId) {
      throw new Error('Authentication required')
    }
    
    // Get organization context
    const orgContext = await getOrganizationContext(authResult.userId)
    console.log('📊 SERVER ACTION: Organization context:', orgContext)
    
    if (!orgContext) {
      throw new Error('Organization membership required')
    }
    
    // Get organization-scoped conversation count
    const conversationsCount = await prisma.conversation.count({
      where: {
        organizationId: orgContext.organizationId,
        patient: {
          phone: {
            contains: ''
          }
        }
      }
    })
    
    // Get organization-scoped active patients count
    const recentDate = new Date()
    recentDate.setDate(recentDate.getDate() - 30)
    
    const activePatientsCount = await prisma.patient.count({
      where: {
        organizationId: orgContext.organizationId,
        status: 'active',
        conversations: {
          some: {
            createdAt: {
              gte: recentDate
            }
          }
        }
      }
    })
    
    // Get organization-scoped message count
    const messagesCount = await prisma.message.count({
      where: {
        organizationId: orgContext.organizationId,
        deletedAt: null
      }
    })
    
    // Get escalations
    const escalationCount = await prisma.conversation.count({
      where: {
        organizationId: orgContext.organizationId,
        escalationFlag: true
      }
    })
    
    const stats = {
      conversations: {
        total: conversationsCount,
        label: conversationsCount.toString(),
        withEscalations: escalationCount
      },
      activePatients: {
        total: activePatientsCount,
        label: activePatientsCount.toString()
      },
      messages: {
        total: messagesCount
      },
      insights: {
        escalationRate: conversationsCount > 0 ? 
          Number(((escalationCount / conversationsCount) * 100).toFixed(1)) : 0,
        averageSentiment: null,
        messagesPerConversation: conversationsCount > 0 ? 
          Number((messagesCount / conversationsCount).toFixed(1)) : 0
      },
      organizationContext: {
        organizationId: orgContext.organizationId,
        organizationName: orgContext.organizationName,
        userRole: orgContext.userRole
      },
      lastUpdated: new Date().toISOString()
    }
    
    console.log('📊 SERVER ACTION: Stats retrieved successfully')
    return { success: true, data: stats }
    
  } catch (error) {
    console.error('📊 SERVER ACTION ERROR:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
} 
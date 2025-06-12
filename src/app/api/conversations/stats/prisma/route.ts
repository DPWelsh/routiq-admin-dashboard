import { NextResponse } from 'next/server'
import { prisma } from '@/lib/database/clients/prisma'
import { logger } from '@/lib/logging/logger'

export async function GET() {
  try {
    logger.api.request('GET', '/api/conversations/stats/prisma')
    
    // Get overview stats
    const totalConversations = await prisma.conversation.count()
    const totalMessages = await prisma.message.count()
    
    // Get earliest and latest message times
    const earliestMessage = await prisma.message.findFirst({
      orderBy: { timestamp: 'asc' },
      select: { timestamp: true }
    })
    
    const latestMessage = await prisma.message.findFirst({
      orderBy: { timestamp: 'desc' },
      select: { timestamp: true }
    })
    
    // Get message types count
    const messageTypes = await prisma.message.groupBy({
      by: ['senderType'],
      _count: {
        senderType: true
      }
    })
    
    const response = {
      success: true,
      data: {
        overview: {
          total_conversations: totalConversations.toString(),
          total_messages: totalMessages.toString(),
          earliest_message: earliestMessage?.timestamp?.toISOString() || new Date().toISOString(),
          latest_message: latestMessage?.timestamp?.toISOString() || new Date().toISOString()
        },
        messageTypes: messageTypes.map(type => ({
          message_type: type.senderType,
          count: type._count.senderType.toString()
        }))
      }
    }
    
    logger.api.response('GET', '/api/conversations/stats/prisma', 200, { 
      totalConversations, 
      totalMessages 
    })
    return NextResponse.json(response)
  } catch (error) {
    logger.api.error('GET', '/api/conversations/stats/prisma', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch conversation stats from Prisma',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 
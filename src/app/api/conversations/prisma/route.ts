import { NextResponse } from 'next/server'
import { prisma } from '@/lib/database/clients/prisma'
import { logger } from '@/lib/logging/logger'

interface ConversationMetadata {
  topic?: string
  [key: string]: unknown
}

export async function GET() {
  try {
    logger.api.request('GET', '/api/conversations/prisma')
    
    const conversations = await prisma.conversation.findMany({
      include: {
        messages: {
          orderBy: {
            timestamp: 'asc'
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
    
    // Transform to match the expected format
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transformedConversations = conversations.map((conv: any) => {
      const messages = conv.messages || []
      const firstMessage = messages[0]
      const lastMessage = messages[messages.length - 1]
      const startTime = firstMessage?.timestamp || conv.createdAt
      const endTime = lastMessage?.timestamp || conv.updatedAt
      
      const metadata = conv.metadata as ConversationMetadata
      
      return {
        session_id: conv.id,
        topic: metadata?.topic || 'No topic',
        category: conv.source, // Use source as category
        message_count: messages.length,
        start_time: startTime,
        end_time: endTime,
        duration_minutes: Math.round((endTime.getTime() - startTime.getTime()) / 1000 / 60),
        first_message: firstMessage?.content || '',
        last_message: lastMessage?.content || ''
      }
    })
    
    const response = {
      success: true,
      data: transformedConversations,
      count: transformedConversations.length
    }
    
    logger.api.response('GET', '/api/conversations/prisma', 200, { count: response.count })
    return NextResponse.json(response)
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    logger.api.error('GET', '/api/conversations/prisma', message)
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch conversations',
        details: message
      },
      { status: 500 }
    )
  }
} 
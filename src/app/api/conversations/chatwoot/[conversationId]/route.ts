import { NextResponse } from 'next/server'
import { getChatwootConversationMessages } from '@/lib/database/clients/chatwoot'
import { logger } from '@/lib/logging/logger'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const resolvedParams = await params
  try {
    const conversationId = parseInt(resolvedParams.conversationId)
    
    if (isNaN(conversationId)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid conversation ID',
          details: 'Conversation ID must be a number'
        },
        { status: 400 }
      )
    }
    
    logger.api.request('GET', `/api/conversations/chatwoot/${conversationId}`)
    
    const messages = await getChatwootConversationMessages(conversationId)
    
    const response = {
      success: true,
      data: messages,
      count: messages.length
    }
    
    logger.api.response('GET', `/api/conversations/chatwoot/${conversationId}`, 200, { count: messages.length })
    return NextResponse.json(response)
  } catch (error) {
    logger.api.error('GET', `/api/conversations/chatwoot/${resolvedParams.conversationId}`, error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch Chatwoot conversation messages',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 
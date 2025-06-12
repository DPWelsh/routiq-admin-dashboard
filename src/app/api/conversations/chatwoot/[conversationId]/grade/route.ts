import { NextResponse } from 'next/server'
import { saveChatwootConversationGrade, getChatwootConversationGrade } from '@/lib/database/clients/chatwoot'
import { logger } from '@/lib/logging/logger'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params
  
  try {
    const body = await request.json()
    const { overallRating, needsFollowup, trainingNotes, gradedBy } = body
    
    logger.api.request('POST', `/api/conversations/chatwoot/${conversationId}/grade`, { overallRating, needsFollowup })
    
    const grade = await saveChatwootConversationGrade(
      parseInt(conversationId),
      overallRating,
      needsFollowup,
      trainingNotes,
      gradedBy
    )
    
    const response = {
      success: true,
      data: grade
    }
    
    logger.api.response('POST', `/api/conversations/chatwoot/${conversationId}/grade`, 200)
    return NextResponse.json(response)
  } catch (error) {
    logger.api.error('POST', `/api/conversations/chatwoot/${conversationId}/grade`, error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to save conversation grade',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params
  
  try {
    logger.api.request('GET', `/api/conversations/chatwoot/${conversationId}/grade`)
    
    const grade = await getChatwootConversationGrade(parseInt(conversationId))
    
    const response = {
      success: true,
      data: grade
    }
    
    logger.api.response('GET', `/api/conversations/chatwoot/${conversationId}/grade`, 200)
    return NextResponse.json(response)
  } catch (error) {
    logger.api.error('GET', `/api/conversations/chatwoot/${conversationId}/grade`, error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch conversation grade',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 
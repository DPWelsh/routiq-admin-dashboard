import { Client } from 'pg'
import { logger } from '../../logging/logger'

// Connection to Main database
const createN8nDbClient = () => {
  const connectionString = process.env.DATABASE_URL
  
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set')
  }
  
  return new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  })
}

export interface N8nMessage {
  id: number
  session_id: string
  message: {
    type: 'ai' | 'human'
    content: string
    additional_kwargs?: Record<string, unknown>
    response_metadata?: Record<string, unknown>
    tool_calls?: unknown[]
    invalid_tool_calls?: unknown[]
  }
  timestampz: Date
}

export interface ConversationSummary {
  session_id: string
  topic: string
  category: 'CONFIRMATION' | 'RESCHEDULE' | 'QUESTION' | 'OTHER'
  message_count: number
  start_time: Date
  end_time: Date
  duration_minutes: number
  first_message: string
  last_message: string
}

function categorizeConversation(messages: N8nMessage[]): 'CONFIRMATION' | 'RESCHEDULE' | 'QUESTION' | 'OTHER' {
  const allContent = messages
    .map(m => m.message?.content || '')
    .filter(content => content.length > 0)
    .join(' ')
    .toLowerCase()
  
  if (allContent.includes('confirm') || allContent.includes('appointment reminder') || allContent.includes('click the button')) {
    return 'CONFIRMATION'
  }
  
  if (allContent.includes('reschedule') || allContent.includes('move') || allContent.includes('change') || allContent.includes('cancel')) {
    return 'RESCHEDULE'
  }
  
  if (allContent.includes('?') || allContent.includes('how much') || allContent.includes('what') || allContent.includes('when')) {
    return 'QUESTION'
  }
  
  return 'OTHER'
}

function generateTopic(messages: N8nMessage[]): string {
  const allContent = messages
    .map(m => m.message?.content || '')
    .filter(content => content.length > 0)
    .join(' ')
    .toLowerCase()
  
  if (allContent.includes('appointment') || allContent.includes('session') || allContent.includes('booking')) {
    if (allContent.includes('alister')) {
      return 'Appointment with Alister'
    }
    return 'Appointment Booking'
  }
  
  if (allContent.includes('cost') || allContent.includes('price') || allContent.includes('rate') || allContent.includes('payment')) {
    return 'Pricing Inquiry'
  }
  
  if (allContent.includes('physio') || allContent.includes('injury') || allContent.includes('pain') || allContent.includes('treatment')) {
    return 'Health Consultation'
  }
  
  return 'General Conversation'
}

export async function getConversations(): Promise<ConversationSummary[]> {
  const client = createN8nDbClient()
  
  try {
    await client.connect()
    logger.db.query('getConversations', 'n8n_chat_histories')
    
    // Fetch all messages grouped by session
    const result = await client.query(`
      SELECT 
        id,
        session_id,
        message,
        timestampz
      FROM n8n_chat_histories 
      ORDER BY session_id, timestampz ASC;
    `)
    
    // Group messages by session_id
    const sessionGroups = new Map<string, N8nMessage[]>()
    
    result.rows.forEach((row: Record<string, unknown>) => {
      const sessionId = row.session_id as string
      if (!sessionGroups.has(sessionId)) {
        sessionGroups.set(sessionId, [])
      }
      
      // Parse the message JSON if it's a string
      let messageData: N8nMessage['message']
      try {
        if (typeof row.message === 'string') {
          messageData = JSON.parse(row.message)
        } else {
          messageData = row.message as N8nMessage['message']
        }
      } catch (error) {
        logger.warn(`Failed to parse message JSON for row ${row.id}:`, error)
        messageData = { type: 'human', content: '' }
      }
      
      sessionGroups.get(sessionId)!.push({
        id: row.id as number,
        session_id: row.session_id as string,
        message: messageData,
        timestampz: new Date(row.timestampz as string)
      })
    })
    
    // Convert to conversation summaries
    const conversations: ConversationSummary[] = []
    
    for (const [sessionId, messages] of sessionGroups) {
      messages.sort((a, b) => a.timestampz.getTime() - b.timestampz.getTime())
      
      // Filter out messages with null/empty content
      const validMessages = messages.filter(m => m.message?.content && m.message.content.trim().length > 0)
      
      if (validMessages.length === 0) {
        logger.warn(`Skipping session ${sessionId} - no valid messages`)
        continue
      }
      
      const startTime = validMessages[0].timestampz
      const endTime = validMessages[validMessages.length - 1].timestampz
      const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 1000 / 60)
      
      conversations.push({
        session_id: sessionId,
        topic: generateTopic(validMessages),
        category: categorizeConversation(validMessages),
        message_count: validMessages.length,
        start_time: startTime,
        end_time: endTime,
        duration_minutes: durationMinutes,
        first_message: validMessages[0].message.content,
        last_message: validMessages[validMessages.length - 1].message.content
      })
    }
    
    // Sort by most recent first
    conversations.sort((a, b) => b.start_time.getTime() - a.start_time.getTime())
    
    logger.info(`Retrieved ${conversations.length} conversations`)
    return conversations
    
  } catch (error) {
    logger.db.error('getConversations', 'n8n_chat_histories', error)
    throw error
  } finally {
    await client.end()
  }
}

export async function getConversationMessages(sessionId: string): Promise<N8nMessage[]> {
  const client = createN8nDbClient()
  
  try {
    await client.connect()
    logger.db.query('getConversationMessages', 'n8n_chat_histories', { sessionId })
    
    const result = await client.query(`
      SELECT 
        id,
        session_id,
        message,
        timestampz
      FROM n8n_chat_histories 
      WHERE session_id = $1
      ORDER BY timestampz ASC;
    `, [sessionId])
    
    const messages = result.rows.map((row: Record<string, unknown>) => {
      // Parse the message JSON if it's a string
      let messageData: N8nMessage['message']
      try {
        if (typeof row.message === 'string') {
          messageData = JSON.parse(row.message)
        } else {
          messageData = row.message as N8nMessage['message']
        }
      } catch (error) {
        logger.warn(`Failed to parse message JSON for row ${row.id}:`, error)
        messageData = { type: 'human', content: '' }
      }
      
      return {
        id: row.id as number,
        session_id: row.session_id as string,
        message: messageData,
        timestampz: new Date(row.timestampz as string)
      }
    })
    
    logger.info(`Retrieved ${messages.length} messages for session ${sessionId}`)
    return messages
    
  } catch (error) {
    logger.db.error('getConversationMessages', 'n8n_chat_histories', error)
    throw error
  } finally {
    await client.end()
  }
}

export async function getConversationStats() {
  const client = createN8nDbClient()
  
  try {
    await client.connect()
    logger.db.query('getConversationStats', 'n8n_chat_histories')
    
    const statsResult = await client.query(`
      SELECT 
        COUNT(DISTINCT session_id) as total_conversations,
        COUNT(*) as total_messages,
        MIN(timestampz) as earliest_message,
        MAX(timestampz) as latest_message
      FROM n8n_chat_histories;
    `)
    
    // Get message counts by parsing JSON in application code
    let humanCount = 0
    let aiCount = 0
    
    try {
      // Use the EXACT same approach as getConversationMessages which works
      const messagesResult = await client.query(`
        SELECT 
          id,
          session_id,
          message,
          timestampz
        FROM n8n_chat_histories 
        ORDER BY timestampz ASC
      `)
      
      messagesResult.rows.forEach((row: Record<string, unknown>) => {
        // Use the EXACT same parsing logic as getConversationMessages
        let messageData: N8nMessage['message']
        try {
          if (typeof row.message === 'string') {
            messageData = JSON.parse(row.message)
          } else {
            messageData = row.message as N8nMessage['message']
          }
          
          // Use the same filtering logic as individual conversations
          if (messageData?.content && messageData.content.trim().length > 0) {
            if (messageData.type === 'human') {
              humanCount++
            } else if (messageData.type === 'ai') {
              aiCount++
            }
          }
        } catch (error) {
          // Use same fallback as getConversationMessages - skip invalid messages
          logger.warn(`Failed to parse message JSON for row ${row.id}:`, error)
        }
      })
      
      logger.info(`Message counts: human=${humanCount}, ai=${aiCount}`)
    } catch (error) {
      logger.warn('Failed to parse message types, using default counts:', error)
    }
    
    const stats = {
      overview: statsResult.rows[0],
      messageTypes: [
        { message_type: 'human', count: humanCount.toString() },
        { message_type: 'ai', count: aiCount.toString() }
      ]
    }
    
    logger.info('Retrieved conversation statistics')
    return stats
    
  } catch (error) {
    logger.db.error('getConversationStats', 'n8n_chat_histories', error)
    throw error
  } finally {
    await client.end()
  }
} 
import { BaseDatabaseService } from './base-database-service'

/**
 * ⚠️  CRITICAL: DO NOT CONVERT TO PRISMA ORM
 * 
 * This service uses RAW SQL intentionally to avoid UUID casting errors.
 * The phone-centric architecture prevents PostgreSQL UUID casting issues
 * that occur when using Prisma ORM with phone string parameters.
 * 
 * Previous attempts to use Prisma ORM resulted in:
 * "ERROR: operator does not exist: uuid = text"
 * 
 * Converting these queries to Prisma will BREAK the system.
 */

// TypeScript interfaces matching the raw SQL results
export interface ConversationListItem {
  patient_id: string
  phone: string
  patient_name: string
  email: string
  conversation_id: string
  conversation_source: string | null
  conversation_updated_at: Date
  total_messages: bigint                      // PostgreSQL COUNT() returns BigInt
  last_message_time: Date | null
  last_message_content: string | null
}

export interface ConversationMessage {
  id: string
  external_id: string
  content: string
  sender_type: 'user' | 'agent' | 'system'
  timestamp: Date
  metadata: unknown
}

export interface ConversationDetail {
  conversation: ConversationListItem
  messages: ConversationMessage[]
}

/**
 * Conversation Database Service
 * 
 * ⚠️  WARNING: Uses raw SQL to avoid Prisma ORM UUID casting conflicts
 * 
 * This service handles all phone-based conversation queries using raw SQL.
 * The phone-centric approach eliminates UUID type casting errors that
 * occurred with Prisma ORM when phone strings were used as parameters.
 * 
 * DO NOT REFACTOR TO PRISMA ORM - It will break phone parameter handling.
 */
export class ConversationService extends BaseDatabaseService {
  
  /**
   * Get all conversations with phone numbers (for sidebar list)
   * 
   * ⚠️  Uses raw SQL to avoid UUID casting issues with phone parameters
   * 
   * @returns Promise<ConversationListItem[]> - List of conversations with metadata
   */
  static async getAllPhoneConversations(): Promise<ConversationListItem[]> {
    console.log('📊 ConversationService: Fetching all phone conversations via raw SQL')
    console.log('🔧 Service details:', {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      databaseUrl: process.env.DATABASE_URL?.substring(0, 30) + '...'
    })
    
    const service = new ConversationService()
    
    // Raw SQL query - DO NOT convert to Prisma ORM
    // This specific query structure avoids UUID casting errors
    const sqlQuery = `
      SELECT DISTINCT
        p.id as patient_id,
        p.phone,
        p.name as patient_name,
        p.email,
        c.id as conversation_id,
        c.source as conversation_source,
        c.updated_at as conversation_updated_at,
        COALESCE(msg_counts.total_messages, 0) as total_messages,
        latest_msg.timestamp as last_message_time,
        latest_msg.content as last_message_content
      FROM patients p
      INNER JOIN conversations c ON p.id = c.patient_id
      LEFT JOIN (
        SELECT 
          conversation_id,
          COUNT(*) as total_messages
        FROM messages 
        GROUP BY conversation_id
      ) msg_counts ON c.id = msg_counts.conversation_id
      LEFT JOIN (
        SELECT DISTINCT ON (conversation_id)
          conversation_id,
          timestamp,
          content
        FROM messages
        ORDER BY conversation_id, timestamp DESC
      ) latest_msg ON c.id = latest_msg.conversation_id
      WHERE p.phone IS NOT NULL AND p.phone != ''
      ORDER BY latest_msg.timestamp DESC NULLS LAST
      LIMIT 50 OFFSET 0
    `
    
    console.log('📝 Executing SQL query:', {
      queryLength: sqlQuery.length,
      queryPreview: sqlQuery.substring(0, 100) + '...',
      parameters: []
    })
    
    try {
      const queryStartTime = Date.now()
      const conversations = await service.executeQuery<ConversationListItem>(sqlQuery, [], 'get-all-phone-conversations')
      const queryExecutionTime = Date.now() - queryStartTime
      
      console.log(`✅ ConversationService: Retrieved ${conversations.length} conversations in ${queryExecutionTime}ms`)
      console.log('📊 Query results sample:', conversations.slice(0, 2).map(c => ({
        patient_id: c.patient_id?.substring(0, 8) + '...',
        phone: c.phone,
        patient_name: c.patient_name,
        total_messages: c.total_messages?.toString(),
        conversation_source: c.conversation_source
      })))
      
      return conversations
    } catch (error) {
      console.error('💥 ConversationService Error in getAllPhoneConversations:')
      console.error('🔍 Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
      
      // Re-throw the error to be handled by the API route
      throw error
    }
  }

  /**
   * Get specific conversation details by phone number
   * 
   * ⚠️  Uses phone-based queries to avoid UUID casting errors
   * 
   * This method fetches both conversation metadata and all messages
   * for a specific phone number using JOIN relationships instead of
   * direct UUID casting which causes PostgreSQL errors.
   * 
   * @param phone - Patient's phone number (e.g., "+61439818201")
   * @returns Promise<ConversationDetail | null> - Conversation with messages or null if not found
   */
  static async getConversationByPhone(phone: string): Promise<ConversationDetail | null> {
    console.log(`📞 ConversationService: Fetching conversation for phone: ${phone}`)
    
    const service = new ConversationService()
    
    // Get conversation metadata using phone-based JOIN
    // DO NOT change to: WHERE conversation_id = $1::uuid (WILL BREAK)
    const conversationData = await service.executeQuery<ConversationListItem>(`
      SELECT DISTINCT
        p.id as patient_id,
        p.phone,
        p.name as patient_name,
        p.email,
        c.id as conversation_id,
        c.source as conversation_source,
        c.updated_at as conversation_updated_at,
        COALESCE(msg_counts.total_messages, 0) as total_messages,
        latest_msg.timestamp as last_message_time,
        latest_msg.content as last_message_content
      FROM patients p
      INNER JOIN conversations c ON p.id = c.patient_id
      LEFT JOIN (
        SELECT 
          conversation_id,
          COUNT(*) as total_messages
        FROM messages 
        GROUP BY conversation_id
      ) msg_counts ON c.id = msg_counts.conversation_id
      LEFT JOIN (
        SELECT DISTINCT ON (conversation_id)
          conversation_id,
          timestamp,
          content
        FROM messages
        ORDER BY conversation_id, timestamp DESC
      ) latest_msg ON c.id = latest_msg.conversation_id
      WHERE p.phone = $1
      LIMIT 1
    `, [phone], 'get-conversation-by-phone')
    
    if (!conversationData || conversationData.length === 0) {
      console.log(`❌ ConversationService: No conversation found for phone: ${phone}`)
      return null
    }
    
    const conversation = conversationData[0]
    
    // Get messages using phone-based JOIN (not conversation_id)
    // This approach avoids UUID casting entirely
    const messages = await service.executeQuery<ConversationMessage>(`
      SELECT 
        m.id::text,
        m.external_id,
        m.content,
        m.sender_type,
        m.timestamp,
        m.metadata
      FROM messages m
      INNER JOIN conversations c ON m.conversation_id = c.id
      INNER JOIN patients p ON c.patient_id = p.id
      WHERE p.phone = $1
      ORDER BY m.timestamp ASC
    `, [phone], 'get-messages-by-phone')
    
    console.log(`✅ ConversationService: Retrieved conversation with ${messages.length} messages`)
    
    return {
      conversation,
      messages
    }
  }

  /**
   * Convert BigInt fields to Numbers for JSON serialization
   * 
   * PostgreSQL COUNT() returns BigInt which cannot be JSON serialized.
   * This helper converts BigInt fields to Numbers for API responses.
   * 
   * @param conversation - Raw conversation data with BigInt fields
   * @returns Conversation data with Numbers instead of BigInt
   */
  static formatConversationForJSON(conversation: ConversationListItem) {
    return {
      patient_id: conversation.patient_id,
      phone: conversation.phone,
      patient_name: conversation.patient_name,
      email: conversation.email,
      conversation_id: conversation.conversation_id,
      conversation_source: conversation.conversation_source,
      conversation_updated_at: conversation.conversation_updated_at,
      total_messages: Number(conversation.total_messages), // Convert BigInt to Number
      last_message_time: conversation.last_message_time,
      last_message_content: conversation.last_message_content
    }
  }

  /**
   * Convert array of conversations for JSON serialization
   * 
   * @param conversations - Array of raw conversation data with BigInt fields
   * @returns Array of conversation data with Numbers instead of BigInt
   */
  static formatConversationsForJSON(conversations: ConversationListItem[]) {
    return conversations.map(conversation => 
      ConversationService.formatConversationForJSON(conversation)
    )
  }
}

/**
 * ⚠️  DEVELOPER NOTES FOR FUTURE MAINTENANCE:
 * 
 * 1. DO NOT convert raw SQL to Prisma ORM - it will break UUID handling
 * 2. Phone numbers must be URL-encoded when used in routes
 * 3. BigInt fields must be converted to Number for JSON serialization
 * 4. All queries use phone-based JOINs, never direct UUID casting
 * 5. This pattern exists to solve specific PostgreSQL/Prisma conflicts
 * 
 * If you want to refactor this:
 * - First fix the original Prisma UUID casting issues
 * - Or migrate to direct PostgreSQL client (remove Prisma entirely)
 * - Test extensively with phone number parameters
 */ 
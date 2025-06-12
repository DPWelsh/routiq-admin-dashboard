import { BaseDatabaseService } from './base-database-service'

/**
 * Conversations Database Service
 * 
 * Handles all conversation-related database operations using raw SQL.
 * Replaces Prisma usage to avoid prepared statement conflicts.
 */

// Database row interfaces matching actual schema
export interface ConversationRow {
  phone: string
  patient_name: string
  email: string
  conversation_id: string
  conversation_start: Date
  conversation_last_activity: Date
  total_messages: string // BigInt from PostgreSQL comes as string
  first_message_time: Date | null
  last_message_time: Date | null
}

export interface MessageRow {
  id: string
  conversation_id: string
  sender_type: string
  content: string
  timestamp: Date
  sentiment_score: number | null
  sentiment_label: string | null
}

export interface ConversationListRow {
  phone: string
  patient_name: string
  email: string
  conversation_id: string
  total_messages: string // BigInt from PostgreSQL comes as string
  last_message_time: Date | null
  last_message_content: string | null
  conversation_source: string | null
}

// Response interfaces for API
export interface ConversationDetails {
  phone: string
  patient_name: string
  email: string
  conversation_id: string
  conversation_start: Date
  conversation_last_activity: Date
  total_messages: number
  first_message_time: Date | null
  last_message_time: Date | null
}

export interface ConversationMessage {
  id: string
  conversation_id: string
  sender_type: string
  content: string
  timestamp: Date
  sentiment_score: number | null
  sentiment_label: string | null
}

export interface ConversationListItem {
  phone: string
  patient_name: string
  email: string
  conversation_id: string
  total_messages: number
  last_message_time: Date | null
  last_message_content: string | null
  conversation_source: string | null
}

export interface ConversationResponse {
  conversation: ConversationDetails | null
  messages: ConversationMessage[]
}

export interface ConversationListResponse {
  conversations: ConversationListItem[]
  total: number
  offset: number
  limit: number
}

export class ConversationsService extends BaseDatabaseService {
  
  /**
   * Get conversation details and messages for a specific phone number
   */
  async getConversationByPhone(phone: string, requestId?: string): Promise<ConversationResponse> {
    // Get conversation details
    const conversationQuery = `
      SELECT 
        p.phone,
        p.name as patient_name,
        p.email,
        c.id as conversation_id,
        c.created_at as conversation_start,
        c.updated_at as conversation_last_activity,
        COUNT(m.id) as total_messages,
        MIN(m.timestamp) as first_message_time,
        MAX(m.timestamp) as last_message_time
      FROM patients p
      LEFT JOIN conversations c ON p.id = c.patient_id
      LEFT JOIN messages m ON c.id = m.conversation_id
      WHERE p.phone = $1
      GROUP BY p.id, p.phone, p.name, p.email, c.id, c.created_at, c.updated_at
    `
    
    const conversationRows = await this.executeQuery<ConversationRow>(
      conversationQuery, 
      [phone], 
      'get-conversation-by-phone',
      requestId
    )
    
    if (conversationRows.length === 0) {
      return { conversation: null, messages: [] }
    }
    
    // Convert the first result
    const rawConversation = conversationRows[0]
    const conversation: ConversationDetails = {
      ...rawConversation,
      total_messages: Number(rawConversation.total_messages)
    }
    
    // Get detailed messages
    const messagesQuery = `
      SELECT 
        m.id,
        m.conversation_id,
        m.sender_type,
        m.content,
        m.timestamp,
        m.sentiment_score,
        m.sentiment_label
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      JOIN patients p ON c.patient_id = p.id
      WHERE p.phone = $1
      ORDER BY m.timestamp ASC
    `
    
    const messages = await this.executeQuery<ConversationMessage>(
      messagesQuery, 
      [phone], 
      'get-messages-by-phone',
      requestId
    )
    
    return { conversation, messages }
  }
  
  /**
   * Get list of all conversations with pagination
   */
  async getConversationsList(
    limit = 50, 
    offset = 0,
    requestId?: string
  ): Promise<ConversationListResponse> {
    const query = `
      SELECT 
        p.phone,
        p.name as patient_name,
        p.email,
        c.id as conversation_id,
        COUNT(m.id) as total_messages,
        MAX(m.timestamp) as last_message_time,
        MAX(m.content) as last_message_content,
        c.source as conversation_source
      FROM patients p
      LEFT JOIN conversations c ON p.id = c.patient_id
      LEFT JOIN messages m ON c.id = m.conversation_id
      WHERE c.id IS NOT NULL
      GROUP BY p.id, p.phone, p.name, p.email, c.id, c.source
      ORDER BY MAX(m.timestamp) DESC NULLS LAST
      LIMIT $1 OFFSET $2
    `
    
    const rows = await this.executeQuery<ConversationListRow>(
      query, 
      [limit, offset], 
      'get-conversations-list',
      requestId
    )
    
    // Convert BigInt to number and transform to response format
    const conversations: ConversationListItem[] = rows.map(row => ({
      ...row,
      total_messages: Number(row.total_messages)
    }))
    
    return {
      conversations,
      total: conversations.length,
      offset,
      limit
    }
  }
  
  /**
   * Get conversation count for metrics
   */
  async getConversationCount(requestId?: string): Promise<number> {
    return this.executeQueryCount(
      'SELECT COUNT(*) as count FROM conversations WHERE deleted_at IS NULL',
      [],
      'get-conversation-count',
      requestId
    )
  }
  
  /**
   * Get message count for metrics
   */
  async getMessageCount(requestId?: string): Promise<number> {
    return this.executeQueryCount(
      'SELECT COUNT(*) as count FROM messages WHERE deleted_at IS NULL',
      [],
      'get-message-count',
      requestId
    )
  }
  
  /**
   * Search conversations by content or patient info
   */
  async searchConversations(
    searchTerm: string,
    limit = 20,
    offset = 0,
    requestId?: string
  ): Promise<ConversationListResponse> {
    const query = `
      SELECT DISTINCT
        p.phone,
        p.name as patient_name,
        p.email,
        c.id as conversation_id,
        COUNT(m.id) as total_messages,
        MAX(m.timestamp) as last_message_time,
        MAX(m.content) as last_message_content,
        c.source as conversation_source
      FROM patients p
      LEFT JOIN conversations c ON p.id = c.patient_id
      LEFT JOIN messages m ON c.id = m.conversation_id
      WHERE c.id IS NOT NULL AND (
        p.name ILIKE $1 OR 
        p.phone ILIKE $1 OR 
        p.email ILIKE $1 OR
        m.content ILIKE $1
      )
      GROUP BY p.id, p.phone, p.name, p.email, c.id, c.source
      ORDER BY MAX(m.timestamp) DESC NULLS LAST
      LIMIT $2 OFFSET $3
    `
    
    const searchPattern = `%${searchTerm}%`
    const rows = await this.executeQuery<ConversationListRow>(
      query, 
      [searchPattern, limit, offset], 
      'search-conversations',
      requestId
    )
    
    const conversations: ConversationListItem[] = rows.map(row => ({
      ...row,
      total_messages: Number(row.total_messages)
    }))
    
    return {
      conversations,
      total: conversations.length,
      offset,
      limit
    }
  }
} 
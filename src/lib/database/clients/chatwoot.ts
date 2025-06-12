import { logger } from '../../logging/logger'

// Database row interfaces
interface ConversationRow {
  id: number
  status: string
  created_at: string
  total_messages: number
  customer_messages: number
  agent_messages: number
  avg_response_time_minutes: string | null
  customer_name: string | null
  phone_number: string | null
  cliniko_id: string | null
  assigned_agent: string | null
  last_message_at: string | null
  overall_rating: number | null
  needs_followup: boolean | null
  training_notes: string | null
  graded_at: string | null
  graded_by: string | null
}

interface MessageRow {
  id: number
  content: string
  message_type: number
  sender_name: string | null
  created_at: string
  is_customer_message: boolean
  is_agent_message: boolean
  word_count: number | null
  response_time_minutes: string | null
  conversation_id: number
  sentiment: Record<string, unknown> | null
  customer_name?: string
  phone_number?: string
  cliniko_id?: string
  conversation_status?: string
  status?: string
}

interface AgentPerformanceRow {
  agent_name: string
  total_messages: string
  avg_response_time: string | null
  conversations_handled: string
  avg_message_length: string | null
}

interface ResponseTimeRow {
  agent_name: string
  response_time_minutes: string
  created_at: string
  conversation_id: number
}

interface StatsOverviewRow {
  total_conversations: string
  total_messages: string
  earliest_message: string | null
  latest_message: string | null
}

interface MessageTypeRow {
  message_type: string
  count: string
}

interface StatusRow {
  status: string
  count: string
  percentage: string
}

interface DailyVolumeRow {
  date: string
  total_messages: string
  customer_messages: string
  agent_messages: string
}

interface ContactRow {
  id: number
  name: string | null
  phone_number: string | null
  email: string | null
  cliniko_id: string | null
  custom_attributes: Record<string, unknown> | null
  created_at: string
}

interface ContactConversationRow {
  id: number
  status: string
  created_at: string
  total_messages: number
  avg_response_time_minutes: string | null
  customer_name: string | null
}

// TypeScript interfaces for Chatwoot data
export interface ChatwootContact {
  id: number
  name: string
  phone_number: string
  email: string
  cliniko_id: string
  custom_attributes: Record<string, unknown>
  created_at: Date
}

export interface ChatwootConversation {
  id: number
  status: string
  created_at: Date
  total_messages: number
  customer_messages: number
  agent_messages: number
  avg_response_time_minutes: number
  customer_name: string
  phone_number: string
  cliniko_id: string
  assigned_agent: string
  last_message_at?: Date
  grade?: ConversationGrade
}

export interface ChatwootMessage {
  id: number
  content: string
  message_type: number
  sender_name: string
  created_at: Date
  is_customer_message: boolean
  is_agent_message: boolean
  word_count: number
  response_time_minutes: number
  conversation_id: number
  sentiment: Record<string, unknown>
}

export interface ChatwootStats {
  overview: {
    total_conversations: number
    total_messages: number
    earliest_message: Date
    latest_message: Date
  }
  messageTypes: Array<{
    message_type: string
    count: number
  }>
  statusDistribution: Array<{
    status: string
    count: number
    percentage: number
  }>
}

export interface AgentPerformance {
  agent_name: string
  total_messages: number
  avg_response_time: number
  conversations_handled: number
  avg_message_length: number
}

export interface ConversationGrade {
  id: number
  conversation_id: number
  overall_rating: number
  needs_followup: boolean
  training_notes: string
  graded_at: Date
  graded_by: string
}

// Connection to Chatwoot database
const createChatwootDbClient = () => {
  const connectionString = process.env.CHATWOOT_DATABASE_URL || process.env.DATABASE_URL
  
  if (!connectionString) {
    throw new Error('Database connection failed: Neither CHATWOOT_DATABASE_URL nor DATABASE_URL environment variable is set. Please configure at least one of these variables in your production environment.')
  }
  
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Client } = require('pg')
  return new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  })
}

export class ChatwootDataAccess {
  private async executeQuery<T = Record<string, unknown>>(query: string, params: unknown[] = []): Promise<T[]> {
    const client = createChatwootDbClient()
    
    try {
      await client.connect()
      logger.db.query('chatwoot', query.substring(0, 50) + '...')
      
      const result = await client.query(query, params)
      return result.rows
    } catch (error) {
      logger.db.error('chatwoot', query.substring(0, 50) + '...', error)
      throw error
    } finally {
      await client.end()
    }
  }

  // =====================================================
  // CONVERSATION ANALYSIS
  // =====================================================

  async getConversations(status?: string, daysBack?: number): Promise<ChatwootConversation[]> {
    // First check if conversation_grades table exists
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'conversation_grades'
      );
    `
    
    const tableExistsResult = await this.executeQuery<{ exists: boolean }>(tableExistsQuery)
    const gradesTableExists = tableExistsResult[0]?.exists || false
    
    let query = `
      SELECT 
        conv.id,
        conv.status,
        conv.created_at,
        conv.total_messages,
        conv.customer_messages,
        conv.agent_messages,
        conv.avg_response_time_minutes,
        c.name as customer_name,
        c.phone_number,
        c.cliniko_id,
        (SELECT m.sender_name FROM chatwoot_messages m 
         WHERE m.conversation_id = conv.id AND m.is_agent_message = true 
         LIMIT 1) as assigned_agent,
        (SELECT MAX(m.created_at) FROM chatwoot_messages m 
         WHERE m.conversation_id = conv.id) as last_message_at
    `
    
    if (gradesTableExists) {
      query += `,
        g.overall_rating,
        g.needs_followup,
        g.training_notes,
        g.graded_at,
        g.graded_by`
    } else {
      query += `,
        NULL as overall_rating,
        NULL as needs_followup,
        NULL as training_notes,
        NULL as graded_at,
        NULL as graded_by`
    }
    
    query += `
      FROM chatwoot_conversations conv
      LEFT JOIN chatwoot_contacts c ON conv.contact_id = c.id`
    
    if (gradesTableExists) {
      query += `
      LEFT JOIN conversation_grades g ON conv.id = g.conversation_id`
    }
    
    query += `
      WHERE 1=1
    `
    
    const params: unknown[] = []
    if (status) {
      query += ` AND conv.status = $${params.length + 1}`
      params.push(status)
    }
    
    if (daysBack) {
      query += ` AND conv.created_at > $${params.length + 1}`
      params.push(new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000))
    }
    
    query += ` ORDER BY last_message_at DESC NULLS LAST`
    
    const rows = await this.executeQuery<ConversationRow>(query, params)
    
    // Group by phone number and keep only the most recent conversation per phone number
    const conversationMap = new Map<string, ConversationRow>()
    
    for (const row of rows) {
      const phoneKey = row.phone_number || `no-phone-${row.id}`
      if (!conversationMap.has(phoneKey) || 
          (row.last_message_at && conversationMap.get(phoneKey)!.last_message_at && 
           new Date(row.last_message_at) > new Date(conversationMap.get(phoneKey)!.last_message_at!))) {
        conversationMap.set(phoneKey, row)
      }
    }
    
    const uniqueRows = Array.from(conversationMap.values())
    
    return uniqueRows.map(row => ({
      ...row,
      created_at: new Date(row.created_at),
      avg_response_time_minutes: parseFloat(row.avg_response_time_minutes || '0') || 0,
      customer_name: row.customer_name || '',
      phone_number: row.phone_number || '',
      cliniko_id: row.cliniko_id || '',
      assigned_agent: row.assigned_agent || '',
      last_message_at: row.last_message_at ? new Date(row.last_message_at) : undefined,
      grade: row.overall_rating ? {
        id: 0, // We don't have the grade ID in this query
        conversation_id: row.id,
        overall_rating: row.overall_rating,
        needs_followup: row.needs_followup || false,
        training_notes: row.training_notes || '',
        graded_at: row.graded_at ? new Date(row.graded_at) : new Date(),
        graded_by: row.graded_by || ''
      } : undefined
    }))
  }

  async getConversationMessages(conversationId: number): Promise<ChatwootMessage[]> {
    const query = `
      SELECT 
        m.id,
        m.content,
        m.message_type,
        m.sender_name,
        m.created_at,
        m.is_customer_message,
        m.is_agent_message,
        m.word_count,
        m.response_time_minutes,
        m.conversation_id,
        m.sentiment
      FROM chatwoot_messages m
      WHERE m.conversation_id = $1
      ORDER BY m.created_at ASC
    `
    
    const rows = await this.executeQuery<MessageRow>(query, [conversationId])
    return rows.map(row => ({
      ...row,
      created_at: new Date(row.created_at),
      response_time_minutes: parseFloat(row.response_time_minutes || '0') || 0,
      sentiment: row.sentiment || {},
      sender_name: row.sender_name || '',
      word_count: row.word_count || 0
    }))
  }

  // =====================================================
  // CUSTOMER MESSAGE ANALYSIS
  // =====================================================

  async getCustomerMessages(limit?: number, daysBack?: number): Promise<ChatwootMessage[]> {
    let query = `
      SELECT 
        m.id,
        m.content,
        m.created_at,
        m.word_count,
        m.sentiment,
        c.name as customer_name,
        c.phone_number,
        c.cliniko_id,
        conv.status as conversation_status,
        m.conversation_id
      FROM chatwoot_messages m
      JOIN chatwoot_conversations conv ON m.conversation_id = conv.id
      JOIN chatwoot_contacts c ON conv.contact_id = c.id
      WHERE m.is_customer_message = true
    `
    
    const params: unknown[] = []
    if (daysBack) {
      query += ` AND m.created_at > $${params.length + 1}`
      params.push(new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000))
    }
    
    query += ` ORDER BY m.created_at DESC`
    
    if (limit) {
      query += ` LIMIT $${params.length + 1}`
      params.push(limit)
    }
    
    const rows = await this.executeQuery<MessageRow>(query, params)
    return rows.map(row => ({
      ...row,
      created_at: new Date(row.created_at),
      sentiment: row.sentiment || {},
      is_customer_message: true,
      is_agent_message: false,
      message_type: 0,
      response_time_minutes: 0,
      sender_name: '',
      word_count: row.word_count || 0
    }))
  }

  async getCustomerMessagesByContact(clinikoId?: string, phoneNumber?: string): Promise<ChatwootMessage[]> {
    if (!clinikoId && !phoneNumber) {
      throw new Error('Must provide either clinikoId or phoneNumber')
    }

    let query = `
      SELECT 
        m.content,
        m.created_at,
        m.word_count,
        conv.id as conversation_id,
        conv.status,
        m.sentiment
      FROM chatwoot_messages m
      JOIN chatwoot_conversations conv ON m.conversation_id = conv.id
      JOIN chatwoot_contacts c ON conv.contact_id = c.id
      WHERE m.is_customer_message = true
    `
    
    const params: unknown[] = []
    if (clinikoId) {
      query += ` AND c.cliniko_id = $${params.length + 1}`
      params.push(clinikoId)
    } else if (phoneNumber) {
      query += ` AND c.phone_number = $${params.length + 1}`
      params.push(phoneNumber)
    }
    
    query += ` ORDER BY m.created_at ASC`
    
    const rows = await this.executeQuery<MessageRow>(query, params)
    return rows.map(row => ({
      ...row,
      id: 0,
      created_at: new Date(row.created_at),
      sentiment: row.sentiment || {},
      is_customer_message: true,
      is_agent_message: false,
      message_type: 0,
      sender_name: '',
      response_time_minutes: 0,
      word_count: row.word_count || 0
    }))
  }

  // =====================================================
  // AGENT PERFORMANCE ANALYSIS
  // =====================================================

  async getAgentPerformance(): Promise<AgentPerformance[]> {
    const query = `
      SELECT 
        m.sender_name as agent_name,
        COUNT(*) as total_messages,
        AVG(m.response_time_minutes) as avg_response_time,
        COUNT(DISTINCT m.conversation_id) as conversations_handled,
        AVG(m.word_count) as avg_message_length
      FROM chatwoot_messages m
      WHERE m.is_agent_message = true
      GROUP BY m.sender_name
      ORDER BY avg_response_time ASC
    `
    
    const rows = await this.executeQuery<AgentPerformanceRow>(query)
    return rows.map(row => ({
      agent_name: row.agent_name,
      total_messages: parseInt(row.total_messages),
      avg_response_time: parseFloat(row.avg_response_time || '0') || 0,
      conversations_handled: parseInt(row.conversations_handled),
      avg_message_length: parseFloat(row.avg_message_length || '0') || 0
    }))
  }

  async getResponseTimes(agentName?: string, daysBack: number = 7): Promise<Array<{
    agent_name: string
    response_time_minutes: number
    created_at: string
    conversation_id: number
  }>> {
    let query = `
      SELECT 
        m.sender_name as agent_name,
        m.response_time_minutes,
        m.created_at,
        conv.id as conversation_id
      FROM chatwoot_messages m
      JOIN chatwoot_conversations conv ON m.conversation_id = conv.id
      WHERE m.is_agent_message = true 
      AND m.response_time_minutes IS NOT NULL
      AND m.created_at > $1
    `
    
    const params: unknown[] = [new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)]
    
    if (agentName) {
      query += ` AND m.sender_name = $${params.length + 1}`
      params.push(agentName)
    }
    
    query += ` ORDER BY m.created_at DESC`
    
    const rows = await this.executeQuery<ResponseTimeRow>(query, params)
    return rows.map(row => ({
      ...row,
      created_at: new Date(row.created_at).toISOString(),
      response_time_minutes: parseFloat(row.response_time_minutes) || 0
    }))
  }

  // =====================================================
  // ANALYTICS & REPORTING
  // =====================================================

  async getConversationStats(): Promise<ChatwootStats> {
    // Get overview stats
    const overviewQuery = `
      SELECT 
        COUNT(DISTINCT conv.id) as total_conversations,
        COUNT(m.id) as total_messages,
        MIN(m.created_at) as earliest_message,
        MAX(m.created_at) as latest_message
      FROM chatwoot_conversations conv
      LEFT JOIN chatwoot_messages m ON conv.id = m.conversation_id
    `
    
    const overviewRows = await this.executeQuery<StatsOverviewRow>(overviewQuery)
    const overview = overviewRows[0]
    
    // Get message types
    const messageTypesQuery = `
      SELECT 
        CASE 
          WHEN is_customer_message THEN 'customer'
          WHEN is_agent_message THEN 'agent'
          ELSE 'system'
        END as message_type,
        COUNT(*) as count
      FROM chatwoot_messages
      GROUP BY 
        CASE 
          WHEN is_customer_message THEN 'customer'
          WHEN is_agent_message THEN 'agent'
          ELSE 'system'
        END
    `
    
    const messageTypeRows = await this.executeQuery<MessageTypeRow>(messageTypesQuery)
    
    // Get status distribution
    const statusQuery = `
      SELECT 
        status,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
      FROM chatwoot_conversations
      GROUP BY status
      ORDER BY count DESC
    `
    
    const statusRows = await this.executeQuery<StatusRow>(statusQuery)
    
    return {
      overview: {
        total_conversations: parseInt(overview.total_conversations) || 0,
        total_messages: parseInt(overview.total_messages) || 0,
        earliest_message: overview.earliest_message ? new Date(overview.earliest_message) : new Date(),
        latest_message: overview.latest_message ? new Date(overview.latest_message) : new Date()
      },
      messageTypes: messageTypeRows.map(row => ({
        message_type: row.message_type,
        count: parseInt(row.count)
      })),
      statusDistribution: statusRows.map(row => ({
        status: row.status,
        count: parseInt(row.count),
        percentage: parseFloat(row.percentage)
      }))
    }
  }

  async getDailyMessageVolume(daysBack: number = 30): Promise<Array<{
    date: string
    total_messages: number
    customer_messages: number
    agent_messages: number
  }>> {
    const query = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total_messages,
        COUNT(CASE WHEN is_customer_message THEN 1 END) as customer_messages,
        COUNT(CASE WHEN is_agent_message THEN 1 END) as agent_messages
      FROM chatwoot_messages
      WHERE created_at > $1
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `
    
    const rows = await this.executeQuery<DailyVolumeRow>(query, [new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)])
    return rows.map(row => ({
      ...row,
      date: new Date(row.date).toISOString(),
      total_messages: parseInt(row.total_messages),
      customer_messages: parseInt(row.customer_messages),
      agent_messages: parseInt(row.agent_messages)
    }))
  }

  // =====================================================
  // CONTACT MANAGEMENT
  // =====================================================

  async getContacts(hasClinikoId?: boolean): Promise<ChatwootContact[]> {
    let query = `
      SELECT 
        id,
        name,
        phone_number,
        email,
        cliniko_id,
        custom_attributes,
        created_at
      FROM chatwoot_contacts
      WHERE 1=1
    `
    
    const params: unknown[] = []
    if (hasClinikoId !== undefined) {
      if (hasClinikoId) {
        query += ` AND cliniko_id IS NOT NULL`
      } else {
        query += ` AND cliniko_id IS NULL`
      }
    }
    
    query += ` ORDER BY created_at DESC`
    
    const rows = await this.executeQuery<ContactRow>(query, params)
    return rows.map(row => ({
      ...row,
      created_at: new Date(row.created_at),
      custom_attributes: row.custom_attributes || {},
      name: row.name || '',
      phone_number: row.phone_number || '',
      email: row.email || '',
      cliniko_id: row.cliniko_id || ''
    }))
  }

  async getContactConversationHistory(clinikoId?: string, phoneNumber?: string): Promise<ChatwootConversation[]> {
    if (!clinikoId && !phoneNumber) {
      throw new Error('Must provide either clinikoId or phoneNumber')
    }

    let query = `
      SELECT 
        conv.id,
        conv.status,
        conv.created_at,
        conv.total_messages,
        conv.avg_response_time_minutes,
        c.name as customer_name
      FROM chatwoot_conversations conv
      JOIN chatwoot_contacts c ON conv.contact_id = c.id
      WHERE 1=1
    `
    
    const params: unknown[] = []
    if (clinikoId) {
      query += ` AND c.cliniko_id = $${params.length + 1}`
      params.push(clinikoId)
    } else if (phoneNumber) {
      query += ` AND c.phone_number = $${params.length + 1}`
      params.push(phoneNumber)
    }
    
    query += ` ORDER BY conv.created_at DESC`
    
    const rows = await this.executeQuery<ContactConversationRow>(query, params)
    return rows.map(row => ({
      ...row,
      created_at: new Date(row.created_at),
      avg_response_time_minutes: parseFloat(row.avg_response_time_minutes || '0') || 0,
      customer_messages: 0,
      agent_messages: 0,
      phone_number: '',
      cliniko_id: '',
      assigned_agent: '',
      customer_name: row.customer_name || ''
    }))
  }

  // =====================================================
  // CONVERSATION GRADING
  // =====================================================

  async saveConversationGrade(
    conversationId: number,
    overallRating: number,
    needsFollowup: boolean,
    trainingNotes: string,
    gradedBy: string
  ): Promise<ConversationGrade> {
    // Check if table exists first
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'conversation_grades'
      );
    `
    
    const tableExistsResult = await this.executeQuery<{ exists: boolean }>(tableExistsQuery)
    const gradesTableExists = tableExistsResult[0]?.exists || false
    
    if (!gradesTableExists) {
      throw new Error('Conversation grades table does not exist. Please run the conversation_grades_schema.sql to create it.')
    }
    
    const query = `
      INSERT INTO conversation_grades (
        conversation_id, overall_rating, needs_followup, training_notes, graded_by, graded_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (conversation_id) 
      DO UPDATE SET 
        overall_rating = EXCLUDED.overall_rating,
        needs_followup = EXCLUDED.needs_followup,
        training_notes = EXCLUDED.training_notes,
        graded_by = EXCLUDED.graded_by,
        graded_at = NOW()
      RETURNING *
    `
    
    const rows = await this.executeQuery<{
      id: number
      conversation_id: number
      overall_rating: number
      needs_followup: boolean
      training_notes: string
      graded_at: string
      graded_by: string
    }>(query, [conversationId, overallRating, needsFollowup, trainingNotes, gradedBy])
    
    const row = rows[0]
    return {
      ...row,
      graded_at: new Date(row.graded_at)
    }
  }

  async getConversationGrade(conversationId: number): Promise<ConversationGrade | null> {
    const query = `
      SELECT * FROM conversation_grades WHERE conversation_id = $1
    `
    
    const rows = await this.executeQuery<{
      id: number
      conversation_id: number
      overall_rating: number
      needs_followup: boolean
      training_notes: string
      graded_at: string
      graded_by: string
    }>(query, [conversationId])
    
    if (rows.length === 0) return null
    
    const row = rows[0]
    return {
      ...row,
      graded_at: new Date(row.graded_at)
    }
  }

  async getGradingStats(): Promise<{
    totalGraded: number
    averageRating: number
    needsFollowupCount: number
    ratingDistribution: Array<{ rating: number; count: number }>
  }> {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_graded,
        AVG(overall_rating) as average_rating,
        COUNT(CASE WHEN needs_followup THEN 1 END) as needs_followup_count
      FROM conversation_grades
    `
    
    const distributionQuery = `
      SELECT 
        overall_rating as rating,
        COUNT(*) as count
      FROM conversation_grades
      GROUP BY overall_rating
      ORDER BY overall_rating
    `
    
    const [statsRows, distributionRows] = await Promise.all([
      this.executeQuery<{
        total_graded: string
        average_rating: string
        needs_followup_count: string
      }>(statsQuery),
      this.executeQuery<{
        rating: number
        count: string
      }>(distributionQuery)
    ])
    
    const stats = statsRows[0]
    
    return {
      totalGraded: parseInt(stats.total_graded) || 0,
      averageRating: parseFloat(stats.average_rating) || 0,
      needsFollowupCount: parseInt(stats.needs_followup_count) || 0,
      ratingDistribution: distributionRows.map(row => ({
        rating: row.rating,
        count: parseInt(row.count)
      }))
    }
  }
}

// Export singleton instance
export const chatwootDb = new ChatwootDataAccess()

// Export convenience functions that match the existing n8n-db pattern
export async function getChatwootConversations(status?: string, daysBack?: number): Promise<ChatwootConversation[]> {
  return chatwootDb.getConversations(status, daysBack)
}

export async function getChatwootConversationMessages(conversationId: number): Promise<ChatwootMessage[]> {
  return chatwootDb.getConversationMessages(conversationId)
}

export async function getChatwootStats(): Promise<ChatwootStats> {
  return chatwootDb.getConversationStats()
}

export async function getChatwootAgentPerformance(): Promise<AgentPerformance[]> {
  return chatwootDb.getAgentPerformance()
}

export async function getChatwootCustomerMessages(limit?: number, daysBack?: number): Promise<ChatwootMessage[]> {
  return chatwootDb.getCustomerMessages(limit, daysBack)
}

export async function saveChatwootConversationGrade(
  conversationId: number,
  overallRating: number,
  needsFollowup: boolean,
  trainingNotes: string,
  gradedBy: string
): Promise<ConversationGrade> {
  return chatwootDb.saveConversationGrade(conversationId, overallRating, needsFollowup, trainingNotes, gradedBy)
}

export async function getChatwootConversationGrade(conversationId: number): Promise<ConversationGrade | null> {
  return chatwootDb.getConversationGrade(conversationId)
}

export async function getChatwootGradingStats(): Promise<{
  totalGraded: number
  averageRating: number
  needsFollowupCount: number
  ratingDistribution: Array<{ rating: number; count: number }>
}> {
  return chatwootDb.getGradingStats()
} 
/**
 * Dashboard Stats API V2 - Using Supabase with RLS
 * This is an example of how API routes will look after migration
 * 
 * Key Changes:
 * - No manual organization filtering needed
 * - Simpler code with automatic RLS protection
 * - Better performance with database-level filtering
 */

import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/client'
import { auth } from '@clerk/nextjs/server'

export async function GET(request: NextRequest) {
  try {
    // Check if user is authenticated
    const { userId } = await auth()
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'content-type': 'application/json' } }
      )
    }

    // Create Supabase client with Clerk auth
    const supabase = await createServerClient()

    // Get dashboard stats - NO MANUAL FILTERING NEEDED!
    // RLS automatically filters by organization
    const [
      conversationsResult,
      patientsResult,
      messagesResult,
      escalationsResult
    ] = await Promise.all([
      // Total conversations
      supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true }),

      // Active patients
      supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active'),

      // Total messages (through conversations)
      supabase
        .from('messages')
        .select('*', { count: 'exact', head: true }),

      // Conversations with escalations
      supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('escalation_flag', true)
    ])

    // Get sentiment data
    const { data: sentimentData } = await supabase
      .from('conversations')
      .select('sentiment_score')
      .not('sentiment_score', 'is', null)

    // Calculate averages
    const avgSentiment = sentimentData?.length
      ? sentimentData.reduce((sum, conv) => sum + Number(conv.sentiment_score), 0) / sentimentData.length
      : 0

    const totalConversations = conversationsResult.count || 0
    const totalMessages = messagesResult.count || 0
    const escalations = escalationsResult.count || 0

    // Build response
    const stats = {
      conversations: {
        total: totalConversations,
        label: totalConversations.toString(),
        withEscalations: escalations
      },
      activePatients: {
        total: patientsResult.count || 0,
        label: (patientsResult.count || 0).toString()
      },
      messages: {
        total: totalMessages
      },
      insights: {
        escalationRate: totalConversations > 0 
          ? Number(((escalations / totalConversations) * 100).toFixed(1))
          : 0,
        averageSentiment: Number(avgSentiment.toFixed(1)),
        messagesPerConversation: totalConversations > 0
          ? Number((totalMessages / totalConversations).toFixed(1))
          : 0
      },
      lastUpdated: new Date().toISOString()
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: stats,
        metadata: {
          timestamp: new Date().toISOString(),
          dataSource: 'supabase-rls'
        }
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('[Dashboard Stats V2] Error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to fetch dashboard stats',
        code: 'STATS_FETCH_ERROR'
      }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' }
      }
    )
  }
}

// Force dynamic rendering
export const dynamic = 'force-dynamic' 
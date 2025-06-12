"use client"

/**
 * ⚠️  CRITICAL: Phone Conversations Interface - DO NOT MODIFY CORE PATTERNS
 * 
 * This component uses a phone-centric architecture with specific patterns
 * that solve UUID casting and prepared statement conflicts. Breaking these
 * patterns will cause conversations to stop loading.
 * 
 * KEY PATTERNS THAT MUST BE PRESERVED:
 * 1. Phone number URL encoding: encodeURIComponent(phone) everywhere
 * 2. API response structure handling (multiple formats supported)
 * 3. URL state management with phone parameters
 * 4. Three-panel layout with fixed height calculations
 * 
 * IF MAKING MOBILE RESPONSIVE:
 * - Create NEW mobile components, don't modify this one
 * - Use responsive classes to show/hide panels
 * - Preserve ALL existing API calling patterns
 * - Test phone parameter handling extensively
 */

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ArrowLeft, Phone, Search, MessageCircle, Clock, User, Bot, Send, MoreVertical, ThumbsUp, ThumbsDown, TrendingUp, Award, Target, MessageSquare, Star, BarChart3 } from "lucide-react"
import { LoadingSpinner } from "@/components/magicui"
import { Separator } from "@/components/ui/separator"
import Image from "next/image"
import { useAuth } from '@clerk/nextjs'
import { useConversationPerformance } from '@/hooks/useConversationPerformance'

/**
 * ⚠️  DO NOT MODIFY: These interfaces match the phone-centric API responses
 * 
 * Changing these interfaces will break the API communication.
 * The optional fields exist for backward compatibility with different
 * API response formats that evolved over time.
 */
interface PhoneConversation {
  phone: string
  patient_name: string
  email: string
  patient_id?: string
  conversation_id: string
  conversation_source?: string
  conversation_updated_at?: string
  total_messages: number
  last_message_time?: string
  last_message_content?: string
  last_message_sender?: string
  latest_conversation_date?: string
  // Legacy fields for backward compatibility
  patient_status?: string
  conversation_start?: string
  conversation_last_activity?: string
  bot_messages?: number
  user_messages?: number
  system_messages?: number
  first_message_time?: string
}

interface PhoneMessage {
  id: number
  content: string
  sender_type: 'user' | 'agent' | 'system'
  timestamp: string
  metadata: Record<string, unknown> | null
  external_id: string
}

interface ChatData {
  conversation: PhoneConversation
  messages: PhoneMessage[]
}

// Performance Panel Component
function ConversationPerformancePanel({ 
  conversation, 
  messages 
}: { 
  conversation: PhoneConversation | undefined
  messages: PhoneMessage[] 
}) {
  const [rating, setRating] = useState<'positive' | 'negative' | 'neutral' | null>(null)
  const [feedback, setFeedback] = useState('')
  const [showFeedback, setShowFeedback] = useState(false)
  // Add independent satisfaction score state
  const [clientSatisfactionScore, setClientSatisfactionScore] = useState<number | null>(null)

  // Use the real performance hook
  const { 
    performance, 
    loading: performanceLoading, 
    error: performanceError,
    submitRating,
    updatePerformance 
  } = useConversationPerformance(conversation?.conversation_id)

  // Initialize satisfaction score independently
  useEffect(() => {
    const satisfactionScore = performance?.satisfactionScore || (performance as unknown as Record<string, unknown>)?.satisfaction_score as number
    
    if (satisfactionScore && satisfactionScore !== clientSatisfactionScore) {
      setClientSatisfactionScore(satisfactionScore)
      console.log('🔍 Setting independent satisfaction score:', satisfactionScore)
    }
  }, [performance?.satisfactionScore])

  // Initialize rating state based on performance data - handle both field formats
  useEffect(() => {
    console.log('🔄 useEffect performance data check:', {
      performance: performance ? 'exists' : 'null',
      satisfactionScore: performance?.satisfactionScore,
      satisfactionFeedback: performance?.satisfactionFeedback,
      allPerformanceKeys: performance ? Object.keys(performance) : null,
      rawPerformance: performance
    })
    
    // Handle both camelCase and snake_case formats from API
    const satisfactionScore = performance?.satisfactionScore || (performance as unknown as Record<string, unknown>)?.satisfaction_score as number
    const satisfactionFeedback = performance?.satisfactionFeedback || (performance as unknown as Record<string, unknown>)?.satisfaction_feedback as string
    
    if (satisfactionScore) {
      // Convert database satisfaction score back to UI rating
      if (satisfactionScore >= 4) {
        setRating('positive')
      } else if (satisfactionScore === 3) {
        setRating('neutral') 
      } else {
        setRating('negative')
      }
      
      console.log('🔄 Initialized rating from database:', {
        satisfactionScore,
        satisfactionFeedback,
        uiRating: satisfactionScore >= 4 ? 'positive' : satisfactionScore === 3 ? 'neutral' : 'negative'
      })
    }
    
    // Set feedback if it exists
    if (satisfactionFeedback) {
      setFeedback(satisfactionFeedback)
      setShowFeedback(true)
    }
  }, [performance])

  // Debug state values
  useEffect(() => {
    console.log('🔍 Feedback box condition check:', {
      rating,
      feedback,
      showFeedback,
      shouldShow: ((showFeedback && rating) || (rating && feedback))
    })
  }, [rating, feedback, showFeedback])

  // Add safety check for conversation
  if (!conversation) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-3 border-b border-routiq-cloud/30 flex-shrink-0">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-routiq-prompt" />
            <h3 className="font-medium text-routiq-core text-sm">Performance</h3>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-3">
          <div className="text-center text-gray-500 text-sm">
            Loading conversation data...
          </div>
        </div>
      </div>
    )
  }

  // Calculate performance metrics from real data or use defaults
  const performanceScore = performance?.overallPerformanceScore || Math.round(
    // Fallback calculation based on message patterns
    (conversation.total_messages > 15 ? 70 : 85) + // More messages = lower score (complexity)
    (messages.filter(m => m.sender_type === 'user').length > 0 ? 10 : 0) + // User engagement
    (messages.filter(m => m.sender_type === 'agent').length > 2 ? 5 : 0) // Bot responsiveness
  )

  const resolutionStatus = performance?.status || 
    (conversation.total_messages > 10 ? "resolved" : "active")

  // Format status for display
  const formatStatusDisplay = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')
  }

  // Convert satisfaction score to text rating - INDEPENDENT from user feedback
  const getOverallRating = () => {
    console.log('🔍 Debug getOverallRating:', {
      performance,
      overallPerformanceScore: performance?.overallPerformanceScore,
      hasPerformance: !!performance,
      performanceKeys: performance ? Object.keys(performance) : null
    })
    
    // Use overallPerformanceScore (calculated separately) NOT satisfactionScore (user feedback)
    let overallScore = performance?.overallPerformanceScore
    
    // Fallback calculation if no overall score exists yet
    if (!overallScore && conversation) {
      // Temporary calculation based on conversation patterns
      overallScore = Math.round(
        (conversation.total_messages > 15 ? 65 : 80) + // More messages = lower score (complexity)
        (messages.filter(m => m.sender_type === 'user').length > 0 ? 10 : 0) + // User engagement
        (messages.filter(m => m.sender_type === 'agent').length > 2 ? 5 : 0) // Bot responsiveness
      )
    }
    
    if (!overallScore) return 'unrated'
    
    // Convert percentage-based score to rating
    if (overallScore >= 80) return 'good'
    if (overallScore >= 60) return 'ok'
    return 'bad'
  }

  // Calculate dummy sentiment score based on conversation data
  const getSentimentInfo = () => {
    // Dummy calculation based on message patterns and performance
    const messageCount = conversation.total_messages
    const hasPositiveKeywords = messages.some(m => 
      m.content?.toLowerCase().includes('thank') || 
      m.content?.toLowerCase().includes('great') ||
      m.content?.toLowerCase().includes('perfect')
    )
    const hasNegativeKeywords = messages.some(m => 
      m.content?.toLowerCase().includes('problem') || 
      m.content?.toLowerCase().includes('issue') ||
      m.content?.toLowerCase().includes('bad')
    )

    // Dummy sentiment logic
    let sentiment = 'Neutral'
    let color = 'text-gray-600'
    
    if (hasPositiveKeywords && messageCount < 20) {
      sentiment = 'Positive'
      color = 'text-green-600'
    } else if (hasNegativeKeywords || messageCount > 25) {
      sentiment = 'Negative' 
      color = 'text-red-600'
    } else if (messageCount > 15) {
      sentiment = 'Mixed'
      color = 'text-yellow-600'
    }

    return { sentiment, color }
  }

  const sentimentInfo = getSentimentInfo()

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'good': return "text-green-600"
      case 'ok': return "text-yellow-600"
      case 'bad': return "text-red-600"
      default: return "text-gray-600"
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600"
    if (score >= 80) return "text-yellow-600"
    return "text-red-600"
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!conversation?.conversation_id) return
    
    console.log('🔄 Updating status:', {
      conversationId: conversation.conversation_id,
      newStatus,
      currentPerformance: performance
    })
    
    try {
      const success = await updatePerformance({ status: newStatus })
      if (!success) {
        console.error('Failed to update status')
      } else {
        console.log('✅ Status updated successfully to:', newStatus)
      }
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  const handleRating = (newRating: 'positive' | 'negative' | 'neutral') => {
    console.log('🔄 Rating button clicked:', {
      newRating,
      currentRating: rating,
      conversationId: conversation?.conversation_id
    })
    
    setRating(newRating)
    setShowFeedback(true)
    
    console.log('✅ Rating state updated:', {
      newRating,
      showFeedback: true
    })
  }

  const submitFeedback = async () => {
    if (!conversation?.conversation_id) return

    try {
      // Convert UI rating to 1-5 scale
      const ratingValue = rating === 'positive' ? 5 : rating === 'neutral' ? 3 : 1
      
      const success = await submitRating(ratingValue, feedback.trim() || undefined)
      
      if (success) {
        // Update independent satisfaction score state
        setClientSatisfactionScore(ratingValue)
        console.log('✅ Rating submitted and independent satisfaction score updated:', ratingValue)
        // Don't hide feedback box - keep it visible to show submitted state
        // setShowFeedback(false)
        console.log('Rating submitted successfully')
        // User can see their submitted feedback and manually clear if needed
      } else {
        console.error('Failed to submit rating')
      }
    } catch (error) {
      console.error('Error submitting rating:', error)
    }
  }

  // Get client satisfaction score for donut chart (1-10 scale) - INDEPENDENT from status
  const getClientSatisfaction = () => {
    console.log('🔍 getClientSatisfaction using independent state:', {
      clientSatisfactionScore,
      performanceSatisfactionScore: performance?.satisfactionScore,
      independent: true
    })
    
    if (!clientSatisfactionScore) return { score: 0, text: 'unrated' }
    
    // Convert 1-5 scale to 1-10 scale and add text
    const scaledScore = clientSatisfactionScore * 2
    return { 
      score: scaledScore, 
      text: `${scaledScore}/10` 
    }
  }

  const satisfaction = getClientSatisfaction()

  const getSatisfactionColor = (score: number) => {
    if (score === 0) return "text-gray-600"
    if (score >= 8) return "text-green-600"
    if (score >= 6) return "text-yellow-600"
    return "text-red-600"
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-routiq-cloud/30 flex-shrink-0">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-routiq-prompt" />
          <h3 className="font-medium text-routiq-core text-sm">Performance</h3>
        </div>
      </div>

      {/* Performance Score - Scrollable Content */}
      <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-3">
        {performanceLoading ? (
          <div className="text-center text-gray-500 text-sm">
            Loading performance data...
          </div>
        ) : performanceError ? (
          <div className="text-center text-red-500 text-sm">
            Error loading performance data
          </div>
        ) : (
          <>
        <Card>
          <CardContent className="p-3">
            <div className="text-center">
              {/* Compact Donut Chart */}
              <div className="relative inline-flex items-center justify-center">
                <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                  {/* Background circle */}
                  <path
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-routiq-cloud/40"
                  />
                  {/* Progress circle */}
                  <path
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                        strokeDasharray={`${satisfaction.score === 0 ? 0 : (satisfaction.score / 10) * 100}, 100`}
                        className={getSatisfactionColor(satisfaction.score).replace('text-', 'text-')}
                  />
                </svg>
                {/* Center text */}
                <div className="absolute inset-0 flex items-center justify-center">
                      <div className={`text-lg font-bold ${getSatisfactionColor(satisfaction.score)}`}>
                        {satisfaction.text}
                  </div>
                </div>
              </div>
                  <p className="text-xs text-routiq-blackberry/70 mt-2">Client Satisfaction</p>
            </div>
          </CardContent>
        </Card>

        {/* Key Metrics */}
        <div className="space-y-2">
          <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-100">
            <div className="flex items-center gap-2">
              <Target className="h-3 w-3 text-routiq-blackberry/60" />
              <span className="text-xs text-routiq-core">Status</span>
            </div>
            <Select value={resolutionStatus} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-44 h-6 text-xs border-gray-300 bg-white hover:bg-gray-50 text-gray-700 focus:text-gray-700">
                <SelectValue>{formatStatusDisplay(resolutionStatus)}</SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-200 shadow-lg min-w-44">
                <SelectItem value="open" className="text-gray-700 hover:bg-gray-100 hover:text-gray-800 focus:bg-gray-100 focus:text-gray-800">Open</SelectItem>
                <SelectItem value="requires-follow-up" className="text-gray-700 hover:bg-gray-100 hover:text-gray-800 focus:bg-gray-100 focus:text-gray-800">Requires Follow-up</SelectItem>
                <SelectItem value="resolved" className="text-gray-700 hover:bg-gray-100 hover:text-gray-800 focus:bg-gray-100 focus:text-gray-800">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sentiment Score - Always show with dummy value for now */}
          <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-100">
            <div className="flex items-center gap-2">
              <Star className="h-3 w-3 text-routiq-blackberry/60" />
              <span className="text-xs text-routiq-core">Sentiment</span>
            </div>
            <span className={`text-xs font-medium ${sentimentInfo.color}`}>
              {sentimentInfo.sentiment}
            </span>
          </div>
        </div>

        <Separator />

        {/* Rating Section */}
        <div className="space-y-2">
          <h4 className="font-medium text-routiq-core text-sm">Rate this conversation</h4>
          
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => handleRating('positive')}
              className={`flex-1 gap-1 h-8 text-xs transition-all border ${
                rating === 'positive' 
                  ? 'bg-green-600 hover:bg-green-700 text-white border-green-600' 
                  : 'bg-white border-green-300 text-green-600 hover:bg-green-50 hover:border-green-400'
              }`}
            >
              <ThumbsUp className="h-3 w-3" />
              Good
            </Button>
            <Button
              size="sm"
              onClick={() => handleRating('neutral')}
              className={`flex-1 gap-1 h-8 text-xs transition-all border ${
                rating === 'neutral' 
                  ? 'bg-gray-600 hover:bg-gray-700 text-white border-gray-600' 
                  : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400'
              }`}
            >
              OK
            </Button>
            <Button
              size="sm"
              onClick={() => handleRating('negative')}
              className={`flex-1 gap-1 h-8 text-xs transition-all border ${
                rating === 'negative' 
                  ? 'bg-red-600 hover:bg-red-700 text-white border-red-600' 
                  : 'bg-white border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400'
              }`}
            >
              <ThumbsDown className="h-3 w-3" />
              Poor
            </Button>
          </div>

              {/* Conditional feedback box - show when rating is selected OR existing feedback exists */}
              {((showFeedback && rating) || (rating && feedback)) && (
          <div className="space-y-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder={
                rating === 'negative' 
                  ? "Describe any issues, errors, or problems with the AI bot's responses..."
                  : rating === 'neutral'
                  ? "Share any thoughts or suggestions about this conversation..."
                  : rating === 'positive'
                  ? "Share your feedback to help improve our AI bot..."
                  : "Rate the conversation and share your thoughts..."
              }
              className="w-full p-3 text-sm border border-gray-300 rounded-md resize-none h-24 focus:outline-none focus:ring-2 focus:ring-gray-400/30 focus:border-gray-400 bg-white"
            />
            <div className="flex gap-2">
              <Button 
                size="sm" 
                onClick={submitFeedback} 
                className="flex-1 h-8 text-xs bg-gray-600 hover:bg-gray-700 text-white border-0"
                      disabled={!rating}
              >
                Submit Feedback
              </Button>
              <Button 
                size="sm" 
                onClick={() => {
                  setRating(null)
                  setFeedback('')
                  setShowFeedback(false)
                }} 
                className="h-8 text-xs bg-white text-gray-600 hover:bg-gray-50 border border-gray-300"
              >
                Clear
              </Button>
            </div>
          </div>
              )}
        </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function PhoneChatPage() {
  const { getToken } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedPhone = searchParams.get('phone')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [conversations, setConversations] = useState<PhoneConversation[]>([])
  const [selectedChat, setSelectedChat] = useState<ChatData | null>(null)
  const [loading, setLoading] = useState(true)
  const [chatLoading, setChatLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchConversations()
  }, [])

  useEffect(() => {
    if (selectedPhone && conversations.length > 0) {
      const conversation = conversations.find(c => c.phone === selectedPhone)
      if (conversation) {
        fetchChatMessages(selectedPhone)
      }
    }
  }, [selectedPhone, conversations])

  useEffect(() => {
    scrollToBottom()
  }, [selectedChat?.messages])

  /**
   * ⚠️  CRITICAL: Fetches conversation list from phone-centric API
   * 
   * MUST USE encodeURIComponent for phone parameters - contains special characters.
   * Response structure varies by service layer evolution:
   * - New service structure: data.data.conversations (array)
   * - Legacy structure: data.conversations (array)
   * - Direct array format: data (array)
   */
  const fetchConversations = async () => {
    try {
      setLoading(true)
      console.log('🔄 Frontend: Starting fetchConversations...')
      
      const response = await fetch('/api/conversations/phone', {
        headers: {
          'Content-Type': 'application/json'
        }
      })
      console.log('📡 Frontend: API Response status:', response.status, response.statusText)
      
      if (!response.ok) {
        throw new Error('Failed to fetch conversations')
      }

      const data = await response.json()
      console.log('📋 Frontend: Full API response data:', data)
      console.log('📋 Frontend: data.success:', data.success)
      console.log('📋 Frontend: data.data:', data.data)
      console.log('📋 Frontend: data.data.conversations:', data.data?.conversations)
      console.log('📋 Frontend: data.data.conversations length:', data.data?.conversations?.length)
      console.log('📋 Frontend: data.data.conversations type:', typeof data.data?.conversations)
      console.log('📋 Frontend: data.data.conversations array check:', Array.isArray(data.data?.conversations))

      // ⚠️  CRITICAL: Handle different possible response structures
      // DO NOT simplify this - it handles API evolution and prevents breakage
      let conversationsArray = []
      
      if (data.data?.conversations && Array.isArray(data.data.conversations)) {
        // New service-based API structure: data.data.conversations
        conversationsArray = data.data.conversations
        console.log('✅ Frontend: Using data.data.conversations structure')
      } else if (data.conversations && Array.isArray(data.conversations)) {
        // Legacy structure: data.conversations
        conversationsArray = data.conversations
        console.log('✅ Frontend: Using data.conversations structure')
      } else if (Array.isArray(data)) {
        // Direct array response
        conversationsArray = data
        console.log('✅ Frontend: Using direct array structure')
      } else {
        console.log('❌ Frontend: No valid conversations array found in response')
        console.log('📋 Frontend: Available keys in data:', Object.keys(data))
        conversationsArray = []
      }

      console.log('✅ Frontend: Setting conversations array:', conversationsArray)
      console.log('✅ Frontend: Array length:', conversationsArray.length)
      
      setConversations(conversationsArray)
    } catch (error) {
      console.error('❌ Frontend: Error fetching conversations:', error)
      setConversations([])
    } finally {
      setLoading(false)
    }
  }

  /**
   * ⚠️  CRITICAL: Fetches specific conversation by phone number
   * 
   * PHONE ENCODING IS MANDATORY: Must use encodeURIComponent(phone)
   * The phone parameter must be URL-encoded to handle special characters
   * like "+" in phone numbers (+61439818201 → %2B61439818201).
   * 
   * DO NOT remove encodeURIComponent - it will break phone parameter handling.
   * 
   * @param phone - Patient's phone number (gets URL-encoded automatically)
   */
  const fetchChatMessages = async (phone: string) => {
    try {
      setChatLoading(true)
      console.log('🔄 Frontend: Fetching chat messages for phone:', phone)
      
      const response = await fetch(`/api/conversations/phone?phone=${encodeURIComponent(phone)}`, {
        headers: {
          'Content-Type': 'application/json'
        }
      })
      console.log('📡 Frontend: Chat API Response status:', response.status, response.statusText)
      
      if (!response.ok) {
        throw new Error('Failed to fetch chat messages')
      }

      const data = await response.json()
      console.log('📋 Frontend: Chat API response data:', data)
      console.log('📋 Frontend: data.success:', data.success)
      console.log('📋 Frontend: data.conversation:', data.conversation)
      console.log('📋 Frontend: data.messages:', data.messages)
      
      if (!data.success) {
        throw new Error('API returned error')
      }

      const chatData = {
        conversation: data.conversation,
        messages: data.messages || []
      }
      
      console.log('✅ Frontend: Setting selectedChat:', chatData)
      setSelectedChat(chatData)
    } catch (err) {
      console.error('❌ Frontend: Failed to load chat:', err)
    } finally {
      setChatLoading(false)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  /**
   * ⚠️  CRITICAL: Handles conversation selection with URL state management
   * 
   * PHONE ENCODING IS MANDATORY: Must use encodeURIComponent(phone)
   * This function updates the URL with the selected phone number and triggers
   * the conversation loading through URL state management.
   * 
   * DO NOT modify the URL structure or remove encoding - it will break
   * browser back/forward navigation and conversation selection.
   * 
   * @param phone - Patient's phone number (gets URL-encoded automatically)
   */
  const handleConversationSelect = (phone: string) => {
    // ⚠️  CRITICAL: encodeURIComponent is MANDATORY for URL parameters
    router.push(`/dashboard/conversations/phone?phone=${encodeURIComponent(phone)}`)
  }

  const formatTime = (dateString: string) => {
    if (!dateString || dateString === '') {
      return 'No date'
    }
    
    const date = new Date(dateString)
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid date'
    }
    
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    
    // For messages, always show time + date for better granularity
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    
    if (diffInHours < 24) {
      return `${timeStr} • Today`
    } else if (diffInHours < 48) {
      return `${timeStr} • Yesterday`
    } else {
      const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' })
      return `${timeStr} • ${dateStr}`
    }
  }

  const getInitials = (name: string) => {
    if (!name) return '?'
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const filteredConversations = conversations.filter(conv => {
    const searchLower = searchTerm.toLowerCase()
    return (
      (conv.patient_name || '').toLowerCase().includes(searchLower) ||
      (conv.phone || '').toLowerCase().includes(searchLower) ||
      (conv.email || '').toLowerCase().includes(searchLower)
    )
  })

  // Only log when conversations change, not on every render
  useEffect(() => {
    if (conversations.length > 0) {
      console.log('🔍 Frontend: Conversations loaded:', conversations.length)
      console.log('🔍 Frontend: Sample conversation:', conversations[0])
      console.log('🔍 Frontend: Date fields check:', {
        latest_conversation_date: conversations[0].latest_conversation_date,
        last_message_time: conversations[0].last_message_time,
        conversation_updated_at: conversations[0].conversation_updated_at
      })
    }
  }, [conversations.length])
  
  const getSenderBubbleStyle = (senderType: string) => {
    switch (senderType) {
      case 'user':
        // Patient messages - on the left with grey background like Facebook
        return 'bg-gray-200/80 text-gray-800 mr-auto max-w-[70%] rounded-r-2xl rounded-tl-2xl rounded-bl-md'
      case 'agent':
        // Bot/Our messages - on the right with brand blue at 50%
        return 'bg-routiq-cloud/50 text-routiq-core ml-auto max-w-[70%] rounded-l-2xl rounded-tr-2xl rounded-br-md'
      case 'system':
        return 'bg-gray-100/80 text-gray-600 mx-auto max-w-[80%] rounded-xl text-center text-sm'
      default:
        return 'bg-gray-200/80 text-gray-800 mr-auto max-w-[70%] rounded-r-2xl rounded-tl-2xl rounded-bl-md'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="relative">
          {/* Outer spinning ring */}
          <div className="absolute inset-0 w-20 h-20 border-4 border-gray-200 border-t-routiq-energy rounded-full animate-routiq-spin"></div>
          
          {/* Inner pulsing ring */}
          <div className="absolute inset-2 w-16 h-16 border-2 border-routiq-cloud/30 rounded-full animate-routiq-pulse"></div>
          
          {/* Routiq Logo */}
          <div className="w-20 h-20 flex items-center justify-center animate-routiq-fade-in">
            <Image
              src="/logos/routiq-logomark-core.svg"
              alt="Routiq"
              width={40}
              height={40}
              className="w-10 h-10"
            />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white p-6">
        <Card className="border-routiq-energy bg-white max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-routiq-prompt">Error Loading Conversations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-routiq-core mb-4">{error}</p>
            <Button onClick={fetchConversations} variant="outline">Try Again</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="h-full flex overflow-hidden">
      {/* Sidebar - Conversation List */}
      <div className="w-80 bg-white border-r border-routiq-cloud/30 flex flex-col h-full">
        {/* Header */}
        <div className="p-3 border-b border-routiq-cloud/30 flex-shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <h1 className="text-lg font-semibold text-routiq-core">Phone Conversations</h1>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-routiq-blackberry/50 h-4 w-4" />
            <Input
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-100 border-gray-200 rounded-full"
            />
          </div>
        </div>

        {/* Conversation List - Fixed height with internal scroll */}
        <div className="overflow-y-auto" style={{ height: 'calc(100vh - 240px)' }}>
          {filteredConversations.map((conversation) => (
            <div
              key={conversation.phone}
              onClick={() => handleConversationSelect(conversation.phone)}
              className={`p-3 border-b border-routiq-cloud/20 cursor-pointer hover:bg-routiq-cloud/20 transition-colors ${
                selectedPhone === conversation.phone ? 'bg-routiq-prompt/10 border-r-2 border-r-routiq-prompt' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-routiq-cloud/20 text-routiq-cloud font-semibold text-sm">
                      {getInitials(conversation.patient_name)}
                    </AvatarFallback>
                  </Avatar>
                  {conversation.patient_status === 'active' && (
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-routiq-core truncate text-sm">
                      {conversation.patient_name || 'Unknown'}
                    </h3>
                    <span className="text-xs text-routiq-blackberry/60">
                      {formatTime(conversation.last_message_time || conversation.latest_conversation_date || '')}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      {conversation.last_message_sender === 'user' && (
                        <User className="h-3 w-3 text-routiq-blackberry/50 flex-shrink-0" />
                      )}
                      {conversation.last_message_sender === 'agent' && (
                        <Bot className="h-3 w-3 text-routiq-cloud flex-shrink-0" />
                      )}
                    <p className="text-xs text-routiq-blackberry/70 truncate">
                        {conversation.last_message_content || conversation.phone}
                    </p>
                    </div>
                    {conversation.total_messages > 0 && (
                      <Badge variant="secondary" className="text-xs h-4 flex-shrink-0 ml-2">
                        {conversation.total_messages}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white min-w-0">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="p-3 border-b border-routiq-cloud/30 bg-white flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-routiq-cloud/20 text-routiq-cloud font-semibold text-sm">
                      {getInitials(selectedChat?.conversation?.patient_name || 'Unknown')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="font-semibold text-routiq-core text-sm">
                      {selectedChat?.conversation?.patient_name || 'Unknown Patient'}
                    </h2>
                    <div className="flex items-center gap-2 text-xs text-routiq-blackberry/70">
                      <Phone className="h-3 w-3" />
                      {selectedChat?.conversation?.phone || 'No phone'}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="text-right text-xs text-routiq-blackberry/70">
                    <div>{selectedChat?.conversation?.total_messages || 0} messages</div>
                    <div className="text-xs">
                      {selectedChat?.conversation?.bot_messages || 0} bot • {selectedChat?.conversation?.user_messages || 0} user
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className="overflow-y-auto p-3 bg-routiq-cloud/5" style={{ height: 'calc(100vh - 220px)' }}>
              {chatLoading ? (
                <div className="flex items-center justify-center h-full">
                  <LoadingSpinner text="Loading messages..." />
                </div>
              ) : (
                <div className="space-y-3 max-w-4xl mx-auto">
                  {selectedChat.messages
                    .filter(message => message.sender_type !== 'system')
                    .map((message, index) => (
                    <div key={message.id || index} className="flex flex-col">
                      <div className={`p-2 ${getSenderBubbleStyle(message.sender_type)}`}>
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {message.content || 'No content'}
                        </p>
                      </div>
                      <div className={`text-xs text-routiq-blackberry/50 mt-1 ${
                        message.sender_type === 'agent' ? 'text-right ml-auto' : 'text-left mr-auto'
                      }`}>
                        <div className="flex items-center gap-1">
                          {message.sender_type === 'agent' && <Bot className="h-3 w-3" />}
                          {message.sender_type === 'user' && <User className="h-3 w-3" />}
                          <span>
                            {message.sender_type === 'agent' ? 'Bot' : 'Patient'} • 
                            {formatTime(message.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Message Input (Disabled - Read Only) */}
            <div className="p-3 border-t border-routiq-cloud/30 bg-white flex-shrink-0">
              <div className="flex items-center gap-3 max-w-4xl mx-auto">
                <div className="flex-1 relative">
                  <Input
                    placeholder="This is a read-only conversation view..."
                    disabled
                    className="pr-12 bg-routiq-cloud/20 border-routiq-cloud/30"
                  />
                  <Button 
                    size="sm" 
                    disabled
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* No Chat Selected */
          <div className="flex-1 flex items-center justify-center bg-routiq-cloud/5">
            <div className="text-center space-y-4">
              <MessageCircle className="h-16 w-16 text-routiq-blackberry/40 mx-auto" />
              <div>
                <h3 className="text-lg font-medium text-routiq-core mb-2">
                  Select a conversation
                </h3>
                <p className="text-routiq-blackberry/70">
                  Choose a phone conversation from the list to view the chat history
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Performance Panel */}
      {selectedChat && selectedChat.conversation && (
        <div className="w-80 bg-white border-l border-routiq-cloud/30 flex flex-col">
          <ConversationPerformancePanel 
            conversation={selectedChat.conversation}
            messages={selectedChat.messages}
          />
        </div>
      )}
    </div>
  )
} 
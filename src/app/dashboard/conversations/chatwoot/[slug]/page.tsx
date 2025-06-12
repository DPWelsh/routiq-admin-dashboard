"use client"

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, MessageCircle, Clock, User, Bot } from "lucide-react"
import { ChatwootMessage } from '@/lib/database/clients/chatwoot'
import { StarRating } from "@/components/ui/star-rating"

export default function ChatwootConversationDetailPage() {
  const router = useRouter()
  const params = useParams()
  
  // Slug is the phone number
  const phoneNumberSlug = params.slug as string
  
  const [messages, setMessages] = useState<ChatwootMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState<string>('')
  const [conversationId, setConversationId] = useState<number | null>(null)

  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true)
      

      
      // First, find the conversation by phone number
      // phoneNumberSlug is already URL encoded from the URL, so don't encode it again
      const conversationResponse = await fetch(`/api/conversations/chatwoot?phoneNumber=${phoneNumberSlug}`)
      
      if (!conversationResponse.ok) {
        throw new Error('Failed to fetch conversation')
      }

      const conversationData = await conversationResponse.json()
      
      if (!conversationData.success || conversationData.data.length === 0) {
        throw new Error('Conversation not found for this phone number')
      }

      const conversation = conversationData.data[0]
      setCustomerName(conversation.customer_name || 'Unknown Customer')
      setConversationId(conversation.id)
      
      // Now fetch messages for this conversation
      const messagesResponse = await fetch(`/api/conversations/chatwoot/${conversation.id}`)
      
      if (!messagesResponse.ok) {
        throw new Error('Failed to fetch conversation messages')
      }

      const messagesData = await messagesResponse.json()
      
      if (!messagesData.success) {
        throw new Error(messagesData.error || 'Failed to fetch messages')
      }

      setMessages(messagesData.data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages')
    } finally {
      setLoading(false)
    }
  }, [phoneNumberSlug])

  useEffect(() => {
    if (phoneNumberSlug) {
      fetchMessages()
    }
  }, [phoneNumberSlug, fetchMessages])

  const formatDate = (dateString: string | Date) => {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString
    return date.toLocaleString([], { 
      year: 'numeric',
      month: 'short', 
      day: 'numeric',
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  const getMessageTypeIcon = (message: ChatwootMessage) => {
    if (message.is_customer_message) {
      return <User className="h-4 w-4 text-blue-600" />
    } else if (message.is_agent_message) {
      return <Bot className="h-4 w-4 text-green-600" />
    } else {
      return <MessageCircle className="h-4 w-4 text-gray-600" />
    }
  }

  const getMessageTypeLabel = (message: ChatwootMessage) => {
    if (message.is_customer_message) {
      return customerName || 'Customer'
    } else if (message.is_agent_message) {
      return message.sender_name || 'Agent'
    } else {
      return 'System'
    }
  }

  const getMessageTypeColor = (message: ChatwootMessage) => {
    if (message.is_customer_message) {
      return 'bg-blue-50 border-l-blue-500'
    } else if (message.is_agent_message) {
      return 'bg-green-50 border-l-green-500'
    } else {
      return 'bg-gray-50 border-l-gray-500'
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 text-lg">Loading conversation...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800 flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Error Loading Conversation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600 mb-4">{error}</p>
            <div className="flex gap-2">
              <Button onClick={() => router.back()} variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Go Back
              </Button>
              <Button onClick={fetchMessages} variant="outline">
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          onClick={() => router.back()} 
          variant="outline" 
          size="sm"
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">
            {customerName}
          </h1>
          <p className="text-gray-600 mt-1">
            {phoneNumberSlug && `📞 ${phoneNumberSlug} • `}
            {messages.length} messages • Conversation #{conversationId}
          </p>
        </div>
        
        {/* Grading Section */}
        <Card className="p-4 bg-yellow-50 border-yellow-200">
          <div className="text-center">
            <p className="text-sm font-medium text-yellow-800 mb-2">Grade this conversation</p>
            <StarRating 
              rating={0} 
              onRatingChange={(rating) => console.log('Rating:', rating)}
              size="lg"
            />
            <p className="text-xs text-yellow-700 mt-1">Click to rate agent performance</p>
          </div>
        </Card>
      </div>

      {/* Conversation Stats */}
      {messages.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{messages.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Customer Messages</CardTitle>
              <User className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {messages.filter(m => m.is_customer_message).length}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Agent Messages</CardTitle>
              <Bot className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {messages.filter(m => m.is_agent_message).length}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Duration</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                {messages.length > 1 ? (
                  <>
                    {Math.round((new Date(messages[messages.length - 1].created_at).getTime() - 
                                new Date(messages[0].created_at).getTime()) / (1000 * 60 * 60))} hours
                  </>
                ) : (
                  'Single message'
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Messages */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">Messages</h2>
        
        {messages.length === 0 ? (
          <Card className="border-dashed border-2 border-gray-300">
            <CardContent className="text-center py-12">
              <MessageCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No messages found</h3>
              <p className="text-gray-600">This conversation doesn&apos;t have any messages yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <Card 
                key={message.id} 
                className={`border-l-4 ${getMessageTypeColor(message)} transition-all duration-200 hover:shadow-md`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getMessageTypeIcon(message)}
                      <span className="font-medium text-sm">
                        {getMessageTypeLabel(message)}
                      </span>
                      {message.is_agent_message && message.response_time_minutes > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {message.response_time_minutes}min response
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      {formatDate(message.created_at)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="prose prose-sm max-w-none">
                    <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                      {message.content}
                    </p>
                  </div>
                  {message.word_count > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <span className="text-xs text-gray-500">
                        {message.word_count} words
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
} 
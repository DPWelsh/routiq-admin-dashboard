"use client"

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, User, Bot, Clock, MessageSquare } from 'lucide-react'
import { N8nMessage } from '@/lib/database/clients/n8n'

export const dynamic = 'force-dynamic'

export default function ConversationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.sessionId as string
  
  const [messages, setMessages] = useState<N8nMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/conversations/${sessionId}`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch conversation messages')
        }
        
        const data = await response.json()
        setMessages(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    if (sessionId) {
      fetchMessages()
    }
  }, [sessionId])

  const formatTimestamp = (timestamp: string | Date) => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const getMessageTypeIcon = (type: 'human' | 'ai') => {
    return type === 'human' ? (
      <User className="h-4 w-4 text-blue-600" />
    ) : (
      <Bot className="h-4 w-4 text-green-600" />
    )
  }

  const getMessageTypeColor = (type: 'human' | 'ai') => {
    return type === 'human' ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">Loading conversation...</h1>
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold text-red-600">Error</h1>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const validMessages = messages.filter(m => m.message?.content && m.message.content.trim().length > 0)
  const humanMessages = validMessages.filter(m => m.message.type === 'human')
  const aiMessages = validMessages.filter(m => m.message.type === 'ai')
  
  const startTime = validMessages.length > 0 ? validMessages[0].timestampz : null
  const endTime = validMessages.length > 0 ? validMessages[validMessages.length - 1].timestampz : null
  const duration = startTime && endTime ? 
    Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000 / 60) : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Conversation Details</h1>
            <p className="text-sm text-gray-500">Session ID: {sessionId}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <MessageSquare className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{validMessages.length}</p>
                <p className="text-xs text-gray-500">Total Messages</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{humanMessages.length}</p>
                <p className="text-xs text-gray-500">Human Messages</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Bot className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{aiMessages.length}</p>
                <p className="text-xs text-gray-500">AI Messages</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">{duration}</p>
                <p className="text-xs text-gray-500">Duration (min)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Messages */}
      <Card>
        <CardHeader>
          <CardTitle>Conversation Messages</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {validMessages.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No messages found in this conversation.</p>
            ) : (
              validMessages.map((message, index) => (
                <div
                  key={message.id}
                  className={`p-4 rounded-lg border ${getMessageTypeColor(message.message.type)}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      {getMessageTypeIcon(message.message.type)}
                      <Badge variant={message.message.type === 'human' ? 'default' : 'secondary'}>
                        {message.message.type === 'human' ? 'Human' : 'AI'}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        Message {index + 1}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(message.timestampz)}
                    </span>
                  </div>
                  <div className="prose prose-sm max-w-none">
                    <p className="whitespace-pre-wrap">{message.message.content}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 
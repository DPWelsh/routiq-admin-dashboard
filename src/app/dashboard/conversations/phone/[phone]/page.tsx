"use client"

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Phone, Mail, User, MessageCircle, Clock, Calendar, Bot, Users, TrendingUp } from "lucide-react"
import { LoadingSpinner } from "@/components/magicui"
import Image from 'next/image'

interface PhoneConversationDetail {
  phone: string
  patient_name: string
  email: string
  conversation_id: string
  conversation_start: string
  conversation_last_activity: string
  total_messages: number
  first_message_time: string
  last_message_time: string
}

interface PhoneMessage {
  id: number
  content: string
  sender_type: 'user' | 'agent' | 'system'
  timestamp: string
  metadata: Record<string, unknown> | null
  external_id: string
}

interface PhoneConversationData {
  conversation: PhoneConversationDetail
  messages: PhoneMessage[]
}

export default function PhoneConversationPage() {
  const params = useParams()
  const router = useRouter()
  const phone = decodeURIComponent(params.phone as string)

  const [data, setData] = useState<PhoneConversationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchConversationData()
  }, [phone])

  const fetchConversationData = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/conversations/phone?phone=${encodeURIComponent(phone)}`)

      if (!response.ok) {
        throw new Error('Failed to fetch conversation data')
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'API returned error')
      }

      setData(result.data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversation')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    
    if (diffInHours < 24) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    } else if (diffInHours < 48) {
      return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    } else {
      return date.toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit', 
        minute: '2-digit' 
      })
    }
  }

  const getSenderIcon = (senderType: string) => {
    switch (senderType) {
      case 'agent':
        return <Bot className="h-4 w-4 text-routiq-energy" />
      case 'user':
        return <User className="h-4 w-4 text-routiq-prompt" />
      case 'system':
        return <MessageCircle className="h-4 w-4 text-routiq-core" />
      default:
        return <MessageCircle className="h-4 w-4 text-routiq-blackberry" />
    }
  }

  const getSenderLabel = (senderType: string) => {
    switch (senderType) {
      case 'agent':
        return 'Bot'
      case 'user':
        return 'Patient'
      case 'system':
        return 'System'
      default:
        return 'Unknown'
    }
  }

  const getSenderColorClass = (senderType: string) => {
    switch (senderType) {
      case 'agent':
        return 'bg-routiq-energy/10 border-routiq-energy/20 text-routiq-energy'
      case 'user':
        return 'bg-routiq-prompt/10 border-routiq-prompt/20 text-routiq-prompt'
      case 'system':
        return 'bg-routiq-core/10 border-routiq-core/20 text-routiq-core'
      default:
        return 'bg-routiq-blackberry/10 border-routiq-blackberry/20 text-routiq-blackberry'
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

  if (error || !data) {
    return (
      <div className="min-h-screen bg-white p-6">
        <div className="max-w-4xl mx-auto">
          <Button 
            onClick={() => router.back()} 
            variant="outline" 
            className="mb-6 gap-2 border-routiq-core/20 hover:bg-routiq-core/5"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Conversations
          </Button>
          
          <Card className="border-routiq-energy bg-white">
            <CardHeader>
              <CardTitle className="text-routiq-prompt flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Error Loading Conversation
              </CardTitle>
              <CardDescription className="text-routiq-core">{error || 'Conversation not found'}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={fetchConversationData} variant="outline" className="gap-2 border-routiq-energy hover:bg-routiq-energy/10">
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const { conversation, messages } = data
  const botMessages = messages.filter(m => m.sender_type === 'agent').length
  const userMessages = messages.filter(m => m.sender_type === 'user').length
  const systemMessages = messages.filter(m => m.sender_type === 'system').length

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back Button */}
        <Button 
          onClick={() => router.back()} 
          variant="outline" 
          className="gap-2 border-routiq-core/20 hover:bg-routiq-core/5"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Conversations
        </Button>

        {/* Header Card */}
        <Card className="bg-white border-routiq-energy">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <CardTitle className="text-2xl text-routiq-core flex items-center gap-3">
                  <Phone className="h-6 w-6 text-routiq-prompt" />
                  {conversation.patient_name || 'Unknown Patient'}
                </CardTitle>
                <div className="flex items-center gap-4 text-sm text-routiq-core/70">
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {conversation.phone}
                  </span>
                  {conversation.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {conversation.email}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-routiq-prompt/10 rounded-lg p-3 border border-routiq-prompt/20">
                <div className="flex items-center gap-2 mb-1">
                  <MessageCircle className="h-4 w-4 text-routiq-prompt" />
                  <span className="text-sm font-medium text-routiq-core">Total Messages</span>
                </div>
                <div className="text-2xl font-bold text-routiq-core">{conversation.total_messages}</div>
              </div>
              
              <div className="bg-routiq-energy/10 rounded-lg p-3 border border-routiq-energy/20">
                <div className="flex items-center gap-2 mb-1">
                  <Bot className="h-4 w-4 text-routiq-energy" />
                  <span className="text-sm font-medium text-routiq-core">Bot Messages</span>
                </div>
                <div className="text-2xl font-bold text-routiq-core">{botMessages}</div>
              </div>
              
              <div className="bg-routiq-blackberry/10 rounded-lg p-3 border border-routiq-blackberry/20">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4 text-routiq-blackberry" />
                  <span className="text-sm font-medium text-routiq-core">Patient Messages</span>
                </div>
                <div className="text-2xl font-bold text-routiq-core">{userMessages}</div>
              </div>
              
              <div className="bg-routiq-core/10 rounded-lg p-3 border border-routiq-core/20">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-routiq-core" />
                  <span className="text-sm font-medium text-routiq-core">Bot Ratio</span>
                </div>
                <div className="text-2xl font-bold text-routiq-core">
                  {conversation.total_messages > 0 ? Math.round((botMessages / conversation.total_messages) * 100) : 0}%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Conversation Timeline */}
        <Card className="bg-white border-routiq-energy">
          <CardHeader>
            <CardTitle className="text-lg text-routiq-core flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Conversation Timeline
            </CardTitle>
            <CardDescription>
              From {formatDate(conversation.first_message_time)} to {formatDate(conversation.last_message_time)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {messages.map((message, index) => (
                <div key={message.id || index} className="flex gap-3">
                  <div className="flex-shrink-0">
                    <div className={`p-2 rounded-lg border ${getSenderColorClass(message.sender_type)}`}>
                      {getSenderIcon(message.sender_type)}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={getSenderColorClass(message.sender_type)}>
                        {getSenderLabel(message.sender_type)}
                      </Badge>
                      <span className="text-xs text-routiq-core/60">
                        {formatDate(message.timestamp)}
                      </span>
                    </div>
                    <div className="bg-routiq-energy/20 rounded-lg p-3">
                      <p className="text-sm text-routiq-core whitespace-pre-wrap">
                        {message.content || 'No content'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 
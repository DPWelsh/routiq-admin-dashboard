'use client'

import { useAuth, useUser } from '@clerk/nextjs'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { 
  Users, Calendar, AlertTriangle, MessageCircle, TrendingUp, Activity,
  Bot, Clock, Moon, Phone, Bell, UserCheck, RefreshCw, PoundSterling,
  TimerIcon, BarChart3, HelpCircle, ArrowUpRight, ArrowDownRight, Target,
  MessageCircle as MessageIcon, UserPlus, CalendarCheck,
  Heart, Smile, Frown, Meh, Zap, TrendingDown,
  CheckCircle, XCircle, AlertCircle, Pause, Play
} from 'lucide-react'
import { AnimatedGradientText, BlurFade, ShimmerButton, NumberTicker, LoadingSpinner } from "@/components/magicui"
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useClerkOrganization } from '@/hooks/useClerkOrganization'
import { UpcomingAppointments } from '@/components/features/patients/upcoming-appointments'

// Tremor imports for interactive charts
import { 
  AreaChart, 
  BarChart, 
  LineChart, 
  DonutChart,
  ProgressBar,
  Metric,
  Text,
  Flex,
  Grid,
  Col
} from '@tremor/react'

interface DashboardStats {
  totalConversations: number
  activePatients: number
  upcomingAppointments: number
  inactivePatients: number
  totalMessages: number
}

interface RoutiqAgentMetrics {
  totalInteractions: number
  afterHoursMessages: number
  bookingsMade: number
  remindersSent: number
  followUpsSent: number
  appointmentConfirmations: number
  patientEngagementRate: number
  averageResponseTime: string
  automationEfficiency: number
  emergencyEscalations: number
  patientSatisfactionScore: number
  revenueFromBookings: number
  adminHoursSaved: number
  averageBookingValue: number
  conversionFunnel: {
    interactions: number
    qualified: number
    confirmed: number
    booked: number
  }
  beforeAfter: {
    responseTime: { before: string, after: string }
    availability: { before: string, after: string }
    patientSatisfaction: { before: number, after: number }
    bookingConversion: { before: number, after: number }
  }
  recentPerformance: {
    daily: number
    weekly: number
    monthly: number
  }
}

interface SentimentData {
  overallSentiment: number
  positivePercentage: number
  neutralPercentage: number
  negativePercentage: number
  sentimentTrends: {
    positive: number
    neutral: number
    negative: number
  }
  commonPositiveWords: string[]
  commonNegativeWords: string[]
}

// Mock data for charts - in real app, this would come from your API
const revenueData = [
  { month: 'Jan', revenue: 8400, conversations: 89 },
  { month: 'Feb', revenue: 9200, conversations: 94 },
  { month: 'Mar', revenue: 11800, conversations: 87 },
  { month: 'Apr', revenue: 14100, conversations: 102 },
  { month: 'May', revenue: 16650, conversations: 110 },
  { month: 'Jun', revenue: 18200, conversations: 118 }
]

const conversationTrends = [
  { date: 'Mon', phone: 42, chat: 68, email: 24 },
  { date: 'Tue', phone: 38, chat: 73, email: 28 },
  { date: 'Wed', phone: 45, chat: 71, email: 22 },
  { date: 'Thu', phone: 41, chat: 76, email: 31 },
  { date: 'Fri', phone: 48, chat: 65, email: 35 },
  { date: 'Sat', phone: 28, chat: 41, email: 18 },
  { date: 'Sun', phone: 22, chat: 35, email: 12 }
]

const satisfactionData = [
  { name: 'Excellent', value: 45, color: 'emerald' },
  { name: 'Good', value: 32, color: 'blue' },
  { name: 'Average', value: 18, color: 'yellow' },
  { name: 'Poor', value: 5, color: 'red' }
]

const responseTimeData = [
  { hour: '9AM', avgTime: 28 },
  { hour: '10AM', avgTime: 24 },
  { hour: '11AM', avgTime: 22 },
  { hour: '12PM', avgTime: 45 },
  { hour: '1PM', avgTime: 38 },
  { hour: '2PM', avgTime: 18 },
  { hour: '3PM', avgTime: 16 },
  { hour: '4PM', avgTime: 22 },
  { hour: '5PM', avgTime: 28 }
]

// Enhanced performance metrics with more realistic data
const staticPerformanceData = {
  totalROI: 13695,
  conversionRate: 4.9,
  industryAverage: 2.4,
  availability: "24/7",
  previousAvailability: "9-5 weekdays",
  monthlyGrowth: 23.5,
  responseTimeImprovement: 87, // percentage improvement
  adminHoursSaved: 47.5,
  adminCostSaved: 1045,
  patientSatisfactionIncrease: 0.8, // points increase
  bookingConversionImprovement: 105, // percentage improvement
  emergencyResponseTime: "< 2 min",
  automationEfficiency: 94.2
}

// Weekly performance trend data
const weeklyPerformanceData = [
  { week: 'Week 1', efficiency: 89, satisfaction: 4.1, bookings: 23 },
  { week: 'Week 2', efficiency: 91, satisfaction: 4.2, bookings: 28 },
  { week: 'Week 3', efficiency: 93, satisfaction: 4.3, bookings: 31 },
  { week: 'Week 4', efficiency: 94, satisfaction: 4.4, bookings: 35 }
]

const valueFormatter = (number: number) => `$${(number / 1000).toFixed(1)}k`
const timeFormatter = (number: number) => `${number}s`
const performanceFormatter = (number: number) => `${number}%`
const conversationFormatter = (number: number) => number.toString()

// Types for custom tooltip
interface TooltipPayloadItem {
  dataKey: string
  value: number
  color?: string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string
}

// Custom tooltip component for conversation channels chart
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ConversationTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null

  return (
    <div className="rounded-md border text-sm shadow-md border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-3">
      <div className="border-b border-inherit pb-2 mb-2">
        <p className="font-medium text-gray-900 dark:text-gray-50">{label}</p>
      </div>
      <div className="space-y-1">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {payload.map((item: any, index: number) => {
          // Define colors for each category
          const getColor = (dataKey: string) => {
            switch (dataKey) {
              case 'phone': return '#3b82f6' // blue
              case 'chat': return '#10b981'  // emerald
              case 'email': return '#8b5cf6' // violet
              default: return '#6b7280'
            }
          }

          return (
            <div key={index} className="flex items-center justify-between space-x-8">
              <div className="flex items-center space-x-2">
                <span
                  className="size-2 shrink-0 rounded-xs"
                  style={{ backgroundColor: getColor(item.dataKey) }}
                  aria-hidden="true"
                />
                <p className="text-right whitespace-nowrap text-gray-700 dark:text-gray-300">
                  {item.dataKey}
                </p>
              </div>
              <p className="text-right font-medium whitespace-nowrap tabular-nums text-gray-900 dark:text-gray-50">
                {conversationFormatter(item.value)}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { getToken } = useAuth()
  const { user } = useUser()
  const router = useRouter()
  const { organizationId, isLoading: isOrgLoading, hasOrganization } = useClerkOrganization()
  const [stats, setStats] = useState<DashboardStats>({
    totalConversations: 0,
    activePatients: 0,
    upcomingAppointments: 0,
    inactivePatients: 0,
    totalMessages: 0
  })
  const [performanceMetrics, setPerformanceMetrics] = useState<RoutiqAgentMetrics | null>(null)
  const [sentimentData, setSentimentData] = useState<SentimentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'current' | 'comparison'>('current')
  const [activeTab, setActiveTab] = useState('overview')
  const [error, setError] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    // Don't fetch if org is still loading
    if (isOrgLoading) return

    // Redirect if no organization
    if (!hasOrganization) {
      router.push('/organization-selection')
      return
    }

    // Fetch data only when organization is available
    const fetchDashboardData = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch('/api/dashboard/stats')
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to fetch stats')
        }

        const data = await response.json()
        setStats(prev => ({
          ...prev,
          totalConversations: data.data.conversations.total,
          activePatients: data.data.activePatients.total,
          totalMessages: data.data.messages.total
        }))
      } catch (err) {
        console.error('Dashboard error:', err)
        setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [organizationId, hasOrganization, isOrgLoading, router])

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const formatCurrency = (amount: number) => `$${amount.toLocaleString()}`
  const calculateConversionRate = (current: number, total: number) => 
    ((current / total) * 100).toFixed(1)

  const getSentimentColor = (sentiment: number) => {
    if (sentiment >= 4) return "text-green-600"
    if (sentiment >= 3) return "text-yellow-600"
    return "text-red-600"
  }

  const getSentimentIcon = (sentiment: number) => {
    if (sentiment >= 4) return <Smile className="h-4 w-4 text-green-600" />
    if (sentiment >= 3) return <Meh className="h-4 w-4 text-yellow-600" />
    return <Frown className="h-4 w-4 text-red-600" />
  }

  const handlePatientClick = (patient: { contact_phone: string }) => {
    // Navigate to the patient's conversation using phone number
    if (patient.contact_phone) {
      let formattedPhone = patient.contact_phone
      if (!patient.contact_phone.startsWith('+')) {
        const cleanedPhone = patient.contact_phone.replace(/\D/g, '')
        if (cleanedPhone.length === 10) {
          formattedPhone = `+1${cleanedPhone}`
        } else if (cleanedPhone.length === 11 && cleanedPhone.startsWith('1')) {
          formattedPhone = `+${cleanedPhone}`
        } else {
          formattedPhone = cleanedPhone.startsWith('+') ? cleanedPhone : `+${cleanedPhone}`
        }
      }
      
      const encodedPhone = encodeURIComponent(formattedPhone)
      router.push(`/dashboard/conversations/phone?phone=${encodedPhone}`)
    }
  }

  if (isOrgLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading dashboard...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600">
          <h2 className="text-xl font-semibold mb-2">Error Loading Dashboard</h2>
          <p>{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen relative">
        {/* Hero Section - Routiq Gradient Image */}
        <BlurFade delay={0.1}>
          <div 
            className="relative overflow-hidden text-white"
            style={{
              backgroundImage: `url('/backgrounds/routiq_gradient_03.jpg')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat'
            }}
          >
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5"></div>
              <div className="absolute inset-0" style={{
                backgroundImage: `radial-gradient(circle at 20px 20px, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                backgroundSize: `40px 40px`
              }}></div>
            </div>
            
            <div className="relative px-4 py-8 lg:px-6 lg:py-12">
              <div className="mx-auto max-w-7xl">
                <BlurFade delay={0.2}>
                  <div className="mb-6">
                    <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl text-[#1a1c12]">
                      Welcome back, {user?.firstName || 'User'}
            </h1>
                    <p className="mt-3 text-lg text-[#472424]">
                      Your Routiq dashboard • {currentTime.toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
            </p>
          </div>
        </BlurFade>

                {/* Hero Metrics - Brand Colors */}
                <BlurFade delay={0.3}>
                  <Grid numItems={1} numItemsSm={2} numItemsLg={4} className="gap-4">
                    <Card className="bg-white/20 backdrop-blur-sm border-white/30">
                      <CardContent className="p-4">
                        <Flex alignItems="start">
                          <div>
                            <Text className="text-[#472424] text-sm font-medium">Revenue This Month</Text>
                            <Metric className="text-[#1a1c12] text-2xl font-bold">$12,650</Metric>
                            <Text className="text-[#7d312d] text-xs">↗ 89 bookings made</Text>
                          </div>
                          <span className="text-2xl text-[#7d312d]">$</span>
                        </Flex>
                  </CardContent>
                </Card>

                    <Card className="bg-white/20 backdrop-blur-sm border-white/30">
                      <CardContent className="p-4">
                        <Flex alignItems="start">
                          <div>
                            <Text className="text-[#472424] text-sm font-medium">Patient Satisfaction</Text>
                            <Metric className="text-[#1a1c12] text-2xl font-bold">4.2/5</Metric>
                            <Text className="text-[#7d312d] text-xs">💚 67% positive feedback</Text>
                          </div>
                          <Smile className="h-6 w-6 text-[#7d312d]" />
                        </Flex>
                  </CardContent>
                </Card>

                    <Card className="bg-white/20 backdrop-blur-sm border-white/30">
                      <CardContent className="p-4">
                        <Flex alignItems="start">
                          <div>
                            <Text className="text-[#472424] text-sm font-medium">Response Time</Text>
                            <Metric className="text-[#1a1c12] text-2xl font-bold">{"<30s"}</Metric>
                            <Text className="text-[#7d312d] text-xs">⚡ was 3-4 hours before</Text>
                          </div>
                          <Zap className="h-6 w-6 text-[#7d312d]" />
                        </Flex>
                  </CardContent>
                </Card>

                    <Card className="bg-white/20 backdrop-blur-sm border-white/30">
                      <CardContent className="p-4">
                        <Flex alignItems="start">
                          <div>
                            <Text className="text-[#472424] text-sm font-medium">Admin Hours Saved</Text>
                            <Metric className="text-[#1a1c12] text-2xl font-bold">47.5h</Metric>
                            <Text className="text-[#7d312d] text-xs">⚡ $1,045 value</Text>
                          </div>
                          <TimerIcon className="h-6 w-6 text-[#7d312d]" />
                        </Flex>
                  </CardContent>
                </Card>
                  </Grid>
                </BlurFade>
              </div>
            </div>
          </div>
        </BlurFade>

        {/* Main Dashboard Content with seamless gradient transition */}
        <div className="relative bg-gradient-to-br from-blue-50/50 via-white to-gray-50/30">
            <BlurFade delay={0.4}>
              <div className="space-y-4 px-4 py-6 lg:px-6">
                {/* Charts - Side by Side */}
                <Grid numItems={1} numItemsLg={2} className="gap-4">
                  <Card className="bg-white/95 backdrop-blur-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        Revenue Trends
                      </CardTitle>
                      <CardDescription className="text-xs">Monthly revenue and conversation volume</CardDescription>
                  </CardHeader>
                    <CardContent className="pl-2">
                      <AreaChart
                        className="h-48 mt-4"
                        data={revenueData}
                        index="month"
                        categories={["revenue"]}
                        colors={["blue"]}
                        valueFormatter={valueFormatter}
                        showLegend={false}
                        showYAxis={true}
                        showXAxis={true}
                        showGridLines={false}
                        yAxisWidth={80}
                        autoMinValue={true}
                      />
                  </CardContent>
                </Card>
                
                  <Card className="bg-white/95 backdrop-blur-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <MessageCircle className="h-4 w-4 text-blue-600" />
                        Conversation Channels
                      </CardTitle>
                      <CardDescription className="text-xs">Daily conversation volume by channel</CardDescription>
                  </CardHeader>
                    <CardContent className="pl-2">
                      <BarChart
                        className="h-48 mt-4"
                        data={conversationTrends}
                        index="date"
                        categories={["phone", "chat", "email"]}
                        colors={["blue", "emerald", "violet"]}
                        valueFormatter={conversationFormatter}
                        showLegend={false}
                        showYAxis={true}
                        showXAxis={true}
                        showGridLines={false}
                        yAxisWidth={80}
                        autoMinValue={true}
                        customTooltip={ConversationTooltip}
                      />
                  </CardContent>
                </Card>
                </Grid>

                {/* Upcoming Appointments Widget */}
                <Grid numItems={1} numItemsLg={2} className="gap-4">
                  <UpcomingAppointments 
                    limit={5}
                    showRefresh={true}
                    compact={true}
                    onPatientClick={handlePatientClick}
                    title="Today's Upcoming Appointments"
                  />
                  
                  <Card className="bg-white/95 backdrop-blur-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Activity className="h-4 w-4 text-emerald-600" />
                        Quick Actions
                      </CardTitle>
                      <CardDescription className="text-xs">Common tasks and shortcuts</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div 
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                        onClick={() => router.push('/dashboard/patients')}
                      >
                        <Users className="h-5 w-5 text-blue-600" />
                        <div>
                          <p className="font-medium text-gray-900 text-sm">View All Patients</p>
                          <p className="text-xs text-gray-500">Manage patient records and appointments</p>
                        </div>
                      </div>
                      
                      <div 
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                        onClick={() => router.push('/dashboard/conversations')}
                      >
                        <MessageCircle className="h-5 w-5 text-green-600" />
                        <div>
                          <p className="font-medium text-gray-900 text-sm">View Conversations</p>
                          <p className="text-xs text-gray-500">Check recent patient communications</p>
                        </div>
                      </div>
                      
                      <div 
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                        onClick={() => router.push('/dashboard/upcoming-appointments')}
                      >
                        <Calendar className="h-5 w-5 text-purple-600" />
                        <div>
                          <p className="font-medium text-gray-900 text-sm">All Upcoming Appointments</p>
                          <p className="text-xs text-gray-500">View complete appointment schedule</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Key Metrics Cards - Compact */}
                <Grid numItems={2} numItemsSm={2} numItemsLg={4} className="gap-3">
                  <Card className="hover:shadow-lg transition-shadow bg-white/95 backdrop-blur-sm">
                    <CardContent className="p-4">
                      <Flex alignItems="start">
                        <div className="flex-1">
                          <Text className="text-gray-600 text-xs">Total Conversations</Text>
                          <Metric className="text-2xl font-bold text-gray-900">90</Metric>
                          <Text className="text-gray-500 text-xs">All time conversations</Text>
                    </div>
                        <MessageCircle className="h-6 w-6 text-blue-600" />
                      </Flex>
                  </CardContent>
                </Card>
                
                  <Card className="hover:shadow-lg transition-shadow bg-white/95 backdrop-blur-sm">
                    <CardContent className="p-4">
                      <Flex alignItems="start">
                        <div className="flex-1">
                          <Text className="text-gray-600 text-xs">Active Patients</Text>
                          <Metric className="text-2xl font-bold text-emerald-600">61</Metric>
                          <Text className="text-gray-500 text-xs">Recent & upcoming appointments</Text>
                    </div>
                        <Users className="h-6 w-6 text-emerald-600" />
                      </Flex>
                  </CardContent>
                </Card>

                  <Card className="hover:shadow-lg transition-shadow bg-white/95 backdrop-blur-sm">
                    <CardContent className="p-4">
                      <Flex alignItems="start">
                        <div className="flex-1">
                          <Text className="text-gray-600 text-xs">Total Messages</Text>
                          <Metric className="text-2xl font-bold text-blue-600">1,805</Metric>
                          <Text className="text-gray-500 text-xs">All platforms combined</Text>
                      </div>
                        <MessageIcon className="h-6 w-6 text-blue-600" />
                      </Flex>
                    </CardContent>
                  </Card>

                  <Card 
                    className="hover:shadow-lg transition-shadow bg-white/95 backdrop-blur-sm cursor-pointer"
                    onClick={() => router.push('/dashboard/upcoming-appointments')}
                  >
                    <CardContent className="p-4">
                      <Flex alignItems="start">
                        <div className="flex-1">
                          <Text className="text-gray-600 text-xs">Upcoming Appointments</Text>
                          <Metric className="text-2xl font-bold text-orange-600">12</Metric>
                          <Text className="text-gray-500 text-xs">Scheduled appointments</Text>
                      </div>
                        <CalendarCheck className="h-6 w-6 text-orange-600" />
                      </Flex>
                    </CardContent>
                  </Card>
                </Grid>
              </div>
          </BlurFade>
                </div>
      </div>
    </TooltipProvider>
  )
} 
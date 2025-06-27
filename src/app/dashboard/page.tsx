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
      CheckCircle, XCircle, AlertCircle, Pause, Play,
    Building2, RefreshCw as Sync, Settings
} from 'lucide-react'
import { AnimatedGradientText, BlurFade, ShimmerButton, NumberTicker, LoadingSpinner } from "@/components/magicui"
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useClerkOrganization } from '@/hooks/useClerkOrganization'
import { UpcomingAppointments } from '@/components/features/patients/upcoming-appointments'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

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
              {/* Quick Actions */}
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Multi-Organization Sync</CardTitle>
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">New!</div>
                    <p className="text-xs text-muted-foreground">
                      Choose any organization and sync patient data
                    </p>
                    <Link href="/dashboard/sync">
                      <Button className="w-full mt-3" size="sm">
                        <Sync className="h-4 w-4 mr-2" />
                        Open Sync Dashboard
                      </Button>
                    </Link>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Patients</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">--</div>
                    <p className="text-xs text-muted-foreground">
                      Select organization to view
                    </p>
                    <Link href="/dashboard/patients">
                      <Button variant="outline" className="w-full mt-3" size="sm">
                        View Patients
                      </Button>
                    </Link>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Upcoming Appointments</CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">--</div>
                    <p className="text-xs text-muted-foreground">
                      Select organization to view
                    </p>
                    <Link href="/dashboard/upcoming-appointments">
                      <Button variant="outline" className="w-full mt-3" size="sm">
                        View Appointments
                      </Button>
                    </Link>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Conversations</CardTitle>
                    <MessageIcon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">--</div>
                    <p className="text-xs text-muted-foreground">
                      Chat performance metrics
                    </p>
                    <Link href="/dashboard/conversations">
                      <Button variant="outline" className="w-full mt-3" size="sm">
                        View Conversations
                      </Button>
                    </Link>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Performance</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">--</div>
                    <p className="text-xs text-muted-foreground">
                      Response time analytics
                    </p>
                    <Link href="/dashboard/performance">
                      <Button variant="outline" className="w-full mt-3" size="sm">
                        View Analytics
                      </Button>
                    </Link>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Settings</CardTitle>
                    <Settings className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">Config</div>
                    <p className="text-xs text-muted-foreground">
                      Manage integrations and settings
                    </p>
                    <Link href="/dashboard/settings">
                      <Button variant="outline" className="w-full mt-3" size="sm">
                        Open Settings
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Activity Placeholder */}
              <Card>
                <CardHeader>
                  <CardTitle>Getting Started</CardTitle>
                  <CardDescription>
                    Use the multi-organization sync dashboard to manage patient data across all your clinics
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start space-x-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100">
                      <Building2 className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">1. Select Organization</p>
                      <p className="text-sm text-muted-foreground">
                        Choose which organization you want to manage from the dropdown
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100">
                      <Sync className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">2. Start Sync</p>
                      <p className="text-sm text-muted-foreground">
                        Trigger patient data synchronization with your Cliniko system
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100">
                      <Activity className="h-4 w-4 text-purple-600" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">3. Monitor Progress</p>
                      <p className="text-sm text-muted-foreground">
                        Watch real-time sync progress and view patient statistics
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </BlurFade>
        </div>
      </div>
    </TooltipProvider>
  )
} 
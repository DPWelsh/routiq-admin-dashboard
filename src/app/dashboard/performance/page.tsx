"use client"

// Force dynamic rendering to prevent SSR issues with Clerk
export const dynamic = 'force-dynamic'

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Bot, 
  Calendar, 
  Clock, 
  MessageSquare, 
  Users, 
  Phone, 
  Bell, 
  UserCheck,
  TrendingUp,
  Moon,
  RefreshCw,
  Activity,
  PoundSterling,
  TimerIcon,
  BarChart3,
  HelpCircle,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  MessageCircle,
  UserPlus,
  CalendarCheck
} from "lucide-react"
import Image from "next/image"

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

export default function RoutiqAgentPerformancePage() {
  const [metrics, setMetrics] = useState<RoutiqAgentMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'current' | 'comparison'>('current')
  const [showTooltip, setShowTooltip] = useState<string | null>(null)

  useEffect(() => {
    console.log("🤖 [ROUTIQ AGENT] Performance metrics loading")
    
    // Enhanced mock data with onboarding-ready features
    const mockMetrics: RoutiqAgentMetrics = {
      totalInteractions: 1805,
      afterHoursMessages: 342,
      bookingsMade: 89,
      remindersSent: 156,
      followUpsSent: 203,
      appointmentConfirmations: 127,
      patientEngagementRate: 87.5,
      averageResponseTime: "< 30 seconds",
      automationEfficiency: 94.2,
      emergencyEscalations: 3,
      patientSatisfactionScore: 4.8,
      revenueFromBookings: 12650, // £142 avg × 89 bookings
      adminHoursSaved: 47.5, // Based on message volume
      averageBookingValue: 142,
      conversionFunnel: {
        interactions: 1805,
        qualified: 456, // 25.3%
        confirmed: 234, // 51.3% of qualified
        booked: 89 // 38.0% of confirmed
      },
      beforeAfter: {
        responseTime: { before: "3-4 hours", after: "< 30 seconds" },
        availability: { before: "9-5 weekdays", after: "24/7 coverage" },
        patientSatisfaction: { before: 3.2, after: 4.8 },
        bookingConversion: { before: 12.5, after: 26.0 }
      },
      recentPerformance: {
        daily: 23,
        weekly: 167,
        monthly: 721
      }
    }

    setTimeout(() => {
      setMetrics(mockMetrics)
      setLoading(false)
    }, 1000)
  }, [])

  const formatCurrency = (amount: number) => `£${amount.toLocaleString()}`
  
  const calculateConversionRate = (current: number, total: number) => 
    ((current / total) * 100).toFixed(1)

  const Tooltip = ({ content, children }: { content: string, children: React.ReactNode }) => (
    <div className="relative inline-block">
      {children}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-routiq-core text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 whitespace-nowrap">
        {content}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-routiq-core"></div>
      </div>
    </div>
  )

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

  return (
    <div className="p-4 space-y-6">
      {/* Header Section with Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-2">
            <h1 className="text-3xl font-bold text-routiq-core">Routiq Agent Performance</h1>
          </div>
          <p className="text-routiq-blackberry/70">AI assistant ROI metrics and healthcare automation insights</p>
        </div>
        <div className="flex items-center gap-4">
          <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'current' | 'comparison')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="current">Live Metrics</TabsTrigger>
              <TabsTrigger value="comparison">Before vs After</TabsTrigger>
            </TabsList>
          </Tabs>
          <Badge className="bg-green-100 text-green-800 border-green-300">
            <Activity className="h-3 w-3 mr-1" />
            Active & Learning
          </Badge>
        </div>
      </div>

      <div className="space-y-6">
        {viewMode === 'current' ? (
          <>
            {/* Immediate ROI Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Revenue Impact */}
              <Card className="bg-gradient-to-br from-green-50 to-green-100/50 border-green-200 shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <div className="group">
                    <CardTitle className="text-sm font-medium text-routiq-core flex items-center gap-1">
                      Revenue Generated
                      <Tooltip content="Total revenue from AI-assisted bookings this month">
                        <HelpCircle className="h-3 w-3 text-routiq-blackberry/50" />
                      </Tooltip>
                    </CardTitle>
                  </div>
                  <PoundSterling className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-700">{formatCurrency(metrics?.revenueFromBookings || 0)}</div>
                  <p className="text-xs text-green-600 mt-1">
                    <span className="font-medium">{metrics?.bookingsMade} bookings</span> × avg £{metrics?.averageBookingValue}
                  </p>
                </CardContent>
              </Card>

              {/* Time Savings */}
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200 shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <div className="group">
                    <CardTitle className="text-sm font-medium text-routiq-core flex items-center gap-1">
                      Admin Hours Saved
                      <Tooltip content="Staff time saved through automation at £22/hour average">
                        <HelpCircle className="h-3 w-3 text-routiq-blackberry/50" />
                      </Tooltip>
                    </CardTitle>
                  </div>
                  <TimerIcon className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-700">{metrics?.adminHoursSaved}h</div>
                  <p className="text-xs text-blue-600 mt-1">
                    <span className="font-medium">{formatCurrency((metrics?.adminHoursSaved || 0) * 22)} saved</span> this month
                  </p>
                </CardContent>
              </Card>

              {/* Total ROI */}
              <Card className="bg-gradient-to-br from-routiq-prompt/5 to-routiq-prompt/10 border-routiq-prompt/20 shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <div className="group">
                    <CardTitle className="text-sm font-medium text-routiq-core flex items-center gap-1">
                      Total ROI Impact
                      <Tooltip content="Combined revenue generation and cost savings">
                        <HelpCircle className="h-3 w-3 text-routiq-blackberry/50" />
                      </Tooltip>
                    </CardTitle>
                  </div>
                  <TrendingUp className="h-4 w-4 text-routiq-prompt" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-routiq-core">
                    {formatCurrency((metrics?.revenueFromBookings || 0) + ((metrics?.adminHoursSaved || 0) * 22))}
                  </div>
                  <p className="text-xs text-routiq-prompt/70 mt-1">
                    <span className="font-medium">Direct financial impact</span> this month
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Conversion Funnel */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-routiq-core">
                  <BarChart3 className="h-5 w-5 text-routiq-prompt" />
                  Patient Journey Conversion Funnel
                </CardTitle>
                <CardDescription>How interactions convert to bookings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="bg-blue-100 rounded-lg p-4">
                        <MessageCircle className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                        <div className="text-lg font-bold text-blue-700">{metrics?.conversionFunnel.interactions.toLocaleString()}</div>
                        <div className="text-xs text-blue-600">Total Interactions</div>
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className="bg-purple-100 rounded-lg p-4">
                        <UserPlus className="h-6 w-6 text-purple-600 mx-auto mb-2" />
                        <div className="text-lg font-bold text-purple-700">{metrics?.conversionFunnel.qualified}</div>
                        <div className="text-xs text-purple-600">Qualified Leads</div>
                        <div className="text-xs text-purple-500 mt-1">
                          {calculateConversionRate(metrics?.conversionFunnel.qualified || 0, metrics?.conversionFunnel.interactions || 1)}%
                        </div>
                      </div>
                    </div>

                    <div className="text-center">
                      <div className="bg-orange-100 rounded-lg p-4">
                        <Target className="h-6 w-6 text-orange-600 mx-auto mb-2" />
                        <div className="text-lg font-bold text-orange-700">{metrics?.conversionFunnel.confirmed}</div>
                        <div className="text-xs text-orange-600">Confirmed Interest</div>
                        <div className="text-xs text-orange-500 mt-1">
                          {calculateConversionRate(metrics?.conversionFunnel.confirmed || 0, metrics?.conversionFunnel.qualified || 1)}%
                        </div>
                      </div>
                    </div>

                    <div className="text-center">
                      <div className="bg-green-100 rounded-lg p-4">
                        <CalendarCheck className="h-6 w-6 text-green-600 mx-auto mb-2" />
                        <div className="text-lg font-bold text-green-700">{metrics?.conversionFunnel.booked}</div>
                        <div className="text-xs text-green-600">Bookings Made</div>
                        <div className="text-xs text-green-500 mt-1">
                          {calculateConversionRate(metrics?.conversionFunnel.booked || 0, metrics?.conversionFunnel.confirmed || 1)}%
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-center text-sm text-routiq-blackberry/60">
                    <span className="font-medium">Overall conversion rate:</span> {calculateConversionRate(metrics?.conversionFunnel.booked || 0, metrics?.conversionFunnel.interactions || 1)}% 
                    <span className="text-green-600 ml-2">↑ 108% above industry avg (2.4%)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Key Performance Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* After Hours Support */}
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <div className="group">
                    <CardTitle className="text-sm font-medium text-routiq-core flex items-center gap-1">
                      After Hours Messages
                      <Tooltip content="Patient messages handled outside business hours">
                        <HelpCircle className="h-3 w-3 text-routiq-blackberry/50" />
                      </Tooltip>
                    </CardTitle>
                  </div>
                  <Moon className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-routiq-core">{metrics?.afterHoursMessages}</div>
                  <p className="text-xs text-routiq-blackberry/60 mt-1">
                    <span className="text-blue-600 font-medium">24/7</span> patient support
                  </p>
                </CardContent>
              </Card>

              {/* Response Time */}
              <Card className="bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <div className="group">
                    <CardTitle className="text-sm font-medium text-routiq-core flex items-center gap-1">
                      Response Time
                      <Tooltip content="Average time to respond to patient messages">
                        <HelpCircle className="h-3 w-3 text-routiq-blackberry/50" />
                      </Tooltip>
                    </CardTitle>
                  </div>
                  <Clock className="h-4 w-4 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-routiq-core">{metrics?.averageResponseTime}</div>
                  <p className="text-xs text-routiq-blackberry/60 mt-1">
                    <span className="text-orange-600 font-medium">Instant</span> AI responses
                  </p>
                </CardContent>
              </Card>

              {/* Patient Satisfaction */}
              <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100/50 border-yellow-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <div className="group">
                    <CardTitle className="text-sm font-medium text-routiq-core flex items-center gap-1">
                      Patient Satisfaction
                      <Tooltip content="Average patient rating for AI interactions">
                        <HelpCircle className="h-3 w-3 text-routiq-blackberry/50" />
                      </Tooltip>
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <div
                        key={star}
                        className={`w-2 h-2 rounded-full ${
                          star <= Math.floor(metrics?.patientSatisfactionScore || 0)
                            ? 'bg-yellow-400'
                            : 'bg-routiq-cloud/30'
                        }`}
                      />
                    ))}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-routiq-core">{metrics?.patientSatisfactionScore}/5</div>
                  <p className="text-xs text-routiq-blackberry/60 mt-1">
                    <span className="text-yellow-600 font-medium">↑ 50%</span> vs pre-AI
                  </p>
                </CardContent>
              </Card>

              {/* Automation Efficiency */}
              <Card className="bg-gradient-to-br from-green-50 to-green-100/50 border-green-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <div className="group">
                    <CardTitle className="text-sm font-medium text-routiq-core flex items-center gap-1">
                      Automation Rate
                      <Tooltip content="Percentage of interactions handled without human intervention">
                        <HelpCircle className="h-3 w-3 text-routiq-blackberry/50" />
                      </Tooltip>
                    </CardTitle>
                  </div>
                  <Bot className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-routiq-core">{metrics?.automationEfficiency}%</div>
                  <p className="text-xs text-routiq-blackberry/60 mt-1">
                    <span className="text-green-600 font-medium">Fully automated</span> handling
                  </p>
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          /* Before vs After Comparison View */
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Response Time Comparison */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-routiq-core">
                    <Clock className="h-5 w-5 text-routiq-prompt" />
                    Response Time Impact
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <div>
                      <div className="text-sm text-gray-600">Before Routiq</div>
                      <div className="text-xl font-bold text-red-600">{metrics?.beforeAfter.responseTime.before}</div>
                    </div>
                    <ArrowDownRight className="h-6 w-6 text-red-500" />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div>
                      <div className="text-sm text-gray-600">With Routiq Agent</div>
                      <div className="text-xl font-bold text-green-600">{metrics?.beforeAfter.responseTime.after}</div>
                    </div>
                    <ArrowUpRight className="h-6 w-6 text-green-500" />
                  </div>
                  <div className="text-center text-lg font-bold text-routiq-prompt">
                    450x faster response time
                  </div>
                </CardContent>
              </Card>

              {/* Availability Comparison */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-routiq-core">
                    <Moon className="h-5 w-5 text-routiq-prompt" />
                    Coverage Impact
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <div>
                      <div className="text-sm text-gray-600">Before Routiq</div>
                      <div className="text-xl font-bold text-red-600">{metrics?.beforeAfter.availability.before}</div>
                    </div>
                    <ArrowDownRight className="h-6 w-6 text-red-500" />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div>
                      <div className="text-sm text-gray-600">With Routiq Agent</div>
                      <div className="text-xl font-bold text-green-600">{metrics?.beforeAfter.availability.after}</div>
                    </div>
                    <ArrowUpRight className="h-6 w-6 text-green-500" />
                  </div>
                  <div className="text-center text-lg font-bold text-routiq-prompt">
                    +128 hours coverage per week
                  </div>
                </CardContent>
              </Card>

              {/* Satisfaction Comparison */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-routiq-core">
                    <Users className="h-5 w-5 text-routiq-prompt" />
                    Patient Satisfaction
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <div>
                      <div className="text-sm text-gray-600">Before Routiq</div>
                      <div className="text-xl font-bold text-red-600">{metrics?.beforeAfter.patientSatisfaction.before}/5</div>
                    </div>
                    <ArrowDownRight className="h-6 w-6 text-red-500" />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div>
                      <div className="text-sm text-gray-600">With Routiq Agent</div>
                      <div className="text-xl font-bold text-green-600">{metrics?.beforeAfter.patientSatisfaction.after}/5</div>
                    </div>
                    <ArrowUpRight className="h-6 w-6 text-green-500" />
                  </div>
                  <div className="text-center text-lg font-bold text-routiq-prompt">
                    +50% improvement
                  </div>
                </CardContent>
              </Card>

              {/* Conversion Comparison */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-routiq-core">
                    <Target className="h-5 w-5 text-routiq-prompt" />
                    Booking Conversion
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <div>
                      <div className="text-sm text-gray-600">Before Routiq</div>
                      <div className="text-xl font-bold text-red-600">{metrics?.beforeAfter.bookingConversion.before}%</div>
                    </div>
                    <ArrowDownRight className="h-6 w-6 text-red-500" />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div>
                      <div className="text-sm text-gray-600">With Routiq Agent</div>
                      <div className="text-xl font-bold text-green-600">{metrics?.beforeAfter.bookingConversion.after}%</div>
                    </div>
                    <ArrowUpRight className="h-6 w-6 text-green-500" />
                  </div>
                  <div className="text-center text-lg font-bold text-routiq-prompt">
                    +108% conversion increase
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 
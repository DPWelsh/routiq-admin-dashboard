"use client"

// Force dynamic rendering to prevent SSR issues with Clerk
export const dynamic = 'force-dynamic'

import { useEffect, useState } from "react"
import Image from 'next/image'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, BarChart3, TrendingDown, TrendingUp, Timer, Zap, Activity } from "lucide-react"

interface TimingData {
  averageResponseTime: number
  peakHours: string[]
  fastestResponse: number
  slowestResponse: number
  timeDistribution: {
    under30s: number
    under1m: number
    under5m: number
    over5m: number
  }
}

export default function TimingAnalysisPage() {
  const [timingData, setTimingData] = useState<TimingData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    console.log("⏰ [TIMING] Component mounted")
    
    // Mock timing data
    const mockData: TimingData = {
      averageResponseTime: 2.4,
      peakHours: ["9:00 AM", "2:00 PM", "7:00 PM"],
      fastestResponse: 0.3,
      slowestResponse: 8.7,
      timeDistribution: {
        under30s: 45,
        under1m: 72,
        under5m: 91,
        over5m: 9
      }
    }

    setTimeout(() => {
      setTimingData(mockData)
      setLoading(false)
    }, 1000)
  }, [])

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
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Timing Analysis</h1>
        <p className="text-gray-600">Analyze response times and identify optimization opportunities</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Response</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{timingData?.averageResponseTime} min</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">↓ 15%</span> improvement
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fastest Response</CardTitle>
            <TrendingDown className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{timingData?.fastestResponse} min</div>
            <p className="text-xs text-muted-foreground">Best case scenario</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Slowest Response</CardTitle>
            <TrendingUp className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{timingData?.slowestResponse} min</div>
            <p className="text-xs text-muted-foreground">Needs attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Peak Hours</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold space-y-1">
              {timingData?.peakHours.map((hour, index) => (
                <div key={index} className="text-blue-600">{hour}</div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Response Time Distribution</CardTitle>
            <CardDescription>Percentage of responses by time range</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Under 30 seconds</span>
                <div className="flex items-center space-x-2">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full" 
                      style={{width: `${timingData?.timeDistribution.under30s}%`}}
                    ></div>
                  </div>
                  <span className="text-sm font-medium">{timingData?.timeDistribution.under30s}%</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Under 1 minute</span>
                <div className="flex items-center space-x-2">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{width: `${timingData?.timeDistribution.under1m}%`}}
                    ></div>
                  </div>
                  <span className="text-sm font-medium">{timingData?.timeDistribution.under1m}%</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Under 5 minutes</span>
                <div className="flex items-center space-x-2">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-yellow-600 h-2 rounded-full" 
                      style={{width: `${timingData?.timeDistribution.under5m}%`}}
                    ></div>
                  </div>
                  <span className="text-sm font-medium">{timingData?.timeDistribution.under5m}%</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Over 5 minutes</span>
                <div className="flex items-center space-x-2">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-red-600 h-2 rounded-full" 
                      style={{width: `${timingData?.timeDistribution.over5m}%`}}
                    ></div>
                  </div>
                  <span className="text-sm font-medium">{timingData?.timeDistribution.over5m}%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Response Time Trends</CardTitle>
            <CardDescription>Historical response time data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p>Time series charts will be implemented in the next sprint</p>
                <p className="text-sm">Shows response time trends over time with hour-by-hour breakdown</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 
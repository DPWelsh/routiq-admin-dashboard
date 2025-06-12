"use client"

// Force dynamic rendering to prevent SSR issues with Clerk
export const dynamic = 'force-dynamic'

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Heart, Smile, Frown, Meh, TrendingUp } from "lucide-react"

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

export default function SentimentPage() {
  const [sentimentData, setSentimentData] = useState<SentimentData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    console.log("💖 [SENTIMENT] Component mounted")
    
    // Mock sentiment data
    const mockData: SentimentData = {
      overallSentiment: 4.2,
      positivePercentage: 67,
      neutralPercentage: 25,
      negativePercentage: 8,
      sentimentTrends: {
        positive: 12,
        neutral: -3,
        negative: -9
      },
      commonPositiveWords: ["helpful", "quick", "professional", "satisfied", "excellent"],
      commonNegativeWords: ["slow", "confused", "frustrated", "unclear"]
    }

    setTimeout(() => {
      setSentimentData(mockData)
      setLoading(false)
    }, 1000)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const getSentimentColor = (sentiment: number) => {
    if (sentiment >= 4) return "text-green-600"
    if (sentiment >= 3) return "text-yellow-600"
    return "text-red-600"
  }

  const getSentimentIcon = (sentiment: number) => {
    if (sentiment >= 4) return <Smile className="h-6 w-6 text-green-600" />
    if (sentiment >= 3) return <Meh className="h-6 w-6 text-yellow-600" />
    return <Frown className="h-6 w-6 text-red-600" />
  }

  return (
    <div className="p-4 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Sentiment Analysis</h1>
        <p className="text-gray-600">Track customer sentiment and emotional responses</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Sentiment</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {getSentimentIcon(sentimentData?.overallSentiment || 0)}
              <span className={`text-2xl font-bold ${getSentimentColor(sentimentData?.overallSentiment || 0)}`}>
                {sentimentData?.overallSentiment}/5
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">↑ 0.3</span> from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Positive Feedback</CardTitle>
            <Smile className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{sentimentData?.positivePercentage}%</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">↑ {sentimentData?.sentimentTrends.positive}%</span> increase
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Neutral Feedback</CardTitle>
            <Meh className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{sentimentData?.neutralPercentage}%</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-red-600">↓ {Math.abs(sentimentData?.sentimentTrends.neutral || 0)}%</span> decrease
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Negative Feedback</CardTitle>
            <Frown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{sentimentData?.negativePercentage}%</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">↓ {Math.abs(sentimentData?.sentimentTrends.negative || 0)}%</span> decrease
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Sentiment Distribution</CardTitle>
            <CardDescription>Breakdown of customer sentiment</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Smile className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Positive</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full" 
                      style={{width: `${sentimentData?.positivePercentage}%`}}
                    ></div>
                  </div>
                  <span className="text-sm font-medium">{sentimentData?.positivePercentage}%</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Meh className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm">Neutral</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-yellow-600 h-2 rounded-full" 
                      style={{width: `${sentimentData?.neutralPercentage}%`}}
                    ></div>
                  </div>
                  <span className="text-sm font-medium">{sentimentData?.neutralPercentage}%</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Frown className="h-4 w-4 text-red-600" />
                  <span className="text-sm">Negative</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-red-600 h-2 rounded-full" 
                      style={{width: `${sentimentData?.negativePercentage}%`}}
                    ></div>
                  </div>
                  <span className="text-sm font-medium">{sentimentData?.negativePercentage}%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Word Analysis</CardTitle>
            <CardDescription>Most common words in feedback</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-green-600 mb-2">Positive Keywords</h4>
                <div className="flex flex-wrap gap-2">
                  {sentimentData?.commonPositiveWords.map((word, index) => (
                    <span key={index} className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                      {word}
                    </span>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-red-600 mb-2">Negative Keywords</h4>
                <div className="flex flex-wrap gap-2">
                  {sentimentData?.commonNegativeWords.map((word, index) => (
                    <span key={index} className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs">
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sentiment Trends</CardTitle>
          <CardDescription>Customer sentiment over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>Sentiment trend charts will be implemented in the next sprint</p>
              <p className="text-sm">Shows sentiment evolution over time with positive/negative breakdowns</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 
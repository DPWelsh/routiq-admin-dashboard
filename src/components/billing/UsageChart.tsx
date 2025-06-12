'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { useUsageMetrics } from '@/hooks/useUsageMetrics';

interface UsageChartProps {
  organizationId: string;
  className?: string;
  metricType?: 'users' | 'patients' | 'conversations' | 'messages';
}

export function UsageChart({ 
  organizationId, 
  className, 
  metricType = 'users' 
}: UsageChartProps) {
  const { usageData, isLoading, error } = useUsageMetrics();

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Usage Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-32 bg-muted rounded-md" />
            <div className="flex justify-between">
              <div className="h-4 bg-muted rounded w-20" />
              <div className="h-4 bg-muted rounded w-16" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !usageData) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Usage Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            {error ? 'Failed to load usage data' : 'No usage data available'}
          </div>
        </CardContent>
      </Card>
    );
  }

  const metric = usageData.metrics[metricType];
  const percentage = metric.percentage;

  // Generate simple trend data (mock data for demonstration)
  const generateTrendData = () => {
    const days = 7;
    const data = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      // Generate realistic usage progression
      const baseUsage = metric.total * (0.7 + (Math.random() * 0.3));
      const dailyUsage = Math.floor(baseUsage * (0.8 + (Math.random() * 0.4)) / days);
      
      data.push({
        date: date.toLocaleDateString('en-US', { weekday: 'short' }),
        value: dailyUsage,
        percentage: (dailyUsage / metric.limit) * 100
      });
    }
    return data;
  };

  const trendData = generateTrendData();
  const maxValue = Math.max(...trendData.map(d => d.value));
  const trend = trendData[trendData.length - 1].value > trendData[0].value ? 'up' : 'down';

  const getMetricLabel = (type: string) => {
    switch (type) {
      case 'users': return 'Users';
      case 'patients': return 'Patients';
      case 'conversations': return 'Conversations';
      case 'messages': return 'Messages';
      default: return 'Usage';
    }
  };

  const getMetricColor = (type: string) => {
    switch (type) {
      case 'users': return 'bg-blue-500';
      case 'patients': return 'bg-purple-500';
      case 'conversations': return 'bg-green-500';
      case 'messages': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          {getMetricLabel(metricType)} Trends
          <div className="ml-auto flex items-center gap-2">
            {trend === 'up' ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
            <Badge variant="outline">7 days</Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Chart */}
          <div className="flex items-end justify-between h-32 gap-2">
            {trendData.map((item, index) => (
              <div key={index} className="flex flex-col items-center flex-1">
                <div className="relative w-full flex items-end justify-center">
                  <div
                    className={`w-full max-w-8 rounded-t ${getMetricColor(metricType)} transition-all duration-300 hover:opacity-80`}
                    style={{
                      height: `${Math.max((item.value / maxValue) * 100, 5)}%`,
                      minHeight: '4px'
                    }}
                    title={`${item.date}: ${item.value} ${getMetricLabel(metricType).toLowerCase()}`}
                  />
                </div>
                <div className="text-xs text-muted-foreground mt-2 font-medium">
                  {item.date}
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              Current: {metric.total.toLocaleString()} / {metric.limit.toLocaleString()}
            </div>
            <div className="text-sm font-medium">
              {percentage.toFixed(1)}% used
            </div>
          </div>

          {/* Usage Status */}
          <div className="flex gap-2">
            {percentage >= 90 && (
              <Badge variant="destructive" className="text-xs">
                Near Limit
              </Badge>
            )}
            {percentage >= 75 && percentage < 90 && (
              <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800">
                High Usage
              </Badge>
            )}
            {percentage < 50 && (
              <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                Normal Usage
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 
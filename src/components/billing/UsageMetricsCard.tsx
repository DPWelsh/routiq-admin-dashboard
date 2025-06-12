'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, 
  Database, 
  Users, 
  Clock, 
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';
import { useUsageMetrics } from '@/hooks/useUsageMetrics';
import { cn } from '@/lib/utils';

// Simple Skeleton component
interface SkeletonProps {
  className?: string;
}

function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cn("animate-pulse rounded-md bg-muted", className)} />
  );
}

interface UsageMetricsCardProps {
  organizationId: string;
  className?: string;
}

export function UsageMetricsCard({ organizationId, className }: UsageMetricsCardProps) {
  const { usageData, isLoading, error } = useUsageMetrics();

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Usage Metrics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Usage Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!usageData) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Usage Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No usage data available.</p>
        </CardContent>
      </Card>
    );
  }

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 75) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <Minus className="h-4 w-4 text-gray-400" />;
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Usage Metrics
          <Badge variant="outline" className="ml-auto">
            Current Period
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Users */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              <span className="font-medium">Users</span>
              {getTrendIcon('stable')}
            </div>
            <div className="text-right">
              <div className={`font-semibold ${getUsageColor(usageData.metrics.users.percentage)}`}>
                {formatNumber(usageData.metrics.users.total)} / {formatNumber(usageData.metrics.users.limit)}
              </div>
              <div className="text-sm text-muted-foreground">
                {usageData.metrics.users.percentage.toFixed(1)}%
              </div>
            </div>
          </div>
          <Progress 
            value={usageData.metrics.users.percentage} 
            className="h-2"
          />
        </div>

        {/* Patients */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-purple-600" />
              <span className="font-medium">Patients</span>
              {getTrendIcon('stable')}
            </div>
            <div className="text-right">
              <div className={`font-semibold ${getUsageColor(usageData.metrics.patients.percentage)}`}>
                {formatNumber(usageData.metrics.patients.total)} / {formatNumber(usageData.metrics.patients.limit)}
              </div>
              <div className="text-sm text-muted-foreground">
                {usageData.metrics.patients.percentage.toFixed(1)}%
              </div>
            </div>
          </div>
          <Progress 
            value={usageData.metrics.patients.percentage} 
            className="h-2"
          />
        </div>

        {/* Conversations */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-green-600" />
              <span className="font-medium">Conversations</span>
              {getTrendIcon('stable')}
            </div>
            <div className="text-right">
              <div className={`font-semibold ${getUsageColor(usageData.metrics.conversations.percentage)}`}>
                {formatNumber(usageData.metrics.conversations.total)} / {formatNumber(usageData.metrics.conversations.limit)}
              </div>
              <div className="text-sm text-muted-foreground">
                {usageData.metrics.conversations.percentage.toFixed(1)}%
              </div>
            </div>
          </div>
          <Progress 
            value={usageData.metrics.conversations.percentage} 
            className="h-2"
          />
        </div>

        {/* Messages */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-orange-600" />
              <span className="font-medium">Messages</span>
              {getTrendIcon('stable')}
            </div>
            <div className="text-right">
              <div className={`font-semibold ${getUsageColor(usageData.metrics.messages.percentage)}`}>
                {formatNumber(usageData.metrics.messages.total)} / {formatNumber(usageData.metrics.messages.limit)}
              </div>
              <div className="text-sm text-muted-foreground">
                {usageData.metrics.messages.percentage.toFixed(1)}%
              </div>
            </div>
          </div>
          <Progress 
            value={usageData.metrics.messages.percentage} 
            className="h-2"
          />
        </div>

        {/* Usage Warnings */}
        {usageData.warnings.length > 0 && (
          <Alert variant="default">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>
              Usage Alerts
            </AlertTitle>
            <AlertDescription className="space-y-1">
              <div>You have {usageData.warnings.length} usage warning{usageData.warnings.length > 1 ? 's' : ''}.</div>
              <div className="text-sm">
                Monitor your usage closely to avoid service interruptions.
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
} 
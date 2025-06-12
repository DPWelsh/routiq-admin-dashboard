'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  AlertTriangle, 
  AlertCircle, 
  Clock, 
  CreditCard,
  Users,
  ExternalLink,
  X
} from 'lucide-react';
import { useBillingAlerts } from '@/hooks/useBillingAlerts';
import { useUsageMetrics } from '@/hooks/useUsageMetrics';

interface UsageAlertsProps {
  organizationId: string;
  className?: string;
  showDismissible?: boolean;
}

export function UsageAlerts({ 
  organizationId, 
  className, 
  showDismissible = true 
}: UsageAlertsProps) {
  const { alerts, isLoading, error, dismissAlert } = useBillingAlerts();
  const { usageData } = useUsageMetrics();

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Usage Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 bg-muted rounded-md" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Usage Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              Failed to load billing alerts: {error}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Combine billing alerts with usage warnings
  const allAlerts = [
    ...(alerts || []),
    ...(usageData?.warnings.map(warning => ({
      id: `usage-${warning.type}`,
      type: 'usage' as const,
      level: warning.level,
      title: `${warning.type.charAt(0).toUpperCase() + warning.type.slice(1)} Usage Alert`,
      message: `You are using ${warning.percentage.toFixed(1)}% of your ${warning.type} limit (${warning.current}/${warning.limit}).`,
      actionUrl: '/dashboard/organization/billing',
      actionText: 'Manage Plan',
      canDismiss: true,
      timestamp: new Date().toISOString()
    })) || [])
  ];

  if (allAlerts.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Usage Alerts
            <Badge variant="secondary" className="ml-auto">
              All Clear
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-4">
            No billing or usage alerts at this time.
          </div>
        </CardContent>
      </Card>
    );
  }

  const getAlertIcon = (type: string, level: string) => {
    if (level === 'critical') {
      return <AlertTriangle className="h-4 w-4 text-red-600" />;
    }
    
    switch (type) {
      case 'trial_expiring':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'payment_failed':
        return <CreditCard className="h-4 w-4 text-red-600" />;
      case 'usage':
        return <Users className="h-4 w-4 text-orange-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-blue-600" />;
    }
  };

  const getAlertVariant = (level: string): "default" | "destructive" => {
    return level === 'critical' ? 'destructive' : 'default';
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'critical':
        return <Badge variant="destructive" className="text-xs">Critical</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800">Warning</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">Info</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffMinutes < 60) {
      return `${diffMinutes} minutes ago`;
    } else if (diffMinutes < 1440) {
      return `${Math.floor(diffMinutes / 60)} hours ago`;
    } else {
      return `${Math.floor(diffMinutes / 1440)} days ago`;
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Usage Alerts
          <Badge variant="outline" className="ml-auto">
            {allAlerts.length} alert{allAlerts.length !== 1 ? 's' : ''}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {allAlerts.map((alert) => (
          <Alert key={alert.id} variant={getAlertVariant(alert.level)}>
            <div className="flex items-start gap-3">
              {getAlertIcon(alert.type, alert.level)}
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTitle className="text-sm font-medium">
                    {alert.title}
                  </AlertTitle>
                  {getLevelBadge(alert.level)}
                </div>
                <AlertDescription className="text-sm">
                  {alert.message}
                </AlertDescription>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    {formatDate(alert.timestamp)}
                  </div>
                  <div className="flex items-center gap-2">
                    {alert.actionUrl && alert.actionText && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-7 text-xs"
                        onClick={() => window.open(alert.actionUrl, '_blank')}
                      >
                        {alert.actionText}
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                    )}
                    {showDismissible && alert.canDismiss && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => dismissAlert(alert.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Alert>
        ))}
      </CardContent>
    </Card>
  );
} 
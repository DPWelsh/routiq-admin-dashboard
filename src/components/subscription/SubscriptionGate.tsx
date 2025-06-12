import { useSubscription } from '@/hooks/useSubscription'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Crown, Lock } from 'lucide-react'

interface SubscriptionGateProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function SubscriptionGate({ children, fallback }: SubscriptionGateProps) {
  const { isSubscribed } = useSubscription()

  if (isSubscribed) {
    return <>{children}</>
  }

  return (
    <>
      {fallback || (
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Crown className="h-6 w-6 text-white" />
            </div>
            <CardTitle className="flex items-center justify-center gap-2">
              <Lock className="h-5 w-5" />
              Premium Feature
            </CardTitle>
            <CardDescription>
              This feature requires an active subscription to access
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <a href="/pricing">Upgrade to Premium</a>
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  )
}

// Quick usage example
export function PremiumDashboardSection() {
  return (
    <SubscriptionGate>
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Premium Analytics</h2>
        <p>Advanced metrics and insights available to premium users</p>
        {/* Your premium content here */}
      </div>
    </SubscriptionGate>
  )
} 
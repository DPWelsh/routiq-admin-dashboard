import { useUser } from '@clerk/nextjs'

export interface SubscriptionData {
  isSubscribed: boolean
  subscriptionId: string | null
  subscriptionStatus: string | null
  stripeCustomerId: string | null
  currentPeriodEnd: number | null
  cancelAtPeriodEnd: boolean | null
  lastPaymentStatus: string | null
  lastPaymentDate: string | null
}

export function useSubscription(): SubscriptionData {
  const { user } = useUser()
  
  const metadata = user?.publicMetadata
  
  const isSubscribed = metadata?.subscriptionStatus === 'active'
  const subscriptionId = (metadata?.subscriptionId as string) || null
  const subscriptionStatus = (metadata?.subscriptionStatus as string) || null
  const stripeCustomerId = (metadata?.stripeCustomerId as string) || null
  const currentPeriodEnd = (metadata?.currentPeriodEnd as number) || null
  const cancelAtPeriodEnd = (metadata?.cancelAtPeriodEnd as boolean) || null
  const lastPaymentStatus = (metadata?.lastPaymentStatus as string) || null
  const lastPaymentDate = (metadata?.lastPaymentDate as string) || null
  
  return {
    isSubscribed,
    subscriptionId,
    subscriptionStatus,
    stripeCustomerId,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    lastPaymentStatus,
    lastPaymentDate,
  }
}

// Helper function to check if subscription is active and not expired
export function useIsSubscriptionActive(): boolean {
  const { isSubscribed, currentPeriodEnd } = useSubscription()
  
  if (!isSubscribed || !currentPeriodEnd) return false
  
  // Check if subscription hasn't expired
  const now = Math.floor(Date.now() / 1000)
  return currentPeriodEnd > now
}

// Helper function to get subscription status text
export function useSubscriptionStatusText(): string {
  const { subscriptionStatus, cancelAtPeriodEnd } = useSubscription()
  
  if (!subscriptionStatus) return 'No subscription'
  
  switch (subscriptionStatus) {
    case 'active':
      return cancelAtPeriodEnd ? 'Active (Canceling)' : 'Active'
    case 'canceled':
      return 'Canceled'
    case 'incomplete':
      return 'Payment Required'
    case 'incomplete_expired':
      return 'Expired'
    case 'past_due':
      return 'Past Due'
    case 'unpaid':
      return 'Unpaid'
    case 'trialing':
      return 'Trial'
    default:
      return subscriptionStatus
  }
} 
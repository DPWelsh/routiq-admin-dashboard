"use client"

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useOrganizationBilling } from '@/hooks/useOrganizationBilling'
import { useOrganizationContext } from '@/hooks/useOrganizationContext'
import { Calendar, CreditCard, Building, Users, Shield, AlertTriangle } from 'lucide-react'

export function BillingSection() {
  const { 
    billingData, 
    isLoading, 
    error, 
    openCustomerPortal,
    trialDaysRemaining,
    hasActiveSubscription 
  } = useOrganizationBilling()

  const { organizationName, userRole, isAdmin, isOwner } = useOrganizationContext()

  // Check if user can manage billing
  const canManageBilling = isAdmin || isOwner
  const isInTrial = billingData?.trial.isInTrial || false
  const daysRemaining = trialDaysRemaining

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Organization Billing
          </CardTitle>
          <CardDescription>Loading billing information...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Billing Error
          </CardTitle>
          <CardDescription>Unable to load billing information</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <Button 
            variant="outline" 
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Permission check
  if (!canManageBilling) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Organization Billing
          </CardTitle>
          <CardDescription>Billing management access restricted</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-2">
            You need administrator permissions to view billing information.
          </p>
          <Badge variant="secondary" className="capitalize">
            {userRole}
          </Badge>
        </CardContent>
      </Card>
    )
  }

  const handleManageBilling = async () => {
    try {
      const portalUrl = await openCustomerPortal()
      if (portalUrl) {
        window.location.href = portalUrl
      }
    } catch (error) {
      console.error('Failed to open customer portal:', error)
      // Could show a toast notification here
    }
  }

  // Format currency
  const formatCurrency = (amount: number | null, currency: string = 'usd') => {
    if (amount === null) return 'N/A'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100)
  }

  // Format date
  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return 'N/A'
    return new Date(timestamp * 1000).toLocaleDateString()
  }

  const subscription = billingData?.stripe?.subscription
  const customer = billingData?.stripe?.customer

  return (
    <div className="space-y-6">
      {/* Organization Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            {organizationName || 'Organization'} Billing
          </CardTitle>
          <CardDescription>
            Manage your organization&apos;s subscription and billing details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Subscription Status */}
            <div className="flex items-center gap-3">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Status</p>
                <Badge 
                  variant={
                    billingData?.organization?.subscriptionStatus === 'active' ? 'default' :
                    billingData?.organization?.subscriptionStatus === 'trialing' ? 'secondary' :
                    'destructive'
                  }
                  className="capitalize"
                >
                  {billingData?.organization?.subscriptionStatus || 'Unknown'}
                </Badge>
              </div>
            </div>

            {/* Current Plan */}
            <div className="flex items-center gap-3">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Plan</p>
                <p className="text-sm text-muted-foreground capitalize">
                  {billingData?.organization?.subscriptionPlan || 'No plan'}
                </p>
              </div>
            </div>

            {/* Trial Info */}
            {isInTrial && (
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Trial</p>
                  <p className="text-sm text-muted-foreground">
                    {daysRemaining} days remaining
                  </p>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Subscription Details */}
          {subscription && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Subscription Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Billing Period</p>
                  <p>{formatDate(subscription.currentPeriodStart)} - {formatDate(subscription.currentPeriodEnd)}</p>
                </div>
                {subscription.items && subscription.items.length > 0 && (
                  <div>
                    <p className="text-muted-foreground">Amount</p>
                    <p>{formatCurrency(subscription.items[0]?.amount, subscription.items[0]?.currency)}</p>
                  </div>
                )}
                {subscription.cancelAtPeriodEnd && (
                  <div>
                    <p className="text-muted-foreground">Cancellation</p>
                    <p className="text-red-600">Ends {formatDate(subscription.currentPeriodEnd)}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Customer Portal Button */}
          <div className="pt-4">
            <Button 
              onClick={handleManageBilling}
              className="w-full md:w-auto"
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Manage Billing
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Opens Stripe customer portal to manage payment methods, view invoices, and update billing details.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Billing Contact */}
      {customer && (
        <Card>
          <CardHeader>
            <CardTitle>Billing Contact</CardTitle>
            <CardDescription>Current billing information on file</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div>
                <p className="text-muted-foreground">Email</p>
                <p>{customer.email || 'No email on file'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Customer Since</p>
                <p>{formatDate(customer.created)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Subscription State */}
      {!hasActiveSubscription && !isInTrial && (
        <Card>
          <CardHeader>
            <CardTitle>No Active Subscription</CardTitle>
            <CardDescription>
              Your organization doesn&apos;t have an active subscription
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              To access premium features, please subscribe to a plan.
            </p>
            <Button onClick={handleManageBilling}>
              View Plans
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 
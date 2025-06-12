'use client'

import { SignOutButton } from '@clerk/nextjs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle, Mail } from 'lucide-react'

export default function OnboardingPendingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="w-6 h-6 text-yellow-600" />
          </div>
          <CardTitle className="text-xl font-semibold text-gray-900">
            Organization Access Pending
          </CardTitle>
          <CardDescription className="text-gray-600">
            You need to be invited to an organization to access the dashboard
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Mail className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-900 mb-1">
                  Waiting for invitation
                </p>
                <p className="text-blue-700">
                  Ask your organization administrator to send you an invitation link to join their organization.
                </p>
              </div>
            </div>
          </div>
          
          <div className="text-center space-y-3">
            <p className="text-sm text-gray-600">
              Need help? Contact your organization administrator or{' '}
              <a 
                href="mailto:support@routiq.app" 
                className="text-blue-600 hover:text-blue-700 underline"
              >
                support@routiq.app
              </a>
            </p>
            
            <div className="pt-4 border-t border-gray-200">
              <SignOutButton>
                <Button variant="outline" className="w-full">
                  Sign Out
                </Button>
              </SignOutButton>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 
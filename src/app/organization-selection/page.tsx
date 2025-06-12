'use client'

import { OrganizationList, CreateOrganization } from '@clerk/nextjs'
import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Building2, Plus } from 'lucide-react'

export default function OrganizationSelectionPage() {
  const [showCreateOrg, setShowCreateOrg] = useState(false)

  if (showCreateOrg) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>Create Organization</CardTitle>
            <CardDescription>
              Set up a new organization for your clinic
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateOrganization 
              afterCreateOrganizationUrl="/dashboard"
              skipInvitationScreen={false}
            />
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => setShowCreateOrg(false)}
            >
              Back to selection
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Building2 className="w-6 h-6 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-semibold">
            Select Your Organization
          </CardTitle>
          <CardDescription>
            Choose an organization to continue or create a new one
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Clerk's OrganizationList component handles everything */}
          <OrganizationList 
            afterSelectOrganizationUrl="/dashboard"
            afterCreateOrganizationUrl="/dashboard"
          />
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-muted-foreground">
                Or
              </span>
            </div>
          </div>
          
          <Button 
            className="w-full"
            onClick={() => setShowCreateOrg(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create New Organization
          </Button>
        </CardContent>
      </Card>
    </div>
  )
} 
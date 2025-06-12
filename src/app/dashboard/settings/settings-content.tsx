"use client"

import { useUser, useClerk } from '@clerk/nextjs'
import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  User, 
  Bell, 
  Shield, 
  CreditCard,
  Settings as SettingsIcon,
  Save,
  Download,
  Trash2,
  AlertTriangle
} from 'lucide-react'
import { BillingSection } from '@/components/subscription/BillingSection'

export default function SettingsContent() {
  const { user, isLoaded } = useUser()
  const { signOut } = useClerk()
  
  const [activeTab, setActiveTab] = useState('profile')
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    marketing: false
  })

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-routiq-core"></div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-3 p-4 h-full overflow-auto">
      {/* Header */}
      <div className="text-center space-y-1">
        <h1 className="text-xl font-bold text-routiq-core">Account Settings</h1>
        <p className="text-gray-600 text-xs">Manage your account preferences and settings</p>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-gray-100 h-10">
          <TabsTrigger value="profile" className="flex items-center gap-2 text-xs">
            <User className="h-3 w-3" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="billing" className="flex items-center gap-2 text-xs">
            <CreditCard className="h-3 w-3" />
            Billing
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2 text-xs">
            <Bell className="h-3 w-3" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2 text-xs">
            <Shield className="h-3 w-3" />
            Security
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-3 mt-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Profile Info Card */}
            <Card className="border-gray-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-routiq-core text-base">Profile Information</CardTitle>
                <CardDescription className="text-xs">Update your personal details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Profile Header */}
                <div className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-r from-routiq-core to-routiq-energy flex items-center justify-center text-white text-sm font-semibold">
                    {user?.firstName?.[0] || user?.emailAddresses[0]?.emailAddress[0]?.toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-routiq-core">
                      {user?.firstName} {user?.lastName}
                    </h3>
                    <p className="text-gray-600 text-xs">
                      {user?.emailAddresses[0]?.emailAddress}
                    </p>
                    <Badge className="bg-green-100 text-green-800 border-green-200 text-xs mt-1">
                      {user?.emailAddresses[0]?.verification?.status === 'verified' ? 'Verified' : 'Unverified'}
                    </Badge>
                  </div>
                </div>
                
                {/* Form Fields */}
                <div className="grid grid-cols-1 gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="firstName" className="text-xs font-medium">First Name</Label>
                      <Input 
                        id="firstName" 
                        defaultValue={user?.firstName || ''} 
                        placeholder="First name"
                        className="border-gray-200 focus:border-routiq-core text-xs h-8"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="lastName" className="text-xs font-medium">Last Name</Label>
                      <Input 
                        id="lastName" 
                        defaultValue={user?.lastName || ''} 
                        placeholder="Last name"
                        className="border-gray-200 focus:border-routiq-core text-xs h-8"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <Label htmlFor="email" className="text-xs font-medium">Email Address</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      defaultValue={user?.emailAddresses[0]?.emailAddress || ''} 
                      disabled
                      className="bg-gray-50 border-gray-200 text-xs h-8"
                    />
                    <p className="text-[10px] text-gray-500">
                      Email changes via Clerk account settings
                    </p>
                  </div>

                  <Button className="bg-routiq-core hover:bg-routiq-core/90 text-white text-xs h-8">
                    <Save className="h-3 w-3 mr-2" />
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions Card */}
            <Card className="border-gray-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-routiq-core text-base">Quick Actions</CardTitle>
                <CardDescription className="text-xs">Common account tasks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex items-center justify-between p-2 border border-gray-200 rounded-lg">
                    <div>
                      <h4 className="font-medium text-xs">Change Password</h4>
                      <p className="text-[10px] text-gray-500">Update your password</p>
                    </div>
                    <Button variant="outline" size="sm" className="border-routiq-core text-routiq-core hover:bg-routiq-core hover:text-white text-[10px] h-7">
                      Change
                    </Button>
                  </div>
                  
                  <div className="flex items-center justify-between p-2 border border-gray-200 rounded-lg">
                    <div>
                      <h4 className="font-medium text-xs">Enable 2FA</h4>
                      <p className="text-[10px] text-gray-500">Add extra security</p>
                    </div>
                    <Button variant="outline" size="sm" className="border-routiq-core text-routiq-core hover:bg-routiq-core hover:text-white text-[10px] h-7">
                      Enable
                    </Button>
                  </div>
                  
                  <div className="flex items-center justify-between p-2 border border-gray-200 rounded-lg">
                    <div>
                      <h4 className="font-medium text-xs">Export Data</h4>
                      <p className="text-[10px] text-gray-500">Download your data</p>
                    </div>
                    <Button variant="outline" size="sm" className="border-routiq-core text-routiq-core hover:bg-routiq-core hover:text-white text-[10px] h-7">
                      <Download className="h-3 w-3 mr-1" />
                      Export
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing" className="space-y-3 mt-3">
          <BillingSection />
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-3 mt-3">
          <Card className="border-gray-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-routiq-core text-base">Notification Preferences</CardTitle>
              <CardDescription className="text-xs">Choose how you want to receive updates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="flex items-center justify-between p-2 border border-gray-200 rounded-lg">
                  <div>
                    <Label className="text-xs font-medium">Email Notifications</Label>
                    <p className="text-[10px] text-gray-500">Important updates via email</p>
                  </div>
                  <Switch
                    checked={notifications.email}
                    onCheckedChange={(checked) => 
                      setNotifications(prev => ({ ...prev, email: checked }))
                    }
                  />
                </div>
                
                <div className="flex items-center justify-between p-2 border border-gray-200 rounded-lg">
                  <div>
                    <Label className="text-xs font-medium">Push Notifications</Label>
                    <p className="text-[10px] text-gray-500">Browser notifications</p>
                  </div>
                  <Switch
                    checked={notifications.push}
                    onCheckedChange={(checked) => 
                      setNotifications(prev => ({ ...prev, push: checked }))
                    }
                  />
                </div>
                
                <div className="flex items-center justify-between p-2 border border-gray-200 rounded-lg">
                  <div>
                    <Label className="text-xs font-medium">Marketing Updates</Label>
                    <p className="text-[10px] text-gray-500">Feature updates & offers</p>
                  </div>
                  <Switch
                    checked={notifications.marketing}
                    onCheckedChange={(checked) => 
                      setNotifications(prev => ({ ...prev, marketing: checked }))
                    }
                  />
                </div>
              </div>
              
              <div className="mt-3">
                <Button className="bg-routiq-core hover:bg-routiq-core/90 text-white text-xs h-8">
                  <Save className="h-3 w-3 mr-2" />
                  Save Preferences
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-3 mt-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Security Settings */}
            <Card className="border-gray-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-routiq-core text-base">Security Settings</CardTitle>
                <CardDescription className="text-xs">Protect your account</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between p-2 border border-gray-200 rounded-lg">
                  <div>
                    <h4 className="font-medium text-xs">Two-Factor Authentication</h4>
                    <p className="text-[10px] text-gray-500">Extra account security</p>
                  </div>
                  <Button variant="outline" size="sm" className="border-routiq-core text-routiq-core hover:bg-routiq-core hover:text-white text-[10px] h-7">
                    Enable 2FA
                  </Button>
                </div>
                
                <div className="flex items-center justify-between p-2 border border-gray-200 rounded-lg">
                  <div>
                    <h4 className="font-medium text-xs">Password</h4>
                    <p className="text-[10px] text-gray-500">Last changed 30 days ago</p>
                  </div>
                  <Button variant="outline" size="sm" className="border-routiq-core text-routiq-core hover:bg-routiq-core hover:text-white text-[10px] h-7">
                    Change
                  </Button>
                </div>
                
                <div className="flex items-center justify-between p-2 border border-gray-200 rounded-lg">
                  <div>
                    <h4 className="font-medium text-xs">Active Sessions</h4>
                    <p className="text-[10px] text-gray-500">Manage signed-in devices</p>
                  </div>
                  <Button variant="outline" size="sm" className="border-routiq-core text-routiq-core hover:bg-routiq-core hover:text-white text-[10px] h-7">
                    View All
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Data & Privacy */}
            <Card className="border-gray-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-routiq-core text-base">Data & Privacy</CardTitle>
                <CardDescription className="text-xs">Control your data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between p-2 border border-gray-200 rounded-lg">
                  <div>
                    <h4 className="font-medium text-xs">Export Data</h4>
                    <p className="text-[10px] text-gray-500">Download account data</p>
                  </div>
                  <Button variant="outline" size="sm" className="border-routiq-core text-routiq-core hover:bg-routiq-core hover:text-white text-[10px] h-7">
                    <Download className="h-3 w-3 mr-1" />
                    Export
                  </Button>
                </div>
                
                {/* Danger Zone */}
                <div className="mt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-3 w-3 text-red-500" />
                    <h4 className="font-medium text-red-600 text-xs">Danger Zone</h4>
                  </div>
                  <div className="p-2 border border-red-200 rounded-lg bg-red-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-red-800 text-xs">Delete Account</h4>
                        <p className="text-[10px] text-red-600">Permanently delete your account</p>
                      </div>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        className="text-[10px] h-7"
                        onClick={() => {
                          if (confirm('Are you sure? This action cannot be undone.')) {
                            console.log('Account deletion requested')
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
} 
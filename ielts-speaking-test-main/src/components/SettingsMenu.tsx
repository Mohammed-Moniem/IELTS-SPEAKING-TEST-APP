import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, User, CreditCard, ChartBar, Bell, Shield, Gear } from "@phosphor-icons/react"
import { AnalyticsPanel } from "./AnalyticsPanel"

interface UserData {
  email: string
  phone: string
  firstName: string
  lastName: string
}

interface TestPreferences {
  testDate: string
  targetBand: string
  timeFrame: string
}

interface SubscriptionData {
  planType: 'free' | 'premium' | 'pro'
  subscriptionDate?: string
  trialEndsAt?: string
  isTrialActive?: boolean
}

interface UsageData {
  practiceCount: number
  testCount: number
  lastReset: string
}

interface SettingsMenuProps {
  userData: UserData
  testPreferences: TestPreferences
  subscriptionData: SubscriptionData
  usageData: UsageData
  onBack: () => void
  onEditProfile: () => void
  onManageSubscription: () => void
  onViewUsage: () => void
}

export function SettingsMenu({ 
  userData, 
  testPreferences, 
  subscriptionData, 
  usageData, 
  onBack, 
  onEditProfile, 
  onManageSubscription, 
  onViewUsage 
}: SettingsMenuProps) {
  const [currentView, setCurrentView] = useState<'menu' | 'analytics'>('menu')

  if (currentView === 'analytics') {
    return (
      <AnalyticsPanel
        onBack={() => setCurrentView('menu')}
        userData={userData}
        testPreferences={testPreferences}
        subscriptionData={subscriptionData}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            onClick={onBack}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Settings</h1>
            <p className="text-slate-600">Manage your account and preferences</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Profile Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile & Account
              </CardTitle>
              <CardDescription>
                Manage your personal information and test preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{userData.firstName} {userData.lastName}</div>
                  <div className="text-sm text-muted-foreground">{userData.email}</div>
                </div>
                <Button variant="outline" size="sm" onClick={onEditProfile}>
                  Edit Profile
                </Button>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <div className="text-sm font-medium">Test Preferences</div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Target Band:</span> {testPreferences.targetBand}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Test Date:</span> {testPreferences.testDate}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Subscription Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Subscription & Billing
              </CardTitle>
              <CardDescription>
                Manage your subscription plan and billing information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant={subscriptionData.planType === 'free' ? 'secondary' : 'default'}>
                    {subscriptionData.planType.toUpperCase()}
                  </Badge>
                  {subscriptionData.isTrialActive && (
                    <Badge variant="outline">Trial Active</Badge>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={onManageSubscription}>
                  Manage Plan
                </Button>
              </div>
              
              {subscriptionData.planType !== 'free' && subscriptionData.trialEndsAt && (
                <div className="text-sm text-muted-foreground">
                  Trial ends: {new Date(subscriptionData.trialEndsAt).toLocaleDateString()}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Usage & Analytics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ChartBar className="h-5 w-5" />
                Usage & Analytics
              </CardTitle>
              <CardDescription>
                Track your progress and view detailed analytics
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-slate-50 rounded-lg">
                  <div className="text-2xl font-bold text-primary">{usageData.practiceCount}</div>
                  <div className="text-sm text-muted-foreground">Practice Sessions</div>
                </div>
                <div className="text-center p-3 bg-slate-50 rounded-lg">
                  <div className="text-2xl font-bold text-primary">{usageData.testCount}</div>
                  <div className="text-sm text-muted-foreground">Mock Tests</div>
                </div>
              </div>
              
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => setCurrentView('analytics')}
              >
                View Detailed Analytics
              </Button>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notifications
              </CardTitle>
              <CardDescription>
                Configure your notification preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Practice Reminders</div>
                    <div className="text-sm text-muted-foreground">Daily practice notifications</div>
                  </div>
                  <Badge variant="outline">Enabled</Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Progress Updates</div>
                    <div className="text-sm text-muted-foreground">Weekly progress summaries</div>
                  </div>
                  <Badge variant="outline">Enabled</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Privacy & Security */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Privacy & Security
              </CardTitle>
              <CardDescription>
                Manage your data and security settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  Export My Data
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  Privacy Settings
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start text-red-600 hover:text-red-700">
                  Delete Account
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* App Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gear className="h-5 w-5" />
                App Settings
              </CardTitle>
              <CardDescription>
                Customize your app experience
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Auto-save Responses</div>
                    <div className="text-sm text-muted-foreground">Automatically save your practice responses</div>
                  </div>
                  <Badge variant="outline">On</Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Audio Recording Quality</div>
                    <div className="text-sm text-muted-foreground">Higher quality uses more storage</div>
                  </div>
                  <Badge variant="outline">High</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
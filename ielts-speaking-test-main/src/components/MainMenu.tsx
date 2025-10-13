import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { UsageTracker } from "./UsageTracker"
import { BookOpen, TestTube, Clock, Trophy, User, Gear } from "@phosphor-icons/react"

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

interface MainMenuProps {
  onSelectMode: (mode: 'practice' | 'test' | 'profile' | 'settings') => void
  completedCount: number
  userName: string
  subscriptionData?: SubscriptionData
  usageData?: UsageData
  onUpgrade?: () => void
}

export function MainMenu({ 
  onSelectMode, 
  completedCount, 
  userName, 
  subscriptionData,
  usageData,
  onUpgrade 
}: MainMenuProps) {
  return (
    <div className="min-h-screen p-6 fade-in">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-between mb-8">
            <Button 
              variant="outline" 
              onClick={() => onSelectMode('settings')}
              className="modern-button rounded-xl px-4 py-2 border-2"
            >
              <Gear size={18} />
              Settings
            </Button>
            <h1 className="text-5xl font-bold gradient-text">
              IELTS Speaking Practice
            </h1>
            <Button 
              variant="outline" 
              onClick={() => onSelectMode('profile')}
              className="modern-button rounded-xl px-4 py-2 border-2"
            >
              <User size={18} />
              Profile
            </Button>
          </div>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Welcome back, <span className="font-semibold text-primary">{userName}</span>! Choose your learning approach: practice with specific topics or take a full AI-driven test simulation
          </p>
        </div>

        {/* Usage Tracker */}
        {subscriptionData && usageData && (
          <div className="mb-8">
            <UsageTracker
              currentUsage={usageData.practiceCount}
              monthlyLimit={3}
              planType={subscriptionData.planType}
              onUpgrade={onUpgrade}
            />
          </div>
        )}

        {/* Mode Selection Cards */}
        <div className="grid md:grid-cols-2 gap-10 mb-12">
          {/* Practice Mode */}
          <Card className="glass-card p-10 hover:shadow-2xl transition-all duration-300 cursor-pointer group hover:scale-[1.02]" 
                onClick={() => onSelectMode('practice')}>
            <div className="text-center space-y-8">
              <div className="flex justify-center">
                <div className="p-6 bg-gradient-to-br from-accent/20 to-accent/10 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                  <BookOpen size={56} className="text-accent" />
                </div>
              </div>
              
              <div>
                <h2 className="text-3xl font-bold text-foreground mb-3">
                  Practice Mode
                </h2>
                <p className="text-muted-foreground mb-6 text-lg leading-relaxed">
                  Choose from specific topics and practice at your own pace with guided questions and expert tips
                </p>
                
                <div className="flex justify-center gap-2 mb-8">
                  <Badge variant="secondary" className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full">
                    <Trophy size={16} />
                    {completedCount} topics completed
                  </Badge>
                </div>
              </div>

              <Button className="w-full modern-button h-14 text-lg font-semibold rounded-xl group-hover:bg-accent group-hover:text-accent-foreground">
                Start Practicing
              </Button>
            </div>
          </Card>

          {/* Test Mode */}
          <Card className="glass-card p-10 hover:shadow-2xl transition-all duration-300 cursor-pointer group hover:scale-[1.02]"
                onClick={() => onSelectMode('test')}>
            <div className="text-center space-y-8">
              <div className="flex justify-center">
                <div className="p-6 bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                  <TestTube size={56} className="text-primary" />
                </div>
              </div>
              
              <div>
                <h2 className="text-3xl font-bold text-foreground mb-3">
                  Full Test Simulation
                </h2>
                <p className="text-muted-foreground mb-6 text-lg leading-relaxed">
                  Experience a complete IELTS speaking test with AI examiner, covering all three parts
                </p>
                
                <div className="flex justify-center gap-2 mb-8">
                  <Badge variant="outline" className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full border-2">
                    <Clock size={16} />
                    11-14 minutes
                  </Badge>
                </div>
              </div>

              <Button variant="outline" className="w-full modern-button h-14 text-lg font-semibold rounded-xl border-2 group-hover:bg-primary group-hover:text-primary-foreground">
                Take Full Test
              </Button>
            </div>
          </Card>
        </div>

        {/* Info Section */}
        <Card className="glass-card p-8">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div className="space-y-3">
              <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center mx-auto">
                <span className="text-primary font-bold text-lg">1</span>
              </div>
              <h3 className="font-bold text-foreground text-lg">Part 1</h3>
              <p className="text-muted-foreground leading-relaxed">
                Introduction & familiar topics (4-5 minutes)
              </p>
            </div>
            <div className="space-y-3">
              <div className="w-12 h-12 bg-gradient-to-br from-accent/20 to-accent/10 rounded-xl flex items-center justify-center mx-auto">
                <span className="text-accent font-bold text-lg">2</span>
              </div>
              <h3 className="font-bold text-foreground text-lg">Part 2</h3>
              <p className="text-muted-foreground leading-relaxed">
                Individual long turn with preparation (3-4 minutes)
              </p>
            </div>
            <div className="space-y-3">
              <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center mx-auto">
                <span className="text-primary font-bold text-lg">3</span>
              </div>
              <h3 className="font-bold text-foreground text-lg">Part 3</h3>
              <p className="text-muted-foreground leading-relaxed">
                Two-way discussion on abstract topics (4-5 minutes)
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
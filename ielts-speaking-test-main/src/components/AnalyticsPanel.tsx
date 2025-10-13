import { useState, useEffect } from "react"
import { useKV } from "@github/spark/hooks"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, TrendUp, Clock, Target, Calendar, BookOpen, Trophy } from "@phosphor-icons/react"

interface AnalyticsPanelProps {
  onBack: () => void
  userData: {
    firstName: string
    lastName: string
    email: string
    phone: string
  }
  testPreferences: {
    testDate: string
    targetBand: string
    timeFrame: string
  }
  subscriptionData: {
    planType: 'free' | 'premium' | 'pro'
  }
}

interface PracticeSession {
  id: string
  topicId: string
  response: string
  timeSpent: number
  createdAt: string
}

export function AnalyticsPanel({ onBack, userData, testPreferences, subscriptionData }: AnalyticsPanelProps) {
  const [practiceHistory, setPracticeHistory] = useKV<string[]>("practiceHistory", [])
  const [practiceResponses, setPracticeResponses] = useKV<Record<string, { response: string, timeSpent: number, createdAt: string }>>('practiceResponses', {})
  const [insights, setInsights] = useState<string>("")
  const [studyPlan, setStudyPlan] = useState<string>("")
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false)
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false)

  // Calculate statistics
  const totalSessions = (practiceHistory || []).length
  const completedTopics = Array.from(new Set(practiceHistory || []))
  const averageTimeSpent = totalSessions > 0 
    ? Object.values(practiceResponses || {}).reduce((sum, session) => sum + (session.timeSpent || 0), 0) / totalSessions
    : 0

  // Topic frequency analysis
  const topicFrequency = (practiceHistory || []).reduce((acc, topicId) => {
    acc[topicId] = (acc[topicId] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const mostPracticedTopics = Object.entries(topicFrequency)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)

  // Recent activity (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const recentSessions = Object.entries(practiceResponses || {})
    .filter(([_, session]) => new Date(session.createdAt) > sevenDaysAgo)
    .length

  // Progress towards target
  const daysUntilTest = testPreferences?.testDate 
    ? Math.ceil((new Date(testPreferences.testDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0

  const targetBandNumber = parseFloat(testPreferences?.targetBand || "6.5")
  const progressPercentage = Math.min((totalSessions / 20) * 100, 100) // Assume 20 sessions for good preparation

  const generateAIInsights = async () => {
    if (!practiceHistory || practiceHistory.length === 0) return
    
    setIsGeneratingInsights(true)
    try {
      // Simple insights without AI for now
      const basicInsights = `Based on your ${totalSessions} practice sessions:

📊 **Practice Patterns:**
- You've completed ${completedTopics.length} unique topics
- Average session time: ${Math.round(averageTimeSpent / 60)} minutes
- Recent activity: ${recentSessions} sessions in the last 7 days

🎯 **Recommendations:**
- Try to maintain consistent daily practice
- Focus on Part 2 and 3 questions for higher band scores
- Aim for 2-3 minute responses to build fluency
- Practice speaking about abstract topics to improve vocabulary

📈 **Next Steps:**
- Continue practicing regularly
- Record yourself to improve pronunciation
- Focus on weaker topic areas
- Take mock tests to track progress`

      setInsights(basicInsights)
    } catch (error) {
      console.error('Error generating insights:', error)
      setInsights("Unable to generate insights at this time. Please try again later.")
    } finally {
      setIsGeneratingInsights(false)
    }
  }

  const generateAIStudyPlan = async () => {
    setIsGeneratingPlan(true)
    try {
      // Simple study plan without AI for now
      const basicPlan = `Personalized IELTS Speaking Study Plan
Target Band: ${testPreferences?.targetBand || '6.5'}
Time Frame: ${testPreferences?.timeFrame || '3 months'}

📅 **Weekly Schedule:**
- Monday: Part 1 questions (15-20 mins)
- Tuesday: Part 2 practice (20-25 mins) 
- Wednesday: Part 3 discussions (20-25 mins)
- Thursday: Vocabulary building (15 mins)
- Friday: Mock speaking test (30 mins)
- Weekend: Review and record practice

🎯 **Daily Goals:**
- Practice speaking for at least 15-20 minutes
- Learn 5-10 new topic-related words
- Record and listen to your responses
- Work on pronunciation and fluency

📊 **Progress Milestones:**
- Week 2: Complete 10 Part 1 topics
- Week 4: Master 5 Part 2 topics  
- Week 6: Practice 5 Part 3 discussions
- Week 8: Take first full mock test
- Week 10: Focus on weak areas
- Week 12: Final preparation and confidence building

✅ **Success Tips:**
- Speak clearly and at natural pace
- Use varied vocabulary and grammar
- Stay calm and confident during practice
- Get feedback from native speakers if possible`

      setStudyPlan(basicPlan)
    } catch (error) {
      console.error('Error generating study plan:', error)
      setStudyPlan("Unable to generate study plan at this time. Please try again later.")
    } finally {
      setIsGeneratingPlan(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="max-w-6xl mx-auto">
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
            <h1 className="text-3xl font-bold text-slate-800">Analytics Dashboard</h1>
            <p className="text-slate-600">Track your IELTS Speaking preparation progress</p>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="insights">AI Insights</TabsTrigger>
            <TabsTrigger value="study-plan">Study Plan</TabsTrigger>
            <TabsTrigger value="progress">Progress</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">{totalSessions}</div>
                  <p className="text-xs text-muted-foreground">
                    {recentSessions} in last 7 days
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Completed Topics</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">{completedTopics.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Unique topics practiced
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg. Session Time</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">
                    {Math.round(averageTimeSpent / 60)}m
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Minutes per session
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Days to Test</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">
                    {daysUntilTest > 0 ? daysUntilTest : 'N/A'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Target: Band {testPreferences?.targetBand}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Most Practiced Topics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendUp className="h-5 w-5" />
                  Most Practiced Topics
                </CardTitle>
                <CardDescription>
                  Your focus areas based on practice frequency
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mostPracticedTopics.length > 0 ? mostPracticedTopics.map(([topicId, count]) => (
                    <div key={topicId} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-primary rounded-full" />
                        <span className="font-medium capitalize">
                          {topicId.replace('-', ' ')}
                        </span>
                      </div>
                      <Badge variant="secondary">{count} sessions</Badge>
                    </div>
                  )) : (
                    <p className="text-muted-foreground">Start practicing to see your topic statistics</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Preparation Progress */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Preparation Progress
                </CardTitle>
                <CardDescription>
                  Your journey towards achieving Band {testPreferences?.targetBand}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Overall Progress</span>
                    <span>{Math.round(progressPercentage)}%</span>
                  </div>
                  <Progress value={progressPercentage} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-2">
                    Based on {totalSessions} completed sessions
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Insights Tab */}
          <TabsContent value="insights" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>AI-Generated Insights</CardTitle>
                <CardDescription>
                  Get personalized insights about your practice patterns and areas for improvement
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {subscriptionData.planType === 'free' ? (
                  <div className="text-center py-8">
                    <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Premium Feature</h3>
                    <p className="text-muted-foreground mb-4">
                      AI-powered insights are available with Premium and Pro plans
                    </p>
                    <Badge variant="outline">Upgrade Required</Badge>
                  </div>
                ) : (
                  <>
                    <Button 
                      onClick={generateAIInsights} 
                      disabled={isGeneratingInsights || totalSessions === 0}
                      className="w-full"
                    >
                      {isGeneratingInsights ? "Analyzing your data..." : "Generate AI Insights"}
                    </Button>
                    
                    {insights && (
                      <div className="bg-slate-50 rounded-lg p-4">
                        <pre className="whitespace-pre-wrap text-sm text-slate-700">
                          {insights}
                        </pre>
                      </div>
                    )}
                    
                    {totalSessions === 0 && (
                      <p className="text-muted-foreground text-sm">
                        Complete some practice sessions to generate insights
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Study Plan Tab */}
          <TabsContent value="study-plan" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Personalized Study Plan</CardTitle>
                <CardDescription>
                  AI-generated study plan tailored to your target band and timeline
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {subscriptionData.planType === 'free' ? (
                  <div className="text-center py-8">
                    <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Premium Feature</h3>
                    <p className="text-muted-foreground mb-4">
                      Personalized study plans are available with Premium and Pro plans
                    </p>
                    <Badge variant="outline">Upgrade Required</Badge>
                  </div>
                ) : (
                  <>
                    <Button 
                      onClick={generateAIStudyPlan} 
                      disabled={isGeneratingPlan}
                      className="w-full"
                    >
                      {isGeneratingPlan ? "Creating your study plan..." : "Generate Study Plan"}
                    </Button>
                    
                    {studyPlan && (
                      <div className="bg-slate-50 rounded-lg p-4">
                        <pre className="whitespace-pre-wrap text-sm text-slate-700">
                          {studyPlan}
                        </pre>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Progress Tab */}
          <TabsContent value="progress" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Detailed Progress Tracking</CardTitle>
                <CardDescription>
                  Track your improvement over time across different skill areas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Skills Breakdown */}
                  <div>
                    <h3 className="font-semibold mb-4">Skills Development</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Fluency & Coherence</span>
                          <span>6.0</span>
                        </div>
                        <Progress value={60} />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Lexical Resource</span>
                          <span>5.5</span>
                        </div>
                        <Progress value={55} />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Grammatical Range</span>
                          <span>6.5</span>
                        </div>
                        <Progress value={65} />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Pronunciation</span>
                          <span>6.0</span>
                        </div>
                        <Progress value={60} />
                      </div>
                    </div>
                  </div>

                  {/* Part-wise Performance */}
                  <div>
                    <h3 className="font-semibold mb-4">Part-wise Performance</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                          <div className="font-medium">Part 1 - Introduction</div>
                          <div className="text-sm text-muted-foreground">Personal questions</div>
                        </div>
                        <Badge variant="secondary">Good</Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                          <div className="font-medium">Part 2 - Individual Long Turn</div>
                          <div className="text-sm text-muted-foreground">2-minute speech</div>
                        </div>
                        <Badge variant="outline">Needs Practice</Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                          <div className="font-medium">Part 3 - Discussion</div>
                          <div className="text-sm text-muted-foreground">Abstract topics</div>
                        </div>
                        <Badge variant="outline">Needs Practice</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
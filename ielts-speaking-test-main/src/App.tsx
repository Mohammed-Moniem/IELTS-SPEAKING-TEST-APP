import { useState, useEffect } from "react"
import { useKV } from "@github/spark/hooks"
import { AuthForm } from "./components/AuthForm"
import { TestPreferences } from "./components/TestPreferences"
import { UserProfile } from "./components/UserProfile"
import { MainMenu } from "./components/MainMenu"
import { TopicSelector } from "./components/TopicSelector"
import { PracticeSession } from "./components/PracticeSession"
import { FeedbackDisplay } from "./components/FeedbackDisplay"
import { TestSimulation } from "./components/TestSimulation"
import { TestFeedback } from "./components/TestFeedback"
import { SubscriptionPlans } from "./components/SubscriptionPlans"
import { UsageLimitModal } from "./components/UsageLimitModal"
import { PremiumFeaturePrompt } from "./components/PremiumFeaturePrompt"
import { SettingsMenu } from "./components/SettingsMenu"
import { ChatCircle, GraduationCap, Users, Globe, House, Briefcase } from "@phosphor-icons/react"

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

interface Topic {
  id: string
  title: string
  description: string
  part: number
  category: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  completed: boolean
  icon: React.ComponentType<any>
}

interface PracticeQuestion {
  id: string
  category: string
  part: number
  question: string
  timeLimit: number
  tips: string[]
}

interface TestResponse {
  part: number
  question: string
  response: string
  timeSpent: number
}

type AppState = 'auth' | 'preferences' | 'menu' | 'topics' | 'practice' | 'feedback' | 'test' | 'testFeedback' | 'profile' | 'subscription' | 'usageLimit' | 'premiumPrompt' | 'settings'

const sampleTopics: Topic[] = [
  {
    id: "hometown",
    title: "Your Hometown",
    description: "Talk about where you're from, what you like about it, and how it has changed.",
    part: 1,
    category: "Personal Information",
    difficulty: "beginner",
    completed: false,
    icon: House
  },
  {
    id: "education",
    title: "Education & Learning",
    description: "Describe your educational background and thoughts on learning new skills.",
    part: 1,
    category: "Personal Experience",
    difficulty: "beginner",
    completed: false,
    icon: GraduationCap
  },
  {
    id: "memorable-event",
    title: "A Memorable Event",
    description: "Describe an important event in your life that you will never forget.",
    part: 2,
    category: "Personal Experience", 
    difficulty: "intermediate",
    completed: false,
    icon: ChatCircle
  },
  {
    id: "technology",
    title: "Technology in Society",
    description: "Discuss the impact of technology on modern life and communication.",
    part: 3,
    category: "Society & Technology",
    difficulty: "advanced",
    completed: false,
    icon: Globe
  },
  {
    id: "work-life",
    title: "Work and Career",
    description: "Talk about your job, career goals, and work-life balance.",
    part: 1,
    category: "Work & Career",
    difficulty: "intermediate",
    completed: false,
    icon: Briefcase
  },
  {
    id: "social-media",
    title: "Social Media Impact", 
    description: "Analyze how social media has changed the way people communicate and interact.",
    part: 3,
    category: "Society & Technology",
    difficulty: "advanced",
    completed: false,
    icon: Users
  }
]

const practiceQuestions: Record<string, PracticeQuestion> = {
  "hometown": {
    id: "hometown",
    category: "Your Hometown",
    part: 1,
    question: "Let's talk about your hometown. Can you describe where you're from and what makes it special?",
    timeLimit: 120,
    tips: [
      "Give specific details about location and features",
      "Mention what you like most about your hometown", 
      "Talk about any changes you've seen over time",
      "Keep your answer between 1-2 minutes"
    ]
  },
  "education": {
    id: "education", 
    category: "Education & Learning",
    part: 1,
    question: "Tell me about your educational background. What subjects did you enjoy most and why?",
    timeLimit: 120,
    tips: [
      "Mention your current or most recent studies",
      "Explain why certain subjects interested you",
      "Talk about your learning style or preferences",
      "Give specific examples when possible"
    ]
  },
  "memorable-event": {
    id: "memorable-event",
    category: "A Memorable Event", 
    part: 2,
    question: "Describe an important event in your life that you will never forget. You should say: What the event was, When and where it happened, Who was involved, And explain why this event was so memorable for you.",
    timeLimit: 180,
    tips: [
      "Organize your answer using the bullet points provided",
      "Speak for the full 2 minutes if possible",
      "Include specific details and personal feelings",
      "Use past tenses to describe what happened"
    ]
  },
  "technology": {
    id: "technology",
    category: "Technology in Society",
    part: 3, 
    question: "How has technology changed the way people communicate compared to the past? Do you think these changes are positive or negative?",
    timeLimit: 180,
    tips: [
      "Compare past and present communication methods",
      "Give balanced arguments for both sides",
      "Use examples to support your points",
      "Express your opinion clearly with reasons"
    ]
  },
  "work-life": {
    id: "work-life",
    category: "Work and Career",
    part: 1,
    question: "What kind of work do you do or would you like to do in the future? What attracts you to this type of work?",
    timeLimit: 120,
    tips: [
      "Describe your current job or career goals",
      "Explain what interests you about this work",
      "Mention any skills or qualifications needed",
      "Keep it personal and genuine"
    ]
  },
  "social-media": {
    id: "social-media",
    category: "Social Media Impact",
    part: 3,
    question: "Some people say social media has made people more isolated despite being more connected. What's your opinion on this?",
    timeLimit: 180,
    tips: [
      "Acknowledge both sides of the argument", 
      "Use specific examples from your own experience",
      "Discuss both benefits and drawbacks",
      "Give a clear personal conclusion"
    ]
  }
}

function App() {
  const [appState, setAppState] = useState<AppState>('auth')
  const [currentTopic, setCurrentTopic] = useState<Topic | null>(null)
  const [currentResponse, setCurrentResponse] = useState("")
  const [testResponses, setTestResponses] = useState<TestResponse[]>([])
  const [pendingFeature, setPendingFeature] = useState<string>("")
  
  // Persistent data
  const [topics, setTopics] = useKV<Topic[]>("topics", sampleTopics)
  const [practiceHistory, setPracticeHistory] = useKV<string[]>("practiceHistory", [])
  const [userData, setUserData] = useKV<UserData | null>("userData", null)
  const [testPreferences, setTestPreferences] = useKV<TestPreferences | null>("testPreferences", null)
  const [subscriptionData, setSubscriptionData] = useKV<SubscriptionData>("subscriptionData", { 
    planType: 'free' 
  })
  const [usageData, setUsageData] = useKV<UsageData>("usageData", {
    practiceCount: 0,
    testCount: 0,
    lastReset: new Date().toISOString()
  })

  // Usage limits
  const PRACTICE_LIMIT_FREE = 3
  const TEST_LIMIT_FREE = 1

  // Reset usage monthly
  useEffect(() => {
    const now = new Date()
    const lastReset = new Date(usageData?.lastReset || now)
    const monthsDiff = (now.getFullYear() - lastReset.getFullYear()) * 12 + (now.getMonth() - lastReset.getMonth())
    
    if (monthsDiff >= 1) {
      setUsageData({
        practiceCount: 0,
        testCount: 0,
        lastReset: now.toISOString()
      })
    }
  }, [usageData, setUsageData])

  // Check if user is already authenticated and has preferences set
  useEffect(() => {
    if (userData && testPreferences) {
      setAppState('menu')
    } else if (userData && !testPreferences) {
      setAppState('preferences')
    } else {
      setAppState('auth')
    }
  }, [userData, testPreferences])

  const handleAuthComplete = (user: UserData) => {
    setUserData(user)
    setAppState('preferences')
  }

  const handlePreferencesComplete = (preferences: TestPreferences) => {
    setTestPreferences(preferences)
    setAppState('menu')
  }

  const handleSelectMode = (mode: 'practice' | 'test' | 'profile' | 'settings') => {
    if (mode === 'practice') {
      setAppState('topics')
    } else if (mode === 'test') {
      // Check if user has reached test limit
      if (subscriptionData?.planType === 'free' && (usageData?.testCount || 0) >= TEST_LIMIT_FREE) {
        setPendingFeature('Full Test Simulation')
        setAppState('usageLimit')
        return
      }
      setAppState('test')
    } else if (mode === 'profile') {
      setAppState('profile')
    } else if (mode === 'settings') {
      setAppState('settings')
    }
  }

  const handleSelectTopic = (topic: Topic) => {
    // Check if user has reached practice limit
    if (subscriptionData?.planType === 'free' && (usageData?.practiceCount || 0) >= PRACTICE_LIMIT_FREE) {
      setPendingFeature('Practice Sessions')
      setAppState('usageLimit')
      return
    }

    // Check if trying to access advanced features
    if (subscriptionData?.planType === 'free' && (topic.part === 2 || topic.part === 3)) {
      setPendingFeature(`Part ${topic.part} Questions`)
      setAppState('premiumPrompt')
      return
    }

    setCurrentTopic(topic)
    setAppState('practice')
  }

  const handleCompleteSession = (response: string) => {
    setCurrentResponse(response)
    
    // Mark topic as completed
    setTopics(currentTopics => 
      (currentTopics || []).map(topic => 
        topic.id === currentTopic?.id ? { ...topic, completed: true } : topic
      )
    )
    
    // Add to practice history
    setPracticeHistory(currentHistory => [...(currentHistory || []), currentTopic?.id || ""])
    
    // Increment usage counter for free users
    if (subscriptionData?.planType === 'free') {
      setUsageData(current => ({
        practiceCount: (current?.practiceCount || 0) + 1,
        testCount: current?.testCount || 0,
        lastReset: current?.lastReset || new Date().toISOString()
      }))
    }
    
    setAppState('feedback')
  }

  const handleCompleteTest = (responses: TestResponse[]) => {
    setTestResponses(responses)
    
    // Increment test usage counter for free users
    if (subscriptionData?.planType === 'free') {
      setUsageData(current => ({
        practiceCount: current?.practiceCount || 0,
        testCount: (current?.testCount || 0) + 1,
        lastReset: current?.lastReset || new Date().toISOString()
      }))
    }
    
    setAppState('testFeedback')
  }

  const handleContinue = () => {
    setAppState('menu')
    setCurrentTopic(null)
    setCurrentResponse("")
    setTestResponses([])
  }

  const handlePracticeAgain = () => {
    setAppState('practice')
    setCurrentResponse("")
  }

  const handleRetakeTest = () => {
    setTestResponses([])
    setAppState('test')
  }

  const handleBackToTopics = () => {
    setAppState('topics')
  }

  const handleBackToMenu = () => {
    setAppState('menu')
  }

  const handleUpdateUser = (updatedUser: UserData) => {
    setUserData(updatedUser)
  }

  const handleUpdatePreferences = (updatedPreferences: TestPreferences) => {
    setTestPreferences(updatedPreferences)
  }

  const handleUpgrade = () => {
    setAppState('subscription')
  }

  const handleSelectPlan = (planId: string) => {
    // In a real app, this would integrate with a payment processor
    const newSubscriptionData: SubscriptionData = {
      planType: planId as 'free' | 'premium' | 'pro',
      subscriptionDate: planId !== 'free' ? new Date().toISOString() : undefined,
      isTrialActive: planId !== 'free' ? true : false,
      trialEndsAt: planId !== 'free' ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : undefined
    }
    
    setSubscriptionData(newSubscriptionData)
    setAppState('menu')
  }

  const handleCloseLimitModal = () => {
    setAppState('menu')
    setPendingFeature("")
  }

  const handleClosePremiumPrompt = () => {
    setAppState(currentTopic ? 'practice' : 'topics')
    setPendingFeature("")
  }

  const completedCount = (topics || []).filter(topic => topic.completed).length

  // Authentication flow
  if (appState === 'auth') {
    return <AuthForm onAuthComplete={handleAuthComplete} />
  }

  // Preferences setup
  if (appState === 'preferences' && userData) {
    return (
      <TestPreferences 
        onComplete={handlePreferencesComplete} 
        userName={userData.firstName}
      />
    )
  }

  // Profile page
  if (appState === 'profile' && userData && testPreferences) {
    return (
      <UserProfile
        userData={userData}
        testPreferences={testPreferences}
        onBack={handleBackToMenu}
        onUpdateUser={handleUpdateUser}
        onUpdatePreferences={handleUpdatePreferences}
      />
    )
  }

  if (appState === 'settings' && userData && testPreferences) {
    return (
      <SettingsMenu
        userData={userData}
        testPreferences={testPreferences}
        subscriptionData={subscriptionData || { planType: 'free' }}
        usageData={usageData || { practiceCount: 0, testCount: 0, lastReset: new Date().toISOString() }}
        onBack={handleBackToMenu}
        onEditProfile={() => setAppState('profile')}
        onManageSubscription={() => setAppState('subscription')}
        onViewUsage={() => {}}
      />
    )
  }

  if (appState === 'menu' && userData) {
    return (
      <MainMenu
        onSelectMode={handleSelectMode}
        completedCount={completedCount}
        userName={userData.firstName}
        subscriptionData={subscriptionData}
        usageData={usageData}
        onUpgrade={handleUpgrade}
      />
    )
  }

  if (appState === 'subscription') {
    return (
      <SubscriptionPlans
        onBack={handleBackToMenu}
        onSelectPlan={handleSelectPlan}
        currentPlan={subscriptionData?.planType}
      />
    )
  }

  if (appState === 'usageLimit') {
    return (
      <UsageLimitModal
        currentUsage={pendingFeature === 'Practice Sessions' ? (usageData?.practiceCount || 0) : (usageData?.testCount || 0)}
        monthlyLimit={pendingFeature === 'Practice Sessions' ? PRACTICE_LIMIT_FREE : TEST_LIMIT_FREE}
        featureName={pendingFeature}
        onUpgrade={handleUpgrade}
        onClose={handleCloseLimitModal}
      />
    )
  }

  if (appState === 'premiumPrompt') {
    const premiumBenefits = [
      "Access to all question types (Parts 1, 2, and 3)",
      "Advanced AI feedback with band scores",
      "Unlimited practice sessions",
      "Full test simulations",
      "Detailed performance analytics",
      "Study schedule recommendations"
    ]

    return (
      <PremiumFeaturePrompt
        featureName={pendingFeature}
        featureDescription={`${pendingFeature} are available with our Premium plan`}
        benefits={premiumBenefits}
        onUpgrade={handleUpgrade}
        onClose={handleClosePremiumPrompt}
      />
    )
  }

  if (appState === 'topics') {
    return (
      <TopicSelector
        topics={topics || []}
        onSelectTopic={handleSelectTopic}
        completedCount={completedCount}
        onBack={handleBackToMenu}
        subscriptionData={subscriptionData}
      />
    )
  }

  if (appState === 'practice' && currentTopic) {
    const question = practiceQuestions[currentTopic.id]
    return (
      <PracticeSession
        question={question}
        onComplete={handleCompleteSession}
        onBack={handleBackToTopics}
      />
    )
  }

  if (appState === 'feedback' && currentTopic && userData && testPreferences) {
    return (
      <FeedbackDisplay
        response={currentResponse}
        topic={currentTopic.title}
        onContinue={handleContinue}
        onPracticeAgain={handlePracticeAgain}
        userPreferences={testPreferences}
        userName={userData.firstName}
      />
    )
  }

  if (appState === 'test') {
    return (
      <TestSimulation
        onComplete={handleCompleteTest}
        onBack={handleBackToMenu}
      />
    )
  }

  if (appState === 'testFeedback' && userData && testPreferences) {
    return (
      <TestFeedback
        responses={testResponses}
        onContinue={handleContinue}
        onRetakeTest={handleRetakeTest}
        userPreferences={testPreferences}
        userName={userData.firstName}
      />
    )
  }

  return null
}

export default App
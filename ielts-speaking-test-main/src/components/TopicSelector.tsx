import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ChatCircle, GraduationCap, Users, Globe, CheckCircle, ArrowLeft, Lock, Crown } from "@phosphor-icons/react"

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

interface SubscriptionData {
  planType: 'free' | 'premium' | 'pro'
  subscriptionDate?: string
  trialEndsAt?: string
  isTrialActive?: boolean
}

interface TopicSelectorProps {
  topics: Topic[]
  onSelectTopic: (topic: Topic) => void
  completedCount: number
  onBack?: () => void
  subscriptionData?: SubscriptionData
}

const difficultyColors = {
  beginner: 'bg-green-100 text-green-800',
  intermediate: 'bg-yellow-100 text-yellow-800', 
  advanced: 'bg-red-100 text-red-800'
}

const partColors = {
  1: 'bg-blue-100 text-blue-800',
  2: 'bg-purple-100 text-purple-800',
  3: 'bg-orange-100 text-orange-800'
}

export function TopicSelector({ topics, onSelectTopic, completedCount, onBack, subscriptionData }: TopicSelectorProps) {
  const progressPercentage = (completedCount / topics.length) * 100

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {onBack && (
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft size={20} />
          </Button>
          <span className="text-muted-foreground">Back to Main Menu</span>
        </div>
      )}
      
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-foreground">IELTS Speaking Practice</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Improve your IELTS speaking skills with structured practice sessions. 
          Choose from different topics and parts to focus on your areas for improvement.
        </p>
        
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{completedCount} / {topics.length} completed</span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {topics.map((topic) => {
          const IconComponent = topic.icon
          const isPremiumFeature = (topic.part === 2 || topic.part === 3) && subscriptionData?.planType === 'free'
          
          return (
            <Card 
              key={topic.id} 
              className={`transition-all hover:shadow-md relative ${
                topic.completed ? 'bg-accent/10 border-accent' : ''
              } ${isPremiumFeature ? 'opacity-75' : ''}`}
            >
              {isPremiumFeature && (
                <div className="absolute top-2 right-2 z-10">
                  <Badge className="bg-accent/10 text-accent border-accent/20">
                    <Crown size={12} className="mr-1" weight="duotone" />
                    Premium
                  </Badge>
                </div>
              )}
              
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isPremiumFeature ? 'bg-muted/50' : 'bg-primary/10'}`}>
                      {isPremiumFeature ? (
                        <Lock size={24} className="text-muted-foreground" />
                      ) : (
                        <IconComponent size={24} className="text-primary" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <CardTitle className="text-lg leading-tight">{topic.title}</CardTitle>
                      <div className="flex gap-2">
                        <Badge variant="secondary" className={partColors[topic.part as keyof typeof partColors]}>
                          Part {topic.part}
                        </Badge>
                        <Badge variant="outline" className={difficultyColors[topic.difficulty]}>
                          {topic.difficulty}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  {topic.completed && !isPremiumFeature && (
                    <div className="text-accent">
                      <CheckCircle size={20} />
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm mb-4 line-clamp-2">
                  {topic.description}
                  {isPremiumFeature && (
                    <span className="block mt-2 text-accent font-medium">
                      Upgrade to access advanced questions
                    </span>
                  )}
                </CardDescription>
                <Button 
                  onClick={() => onSelectTopic(topic)}
                  className="w-full"
                  variant={topic.completed ? "outline" : isPremiumFeature ? "outline" : "default"}
                  disabled={isPremiumFeature}
                >
                  {topic.completed ? "Practice Again" : "Start Practice"}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
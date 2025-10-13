import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { CheckCircle, TrendUp, Lightbulb, ArrowRight } from "@phosphor-icons/react"

interface TestPreferences {
  testDate: string
  targetBand: string
  timeFrame: string
}

interface FeedbackScore {
  category: string
  score: number
  maxScore: number
  feedback: string
  suggestions: string[]
}

interface FeedbackDisplayProps {
  response: string
  topic: string
  onContinue: () => void
  onPracticeAgain: () => void
  userPreferences: TestPreferences
  userName: string
}

export function FeedbackDisplay({ response, topic, onContinue, onPracticeAgain, userPreferences, userName }: FeedbackDisplayProps) {
  const [feedback, setFeedback] = useState<FeedbackScore[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    generateFeedback()
  }, [response])

  const generateFeedback = async () => {
    setIsLoading(true)
    
    try {
      const testDate = new Date(userPreferences.testDate)
      const today = new Date()
      const daysUntilTest = Math.ceil((testDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      
      const prompt = (window as any).spark.llmPrompt`
        Analyze this IELTS speaking practice response and provide personalized feedback for ${userName}:
        
        Topic: ${topic}
        Response: ${response}
        
        User Context:
        - Target Band Score: ${userPreferences.targetBand}
        - Test Date: ${userPreferences.testDate} (${daysUntilTest} days from now)
        - Preparation Timeframe: ${userPreferences.timeFrame}
        
        Please evaluate the response on these four IELTS speaking criteria and provide a score out of 9 for each:
        1. Fluency and Coherence
        2. Lexical Resource (Vocabulary)
        3. Grammatical Range and Accuracy
        4. Pronunciation (based on text analysis)
        
        For each criterion, provide:
        - A score out of 9
        - Brief feedback explaining the score, considering their target of ${userPreferences.targetBand}
        - 2-3 specific suggestions for improvement that are realistic given their ${daysUntilTest} days until the test
        
        Make the feedback encouraging but honest, and tailor suggestions to help them reach their target band score.
        
        Return as JSON in this format:
        {
          "scores": [
            {
              "category": "Fluency and Coherence",
              "score": 6,
              "feedback": "Your response shows good organization but could benefit from more connecting words to reach band ${userPreferences.targetBand}.",
              "suggestions": ["Use more linking phrases like 'furthermore' and 'in addition'", "Practice speaking without long pauses"]
            }
          ]
        }
      `
      
      const result = await (window as any).spark.llm(prompt, "gpt-4o", true)
      const data = JSON.parse(result)
      setFeedback(data.scores)
    } catch (error) {
      // Fallback feedback if AI fails
      setFeedback([
        {
          category: "Overall Performance",
          score: 6,
          maxScore: 9,
          feedback: "Good effort on this practice session! Your response shows understanding of the topic.",
          suggestions: [
            "Try to include more specific examples and details",
            "Work on expanding your vocabulary with topic-specific words",
            "Practice organizing your ideas with clear introduction, body, and conclusion"
          ]
        }
      ])
    }
    
    setIsLoading(false)
  }

  const overallScore = feedback ? Math.round(feedback.reduce((sum, item) => sum + item.score, 0) / feedback.length) : 0

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p>Analyzing your response...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2">
          <CheckCircle size={32} className="text-accent" />
          <h1 className="text-2xl font-bold">Great job, {userName}!</h1>
        </div>
        <p className="text-muted-foreground">
          Here's your personalized feedback to help you reach Band {userPreferences.targetBand}
        </p>
      </div>

      {/* Overall Score */}
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <TrendUp className="text-primary" />
            Overall Band Score: {overallScore}/9
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={(overallScore / 9) * 100} className="h-3" />
        </CardContent>
      </Card>

      {/* Your Response */}
      <Card>
        <CardHeader>
          <CardTitle>Your Response</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm italic">"{response}"</p>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Feedback */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Detailed Feedback</h2>
        {feedback?.map((item, index) => (
          <Card key={index}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{item.category}</CardTitle>
                <Badge variant="secondary" className="text-lg px-3 py-1">
                  {item.score}/9
                </Badge>
              </div>
              <CardDescription>{item.feedback}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Lightbulb className="text-accent" size={16} />
                  Suggestions for Improvement:
                </div>
                <ul className="space-y-2 text-sm">
                  {item.suggestions.map((suggestion, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <ArrowRight size={16} className="text-accent mt-0.5 flex-shrink-0" />
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <Button onClick={onPracticeAgain} variant="outline" className="flex-1">
          Practice This Topic Again
        </Button>
        <Button onClick={onContinue} className="flex-1">
          Continue to Next Topic
        </Button>
      </div>
    </div>
  )
}
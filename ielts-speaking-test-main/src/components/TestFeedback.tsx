import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Trophy, Clock, CheckCircle, Warning, TrendUp } from "@phosphor-icons/react"

interface TestPreferences {
  testDate: string
  targetBand: string
  timeFrame: string
}

interface TestFeedbackProps {
  responses: TestResponse[]
  onContinue: () => void
  onRetakeTest: () => void
  userPreferences: TestPreferences
  userName: string
}

interface TestResponse {
  part: number
  question: string
  response: string
  timeSpent: number
}

interface FeedbackReport {
  overallBand: number
  criteria: {
    fluencyCoherence: number
    lexicalResource: number
    grammaticalRange: number
    pronunciation: number
  }
  strengths: string[]
  areasForImprovement: string[]
  specificFeedback: {
    part: number
    feedback: string
    score: number
  }[]
  recommendations: string[]
}

export function TestFeedback({ responses, onContinue, onRetakeTest, userPreferences, userName }: TestFeedbackProps) {
  const [feedback, setFeedback] = useState<FeedbackReport | null>(null)
  const [isGenerating, setIsGenerating] = useState(true)

  useEffect(() => {
    generateFeedback()
  }, [responses])

  const generateFeedback = async () => {
    setIsGenerating(true)
    try {
      // Prepare responses for analysis
      const responsesText = responses.map(r => 
        `Part ${r.part}: ${r.question}\nResponse: ${r.response}\nTime spent: ${r.timeSpent}s`
      ).join('\n\n')

      const testDate = new Date(userPreferences.testDate)
      const today = new Date()
      const daysUntilTest = Math.ceil((testDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

      const promptText = `Analyze this IELTS Speaking test performance for ${userName} and provide comprehensive personalized feedback.

User Context:
- Target Band Score: ${userPreferences.targetBand}
- Test Date: ${userPreferences.testDate} (${daysUntilTest} days from now)
- Preparation Timeframe: ${userPreferences.timeFrame}

Test Responses:
${responsesText}

Provide detailed assessment based on IELTS Speaking criteria, comparing performance to their target of Band ${userPreferences.targetBand}:
1. Fluency and Coherence
2. Lexical Resource  
3. Grammatical Range and Accuracy
4. Pronunciation (based on text analysis patterns)

Include specific recommendations that are realistic given they have ${daysUntilTest} days until their test.

Return as JSON with this structure:
{
  "overallBand": 6.5,
  "criteria": {
    "fluencyCoherence": 6.0,
    "lexicalResource": 7.0,
    "grammaticalRange": 6.5,
    "pronunciation": 6.5
  },
  "strengths": ["Good vocabulary range", "Clear structure in Part 2"],
  "areasForImprovement": ["Develop more complex sentences to reach Band ${userPreferences.targetBand}", "Add more linking words"],
  "specificFeedback": [
    {
      "part": 1,
      "feedback": "Good basic responses but could be more detailed for Band ${userPreferences.targetBand}",
      "score": 6.0
    }
  ],
  "recommendations": ["Focus on these areas in your remaining ${daysUntilTest} days", "Practice with complex grammatical structures"]
}`

      const prompt = window.spark.llmPrompt([promptText], '')
      const response = await window.spark.llm(prompt, "gpt-4o", true)
      const feedbackData = JSON.parse(response)
      setFeedback(feedbackData)
    } catch (error) {
      console.error('Failed to generate feedback:', error)
      // Fallback feedback
      setFeedback({
        overallBand: 6.0,
        criteria: {
          fluencyCoherence: 6.0,
          lexicalResource: 6.0,
          grammaticalRange: 6.0,
          pronunciation: 6.0
        },
        strengths: ["Completed all parts of the test", "Showed good effort"],
        areasForImprovement: ["Continue practicing regularly", "Focus on expanding responses"],
        specificFeedback: responses.map(r => ({
          part: r.part,
          feedback: "Good attempt, keep practicing",
          score: 6.0
        })),
        recommendations: ["Take more practice tests", "Work with IELTS materials"]
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const getBandColor = (band: number) => {
    if (band >= 7.5) return "text-green-600"
    if (band >= 6.5) return "text-blue-600"
    if (band >= 5.5) return "text-yellow-600"
    return "text-red-600"
  }

  const getBandDescription = (band: number) => {
    if (band >= 8.5) return "Very Good User"
    if (band >= 7.5) return "Good User"
    if (band >= 6.5) return "Competent User"
    if (band >= 5.5) return "Modest User"
    if (band >= 4.5) return "Limited User"
    return "Needs Improvement"
  }

  const totalTime = responses.reduce((sum, r) => sum + r.timeSpent, 0)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (isGenerating) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <Card className="p-8 text-center max-w-md mx-auto">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold mb-2">Analyzing Your Performance</h2>
          <p className="text-muted-foreground">
            Our AI examiner is evaluating your responses and preparing detailed feedback...
          </p>
        </Card>
      </div>
    )
  }

  if (!feedback) return null

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" onClick={onContinue}>
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">IELTS Speaking Test Results</h1>
            <p className="text-muted-foreground">Comprehensive AI Assessment</p>
          </div>
        </div>

        {/* Overall Score */}
        <Card className="p-8 mb-6">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-4">
              <Trophy size={48} className="text-accent" />
              <div>
                <div className={`text-5xl font-bold ${getBandColor(feedback.overallBand)}`}>
                  {feedback.overallBand}
                </div>
                <p className="text-lg text-muted-foreground">{getBandDescription(feedback.overallBand)}</p>
              </div>
            </div>
            
            <div className="flex justify-center gap-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock size={16} />
                <span>Total Time: {formatTime(totalTime)}</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle size={16} />
                <span>{responses.length} Questions Completed</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Criteria Breakdown */}
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Assessment Criteria</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">Fluency & Coherence</span>
                  <span className={`font-semibold ${getBandColor(feedback.criteria.fluencyCoherence)}`}>
                    {feedback.criteria.fluencyCoherence}
                  </span>
                </div>
                <Progress value={(feedback.criteria.fluencyCoherence / 9) * 100} />
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">Lexical Resource</span>
                  <span className={`font-semibold ${getBandColor(feedback.criteria.lexicalResource)}`}>
                    {feedback.criteria.lexicalResource}
                  </span>
                </div>
                <Progress value={(feedback.criteria.lexicalResource / 9) * 100} />
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">Grammatical Range</span>
                  <span className={`font-semibold ${getBandColor(feedback.criteria.grammaticalRange)}`}>
                    {feedback.criteria.grammaticalRange}
                  </span>
                </div>
                <Progress value={(feedback.criteria.grammaticalRange / 9) * 100} />
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">Pronunciation</span>
                  <span className={`font-semibold ${getBandColor(feedback.criteria.pronunciation)}`}>
                    {feedback.criteria.pronunciation}
                  </span>
                </div>
                <Progress value={(feedback.criteria.pronunciation / 9) * 100} />
              </div>
            </div>
          </div>
        </Card>

        {/* Strengths and Improvements */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <CheckCircle size={20} className="text-green-600" />
              Strengths
            </h3>
            <ul className="space-y-2">
              {feedback.strengths.map((strength, index) => (
                <li key={index} className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-sm">{strength}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendUp size={20} className="text-blue-600" />
              Areas for Improvement
            </h3>
            <ul className="space-y-2">
              {feedback.areasForImprovement.map((area, index) => (
                <li key={index} className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-sm">{area}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Part-by-Part Feedback */}
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Detailed Part Analysis</h2>
          <div className="space-y-4">
            {feedback.specificFeedback.map((partFeedback, index) => (
              <div key={index} className="border border-border rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-semibold">Part {partFeedback.part}</h4>
                  <Badge className={getBandColor(partFeedback.score)}>
                    Band {partFeedback.score}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{partFeedback.feedback}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Recommendations */}
        <Card className="p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Warning size={20} className="text-accent" />
            Recommendations for Improvement
          </h2>
          <div className="space-y-3">
            {feedback.recommendations.map((recommendation, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="bg-accent/10 text-accent rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold mt-0.5">
                  {index + 1}
                </div>
                <p className="text-sm">{recommendation}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-center">
          <Button variant="outline" onClick={onRetakeTest}>
            Take Another Test
          </Button>
          <Button onClick={onContinue}>
            Back to Menu
          </Button>
        </div>
      </div>
    </div>
  )
}
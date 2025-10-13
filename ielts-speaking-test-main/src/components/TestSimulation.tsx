import { useState, useRef, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Play, Pause, Microphone, Clock } from "@phosphor-icons/react"

interface TestSimulationProps {
  onComplete: (responses: TestResponse[]) => void
  onBack: () => void
}

interface TestResponse {
  part: number
  question: string
  response: string
  timeSpent: number
}

interface TestQuestion {
  part: number
  question: string
  preparationTime?: number
  responseTime: number
  instructions?: string
}

type TestPhase = 'intro' | 'preparation' | 'response' | 'transition'

export function TestSimulation({ onComplete, onBack }: TestSimulationProps) {
  const [currentPhase, setCurrentPhase] = useState<TestPhase>('intro')
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [currentResponse, setCurrentResponse] = useState("")
  const [responses, setResponses] = useState<TestResponse[]>([])
  const [questions, setQuestions] = useState<TestQuestion[]>([])
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false)
  
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)

  // Generate AI questions when component mounts
  useEffect(() => {
    generateTestQuestions()
  }, [])

  const generateTestQuestions = async () => {
    setIsGeneratingQuestions(true)
    try {
      const promptText = `Generate a complete IELTS Speaking test with realistic questions for all three parts. 

Part 1 (4-5 minutes): 3-4 questions about familiar topics like hometown, work/study, hobbies, daily routine
Part 2 (3-4 minutes): 1 cue card task with bullet points for 2-minute speech plus 1 follow-up question  
Part 3 (4-5 minutes): 3-4 abstract discussion questions related to Part 2 topic

Return as JSON with this exact structure:
{
  "questions": [
    {
      "part": 1,
      "question": "Let's talk about your hometown. Where are you from?",
      "responseTime": 60,
      "instructions": "Answer naturally, giving some detail but keeping responses brief."
    },
    {
      "part": 2,
      "question": "Describe a skill you would like to learn. You should say: What the skill is, Why you want to learn it, How you would learn it, And explain how this skill would benefit you.",
      "preparationTime": 60,
      "responseTime": 120,
      "instructions": "You have 1 minute to prepare and should speak for 1-2 minutes."
    }
  ]
}`
      const prompt = window.spark.llmPrompt([promptText], '')
      const response = await window.spark.llm(prompt, "gpt-4o", true)
      const data = JSON.parse(response)
      setQuestions(data.questions)
    } catch (error) {
      console.error('Failed to generate questions:', error)
      // Fallback questions
      setQuestions([
        {
          part: 1,
          question: "Let's start with some questions about yourself. Can you tell me about your hometown?",
          responseTime: 60,
          instructions: "Keep your answer brief but detailed."
        },
        {
          part: 1, 
          question: "What do you do for work or study?",
          responseTime: 60
        }
      ])
    } finally {
      setIsGeneratingQuestions(false)
    }
  }

  const startTimer = (seconds: number) => {
    setTimeRemaining(seconds)
    if (timerRef.current) clearInterval(timerRef.current)
    
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          handleTimeUp()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const handleTimeUp = () => {
    stopTimer()
    if (currentPhase === 'preparation') {
      setCurrentPhase('response')
      startTimer(questions[currentQuestionIndex].responseTime)
      startTimeRef.current = Date.now()
    } else if (currentPhase === 'response') {
      handleNextQuestion()
    }
  }

  const handleStartTest = () => {
    setCurrentPhase('preparation')
    const question = questions[0]
    if (question.preparationTime) {
      startTimer(question.preparationTime)
    } else {
      setCurrentPhase('response')
      startTimer(question.responseTime)
      startTimeRef.current = Date.now()
    }
  }

  const handleStartRecording = () => {
    setIsRecording(true)
    if (currentPhase === 'response') {
      startTimeRef.current = Date.now()
    }
  }

  const handleStopRecording = () => {
    setIsRecording(false)
  }

  const handleNextQuestion = () => {
    // Save current response
    const timeSpent = startTimeRef.current ? Math.floor((Date.now() - startTimeRef.current) / 1000) : 0
    const newResponse: TestResponse = {
      part: questions[currentQuestionIndex].part,
      question: questions[currentQuestionIndex].question,
      response: currentResponse,
      timeSpent
    }
    
    setResponses(prev => [...prev, newResponse])
    setCurrentResponse("")
    stopTimer()

    // Move to next question or complete test
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1)
      setCurrentPhase('transition')
      setTimeout(() => {
        const nextQuestion = questions[currentQuestionIndex + 1]
        if (nextQuestion.preparationTime) {
          setCurrentPhase('preparation')
          startTimer(nextQuestion.preparationTime)
        } else {
          setCurrentPhase('response')
          startTimer(nextQuestion.responseTime)
          startTimeRef.current = Date.now()
        }
      }, 2000)
    } else {
      onComplete([...responses, newResponse])
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getCurrentPart = () => {
    if (questions.length === 0) return 1
    return questions[currentQuestionIndex]?.part || 1
  }

  const getProgressPercentage = () => {
    return Math.round(((currentQuestionIndex + 1) / questions.length) * 100)
  }

  if (isGeneratingQuestions) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <Card className="p-8 text-center max-w-md mx-auto">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold mb-2">Preparing Your Test</h2>
          <p className="text-muted-foreground">
            Our AI examiner is generating personalized questions for your IELTS speaking test...
          </p>
        </Card>
      </div>
    )
  }

  if (currentPhase === 'intro') {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Button variant="ghost" onClick={onBack}>
              <ArrowLeft size={20} />
            </Button>
            <h1 className="text-3xl font-bold">IELTS Speaking Test Simulation</h1>
          </div>

          <Card className="p-8 text-center">
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold mb-4">Welcome to your IELTS Speaking Test</h2>
                <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                  This is a simulated IELTS speaking test that will take approximately 11-14 minutes. 
                  The AI examiner will guide you through all three parts of the test and provide 
                  comprehensive feedback at the end.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-4 mb-8">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <Badge className="mb-2">Part 1</Badge>
                  <p className="text-sm text-muted-foreground">Introduction & Interview</p>
                  <p className="text-xs text-muted-foreground mt-1">4-5 minutes</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <Badge className="mb-2">Part 2</Badge>
                  <p className="text-sm text-muted-foreground">Individual Long Turn</p>
                  <p className="text-xs text-muted-foreground mt-1">3-4 minutes</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <Badge className="mb-2">Part 3</Badge>
                  <p className="text-sm text-muted-foreground">Two-way Discussion</p>
                  <p className="text-xs text-muted-foreground mt-1">4-5 minutes</p>
                </div>
              </div>

              <div className="bg-accent/10 p-4 rounded-lg mb-6">
                <p className="text-sm text-foreground">
                  <strong>Instructions:</strong> Type your responses in the text area provided. 
                  Try to speak naturally as if you were in a real test situation.
                </p>
              </div>

              <Button onClick={handleStartTest} size="lg" className="px-8">
                <Play size={20} className="mr-2" />
                Begin Test
              </Button>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  const currentQuestion = questions[currentQuestionIndex]
  if (!currentQuestion) return null

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={onBack}>
              <ArrowLeft size={20} />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">IELTS Speaking Test</h1>
              <div className="flex items-center gap-2">
                <Badge>Part {getCurrentPart()}</Badge>
                <span className="text-sm text-muted-foreground">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <Clock size={16} />
              <span className={timeRemaining <= 10 ? "text-destructive font-semibold" : "text-muted-foreground"}>
                {formatTime(timeRemaining)}
              </span>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <Progress value={getProgressPercentage()} className="mb-2" />
          <p className="text-xs text-muted-foreground text-center">
            Test Progress: {getProgressPercentage()}%
          </p>
        </div>

        {/* Main Content */}
        <div className="grid gap-6">
          {/* Question Card */}
          <Card className="p-6">
            <div className="space-y-4">
              {currentPhase === 'preparation' && (
                <div className="bg-accent/10 p-4 rounded-lg">
                  <h3 className="font-semibold text-accent mb-2">Preparation Time</h3>
                  <p className="text-sm text-muted-foreground">
                    You have {formatTime(timeRemaining)} to prepare your response. 
                    You may make notes if you wish.
                  </p>
                </div>
              )}
              
              {currentPhase === 'transition' && (
                <div className="bg-primary/10 p-4 rounded-lg text-center">
                  <p className="text-primary font-medium">Moving to the next question...</p>
                </div>
              )}

              <div>
                <h2 className="text-lg font-semibold mb-3">
                  {currentQuestion.question}
                </h2>
                
                {currentQuestion.instructions && (
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      <strong>Instructions:</strong> {currentQuestion.instructions}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Response Area */}
          {(currentPhase === 'response' || currentPhase === 'preparation') && (
            <Card className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Your Response</h3>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={isRecording ? "destructive" : "default"}
                      size="sm"
                      onClick={isRecording ? handleStopRecording : handleStartRecording}
                      disabled={currentPhase === 'preparation'}
                    >
                      <Microphone size={16} className="mr-1" />
                      {isRecording ? "Recording..." : "Start Recording"}
                    </Button>
                  </div>
                </div>

                <Textarea
                  placeholder="Type your response here... Try to speak naturally as if in a real test."
                  value={currentResponse}
                  onChange={(e) => setCurrentResponse(e.target.value)}
                  className="min-h-32"
                  disabled={currentPhase === 'preparation'}
                />

                {currentPhase === 'response' && (
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={handleNextQuestion}>
                      Next Question
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Microphone, Play, CheckCircle, Clock } from "@phosphor-icons/react"
import { useKV } from "@github/spark/hooks"

interface PracticeQuestion {
  id: string
  category: string
  part: number
  question: string
  timeLimit: number
  tips: string[]
}

interface PracticeSessionProps {
  question: PracticeQuestion
  onComplete: (response: string) => void
  onBack: () => void
}

export function PracticeSession({ question, onComplete, onBack }: PracticeSessionProps) {
  const [response, setResponse] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const [timeLeft, setTimeLeft] = useState(question.timeLimit)
  const [hasStarted, setHasStarted] = useState(false)

  const handleStartPractice = () => {
    setHasStarted(true)
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const handleToggleRecording = () => {
    setIsRecording(!isRecording)
  }

  const handleComplete = () => {
    onComplete(response)
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack}>
          ← Back to Topics
        </Button>
        <Badge variant="secondary">Part {question.part}</Badge>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">{question.category}</CardTitle>
            {hasStarted && (
              <div className="flex items-center gap-2 text-primary">
                <Clock size={20} />
                <span className="font-mono text-lg">{formatTime(timeLeft)}</span>
              </div>
            )}
          </div>
          <CardDescription className="text-base">
            {question.question}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!hasStarted ? (
            <div className="space-y-4">
              <div className="bg-secondary p-4 rounded-lg">
                <h4 className="font-medium mb-2">Practice Tips:</h4>
                <ul className="space-y-1 text-sm">
                  {question.tips.map((tip, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-accent">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Button onClick={handleStartPractice} className="w-full" size="lg">
                Start Practice Session
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center space-y-4">
                <Button
                  onClick={handleToggleRecording}
                  size="lg"
                  variant={isRecording ? "destructive" : "default"}
                  className={`w-32 h-32 rounded-full ${isRecording ? 'animate-pulse' : ''}`}
                >
                  <Microphone size={48} />
                </Button>
                <p className="text-sm text-muted-foreground">
                  {isRecording ? "Recording... Speak now" : "Click to start recording"}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Or type your response:</label>
                <Textarea
                  placeholder="Type your response here..."
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  rows={6}
                />
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleComplete}
                  disabled={!response.trim() && !isRecording}
                  className="flex-1"
                >
                  <CheckCircle size={20} className="mr-2" />
                  Complete Session
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
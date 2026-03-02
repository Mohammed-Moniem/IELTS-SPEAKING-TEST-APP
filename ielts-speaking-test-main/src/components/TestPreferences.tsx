import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Calendar, Target, Clock } from "@phosphor-icons/react"

interface TestPreferences {
  testDate: string
  targetBand: string
  timeFrame: string
}

interface TestPreferencesProps {
  onComplete: (preferences: TestPreferences) => void
  userName: string
}

const bandScores = [
  { value: "5.0", label: "Band 5.0 - Modest User", description: "Limited user with partial command" },
  { value: "5.5", label: "Band 5.5", description: "Between Modest and Competent User" },
  { value: "6.0", label: "Band 6.0 - Competent User", description: "Generally effective command with inaccuracies" },
  { value: "6.5", label: "Band 6.5", description: "Between Competent and Good User" },
  { value: "7.0", label: "Band 7.0 - Good User", description: "Operational command with occasional inaccuracies" },
  { value: "7.5", label: "Band 7.5", description: "Between Good and Very Good User" },
  { value: "8.0", label: "Band 8.0 - Very Good User", description: "Fully operational command with few inaccuracies" },
  { value: "8.5", label: "Band 8.5", description: "Between Very Good and Expert User" },
  { value: "9.0", label: "Band 9.0 - Expert User", description: "Full operational command of the language" }
]

const timeFrames = [
  { value: "1-month", label: "1 Month", description: "Intensive preparation" },
  { value: "2-months", label: "2 Months", description: "Focused practice" },
  { value: "3-months", label: "3 Months", description: "Steady improvement" },
  { value: "6-months", label: "6 Months", description: "Comprehensive preparation" },
  { value: "flexible", label: "Flexible", description: "No specific timeline" }
]

export function TestPreferences({ onComplete, userName }: TestPreferencesProps) {
  const [preferences, setPreferences] = useState<TestPreferences>({
    testDate: "",
    targetBand: "",
    timeFrame: ""
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!preferences.testDate) {
      newErrors.testDate = "Please select your test date"
    } else {
      const selectedDate = new Date(preferences.testDate)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      if (selectedDate <= today) {
        newErrors.testDate = "Test date must be in the future"
      }
    }

    if (!preferences.targetBand) {
      newErrors.targetBand = "Please select your target band score"
    }

    if (!preferences.timeFrame) {
      newErrors.timeFrame = "Please select your preparation timeframe"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (validateForm()) {
      onComplete(preferences)
    }
  }

  const handleInputChange = (field: keyof TestPreferences, value: string) => {
    setPreferences(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }))
    }
  }

  const getMinDate = () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().split('T')[0]
  }

  const selectedBand = bandScores.find(band => band.value === preferences.targetBand)
  const selectedTimeFrame = timeFrames.find(tf => tf.value === preferences.timeFrame)

  return (
    <div className="min-h-screen flex items-center justify-center p-4 fade-in">
      <Card className="w-full max-w-2xl glass-card border-0 shadow-lg">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center">
            <Target size={32} className="text-accent" />
          </div>
          <div>
            <CardTitle className="text-2xl font-semibold text-foreground">Welcome, {userName}!</CardTitle>
            <CardDescription className="text-muted-foreground mt-2">
              Let's set up your IELTS goals to provide personalized feedback and practice recommendations.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Test Date */}
            <div className="space-y-3">
              <Label htmlFor="testDate" className="text-base font-medium flex items-center gap-2">
                <Calendar size={18} className="text-primary" />
                When is your IELTS test date?
              </Label>
              <Input
                id="testDate"
                type="date"
                value={preferences.testDate}
                onChange={(e) => handleInputChange("testDate", e.target.value)}
                min={getMinDate()}
                className={`text-base ${errors.testDate ? "border-destructive" : ""}`}
              />
              {errors.testDate && <p className="text-sm text-destructive">{errors.testDate}</p>}
              <p className="text-sm text-muted-foreground">
                This helps us track your progress and adjust practice intensity.
              </p>
            </div>

            {/* Target Band Score */}
            <div className="space-y-3">
              <Label className="text-base font-medium flex items-center gap-2">
                <Target size={18} className="text-primary" />
                What's your target band score?
              </Label>
              <Select 
                value={preferences.targetBand} 
                onValueChange={(value) => handleInputChange("targetBand", value)}
              >
                <SelectTrigger className={`text-base ${errors.targetBand ? "border-destructive" : ""}`}>
                  <SelectValue placeholder="Select your target band score" />
                </SelectTrigger>
                <SelectContent>
                  {bandScores.map((band) => (
                    <SelectItem key={band.value} value={band.value} className="py-3">
                      <div>
                        <div className="font-medium">{band.label}</div>
                        <div className="text-sm text-muted-foreground">{band.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedBand && (
                <div className="p-3 bg-accent/10 rounded-lg border border-accent/20">
                  <p className="text-sm font-medium text-accent-foreground">{selectedBand.label}</p>
                  <p className="text-sm text-muted-foreground">{selectedBand.description}</p>
                </div>
              )}
              {errors.targetBand && <p className="text-sm text-destructive">{errors.targetBand}</p>}
            </div>

            {/* Preparation Timeframe */}
            <div className="space-y-3">
              <Label className="text-base font-medium flex items-center gap-2">
                <Clock size={18} className="text-primary" />
                How long do you want to prepare?
              </Label>
              <Select 
                value={preferences.timeFrame} 
                onValueChange={(value) => handleInputChange("timeFrame", value)}
              >
                <SelectTrigger className={`text-base ${errors.timeFrame ? "border-destructive" : ""}`}>
                  <SelectValue placeholder="Select your preparation timeframe" />
                </SelectTrigger>
                <SelectContent>
                  {timeFrames.map((timeFrame) => (
                    <SelectItem key={timeFrame.value} value={timeFrame.value} className="py-3">
                      <div>
                        <div className="font-medium">{timeFrame.label}</div>
                        <div className="text-sm text-muted-foreground">{timeFrame.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTimeFrame && (
                <div className="p-3 bg-secondary/50 rounded-lg border border-border">
                  <p className="text-sm font-medium">{selectedTimeFrame.label}</p>
                  <p className="text-sm text-muted-foreground">{selectedTimeFrame.description}</p>
                </div>
              )}
              {errors.timeFrame && <p className="text-sm text-destructive">{errors.timeFrame}</p>}
            </div>

            <div className="pt-4">
              <Button type="submit" className="w-full text-base py-6">
                Complete Setup & Start Practicing
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
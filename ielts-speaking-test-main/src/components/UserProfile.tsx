import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, User, Calendar, Target, Phone, Envelope, PencilSimple, Check, X } from "@phosphor-icons/react"

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

interface UserProfileProps {
  userData: UserData
  testPreferences: TestPreferences
  onBack: () => void
  onUpdateUser: (userData: UserData) => void
  onUpdatePreferences: (preferences: TestPreferences) => void
}

const bandScores = [
  { value: "5.0", label: "Band 5.0" },
  { value: "5.5", label: "Band 5.5" },
  { value: "6.0", label: "Band 6.0" },
  { value: "6.5", label: "Band 6.5" },
  { value: "7.0", label: "Band 7.0" },
  { value: "7.5", label: "Band 7.5" },
  { value: "8.0", label: "Band 8.0" },
  { value: "8.5", label: "Band 8.5" },
  { value: "9.0", label: "Band 9.0" }
]

const timeFrames = [
  { value: "1-month", label: "1 Month" },
  { value: "2-months", label: "2 Months" },
  { value: "3-months", label: "3 Months" },
  { value: "6-months", label: "6 Months" },
  { value: "flexible", label: "Flexible" }
]

export function UserProfile({ userData, testPreferences, onBack, onUpdateUser, onUpdatePreferences }: UserProfileProps) {
  const [isEditingUser, setIsEditingUser] = useState(false)
  const [isEditingPreferences, setIsEditingPreferences] = useState(false)
  const [editedUser, setEditedUser] = useState(userData)
  const [editedPreferences, setEditedPreferences] = useState(testPreferences)

  const handleSaveUser = () => {
    onUpdateUser(editedUser)
    setIsEditingUser(false)
  }

  const handleCancelUserEdit = () => {
    setEditedUser(userData)
    setIsEditingUser(false)
  }

  const handleSavePreferences = () => {
    onUpdatePreferences(editedPreferences)
    setIsEditingPreferences(false)
  }

  const handleCancelPreferencesEdit = () => {
    setEditedPreferences(testPreferences)
    setIsEditingPreferences(false)
  }

  const getMinDate = () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().split('T')[0]
  }

  const getDaysUntilTest = () => {
    const testDate = new Date(testPreferences.testDate)
    const today = new Date()
    return Math.ceil((testDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft size={16} />
          Back to Menu
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <User className="text-primary" />
            Profile Settings
          </h1>
          <p className="text-muted-foreground">Manage your account and test preferences</p>
        </div>
      </div>

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <User size={20} className="text-primary" />
                Personal Information
              </CardTitle>
              <CardDescription>Your account details</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => isEditingUser ? handleCancelUserEdit() : setIsEditingUser(true)}
            >
              {isEditingUser ? <X size={16} /> : <PencilSimple size={16} />}
              {isEditingUser ? "Cancel" : "Edit"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isEditingUser ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={editedUser.firstName}
                    onChange={(e) => setEditedUser(prev => ({ ...prev, firstName: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={editedUser.lastName}
                    onChange={(e) => setEditedUser(prev => ({ ...prev, lastName: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Envelope size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    value={editedUser.email}
                    onChange={(e) => setEditedUser(prev => ({ ...prev, email: e.target.value }))}
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="phone"
                    value={editedUser.phone}
                    onChange={(e) => setEditedUser(prev => ({ ...prev, phone: e.target.value }))}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={handleSaveUser} size="sm">
                  <Check size={16} />
                  Save Changes
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="font-medium">Name:</span>
                <span>{userData.firstName} {userData.lastName}</span>
              </div>
              <div className="flex items-center gap-3">
                <Envelope size={16} className="text-muted-foreground" />
                <span>{userData.email}</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone size={16} className="text-muted-foreground" />
                <span>{userData.phone}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Preferences */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target size={20} className="text-primary" />
                Test Preferences
              </CardTitle>
              <CardDescription>Your IELTS goals and timeline</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => isEditingPreferences ? handleCancelPreferencesEdit() : setIsEditingPreferences(true)}
            >
              {isEditingPreferences ? <X size={16} /> : <PencilSimple size={16} />}
              {isEditingPreferences ? "Cancel" : "Edit"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isEditingPreferences ? (
            <>
              <div>
                <Label htmlFor="testDate">Test Date</Label>
                <div className="relative">
                  <Calendar size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="testDate"
                    type="date"
                    value={editedPreferences.testDate}
                    onChange={(e) => setEditedPreferences(prev => ({ ...prev, testDate: e.target.value }))}
                    min={getMinDate()}
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <Label>Target Band Score</Label>
                <Select 
                  value={editedPreferences.targetBand} 
                  onValueChange={(value) => setEditedPreferences(prev => ({ ...prev, targetBand: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {bandScores.map((band) => (
                      <SelectItem key={band.value} value={band.value}>
                        {band.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Preparation Timeframe</Label>
                <Select 
                  value={editedPreferences.timeFrame} 
                  onValueChange={(value) => setEditedPreferences(prev => ({ ...prev, timeFrame: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timeFrames.map((timeFrame) => (
                      <SelectItem key={timeFrame.value} value={timeFrame.value}>
                        {timeFrame.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={handleSavePreferences} size="sm">
                  <Check size={16} />
                  Save Changes
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Calendar size={16} className="text-muted-foreground" />
                <span className="font-medium">Test Date:</span>
                <span>{new Date(testPreferences.testDate).toLocaleDateString()}</span>
                <span className="text-sm text-muted-foreground">
                  ({getDaysUntilTest()} days remaining)
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Target size={16} className="text-muted-foreground" />
                <span className="font-medium">Target Band:</span>
                <span className="font-bold text-accent">{testPreferences.targetBand}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-medium">Timeframe:</span>
                <span>{timeFrames.find(tf => tf.value === testPreferences.timeFrame)?.label}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
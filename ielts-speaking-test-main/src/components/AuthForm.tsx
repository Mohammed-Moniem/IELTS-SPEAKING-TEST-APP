import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UserCircle, Envelope, Phone, Eye, EyeSlash } from "@phosphor-icons/react"

interface UserData {
  email: string
  phone: string
  firstName: string
  lastName: string
}

interface AuthFormProps {
  onAuthComplete: (userData: UserData) => void
}

export function AuthForm({ onAuthComplete }: AuthFormProps) {
  const [isLogin, setIsLogin] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: ""
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const validatePhone = (phone: string) => {
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/
    return phoneRegex.test(phone.replace(/\s/g, ''))
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.email) {
      newErrors.email = "Email is required"
    } else if (!validateEmail(formData.email)) {
      newErrors.email = "Please enter a valid email address"
    }

    if (!formData.phone) {
      newErrors.phone = "Phone number is required"
    } else if (!validatePhone(formData.phone)) {
      newErrors.phone = "Please enter a valid phone number"
    }

    if (!formData.password) {
      newErrors.password = "Password is required"
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters"
    }

    if (!isLogin) {
      if (!formData.firstName) {
        newErrors.firstName = "First name is required"
      }
      if (!formData.lastName) {
        newErrors.lastName = "Last name is required"
      }
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = "Passwords do not match"
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    setIsLoading(true)
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const userData: UserData = {
      email: formData.email,
      phone: formData.phone,
      firstName: formData.firstName || "User",
      lastName: formData.lastName || ""
    }
    
    onAuthComplete(userData)
    setIsLoading(false)
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }))
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 fade-in">
      <Card className="w-full max-w-md glass-card border-0 shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-primary/20 to-accent/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
            <UserCircle size={40} className="text-primary" />
          </div>
          <div>
            <CardTitle className="text-3xl font-bold gradient-text mb-2">IELTS Speaking Practice</CardTitle>
            <CardDescription className="text-muted-foreground">
              {isLogin ? "Welcome back! Sign in to continue your practice." : "Create your account to start practicing."}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={isLogin ? "login" : "register"} onValueChange={(value) => setIsLogin(value === "login")}>
            <TabsList className="grid w-full grid-cols-2 mb-6 bg-secondary/50 p-1 rounded-xl">
              <TabsTrigger value="login" className="rounded-lg font-medium">Sign In</TabsTrigger>
              <TabsTrigger value="register" className="rounded-lg font-medium">Sign Up</TabsTrigger>
            </TabsList>

            <form onSubmit={handleSubmit} className="space-y-5">
              <TabsContent value="register" className="mt-0">
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div>
                    <Label htmlFor="firstName" className="text-sm font-medium">First Name</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => handleInputChange("firstName", e.target.value)}
                      placeholder="John"
                      className={`modern-input mt-1.5 ${errors.firstName ? "border-destructive" : ""}`}
                    />
                    {errors.firstName && <p className="text-xs text-destructive mt-1.5">{errors.firstName}</p>}
                  </div>
                  <div>
                    <Label htmlFor="lastName" className="text-sm font-medium">Last Name</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => handleInputChange("lastName", e.target.value)}
                      placeholder="Doe"
                      className={`modern-input mt-1.5 ${errors.lastName ? "border-destructive" : ""}`}
                    />
                    {errors.lastName && <p className="text-xs text-destructive mt-1.5">{errors.lastName}</p>}
                  </div>
                </div>
              </TabsContent>

              <div>
                <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
                <div className="relative mt-1.5">
                  <Envelope size={18} className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    placeholder="john@example.com"
                    className={`modern-input pl-11 ${errors.email ? "border-destructive" : ""}`}
                  />
                </div>
                {errors.email && <p className="text-xs text-destructive mt-1.5">{errors.email}</p>}
              </div>

              <div>
                <Label htmlFor="phone" className="text-sm font-medium">Phone Number</Label>
                <div className="relative mt-1.5">
                  <Phone size={18} className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    className={`modern-input pl-11 ${errors.phone ? "border-destructive" : ""}`}
                  />
                </div>
                {errors.phone && <p className="text-xs text-destructive mt-1.5">{errors.phone}</p>}
              </div>

              <div>
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <div className="relative mt-1.5">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => handleInputChange("password", e.target.value)}
                    placeholder="Enter your password"
                    className={`modern-input pr-11 ${errors.password ? "border-destructive" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-destructive mt-1.5">{errors.password}</p>}
              </div>

              <TabsContent value="register" className="mt-5">
                <div>
                  <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                    placeholder="Confirm your password"
                    className={`modern-input mt-1.5 ${errors.confirmPassword ? "border-destructive" : ""}`}
                  />
                  {errors.confirmPassword && <p className="text-xs text-destructive mt-1.5">{errors.confirmPassword}</p>}
                </div>
              </TabsContent>

              <Button 
                type="submit" 
                className="w-full mt-8 modern-button h-12 text-base font-semibold rounded-xl" 
                disabled={isLoading}
              >
                {isLoading ? "Please wait..." : (isLogin ? "Sign In" : "Create Account")}
              </Button>
            </form>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
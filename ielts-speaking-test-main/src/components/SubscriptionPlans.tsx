import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Check, Crown, Sparkle, Users, Infinity } from "@phosphor-icons/react"

interface SubscriptionPlansProps {
  onBack: () => void
  onSelectPlan: (planId: string) => void
  currentPlan?: string
}

interface Plan {
  id: string
  name: string
  price: string
  interval: string
  description: string
  features: string[]
  popular?: boolean
  icon: React.ComponentType<any>
  color: string
}

const plans: Plan[] = [
  {
    id: "free",
    name: "Free Trial",
    price: "$0",
    interval: "forever",
    description: "Perfect for getting started with IELTS practice",
    features: [
      "3 practice sessions per month",
      "Basic AI feedback",
      "6 topic categories",
      "Progress tracking",
      "Part 1 questions only"
    ],
    icon: Users,
    color: "text-muted-foreground"
  },
  {
    id: "premium",
    name: "Premium",
    price: "$19",
    interval: "month",
    description: "Complete IELTS preparation with unlimited access",
    features: [
      "Unlimited practice sessions",
      "Advanced AI feedback with band scores",
      "All topic categories & difficulties",
      "Full test simulations",
      "Parts 1, 2, and 3 questions",
      "Detailed performance analytics",
      "Study schedule recommendations",
      "Priority customer support"
    ],
    popular: true,
    icon: Crown,
    color: "text-accent"
  },
  {
    id: "pro",
    name: "Pro Tutor",
    price: "$39", 
    interval: "month",
    description: "Advanced features for serious IELTS candidates",
    features: [
      "Everything in Premium",
      "Personalized study plans",
      "Weekly progress reports",
      "Mock interview sessions",
      "Advanced pronunciation analysis",
      "Custom question generation",
      "Export detailed reports",
      "1-on-1 consultation session"
    ],
    icon: Sparkle,
    color: "text-primary"
  }
]

export function SubscriptionPlans({ onBack, onSelectPlan, currentPlan = "free" }: SubscriptionPlansProps) {
  const [selectedPlan, setSelectedPlan] = useState(currentPlan)

  const handleSelectPlan = (planId: string) => {
    setSelectedPlan(planId)
    onSelectPlan(planId)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="flex items-center gap-2"
          >
            <ArrowLeft size={18} />
            Back
          </Button>
        </div>

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold gradient-text mb-4">
            Unlock Your IELTS Potential
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Choose the plan that fits your learning goals and timeline
          </p>
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan) => {
            const Icon = plan.icon
            const isSelected = selectedPlan === plan.id
            const isCurrent = currentPlan === plan.id

            return (
              <Card 
                key={plan.id}
                className={`relative glass-card transition-all duration-300 hover:shadow-xl ${
                  plan.popular ? 'ring-2 ring-accent ring-opacity-50 scale-105' : ''
                } ${isSelected ? 'ring-2 ring-primary' : ''}`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-accent text-accent-foreground">
                    Most Popular
                  </Badge>
                )}
                
                {isCurrent && (
                  <Badge className="absolute -top-3 right-4 bg-primary text-primary-foreground">
                    Current Plan
                  </Badge>
                )}

                <CardHeader className="text-center pb-4">
                  <div className={`mx-auto mb-4 p-3 rounded-full bg-secondary/20 w-fit ${plan.color}`}>
                    <Icon size={32} weight="duotone" />
                  </div>
                  
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription className="text-sm">{plan.description}</CardDescription>
                  
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">/{plan.interval}</span>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <Check size={18} className="text-accent mt-0.5 flex-shrink-0" weight="bold" />
                        <span className="text-sm text-card-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button 
                    className="w-full modern-button"
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() => handleSelectPlan(plan.id)}
                    disabled={isCurrent}
                  >
                    {isCurrent ? "Current Plan" : plan.id === "free" ? "Continue Free" : "Upgrade Now"}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* FAQ Section */}
        <div className="mt-16 text-center">
          <h3 className="text-2xl font-semibold mb-6">Frequently Asked Questions</h3>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto text-left">
            <Card className="glass-card">
              <CardContent className="p-6">
                <h4 className="font-semibold mb-2">Can I change plans anytime?</h4>
                <p className="text-sm text-muted-foreground">
                  Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.
                </p>
              </CardContent>
            </Card>
            
            <Card className="glass-card">
              <CardContent className="p-6">
                <h4 className="font-semibold mb-2">Is there a free trial for premium plans?</h4>
                <p className="text-sm text-muted-foreground">
                  All premium plans come with a 7-day free trial. Cancel anytime during the trial period.
                </p>
              </CardContent>
            </Card>
            
            <Card className="glass-card">
              <CardContent className="p-6">
                <h4 className="font-semibold mb-2">What payment methods do you accept?</h4>
                <p className="text-sm text-muted-foreground">
                  We accept all major credit cards, PayPal, and bank transfers in supported regions.
                </p>
              </CardContent>
            </Card>
            
            <Card className="glass-card">
              <CardContent className="p-6">
                <h4 className="font-semibold mb-2">Do you offer student discounts?</h4>
                <p className="text-sm text-muted-foreground">
                  Yes! Students get 30% off premium plans with valid student ID verification.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
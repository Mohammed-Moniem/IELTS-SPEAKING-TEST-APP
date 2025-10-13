import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Crown, Sparkle, Check, X } from "@phosphor-icons/react"

interface PremiumFeaturePromptProps {
  featureName: string
  featureDescription: string
  benefits: string[]
  onUpgrade: () => void
  onClose: () => void
  showCloseButton?: boolean
}

export function PremiumFeaturePrompt({ 
  featureName, 
  featureDescription, 
  benefits, 
  onUpgrade, 
  onClose,
  showCloseButton = true
}: PremiumFeaturePromptProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="glass-card max-w-md w-full animate-in fade-in zoom-in-95 duration-200">
        <CardHeader className="text-center relative">
          {showCloseButton && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="absolute right-2 top-2 h-8 w-8 p-0"
            >
              <X size={16} />
            </Button>
          )}
          
          <Badge className="mx-auto mb-4 bg-accent/10 text-accent border-accent/20 w-fit">
            <Crown size={14} className="mr-1" weight="duotone" />
            Premium Feature
          </Badge>
          
          <div className="mx-auto mb-4 p-3 rounded-full bg-gradient-to-br from-accent/10 to-primary/10 w-fit">
            <Sparkle size={32} className="text-accent" weight="duotone" />
          </div>
          
          <CardTitle className="text-xl">{featureName}</CardTitle>
          <CardDescription>{featureDescription}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Benefits List */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm">What you'll get with Premium:</h4>
            <ul className="space-y-2">
              {benefits.map((benefit, index) => (
                <li key={index} className="flex items-start gap-3">
                  <Check size={16} className="text-accent mt-0.5 flex-shrink-0" weight="bold" />
                  <span className="text-sm text-card-foreground">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Pricing Highlight */}
          <div className="bg-gradient-to-r from-accent/5 to-primary/5 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold">$19/month</div>
            <div className="text-xs text-muted-foreground">7-day free trial • Cancel anytime</div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            {showCloseButton && (
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1"
              >
                Not Now
              </Button>
            )}
            <Button
              onClick={onUpgrade}
              className={`modern-button ${showCloseButton ? 'flex-1' : 'w-full'}`}
            >
              <Crown size={18} className="mr-2" weight="duotone" />
              Start Free Trial
            </Button>
          </div>

          {/* Trust Indicators */}
          <div className="text-center space-y-1">
            <p className="text-xs text-muted-foreground">
              ✓ No commitment • ✓ Secure payment • ✓ Instant access
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
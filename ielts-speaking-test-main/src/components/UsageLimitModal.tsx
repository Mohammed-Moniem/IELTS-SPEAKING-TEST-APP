import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Crown, Lock, TrendUp } from "@phosphor-icons/react"

interface UsageLimitModalProps {
  currentUsage: number
  monthlyLimit: number
  onUpgrade: () => void
  onClose: () => void
  featureName: string
}

export function UsageLimitModal({ 
  currentUsage, 
  monthlyLimit, 
  onUpgrade, 
  onClose, 
  featureName 
}: UsageLimitModalProps) {
  const usagePercentage = (currentUsage / monthlyLimit) * 100
  const remainingUses = monthlyLimit - currentUsage

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="glass-card max-w-md w-full animate-in fade-in zoom-in-95 duration-200">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 rounded-full bg-destructive/10 w-fit">
            <Lock size={32} className="text-destructive" weight="duotone" />
          </div>
          
          <CardTitle className="text-xl">Usage Limit Reached</CardTitle>
          <CardDescription>
            You've reached your monthly limit for {featureName.toLowerCase()}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Usage Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Monthly Usage</span>
              <span className="font-medium">{currentUsage}/{monthlyLimit}</span>
            </div>
            <Progress value={usagePercentage} className="h-2" />
            {remainingUses > 0 ? (
              <p className="text-xs text-muted-foreground">
                {remainingUses} uses remaining this month
              </p>
            ) : (
              <p className="text-xs text-destructive">
                No uses remaining until next month
              </p>
            )}
          </div>

          {/* Upgrade Benefits */}
          <div className="bg-accent/5 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Crown size={20} className="text-accent" weight="duotone" />
              <span className="font-medium text-accent">Upgrade to Premium</span>
            </div>
            
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <TrendUp size={16} className="text-accent" />
                <span>Unlimited {featureName.toLowerCase()}</span>
              </li>
              <li className="flex items-center gap-2">
                <TrendUp size={16} className="text-accent" />
                <span>Advanced AI feedback with band scores</span>
              </li>
              <li className="flex items-center gap-2">
                <TrendUp size={16} className="text-accent" />
                <span>Full test simulations</span>
              </li>
              <li className="flex items-center gap-2">
                <TrendUp size={16} className="text-accent" />
                <span>Detailed performance analytics</span>
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Maybe Later
            </Button>
            <Button
              onClick={onUpgrade}
              className="flex-1 modern-button"
            >
              <Crown size={18} className="mr-2" weight="duotone" />
              Upgrade Now
            </Button>
          </div>

          {/* Additional Info */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              Your usage resets on the 1st of each month
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
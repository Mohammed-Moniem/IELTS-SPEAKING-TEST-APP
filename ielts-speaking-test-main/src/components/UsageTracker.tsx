import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Crown, TrendUp, Calendar, Infinity } from "@phosphor-icons/react"

interface UsageTrackerProps {
  currentUsage: number
  monthlyLimit: number
  planType: 'free' | 'premium' | 'pro'
  onUpgrade?: () => void
  showUpgradeButton?: boolean
}

export function UsageTracker({ 
  currentUsage, 
  monthlyLimit, 
  planType, 
  onUpgrade,
  showUpgradeButton = true 
}: UsageTrackerProps) {
  const usagePercentage = planType === 'free' ? (currentUsage / monthlyLimit) * 100 : 0
  const remainingUses = planType === 'free' ? monthlyLimit - currentUsage : Number.POSITIVE_INFINITY
  const isNearLimit = usagePercentage >= 80
  const isAtLimit = currentUsage >= monthlyLimit && planType === 'free'

  if (planType !== 'free') {
    return (
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-accent/10">
                <Infinity size={20} className="text-accent" weight="duotone" />
              </div>
              <div>
                <div className="font-medium">Unlimited Usage</div>
                <div className="text-sm text-muted-foreground">Premium Plan Active</div>
              </div>
            </div>
            <Badge className="bg-accent/10 text-accent border-accent/20">
              <Crown size={14} className="mr-1" weight="duotone" />
              {planType === 'premium' ? 'Premium' : 'Pro'}
            </Badge>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={`glass-card ${isNearLimit ? 'ring-2 ring-destructive/20' : ''}`}>
      <CardContent className="p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${isAtLimit ? 'bg-destructive/10' : 'bg-primary/10'}`}>
                <Calendar size={20} className={isAtLimit ? 'text-destructive' : 'text-primary'} weight="duotone" />
              </div>
              <div>
                <div className="font-medium">Monthly Usage</div>
                <div className="text-sm text-muted-foreground">Free Plan</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-medium">{currentUsage}/{monthlyLimit}</div>
              <div className="text-xs text-muted-foreground">practices used</div>
            </div>
          </div>

          <div className="space-y-2">
            <Progress 
              value={usagePercentage} 
              className={`h-2 ${isNearLimit ? 'progress-warning' : ''}`}
            />
            <div className="flex justify-between items-center">
              {remainingUses > 0 ? (
                <span className="text-xs text-muted-foreground">
                  {remainingUses} practices remaining
                </span>
              ) : (
                <span className="text-xs text-destructive">
                  No practices remaining this month
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                Resets Jan 1st
              </span>
            </div>
          </div>

          {(isNearLimit || isAtLimit) && showUpgradeButton && onUpgrade && (
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendUp size={16} className="text-accent" />
                  <span className="text-sm">Get unlimited access</span>
                </div>
                <Button 
                  size="sm" 
                  onClick={onUpgrade}
                  className="modern-button"
                >
                  <Crown size={14} className="mr-1" weight="duotone" />
                  Upgrade
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
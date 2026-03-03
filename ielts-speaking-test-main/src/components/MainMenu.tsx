import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  BookOpen,
  Clock,
  Gear,
  TestTube,
  Trophy,
  User,
} from "@phosphor-icons/react";
import { UsageTracker } from "./UsageTracker";

interface SubscriptionData {
  planType: "free" | "premium" | "pro";
  subscriptionDate?: string;
  trialEndsAt?: string;
  isTrialActive?: boolean;
}

interface UsageData {
  practiceCount: number;
  testCount: number;
  lastReset: string;
}

interface MainMenuProps {
  onSelectMode: (mode: "practice" | "test" | "profile" | "settings") => void;
  completedCount: number;
  userName: string;
  subscriptionData?: SubscriptionData;
  usageData?: UsageData;
  onUpgrade?: () => void;
}

export function MainMenu({
  onSelectMode,
  completedCount,
  userName,
  subscriptionData,
  usageData,
  onUpgrade,
}: MainMenuProps) {
  return (
    <div className="min-h-screen p-6 fade-in">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-between mb-8">
            <Button
              variant="ghost"
              onClick={() => onSelectMode("settings")}
              className="modern-button rounded-lg px-4 py-2"
            >
              <Gear size={18} className="mr-2" />
              Settings
            </Button>
            <h1 className="text-4xl font-bold gradient-text">
              IELTS Speaking Practice
            </h1>
            <Button
              variant="ghost"
              onClick={() => onSelectMode("profile")}
              className="modern-button rounded-lg px-4 py-2"
            >
              <User size={18} className="mr-2" />
              Profile
            </Button>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Welcome back,{" "}
            <span className="font-medium text-foreground">{userName}</span>!
            Choose your learning approach: practice with specific topics or take
            a full AI-driven test simulation.
          </p>
        </div>

        {/* Usage Tracker */}
        {subscriptionData && usageData && (
          <div className="mb-8">
            <UsageTracker
              currentUsage={usageData.practiceCount}
              monthlyLimit={3}
              planType={subscriptionData.planType}
              onUpgrade={onUpgrade}
            />
          </div>
        )}

        {/* Mode Selection Cards */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Practice Mode */}
          <Card
            className="glass-card p-8 cursor-pointer group"
            onClick={() => onSelectMode("practice")}
          >
            <div className="text-center space-y-6">
              <div className="flex justify-center">
                <div className="p-5 bg-accent/10 rounded-full group-hover:bg-accent/20 transition-colors duration-300">
                  <BookOpen size={48} className="text-accent" />
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-semibold text-foreground mb-2">
                  Practice Mode
                </h2>
                <p className="text-muted-foreground mb-6 text-base leading-relaxed">
                  Choose from specific topics and practice at your own pace with
                  guided questions and expert tips
                </p>

                <div className="flex justify-center gap-2 mb-6">
                  <Badge
                    variant="secondary"
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full"
                  >
                    <Trophy size={16} />
                    {completedCount} topics completed
                  </Badge>
                </div>
              </div>

              <Button className="w-full modern-button h-12 text-base font-medium rounded-lg">
                Start Practicing
              </Button>
            </div>
          </Card>

          {/* Test Mode */}
          <Card
            className="glass-card p-8 cursor-pointer group"
            onClick={() => onSelectMode("test")}
          >
            <div className="text-center space-y-6">
              <div className="flex justify-center">
                <div className="p-5 bg-primary/10 rounded-full group-hover:bg-primary/20 transition-colors duration-300">
                  <TestTube size={48} className="text-primary" />
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-semibold text-foreground mb-2">
                  Full Test Simulation
                </h2>
                <p className="text-muted-foreground mb-6 text-base leading-relaxed">
                  Experience a complete IELTS speaking test with AI examiner,
                  covering all three parts
                </p>

                <div className="flex justify-center gap-2 mb-6">
                  <Badge
                    variant="outline"
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-full"
                  >
                    <Clock size={16} />
                    11-14 minutes
                  </Badge>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full modern-button h-12 text-base font-medium rounded-lg"
              >
                Take Full Test
              </Button>
            </div>
          </Card>
        </div>

        {/* Info Section */}
        <Card className="glass-card p-8">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div className="space-y-3">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <span className="text-primary font-semibold text-base">1</span>
              </div>
              <h3 className="font-semibold text-foreground text-base">
                Part 1
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Introduction & familiar topics (4-5 minutes)
              </p>
            </div>
            <div className="space-y-3">
              <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center mx-auto">
                <span className="text-accent font-semibold text-base">2</span>
              </div>
              <h3 className="font-semibold text-foreground text-base">
                Part 2
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Individual long turn with preparation (3-4 minutes)
              </p>
            </div>
            <div className="space-y-3">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <span className="text-primary font-semibold text-base">3</span>
              </div>
              <h3 className="font-semibold text-foreground text-base">
                Part 3
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Two-way discussion on abstract topics (4-5 minutes)
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

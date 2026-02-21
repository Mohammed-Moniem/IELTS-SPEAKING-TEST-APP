import type { SubscriptionPlanOption } from "../components/SubscriptionPlansModal";

export const DEFAULT_SUBSCRIPTION_PLANS: SubscriptionPlanOption[] = [
  {
    tier: "free",
    name: "Free",
    price: 0,
    description: "Kick off your IELTS journey with guided practice.",
    features: [
      "10 practice sessions per month",
      "Community study groups",
      "Basic AI feedback",
    ],
    limits: {
      practice: 10,
      simulation: 0,
    },
  },
  {
    tier: "premium",
    name: "Premium",
    price: 19,
    description: "Unlimited practice plus weekly simulations.",
    features: [
      "Unlimited practice sessions",
      "2 simulations every month",
      "Detailed band-by-band analytics",
    ],
    limits: {
      practice: null,
      simulation: 2,
    },
  },
  {
    tier: "pro",
    name: "Pro",
    price: 29,
    description: "Full access for serious candidates.",
    features: [
      "Unlimited practice & simulations",
      "Advanced AI speaking coach",
      "Priority support & progress reports",
    ],
    limits: {
      practice: null,
      simulation: null,
    },
  },
];


export type PlanId = "free" | "hobby" | "pro" | "max" | "premium" | "premiumPlus";

export interface PlanFeature {
  label: string;
  included: boolean;
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  price: string;
  priceDetail: string;
  bestFor: string;
  tagline: string;
  model: string;
  dailyMessageLimit: number;
  contextWindow: string;
  features: PlanFeature[];
}

export const PLAN_ORDER: PlanId[] = ["free", "hobby", "pro", "max", "premium", "premiumPlus"];

export const PLAN_DEFINITIONS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    price: "$0",
    priceDetail: "forever",
    bestFor: "Casual testing and intermittent tasks.",
    tagline: "Everything you need to try MyAI locally.",
    model: "qwen3:8b",
    dailyMessageLimit: 40,
    contextWindow: "~8K tokens of history",
    features: [
      { label: "My AI 1.0 access", included: true },
      { label: "40 messages / day", included: true },
      { label: "Standard response priority", included: true },
      { label: "Markdown & code rendering", included: true },
      { label: "Extended capacity", included: false },
      { label: "Priority generation", included: false },
    ],
  },
  hobby: {
    id: "hobby",
    name: "Hobby",
    price: "$18",
    priceDetail: "/ month",
    bestFor: "Regular daily personal use.",
    tagline: "More headroom and a larger model for daily driving.",
    model: "qwen3:14b",
    dailyMessageLimit: 500,
    contextWindow: "Full model context window",
    features: [
      { label: "Extended My AI 1.0 capacity", included: true },
      { label: "500 messages / day", included: true },
      { label: "Priority generation", included: true },
      { label: "Full conversation context", included: true },
      { label: "Early access to new features", included: true },
      { label: "Model switching", included: false },
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: "$30",
    priceDetail: "/ month",
    bestFor: "Heavier daily coding and longer sessions.",
    tagline: "A bigger local model for serious day-to-day work.",
    model: "qwen3:32b",
    dailyMessageLimit: 1500,
    contextWindow: "Full model context window",
    features: [
      { label: "Expanded My AI 1.0 capacity", included: true },
      { label: "1,500 messages / day", included: true },
      { label: "Priority generation", included: true },
      { label: "Full conversation context", included: true },
      { label: "Model switching", included: true },
      { label: "Early access to new features", included: true },
    ],
  },
  max: {
    id: "max",
    name: "Max",
    price: "$60",
    priceDetail: "/ month",
    bestFor: "Power users and high-volume, autonomous workflows.",
    tagline: "The highest headroom for near-unlimited daily use.",
    model: "qwen3:32b",
    dailyMessageLimit: 4000,
    contextWindow: "Full model context window",
    features: [
      { label: "Maximum My AI 1.0 capacity", included: true },
      { label: "4,000 messages / day", included: true },
      { label: "Highest priority queue", included: true },
      { label: "Full conversation context", included: true },
      { label: "Model switching", included: true },
      { label: "Early access to agent & tool-calling features", included: true },
    ],
  },
  premium: {
    id: "premium",
    name: "Premium",
    price: "$100",
    priceDetail: "/ month",
    bestFor: "Small teams or families sharing one MyAI instance.",
    tagline: "Everything in Max, shared across your household or team.",
    model: "qwen3:32b",
    dailyMessageLimit: 4000,
    contextWindow: "Full model context window",
    features: [
      { label: "Everything in Max", included: true },
      { label: "Admin-managed access for your household/team", included: true },
      { label: "Centralized plan administration", included: true },
      { label: "Priority support", included: true },
      { label: "Model switching", included: true },
      { label: "Early access to agent & tool-calling features", included: true },
    ],
  },
  premiumPlus: {
    id: "premiumPlus",
    name: "Premium+",
    price: "$200",
    priceDetail: "/ month",
    bestFor: "Organizations needing dedicated priority and custom setup.",
    tagline: "Everything in Premium, with unlimited seats and custom tuning.",
    model: "qwen3:32b",
    dailyMessageLimit: 10000,
    contextWindow: "Full model context window",
    features: [
      { label: "Everything in Premium", included: true },
      { label: "Unlimited admin-managed seats", included: true },
      { label: "Dedicated request priority", included: true },
      { label: "Custom model configuration", included: true },
      { label: "Enhanced local-data privacy controls", included: true },
      { label: "Priority support", included: true },
    ],
  },
};

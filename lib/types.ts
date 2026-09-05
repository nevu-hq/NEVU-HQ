export type AgentKey =
  | "educator"
  | "analyst"
  | "market_context"
  | "risk_officer"
  | "portfolio_architect"
  | "compliance_decision"
  | "personal_assistant"
  | "minute_keeper"
  | "archive";

export type ProviderKey =
  | "openai"
  | "anthropic"
  | "google_gemini"
  | "xai_grok"
  | "huggingface_llama"
  | "local_bridge";

export type Verdict = "Buy" | "Hold" | "Reduce" | "Avoid";

export const AGENTS: {
  key: AgentKey;
  name: string;
  short: string;
}[] = [
  {
    key: "educator",
    name: "Educator Agent",
    short: "Explains concepts clearly",
  },
  {
    key: "analyst",
    name: "Analyst Agent",
    short: "Fundamental and quantitative analysis",
  },
  {
    key: "market_context",
    name: "Market Context Agent",
    short: "Market conditions and sentiment",
  },
  {
    key: "risk_officer",
    name: "Risk Officer Agent",
    short: "Short-term and long-term risk",
  },
  {
    key: "portfolio_architect",
    name: "Portfolio Architect Agent",
    short: "Portfolio proposals and monitoring",
  },
  {
    key: "compliance_decision",
    name: "Compliance & Decision Agent",
    short: "Rules, confidence and combined verdict",
  },
  {
    key: "personal_assistant",
    name: "Personal Assistant Advisor",
    short: "Private second opinion for the Administrator",
  },
  {
    key: "minute_keeper",
    name: "Minute Agent",
    short: "Exact session minutes",
  },
  {
    key: "archive",
    name: "Archive Agent",
    short: "Historical records and official archive",
  },
];

export const PROVIDERS: {
  key: ProviderKey;
  name: string;
}[] = [
  {
    key: "openai",
    name: "ChatGPT / OpenAI",
  },
  {
    key: "anthropic",
    name: "Claude / Anthropic",
  },
  {
    key: "google_gemini",
    name: "Gemini / Google",
  },
  {
    key: "xai_grok",
    name: "Grok / xAI",
  },
  {
    key: "huggingface_llama",
    name: "Llama / Hugging Face",
  },
  {
    key: "local_bridge",
    name: "Local Browser Bridge",
  },
];
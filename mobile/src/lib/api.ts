import { fetch } from "expo/fetch";
import { API_URL } from "./config";

export type PlanId = "free" | "hobby" | "pro" | "max" | "premium" | "premiumPlus";

export const PLAN_NAMES: Record<PlanId, string> = {
  free: "Free",
  hobby: "Hobby",
  pro: "Pro",
  max: "Max",
  premium: "Premium",
  premiumPlus: "Premium+",
};

export interface ArvoModel {
  id: string;
  name: string;
  description: string;
  locked?: boolean;
  required_plan?: string;
}

export interface HistoryItem {
  role: "user" | "assistant";
  content: string;
}

export class ArvoApiError extends Error {}

function userHeaders(email: string): Record<string, string> {
  return email ? { "X-User-Email": email } : {};
}

export async function fetchModels(email: string): Promise<{ default: string; models: ArvoModel[] }> {
  try {
    const response = await fetch(`${API_URL}/models`, { headers: userHeaders(email) });
    if (!response.ok) return { default: "arvo-1.0", models: [] };
    const data = (await response.json()) as { default?: string; models?: ArvoModel[] };
    return { default: data.default ?? "arvo-1.0", models: Array.isArray(data.models) ? data.models : [] };
  } catch {
    return { default: "arvo-1.0", models: [] };
  }
}

export async function fetchPlan(email: string): Promise<PlanId> {
  if (!email) return "free";
  try {
    const response = await fetch(`${API_URL}/users/me/plan?email=${encodeURIComponent(email)}`);
    if (!response.ok) return "free";
    const data = (await response.json()) as { plan?: PlanId };
    return data.plan && data.plan in PLAN_NAMES ? data.plan : "free";
  } catch {
    return "free";
  }
}

export interface StreamChatOptions {
  message: string;
  history: HistoryItem[];
  model: string;
  email: string;
  /** Pictures as data URLs. */
  images?: string[];
  signal?: AbortSignal;
  onToken: (chunk: string) => void;
}

/** Streams a reply from /chat/stream, calling onToken for each piece of text. */
export async function streamChat(options: StreamChatOptions): Promise<void> {
  const { message, history, model, email, images, signal, onToken } = options;

  let response;
  try {
    response = await fetch(`${API_URL}/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...userHeaders(email) },
      body: JSON.stringify({ message, history, model, images: images?.length ? images : undefined }),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ArvoApiError("Couldn't reach Arvo. Check your internet connection and try again.");
  }

  if (!response.ok) {
    let detail = "";
    try {
      detail = ((await response.json()) as { detail?: string }).detail ?? "";
    } catch {
      // Not JSON; fall through to the generic message.
    }
    if (response.status === 429) {
      throw new ArvoApiError(detail || "You've reached today's message limit for your plan.");
    }
    throw new ArvoApiError(detail || `Arvo returned an error (${response.status}).`);
  }
  if (!response.body) throw new ArvoApiError("Streaming isn't supported here.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const event of events) {
      const line = event.trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      let parsed: { content?: string; error?: string };
      try {
        parsed = JSON.parse(payload);
      } catch {
        continue;
      }
      if (parsed.error) throw new ArvoApiError(parsed.error);
      if (parsed.content) onToken(parsed.content);
    }
  }
}

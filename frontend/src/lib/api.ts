import type { PlanId } from "../types/plans";
import type { LivePrice } from "./formatPrice";

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://127.0.0.1:8000";

export interface StreamHistoryItem {
  role: "user" | "assistant";
  content: string;
}

export interface StreamChatOptions {
  message: string;
  history: StreamHistoryItem[];
  plan: PlanId;
  signal: AbortSignal;
  onToken: (chunk: string) => void;
}

export class ChatApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ChatApiError";
    this.status = status;
  }
}

export async function streamChat({ message, history, plan, signal, onToken }: StreamChatOptions): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Plan": plan,
      },
      body: JSON.stringify({ message, history }),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ChatApiError(
      "Could not reach the Arvo backend. Is it running on " + API_URL + "?"
    );
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new ChatApiError(
        "You've hit the daily message limit for your plan. Upgrade to Hobby for more headroom.",
        429
      );
    }
    throw new ChatApiError(`Backend returned an error (${response.status}).`, response.status);
  }

  if (!response.body) {
    throw new ChatApiError("Streaming is not supported by this response.");
  }

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

      try {
        const parsed = JSON.parse(payload) as { content?: string; error?: string; done?: boolean };
        if (parsed.error) {
          throw new ChatApiError(parsed.error);
        }
        if (parsed.content) {
          onToken(parsed.content);
        }
      } catch (err) {
        if (err instanceof ChatApiError) throw err;
      }
    }
  }
}

export async function sendChatOnce(message: string): Promise<string> {
  const response = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!response.ok) {
    throw new ChatApiError(`Backend returned an error (${response.status}).`, response.status);
  }
  const data = await response.json();
  return data.response as string;
}

export async function fetchHealth(): Promise<{ status: string; model?: string; model_available?: boolean }> {
  const response = await fetch(`${API_URL}/health`);
  return response.json();
}

export async function fetchPlanForEmail(email: string): Promise<PlanId> {
  if (!email) return "free";
  const response = await fetch(`${API_URL}/users/me/plan?email=${encodeURIComponent(email)}`);
  if (!response.ok) return "free";
  const data = await response.json();
  return (data.plan as PlanId) ?? "free";
}

export async function fetchLivePrices(): Promise<Partial<Record<PlanId, LivePrice>>> {
  try {
    const response = await fetch(`${API_URL}/billing/prices`);
    if (!response.ok) return {};
    return await response.json();
  } catch {
    return {};
  }
}

export async function createCheckoutSession(email: string, plan: PlanId): Promise<string> {
  const response = await fetch(`${API_URL}/billing/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, plan }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ChatApiError(data.detail ?? "Could not start checkout.", response.status);
  }
  const data = await response.json();
  return data.url as string;
}

export async function createBillingPortalSession(email: string): Promise<string> {
  const response = await fetch(`${API_URL}/billing/portal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ChatApiError(data.detail ?? "Could not open the billing portal.", response.status);
  }
  const data = await response.json();
  return data.url as string;
}

export interface AdminUserGrant {
  email: string;
  plan: PlanId;
  note: string;
  addedAt: string;
}

export async function adminListUsers(adminKey: string): Promise<AdminUserGrant[]> {
  const response = await fetch(`${API_URL}/admin/users`, {
    headers: { "X-Admin-Key": adminKey },
  });
  if (!response.ok) {
    throw new ChatApiError(
      response.status === 401 ? "Invalid admin key." : "Failed to load users.",
      response.status
    );
  }
  return response.json();
}

export async function adminUpsertUser(
  adminKey: string,
  grant: { email: string; plan: PlanId; note?: string }
): Promise<void> {
  const response = await fetch(`${API_URL}/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Key": adminKey,
    },
    body: JSON.stringify(grant),
  });
  if (!response.ok) {
    throw new ChatApiError(
      response.status === 401 ? "Invalid admin key." : "Failed to save grant.",
      response.status
    );
  }
}

export async function adminDeleteUser(adminKey: string, email: string): Promise<void> {
  const response = await fetch(`${API_URL}/admin/users/${encodeURIComponent(email)}`, {
    method: "DELETE",
    headers: { "X-Admin-Key": adminKey },
  });
  if (!response.ok) {
    throw new ChatApiError(
      response.status === 401 ? "Invalid admin key." : "Failed to remove grant.",
      response.status
    );
  }
}

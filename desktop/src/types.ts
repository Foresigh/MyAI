export type ApprovalMode = "ask" | "edits" | "auto";

export interface Settings {
  apiUrl: string;
  defaultApiUrl: string;
  email: string;
  model: string;
  approvalMode: ApprovalMode;
  recentWorkspaces: string[];
}

export interface Workspace {
  path: string;
  name: string;
}

export interface ArvoModel {
  id: string;
  name: string;
  description: string;
  locked?: boolean;
  required_plan?: string;
}

export type Preview =
  | { kind: "command"; command: string; cwd: string }
  | { kind: "edit"; path: string; oldText: string; newText: string }
  | { kind: "write"; path: string; exists: boolean; content: string };

export type AgentEvent =
  | { type: "busy"; busy: boolean }
  | { type: "assistant"; text: string }
  | { type: "tool_start"; id: string; name: string; args: Record<string, unknown> }
  | { type: "tool_output"; id: string; chunk: string }
  | { type: "tool_result"; id: string; ok: boolean; output: string; declined?: boolean }
  | { type: "approval"; id: string; name: string; kind: "edit" | "command"; preview: Preview }
  | { type: "waiting"; seconds: number }
  | { type: "error"; message: string }
  | { type: "stopped" };

export type ToolStatus = "running" | "awaiting" | "ok" | "error" | "declined";

export type Item =
  | { kind: "user"; id: string; text: string }
  | { kind: "assistant"; id: string; text: string }
  | { kind: "error"; id: string; text: string }
  | {
      kind: "tool";
      id: string;
      name: string;
      args: Record<string, unknown>;
      status: ToolStatus;
      output: string;
      preview?: Preview;
      approvalKind?: "edit" | "command";
    };

export interface ArvoBridge {
  getSettings(): Promise<Settings>;
  setSettings(patch: Partial<Settings>): Promise<Settings>;
  pickWorkspace(): Promise<Workspace | null>;
  currentWorkspace(): Promise<Workspace | null>;
  openWorkspace(folder: string): Promise<Workspace | null>;
  revealWorkspace(): Promise<void>;
  getModels(): Promise<{ default: string; plan: string; models: ArvoModel[] } | null>;
  send(text: string): Promise<{ ok?: boolean; error?: string }>;
  stop(): Promise<void>;
  newChat(): Promise<void>;
  respondApproval(id: string, decision: "allow" | "always" | "deny"): Promise<void>;
  onEvent(callback: (event: AgentEvent) => void): () => void;
}

declare global {
  interface Window {
    arvo: ArvoBridge;
  }
}

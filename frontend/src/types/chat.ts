export type Role = "user" | "assistant";

export interface Attachment {
  id: string;
  name: string;
  size: number;
  content: string;
  kind?: "text" | "image";
  /** Full picture sent to the model. Not saved with chat history. */
  dataUrl?: string;
  /** Small preview that is saved with chat history. */
  thumbUrl?: string;
}

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  attachments?: Attachment[];
  error?: boolean;
  pending?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

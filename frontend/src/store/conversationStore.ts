import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatMessage, Conversation } from "../types/chat";
import { createId } from "../lib/id";

function titleFromMessage(content: string): string {
  const clean = content.trim().replace(/\s+/g, " ");
  if (!clean) return "New chat";
  return clean.length > 48 ? `${clean.slice(0, 48)}...` : clean;
}

interface ConversationState {
  conversations: Conversation[];
  activeId: string | null;
  createConversation: () => string;
  deleteConversation: (id: string) => void;
  setActive: (id: string | null) => void;
  addMessage: (conversationId: string, message: ChatMessage) => void;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<ChatMessage>) => void;
  appendToMessage: (conversationId: string, messageId: string, chunk: string) => void;
  removeMessage: (conversationId: string, messageId: string) => void;
  getConversation: (id: string) => Conversation | undefined;
}

export const useConversationStore = create<ConversationState>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeId: null,

      createConversation: () => {
        const id = createId();
        const now = Date.now();
        const conversation: Conversation = {
          id,
          title: "New chat",
          messages: [],
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          conversations: [conversation, ...state.conversations],
          activeId: id,
        }));
        return id;
      },

      deleteConversation: (id) => {
        set((state) => {
          const conversations = state.conversations.filter((c) => c.id !== id);
          const activeId = state.activeId === id ? conversations[0]?.id ?? null : state.activeId;
          return { conversations, activeId };
        });
      },

      setActive: (id) => set({ activeId: id }),

      addMessage: (conversationId, message) => {
        set((state) => ({
          conversations: state.conversations.map((c) => {
            if (c.id !== conversationId) return c;
            const isFirstUserMessage = c.messages.length === 0 && message.role === "user";
            return {
              ...c,
              messages: [...c.messages, message],
              title: isFirstUserMessage ? titleFromMessage(message.content) : c.title,
              updatedAt: Date.now(),
            };
          }),
        }));
      },

      updateMessage: (conversationId, messageId, updates) => {
        set((state) => ({
          conversations: state.conversations.map((c) => {
            if (c.id !== conversationId) return c;
            return {
              ...c,
              messages: c.messages.map((m) => (m.id === messageId ? { ...m, ...updates } : m)),
              updatedAt: Date.now(),
            };
          }),
        }));
      },

      appendToMessage: (conversationId, messageId, chunk) => {
        set((state) => ({
          conversations: state.conversations.map((c) => {
            if (c.id !== conversationId) return c;
            return {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId ? { ...m, content: m.content + chunk } : m
              ),
              updatedAt: Date.now(),
            };
          }),
        }));
      },

      removeMessage: (conversationId, messageId) => {
        set((state) => ({
          conversations: state.conversations.map((c) => {
            if (c.id !== conversationId) return c;
            return { ...c, messages: c.messages.filter((m) => m.id !== messageId) };
          }),
        }));
      },

      getConversation: (id) => get().conversations.find((c) => c.id === id),
    }),
    { name: "myai-conversations" }
  )
);

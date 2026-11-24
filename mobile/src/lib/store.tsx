import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { fetchPlan, type PlanId } from "./api";
import { DEFAULT_MODEL } from "./config";

export interface ChatImage {
  uri: string;
  /** Only kept in memory for the current session; not saved. */
  dataUrl?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  images?: ChatImage[];
  pending?: boolean;
  error?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

export interface Settings {
  email: string;
  plan: PlanId;
  selectedModel: string;
}

interface AppState {
  ready: boolean;
  conversations: Conversation[];
  activeId: string | null;
  settings: Settings;
  activeConversation: Conversation | null;
  newChat: () => void;
  openChat: (id: string) => void;
  deleteChat: (id: string) => void;
  addMessage: (conversationId: string, message: ChatMessage) => void;
  updateMessage: (conversationId: string, messageId: string, update: Partial<ChatMessage>) => void;
  appendToMessage: (conversationId: string, messageId: string, chunk: string) => void;
  removeMessage: (conversationId: string, messageId: string) => void;
  ensureConversation: () => string;
  updateSettings: (update: Partial<Settings>) => void;
  refreshPlan: (email?: string) => Promise<PlanId>;
}

const STORAGE_KEY = "arvo-mobile-state-v1";
const DEFAULT_SETTINGS: Settings = { email: "", plan: "free", selectedModel: DEFAULT_MODEL };

const AppContext = createContext<AppState | null>(null);

export function createId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function titleFrom(text: string): string {
  const clean = text.trim().replace(/\s+/g, " ");
  if (!clean) return "Picture";
  return clean.length > 40 ? `${clean.slice(0, 40)}…` : clean;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  // Mirrors activeId so ensureConversation sees a chat created moments earlier.
  const activeIdRef = useRef<string | null>(null);
  const selectChat = useCallback((id: string | null) => {
    activeIdRef.current = id;
    setActiveId(id);
  }, []);

  // Load saved chats and settings once.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as Partial<{ conversations: Conversation[]; activeId: string | null; settings: Settings }>;
        const loaded = { ...DEFAULT_SETTINGS, ...saved.settings };
        setConversations(saved.conversations ?? []);
        selectChat(saved.activeId ?? null);
        setSettings(loaded);
        // Keep the plan shown in the app in step with the server.
        if (loaded.email) {
          void fetchPlan(loaded.email).then((plan) => setSettings((s) => ({ ...s, plan })));
        }
      })
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, [selectChat]);

  // Save after changes, leaving out picture data and unfinished replies.
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      const toSave = {
        activeId,
        settings,
        conversations: conversations.map((c) => ({
          ...c,
          messages: c.messages
            .filter((m) => !m.pending)
            .map((m) => (m.images ? { ...m, images: m.images.map(({ uri }) => ({ uri })) } : m)),
        })),
      };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toSave)).catch(() => undefined);
    }, 400);
    return () => clearTimeout(timer);
  }, [ready, conversations, activeId, settings]);

  const mutate = useCallback((conversationId: string, fn: (c: Conversation) => Conversation) => {
    setConversations((prev) => prev.map((c) => (c.id === conversationId ? fn(c) : c)));
  }, []);

  const ensureConversation = useCallback(() => {
    const current = activeIdRef.current;
    if (current) return current;
    const id = createId();
    setConversations((prev) => [{ id, title: "New chat", messages: [], updatedAt: Date.now() }, ...prev]);
    selectChat(id);
    return id;
  }, [selectChat]);

  const addMessage = useCallback(
    (conversationId: string, message: ChatMessage) =>
      mutate(conversationId, (c) => ({
        ...c,
        title: c.messages.length === 0 && message.role === "user" ? titleFrom(message.content) : c.title,
        messages: [...c.messages, message],
        updatedAt: Date.now(),
      })),
    [mutate]
  );

  const updateMessage = useCallback(
    (conversationId: string, messageId: string, update: Partial<ChatMessage>) =>
      mutate(conversationId, (c) => ({
        ...c,
        messages: c.messages.map((m) => (m.id === messageId ? { ...m, ...update } : m)),
      })),
    [mutate]
  );

  const appendToMessage = useCallback(
    (conversationId: string, messageId: string, chunk: string) =>
      mutate(conversationId, (c) => ({
        ...c,
        messages: c.messages.map((m) => (m.id === messageId ? { ...m, content: m.content + chunk } : m)),
      })),
    [mutate]
  );

  const removeMessage = useCallback(
    (conversationId: string, messageId: string) =>
      mutate(conversationId, (c) => ({ ...c, messages: c.messages.filter((m) => m.id !== messageId) })),
    [mutate]
  );

  const updateSettings = useCallback((update: Partial<Settings>) => setSettings((s) => ({ ...s, ...update })), []);

  const refreshPlan = useCallback(async (email?: string) => {
    const plan = await fetchPlan((email ?? "").trim());
    setSettings((s) => ({ ...s, plan }));
    return plan;
  }, []);

  const value = useMemo<AppState>(
    () => ({
      ready,
      conversations: [...conversations].sort((a, b) => b.updatedAt - a.updatedAt),
      activeId,
      settings,
      activeConversation: conversations.find((c) => c.id === activeId) ?? null,
      newChat: () => selectChat(null),
      openChat: (id) => selectChat(id),
      deleteChat: (id) => {
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (activeIdRef.current === id) selectChat(null);
      },
      addMessage,
      updateMessage,
      appendToMessage,
      removeMessage,
      ensureConversation,
      updateSettings,
      refreshPlan,
    }),
    [ready, conversations, activeId, settings, selectChat, addMessage, updateMessage, appendToMessage, removeMessage, ensureConversation, updateSettings, refreshPlan]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

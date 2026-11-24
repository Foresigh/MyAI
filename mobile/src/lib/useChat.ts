import { useCallback, useRef, useState } from "react";
import { ArvoApiError, streamChat } from "./api";
import { createId, useApp, type ChatImage, type ChatMessage } from "./store";

/** Sends messages and streams Arvo's replies into the active chat. */
export function useChat() {
  const app = useApp();
  const [isGenerating, setIsGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const runReply = useCallback(
    async (conversationId: string, history: ChatMessage[], text: string, images: ChatImage[]) => {
      const replyId = createId();
      app.addMessage(conversationId, { id: replyId, role: "assistant", content: "", createdAt: Date.now(), pending: true });
      const controller = new AbortController();
      abortRef.current = controller;
      setIsGenerating(true);
      let received = false;

      try {
        await streamChat({
          message: text,
          history: history.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.content })),
          model: app.settings.selectedModel,
          email: app.settings.email,
          images: images.map((i) => i.dataUrl).filter((d): d is string => !!d),
          signal: controller.signal,
          onToken: (chunk) => {
            received = true;
            app.appendToMessage(conversationId, replyId, chunk);
          },
        });
        app.updateMessage(conversationId, replyId, { pending: false });
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          if (received) app.updateMessage(conversationId, replyId, { pending: false });
          else app.removeMessage(conversationId, replyId);
        } else {
          const message = err instanceof ArvoApiError ? err.message : "Something went wrong. Please try again.";
          app.updateMessage(conversationId, replyId, { pending: false, error: true, content: message });
        }
      } finally {
        setIsGenerating(false);
        abortRef.current = null;
      }
    },
    [app]
  );

  const send = useCallback(
    async (text: string, images: ChatImage[]) => {
      const conversationId = app.ensureConversation();
      const history = app.conversations.find((c) => c.id === conversationId)?.messages ?? [];
      app.addMessage(conversationId, {
        id: createId(),
        role: "user",
        content: text,
        createdAt: Date.now(),
        images: images.length ? images : undefined,
      });
      await runReply(conversationId, history, text, images);
    },
    [app, runReply]
  );

  const retryLast = useCallback(async () => {
    const conversation = app.activeConversation;
    if (!conversation) return;
    const messages = conversation.messages;
    const lastUserIndex = messages.map((m) => m.role).lastIndexOf("user");
    if (lastUserIndex === -1) return;
    const lastUser = messages[lastUserIndex];
    for (const m of messages.slice(lastUserIndex + 1)) app.removeMessage(conversation.id, m.id);
    await runReply(conversation.id, messages.slice(0, lastUserIndex), lastUser.content, lastUser.images ?? []);
  }, [app, runReply]);

  const stop = useCallback(() => abortRef.current?.abort(), []);

  return { send, retryLast, stop, isGenerating };
}

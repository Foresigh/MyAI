import { useCallback, useRef, useState } from "react";
import { useConversationStore } from "../store/conversationStore";
import { useSettingsStore } from "../store/settingsStore";
import { streamChat, ChatApiError } from "../lib/api";
import { createId } from "../lib/id";
import type { Attachment, ChatMessage } from "../types/chat";

function buildOutgoingContent(text: string, attachments: Attachment[]): string {
  if (attachments.length === 0) return text;
  const fileBlocks = attachments
    .map((a) => `File: ${a.name}\n\`\`\`\n${a.content}\n\`\`\``)
    .join("\n\n");
  return text ? `${text}\n\n${fileBlocks}` : fileBlocks;
}

export function useChatStream() {
  const [isGenerating, setIsGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const addMessage = useConversationStore((s) => s.addMessage);
  const appendToMessage = useConversationStore((s) => s.appendToMessage);
  const updateMessage = useConversationStore((s) => s.updateMessage);
  const removeMessage = useConversationStore((s) => s.removeMessage);
  const getConversation = useConversationStore((s) => s.getConversation);
  const effectivePlan = useSettingsStore((s) => s.effectivePlan);

  const runAssistantTurn = useCallback(
    async (targetId: string, historyMessages: ChatMessage[], userText: string) => {
      const assistantId = createId();
      addMessage(targetId, {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: Date.now(),
        pending: true,
      });

      const controller = new AbortController();
      abortRef.current = controller;
      setIsGenerating(true);

      try {
        await streamChat({
          message: userText,
          history: historyMessages.map((m) => ({ role: m.role, content: m.content })),
          plan: effectivePlan(),
          signal: controller.signal,
          onToken: (chunk) => appendToMessage(targetId, assistantId, chunk),
        });
        updateMessage(targetId, assistantId, { pending: false });
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          const current = getConversation(targetId)?.messages.find((m) => m.id === assistantId);
          if (current && current.content.length === 0) {
            removeMessage(targetId, assistantId);
          } else {
            updateMessage(targetId, assistantId, { pending: false });
          }
        } else {
          const message = err instanceof ChatApiError ? err.message : "Something went wrong while generating a response.";
          updateMessage(targetId, assistantId, { pending: false, error: true, content: message });
        }
      } finally {
        setIsGenerating(false);
        abortRef.current = null;
      }
    },
    [addMessage, appendToMessage, updateMessage, removeMessage, getConversation, effectivePlan]
  );

  const send = useCallback(
    async (targetId: string, text: string, attachments: Attachment[] = []) => {
      const conversation = getConversation(targetId);
      const historyMessages = conversation?.messages ?? [];
      const outgoing = buildOutgoingContent(text, attachments);

      addMessage(targetId, {
        id: createId(),
        role: "user",
        content: outgoing,
        createdAt: Date.now(),
        attachments,
      });

      await runAssistantTurn(targetId, historyMessages, outgoing);
    },
    [addMessage, getConversation, runAssistantTurn]
  );

  const regenerate = useCallback(
    async (targetId: string) => {
      const conversation = getConversation(targetId);
      if (!conversation) return;
      const messages = conversation.messages;
      const lastAssistantIndex = [...messages].reverse().findIndex((m) => m.role === "assistant");
      if (lastAssistantIndex === -1) return;
      const actualIndex = messages.length - 1 - lastAssistantIndex;
      const lastAssistant = messages[actualIndex];
      const historyBefore = messages.slice(0, actualIndex);
      const lastUser = [...historyBefore].reverse().find((m) => m.role === "user");
      if (!lastUser) return;

      removeMessage(targetId, lastAssistant.id);
      const historyForRequest = historyBefore.filter((m) => m.id !== lastUser.id);
      await runAssistantTurn(targetId, historyForRequest, lastUser.content);
    },
    [getConversation, removeMessage, runAssistantTurn]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { send, regenerate, stop, isGenerating };
}

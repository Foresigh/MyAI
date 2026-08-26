import { ArrowDown } from "lucide-react";
import type { ChatMessage } from "../../types/chat";
import { MessageBubble } from "./MessageBubble";
import { useAutoScroll } from "../../hooks/useAutoScroll";
import styles from "./MessageList.module.css";

interface MessageListProps {
  messages: ChatMessage[];
  isGenerating: boolean;
  onRegenerate: () => void;
}

export function MessageList({ messages, isGenerating, onRegenerate }: MessageListProps) {
  const totalContent = messages.map((m) => m.content).join("").length;
  const { containerRef, isAtBottom, scrollToBottom } = useAutoScroll(totalContent);

  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.inner}>
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isLastAssistant={message.id === lastAssistantId}
            isGenerating={isGenerating}
            onRegenerate={onRegenerate}
          />
        ))}
      </div>
      {!isAtBottom && (
        <button className={styles.scrollButton} onClick={scrollToBottom} aria-label="Scroll to latest message">
          <ArrowDown size={16} />
        </button>
      )}
    </div>
  );
}

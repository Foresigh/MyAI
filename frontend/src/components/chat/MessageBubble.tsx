import { useState } from "react";
import { Check, Copy, RotateCcw, Sparkles, TriangleAlert, User } from "lucide-react";
import type { ChatMessage } from "../../types/chat";
import { Markdown } from "./Markdown";
import { TypingIndicator } from "./TypingIndicator";
import styles from "./MessageBubble.module.css";

interface MessageBubbleProps {
  message: ChatMessage;
  isLastAssistant: boolean;
  isGenerating: boolean;
  onRegenerate: () => void;
}

export function MessageBubble({ message, isLastAssistant, isGenerating, onRegenerate }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  if (isUser) {
    return (
      <div className={styles.row}>
        <div className={styles.userBubble}>
          <p className={styles.userText}>{message.content}</p>
        </div>
        <div className={styles.userAvatar}>
          <User size={14} />
        </div>
      </div>
    );
  }

  const showTyping = message.pending && message.content.length === 0;

  return (
    <div className={`${styles.row} ${styles.assistantRow}`}>
      <div className={styles.assistantAvatar}>
        <Sparkles size={14} />
      </div>
      <div className={styles.assistantContent}>
        {message.error ? (
          <div className={styles.errorBox}>
            <TriangleAlert size={15} />
            <span>{message.content}</span>
          </div>
        ) : showTyping ? (
          <TypingIndicator />
        ) : (
          <Markdown content={message.content} />
        )}

        {!message.pending && !message.error && message.content && (
          <div className={styles.toolbar}>
            <button className={styles.toolButton} onClick={handleCopy} type="button">
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? "Copied" : "Copy"}
            </button>
            {isLastAssistant && !isGenerating && (
              <button className={styles.toolButton} onClick={onRegenerate} type="button">
                <RotateCcw size={13} />
                Regenerate
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

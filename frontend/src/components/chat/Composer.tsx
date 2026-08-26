import { useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { ArrowUp, Paperclip, Square } from "lucide-react";
import { createId } from "../../lib/id";
import { MODEL_DISPLAY_NAME } from "../../lib/brand";
import { isLikelyTextFile, readFileAsText } from "../../lib/fileToText";
import { estimateTokens } from "../../lib/tokenEstimate";
import type { Attachment } from "../../types/chat";
import { AttachmentChip } from "./AttachmentChip";
import styles from "./Composer.module.css";

interface ComposerProps {
  onSend: (text: string, attachments: Attachment[]) => void;
  onStop: () => void;
  isGenerating: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

export function Composer({ onSend, onStop, isGenerating, disabled, disabledReason }: ComposerProps) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canSend = (text.trim().length > 0 || attachments.length > 0) && !isGenerating && !disabled;

  const resizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  };

  const handleFiles = async (fileList: FileList | File[]) => {
    setFileError(null);
    for (const file of Array.from(fileList)) {
      if (!isLikelyTextFile(file)) {
        setFileError(`${file.name}: only text/code files are supported right now.`);
        continue;
      }
      try {
        const content = await readFileAsText(file);
        setAttachments((prev) => [
          ...prev,
          { id: createId(), name: file.name, size: file.size, content },
        ]);
      } catch (err) {
        setFileError((err as Error).message);
      }
    }
  };

  const handleSubmit = () => {
    if (!canSend) return;
    onSend(text.trim(), attachments);
    setText("");
    setAttachments([]);
    requestAnimationFrame(resizeTextarea);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) {
      void handleFiles(e.dataTransfer.files);
    }
  };

  const charCount = text.length;
  const tokenEstimate = estimateTokens(text);

  return (
    <div className={styles.wrapper}>
      <div
        className={isDragging ? `${styles.composer} ${styles.dragging}` : styles.composer}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className={styles.dropOverlay}>Drop files to attach</div>
        )}

        {attachments.length > 0 && (
          <div className={styles.attachments}>
            {attachments.map((a) => (
              <AttachmentChip
                key={a.id}
                attachment={a}
                onRemove={() => setAttachments((prev) => prev.filter((f) => f.id !== a.id))}
              />
            ))}
          </div>
        )}

        {fileError && <div className={styles.fileError}>{fileError}</div>}

        <textarea
          ref={textareaRef}
          className={styles.textarea}
          value={text}
          placeholder={disabled ? disabledReason ?? "Sending is disabled" : "Message MyAI..."}
          rows={1}
          disabled={disabled}
          onChange={(e) => {
            setText(e.target.value);
            resizeTextarea();
          }}
          onKeyDown={handleKeyDown}
        />

        <div className={styles.actionRow}>
          <div className={styles.leftActions}>
            <button
              type="button"
              className={styles.attachButton}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach file"
            >
              <Paperclip size={16} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files) void handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <span className={styles.counter}>
              {charCount > 0 ? `${charCount} chars · ~${tokenEstimate} tokens` : ""}
            </span>
          </div>

          {isGenerating ? (
            <button type="button" className={styles.stopButton} onClick={onStop}>
              <Square size={13} fill="currentColor" />
              Stop
            </button>
          ) : (
            <button
              type="button"
              className={styles.sendButton}
              onClick={handleSubmit}
              disabled={!canSend}
              aria-label="Send message"
            >
              <ArrowUp size={16} />
            </button>
          )}
        </div>
      </div>
      <p className={styles.hint}>
        {MODEL_DISPLAY_NAME} runs locally · Enter to send · Shift+Enter for a new line
      </p>
    </div>
  );
}

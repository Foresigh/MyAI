import { Sparkles, X } from "lucide-react";
import { Button } from "./Button";
import styles from "./PromptComposer.module.css";

interface PromptComposerProps {
  value: string;
  onChange: (value: string) => void;
  onGenerate: () => void;
  onClear: () => void;
  isGenerating: boolean;
  placeholder?: string;
  generateLabel?: string;
  maxLength?: number;
}

export function PromptComposer({
  value,
  onChange,
  onGenerate,
  onClear,
  isGenerating,
  placeholder = "Describe what you want to create...",
  generateLabel = "Generate",
  maxLength = 2000,
}: PromptComposerProps) {
  const canGenerate = value.trim().length > 0 && !isGenerating;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (canGenerate) onGenerate();
    }
  };

  return (
    <div className={styles.wrapper}>
      <textarea
        className={styles.textarea}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={isGenerating}
      />
      <div className={styles.actionRow}>
        <div className={styles.leftActions}>
          <Button variant="ghost" size="sm" onClick={onClear} disabled={isGenerating || value.length === 0}>
            <X size={13} />
            Clear
          </Button>
          <span className={styles.counter}>
            {value.length} / {maxLength}
          </span>
        </div>
        <div className={styles.rightActions}>
          <button className={styles.generateButton} onClick={onGenerate} disabled={!canGenerate}>
            {isGenerating ? <span className={styles.spinner} /> : <Sparkles size={14} />}
            {isGenerating ? "Generating..." : generateLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

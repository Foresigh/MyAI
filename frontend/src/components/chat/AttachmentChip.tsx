import { FileText, X } from "lucide-react";
import type { Attachment } from "../../types/chat";
import styles from "./AttachmentChip.module.css";

interface AttachmentChipProps {
  attachment: Attachment;
  onRemove: () => void;
}

export function AttachmentChip({ attachment, onRemove }: AttachmentChipProps) {
  return (
    <div className={styles.chip}>
      <FileText size={13} />
      <span className={styles.name}>{attachment.name}</span>
      <span className={styles.size}>{Math.max(1, Math.round(attachment.size / 1000))}KB</span>
      <button className={styles.remove} onClick={onRemove} aria-label={`Remove ${attachment.name}`} type="button">
        <X size={12} />
      </button>
    </div>
  );
}

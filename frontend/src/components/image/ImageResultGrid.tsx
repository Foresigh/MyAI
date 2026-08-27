import { useState } from "react";
import { Check, Copy, Download, Expand, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { downloadDataUrl, copyImageToClipboard } from "../../lib/mediaActions";
import type { GeneratedImageItem } from "../../types/image";
import styles from "./ImageMaker.module.css";

interface ImageResultGridProps {
  items: GeneratedImageItem[];
  pendingCount: number;
  onOpen: (dataUrl: string) => void;
  onDelete: (id: string) => void;
  onUseAsReference: (dataUrl: string) => void;
  onCreateVariation: (item: GeneratedImageItem) => void;
  onRegenerate: (item: GeneratedImageItem) => void;
}

export function ImageResultGrid({
  items,
  pendingCount,
  onOpen,
  onDelete,
  onUseAsReference,
  onCreateVariation,
  onRegenerate,
}: ImageResultGridProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (item: GeneratedImageItem) => {
    const ok = await copyImageToClipboard(item.dataUrl);
    if (ok) {
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 1500);
    }
  };

  if (items.length === 0 && pendingCount === 0) {
    return (
      <div className={styles.emptyState}>
        <Sparkles size={22} />
        <h3>No images yet</h3>
        <p>Describe what you want to see and hit Generate — your results will show up here.</p>
      </div>
    );
  }

  return (
    <div className={styles.resultGrid}>
      {Array.from({ length: pendingCount }).map((_, i) => (
        <div key={`pending-${i}`} className={styles.generatingCard}>
          <span className={styles.spinnerLg} />
        </div>
      ))}
      {items.map((item) => (
        <div className={styles.resultCard} key={item.id}>
          <img src={item.dataUrl} alt={item.prompt} className={styles.resultImage} />
          <div className={styles.resultOverlay}>
            <div className={styles.resultActions}>
              <button className={styles.resultActionButton} onClick={() => onOpen(item.dataUrl)} aria-label="Fullscreen">
                <Expand size={13} />
              </button>
              <button
                className={styles.resultActionButton}
                onClick={() => downloadDataUrl(item.dataUrl, `arvo-image-${item.id}.png`)}
                aria-label="Download"
              >
                <Download size={13} />
              </button>
              <button className={styles.resultActionButton} onClick={() => handleCopy(item)} aria-label="Copy image">
                {copiedId === item.id ? <Check size={13} /> : <Copy size={13} />}
              </button>
              <button
                className={styles.resultActionButton}
                onClick={() => onRegenerate(item)}
                aria-label="Regenerate"
              >
                <RefreshCw size={13} />
              </button>
              <button
                className={styles.resultActionButton}
                onClick={() => onUseAsReference(item.dataUrl)}
                aria-label="Use as reference"
              >
                <Sparkles size={13} />
              </button>
              <button
                className={styles.resultActionButton}
                onClick={() => onCreateVariation(item)}
                aria-label="Create variation"
              >
                <Copy size={13} style={{ transform: "scaleX(-1)" }} />
              </button>
              <button className={styles.resultActionButton} onClick={() => onDelete(item.id)} aria-label="Delete">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

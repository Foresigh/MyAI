import { Download, RefreshCw, Sparkles, TriangleAlert, Trash2 } from "lucide-react";
import { IconButton } from "../common/IconButton";
import type { GeneratedVideoItem } from "../../types/video";
import styles from "./VideoMaker.module.css";

interface VideoResultCardProps {
  item: GeneratedVideoItem;
  onRegenerate: (item: GeneratedVideoItem) => void;
  onDelete: (id: string) => void;
  onCreateVariation: (item: GeneratedVideoItem) => void;
}

export function VideoResultCard({ item, onRegenerate, onDelete, onCreateVariation }: VideoResultCardProps) {
  if (item.status === "pending" || item.status === "processing") {
    const percent = Math.round((item.progress ?? 0) * 100);
    return (
      <div className={styles.playerCard}>
        <div className={styles.progressWrap}>
          <span className={styles.spinnerLg} />
          <span className={styles.progressLabel}>
            {item.status === "pending" ? "Queued..." : "Generating video — this can take a few minutes"}
          </span>
          <div className={styles.progressBarTrack}>
            <div className={styles.progressBarFill} style={{ width: `${Math.max(8, percent)}%` }} />
          </div>
        </div>
      </div>
    );
  }

  if (item.status === "failed") {
    return (
      <div className={styles.playerCard}>
        <div className={styles.failedBox}>
          <TriangleAlert size={20} />
          <span>{item.error ?? "Video generation failed."}</span>
          <IconButton label="Regenerate" onClick={() => onRegenerate(item)}>
            <RefreshCw size={15} />
          </IconButton>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.playerCard}>
      {item.videoUrl && <video className={styles.videoEl} src={item.videoUrl} controls />}
      <div className={styles.playerToolbar}>
        <span className={styles.progressLabel}>{item.prompt}</span>
        <div className={styles.toolbarActions}>
          {item.videoUrl && (
            <IconButton label="Download">
              <a
                href={item.videoUrl}
                download={`arvo-video-${item.id}.mp4`}
                style={{ display: "flex", color: "inherit" }}
              >
                <Download size={15} />
              </a>
            </IconButton>
          )}
          <IconButton label="Regenerate" onClick={() => onRegenerate(item)}>
            <RefreshCw size={15} />
          </IconButton>
          <IconButton label="Create variation" onClick={() => onCreateVariation(item)}>
            <Sparkles size={15} />
          </IconButton>
          <IconButton label="Delete" onClick={() => onDelete(item.id)}>
            <Trash2 size={15} />
          </IconButton>
        </div>
      </div>
    </div>
  );
}

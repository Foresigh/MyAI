import { Film } from "lucide-react";
import type { GeneratedVideoItem } from "../../types/video";
import styles from "./VideoMaker.module.css";

interface VideoHistoryGridProps {
  items: GeneratedVideoItem[];
  onOpen: (item: GeneratedVideoItem) => void;
}

export function VideoHistoryGrid({ items, onOpen }: VideoHistoryGridProps) {
  if (items.length === 0) return null;

  return (
    <div className={styles.historyGrid}>
      {items.map((item) => (
        <button key={item.id} className={styles.historyCard} onClick={() => onOpen(item)}>
          <div className={styles.historyThumbWrap}>
            {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt={item.prompt} /> : <Film size={20} />}
            <span className={styles.historyStatusBadge}>{item.status}</span>
          </div>
          <span className={styles.historyPrompt}>{item.prompt}</span>
        </button>
      ))}
    </div>
  );
}

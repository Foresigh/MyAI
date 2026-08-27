import type { GeneratedImageItem } from "../../types/image";
import styles from "./ImageMaker.module.css";

interface ImageHistoryGridProps {
  items: GeneratedImageItem[];
  onOpen: (dataUrl: string) => void;
}

export function ImageHistoryGrid({ items, onOpen }: ImageHistoryGridProps) {
  if (items.length === 0) return null;

  return (
    <div className={styles.historyGrid}>
      {items.map((item) => (
        <button key={item.id} className={styles.historyThumb} onClick={() => onOpen(item.dataUrl)}>
          <img src={item.dataUrl} alt={item.prompt} />
        </button>
      ))}
    </div>
  );
}

import { useEffect } from "react";
import { X } from "lucide-react";
import styles from "./ImageMaker.module.css";

interface ImageLightboxProps {
  src: string;
  onClose: () => void;
}

export function ImageLightbox({ src, onClose }: ImageLightboxProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className={styles.lightboxOverlay} onClick={onClose}>
      <button className={styles.lightboxClose} onClick={onClose} aria-label="Close">
        <X size={18} />
      </button>
      <img src={src} alt="Generated result" className={styles.lightboxImage} onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

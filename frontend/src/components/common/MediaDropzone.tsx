import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import styles from "./MediaDropzone.module.css";

const MAX_BYTES = 8_000_000;

interface MediaDropzoneProps {
  value: string | null; // data URL
  onChange: (dataUrl: string | null) => void;
  label?: string;
  hint?: string;
}

export function MediaDropzone({
  value,
  onChange,
  label = "Drop an image, or click to browse",
  hint = "PNG or JPG, up to 8MB",
}: MediaDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = (file: File) => {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`Image is too large (limit ${Math.round(MAX_BYTES / 1_000_000)}MB).`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
  };

  if (value) {
    return (
      <div className={styles.previewWrapper}>
        <img src={value} alt="Reference" className={styles.previewImage} />
        <button className={styles.removeButton} onClick={() => onChange(null)} aria-label="Remove image">
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <>
      <div
        className={isDragging ? `${styles.dropzone} ${styles.dragging}` : styles.dropzone}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
      >
        <ImagePlus size={22} className={styles.icon} />
        <span className={styles.label}>{label}</span>
        <span className={styles.hint}>{error ?? hint}</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
    </>
  );
}

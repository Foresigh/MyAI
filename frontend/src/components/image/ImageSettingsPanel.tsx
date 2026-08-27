import { PillPicker } from "../common/PillPicker";
import { Stepper } from "../common/Stepper";
import { MediaDropzone } from "../common/MediaDropzone";
import { IMAGE_ASPECT_RATIOS, IMAGE_QUALITIES, IMAGE_STYLES } from "../../types/image";
import type { ImageGenerationSettings } from "../../types/image";
import styles from "./ImageMaker.module.css";

interface ImageSettingsPanelProps {
  settings: ImageGenerationSettings;
  onChange: (settings: ImageGenerationSettings) => void;
  referenceImage: string | null;
  onReferenceImageChange: (value: string | null) => void;
}

export function ImageSettingsPanel({
  settings,
  onChange,
  referenceImage,
  onReferenceImageChange,
}: ImageSettingsPanelProps) {
  return (
    <div className={styles.settingsPanel}>
      <h3 className={styles.settingsTitle}>Settings</h3>

      <PillPicker
        label="Aspect ratio"
        options={IMAGE_ASPECT_RATIOS}
        value={settings.aspectRatio}
        onChange={(aspectRatio) => onChange({ ...settings, aspectRatio })}
      />

      <PillPicker
        label="Quality"
        options={IMAGE_QUALITIES}
        value={settings.quality}
        onChange={(quality) => onChange({ ...settings, quality })}
      />

      <Stepper
        label="Number of images"
        value={settings.numImages}
        min={1}
        max={4}
        onChange={(numImages) => onChange({ ...settings, numImages })}
      />

      <PillPicker
        label="Style"
        options={IMAGE_STYLES}
        value={settings.style}
        onChange={(style) => onChange({ ...settings, style })}
      />

      <div className={styles.referenceField}>
        <span className={styles.settingsFieldLabel}>Reference image (optional)</span>
        <MediaDropzone value={referenceImage} onChange={onReferenceImageChange} />
      </div>
    </div>
  );
}

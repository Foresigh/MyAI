import { PillPicker } from "../common/PillPicker";
import { MediaDropzone } from "../common/MediaDropzone";
import { VIDEO_ASPECT_RATIOS, VIDEO_DURATIONS, VIDEO_QUALITIES } from "../../types/video";
import type { VideoGenerationSettings } from "../../types/video";
import styles from "./VideoMaker.module.css";

interface VideoSettingsPanelProps {
  settings: VideoGenerationSettings;
  onChange: (settings: VideoGenerationSettings) => void;
  referenceImage: string | null;
  onReferenceImageChange: (value: string | null) => void;
}

export function VideoSettingsPanel({
  settings,
  onChange,
  referenceImage,
  onReferenceImageChange,
}: VideoSettingsPanelProps) {
  return (
    <div className={styles.settingsPanel}>
      <h3 className={styles.settingsTitle}>Settings</h3>

      <PillPicker
        label="Aspect ratio"
        options={VIDEO_ASPECT_RATIOS}
        value={settings.aspectRatio}
        onChange={(aspectRatio) => onChange({ ...settings, aspectRatio })}
      />

      <PillPicker
        label="Duration"
        options={VIDEO_DURATIONS.map((d) => ({ value: String(d.value), label: d.label }))}
        value={String(settings.duration)}
        onChange={(duration) => onChange({ ...settings, duration: Number(duration) })}
      />

      <PillPicker
        label="Quality"
        options={VIDEO_QUALITIES}
        value={settings.quality}
        onChange={(quality) => onChange({ ...settings, quality })}
      />

      <div className={styles.referenceField}>
        <span className={styles.settingsFieldLabel}>Starting frame (optional)</span>
        <MediaDropzone
          value={referenceImage}
          onChange={onReferenceImageChange}
          label="Drop an image to animate from it"
        />
      </div>
    </div>
  );
}

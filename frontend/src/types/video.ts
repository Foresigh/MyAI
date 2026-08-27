export type VideoAspectRatio = "16:9" | "9:16" | "1:1" | "4:3";
export type VideoQuality = "standard" | "high";
export type VideoJobStatus = "pending" | "processing" | "completed" | "failed";

export const VIDEO_ASPECT_RATIOS: { value: VideoAspectRatio; label: string }[] = [
  { value: "16:9", label: "Landscape 16:9" },
  { value: "9:16", label: "Portrait 9:16" },
  { value: "1:1", label: "Square 1:1" },
  { value: "4:3", label: "Landscape 4:3" },
];

export const VIDEO_DURATIONS: { value: number; label: string }[] = [
  { value: 4, label: "4s" },
  { value: 5, label: "5s" },
  { value: 8, label: "8s" },
  { value: 10, label: "10s" },
];

export const VIDEO_QUALITIES: { value: VideoQuality; label: string }[] = [
  { value: "standard", label: "Standard" },
  { value: "high", label: "High" },
];

export interface VideoGenerationSettings {
  aspectRatio: VideoAspectRatio;
  duration: number;
  quality: VideoQuality;
}

export interface GeneratedVideoItem {
  id: string;
  jobId: string;
  status: VideoJobStatus;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  progress: number | null;
  prompt: string;
  settings: VideoGenerationSettings;
  createdAt: number;
  error?: string;
}

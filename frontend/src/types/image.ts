export type ImageAspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
export type ImageQuality = "standard" | "high";
export type ImageStyle = "none" | "photorealistic" | "digital-art" | "illustration" | "3d-render";

export const IMAGE_ASPECT_RATIOS: { value: ImageAspectRatio; label: string }[] = [
  { value: "1:1", label: "Square 1:1" },
  { value: "16:9", label: "Landscape 16:9" },
  { value: "9:16", label: "Portrait 9:16" },
  { value: "4:3", label: "Landscape 4:3" },
  { value: "3:4", label: "Portrait 3:4" },
];

export const IMAGE_QUALITIES: { value: ImageQuality; label: string }[] = [
  { value: "standard", label: "Standard" },
  { value: "high", label: "High" },
];

export const IMAGE_STYLES: { value: ImageStyle; label: string }[] = [
  { value: "none", label: "None" },
  { value: "photorealistic", label: "Photorealistic" },
  { value: "digital-art", label: "Digital art" },
  { value: "illustration", label: "Illustration" },
  { value: "3d-render", label: "3D render" },
];

export interface ImageGenerationSettings {
  aspectRatio: ImageAspectRatio;
  numImages: number;
  quality: ImageQuality;
  style: ImageStyle;
}

export interface GeneratedImageItem {
  id: string;
  dataUrl: string;
  prompt: string;
  settings: ImageGenerationSettings;
  createdAt: number;
}

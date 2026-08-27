import { API_URL, ChatApiError } from "./api";
import type { ImageGenerationSettings } from "../types/image";

export interface GenerateImageParams extends ImageGenerationSettings {
  prompt: string;
  referenceImage?: string | null; // data URL
}

export async function generateImages(params: GenerateImageParams): Promise<string[]> {
  const response = await fetch(`${API_URL}/generate-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: params.prompt,
      aspect_ratio: params.aspectRatio,
      num_images: params.numImages,
      quality: params.quality,
      style: params.style,
      reference_image: params.referenceImage ?? undefined,
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ChatApiError(data.detail ?? "Image generation failed.", response.status);
  }

  const data = await response.json();
  return (data.images as { data: string; mime_type: string }[]).map(
    (img) => `data:${img.mime_type};base64,${img.data}`
  );
}

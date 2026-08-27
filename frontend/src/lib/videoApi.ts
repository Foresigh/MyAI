import { API_URL, ChatApiError } from "./api";
import type { VideoGenerationSettings, VideoJobStatus } from "../types/video";

export interface StartVideoParams extends VideoGenerationSettings {
  prompt: string;
  referenceImage?: string | null;
}

export interface VideoJobResult {
  jobId: string;
  status: VideoJobStatus;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  progress: number | null;
  error: string | null;
}

export async function startVideoGeneration(params: StartVideoParams): Promise<VideoJobResult> {
  const response = await fetch(`${API_URL}/generate-video`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: params.prompt,
      aspect_ratio: params.aspectRatio,
      duration: params.duration,
      quality: params.quality,
      reference_image: params.referenceImage ?? undefined,
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ChatApiError(data.detail ?? "Video generation failed to start.", response.status);
  }

  const data = await response.json();
  return {
    jobId: data.job_id,
    status: data.status,
    videoUrl: data.video_url ?? null,
    thumbnailUrl: null,
    progress: data.progress ?? null,
    error: null,
  };
}

export async function pollVideoJob(jobId: string): Promise<VideoJobResult> {
  const response = await fetch(`${API_URL}/generate-video/${encodeURIComponent(jobId)}`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ChatApiError(data.detail ?? "Could not check video status.", response.status);
  }
  const data = await response.json();
  return {
    jobId: data.job_id,
    status: data.status,
    videoUrl: data.video_url ?? null,
    thumbnailUrl: data.thumbnail_url ?? null,
    progress: data.progress ?? null,
    error: data.error ?? null,
  };
}

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000; // videos can legitimately take minutes

export async function pollVideoUntilDone(
  jobId: string,
  onUpdate: (result: VideoJobResult) => void,
  signal?: AbortSignal
): Promise<VideoJobResult> {
  const start = Date.now();

  while (true) {
    if (signal?.aborted) throw new DOMException("Polling aborted", "AbortError");

    const result = await pollVideoJob(jobId);
    onUpdate(result);

    if (result.status === "completed" || result.status === "failed") {
      return result;
    }

    if (Date.now() - start > POLL_TIMEOUT_MS) {
      throw new ChatApiError("Video generation timed out.");
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

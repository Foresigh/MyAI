"""Cloud video generation shaped after Runway ML's task-based API.

IMPORTANT: video-generation APIs are a fast-moving space and Runway's exact
endpoint paths, required headers, and accepted ratio/duration values change
between model versions. This implementation follows their documented
create-task / poll-task pattern as of this writing — verify field names
against https://docs.dev.runwayml.com before relying on this in production.
Swap this file for a different vendor (Luma, Pika, etc.) without touching
anything else in the app; only the ImageProvider/VideoProvider interface is
depended on elsewhere.
"""

from __future__ import annotations

import os

import requests

from .provider import (
    VideoGenerationRequest,
    VideoJob,
    VideoJobStatus,
    VideoProvider,
    VideoProviderError,
)

API_BASE = "https://api.dev.runwayml.com/v1"
API_VERSION = "2024-11-06"
MODEL = "gen3a_turbo"

ASPECT_RATIO_TO_RUNWAY_RATIO = {
    "16:9": "1280:768",
    "9:16": "768:1280",
    "1:1": "1024:1024",
    "4:3": "1104:832",
}

# Runway task id -> our job. In-memory only, matching this app's existing
# demo-grade state (see main.py's usage counters) — fine at personal scale,
# swap for a real datastore before this needs to survive many concurrent users.
_JOBS: dict[str, VideoJob] = {}


class CloudVideoProvider(VideoProvider):
    def __init__(self) -> None:
        self.api_key = os.environ.get("VIDEO_API_KEY")

    def _headers(self) -> dict:
        if not self.api_key:
            raise VideoProviderError(
                "Video generation is not configured on this server. Set the VIDEO_API_KEY "
                "environment variable to a Runway API key."
            )
        return {
            "Authorization": f"Bearer {self.api_key}",
            "X-Runway-Version": API_VERSION,
            "Content-Type": "application/json",
        }

    def start(self, request: VideoGenerationRequest) -> VideoJob:
        ratio = ASPECT_RATIO_TO_RUNWAY_RATIO.get(request.aspect_ratio, "1280:768")

        body = {
            "model": MODEL,
            "promptText": request.prompt,
            "ratio": ratio,
            "duration": request.duration,
        }
        if request.reference_image_b64:
            body["promptImage"] = f"data:image/png;base64,{request.reference_image_b64}"

        try:
            response = requests.post(
                f"{API_BASE}/image_to_video",
                headers=self._headers(),
                json=body,
                timeout=30,
            )
        except requests.RequestException as exc:
            raise VideoProviderError(f"Could not reach the video provider: {exc}") from exc

        if not response.ok:
            raise VideoProviderError(f"Video provider returned an error: {response.text}")

        task_id = response.json().get("id")
        if not task_id:
            raise VideoProviderError("Video provider did not return a task id.")

        job = VideoJob(id=task_id, status=VideoJobStatus.PENDING)
        _JOBS[task_id] = job
        return job

    def poll(self, job_id: str) -> VideoJob:
        try:
            response = requests.get(
                f"{API_BASE}/tasks/{job_id}",
                headers=self._headers(),
                timeout=30,
            )
        except requests.RequestException as exc:
            raise VideoProviderError(f"Could not reach the video provider: {exc}") from exc

        if not response.ok:
            raise VideoProviderError(f"Video provider returned an error: {response.text}")

        data = response.json()
        status_map = {
            "PENDING": VideoJobStatus.PENDING,
            "RUNNING": VideoJobStatus.PROCESSING,
            "SUCCEEDED": VideoJobStatus.COMPLETED,
            "FAILED": VideoJobStatus.FAILED,
        }
        status = status_map.get(data.get("status"), VideoJobStatus.PROCESSING)

        output = data.get("output") or []
        job = VideoJob(
            id=job_id,
            status=status,
            video_url=output[0] if output else None,
            progress=data.get("progress"),
            error=data.get("failure") if status == VideoJobStatus.FAILED else None,
        )
        _JOBS[job_id] = job
        return job

"""Free video generation through a Hugging Face ZeroGPU Space.

Uses Lightricks' official LTX-Video Space (Lightricks/ltx-video-distilled),
which runs on Hugging Face's free shared GPUs. There is no cost, but there is
a daily GPU-time quota: about 2 minutes a day without a token, or about
5 minutes a day with a free Hugging Face account token in HF_TOKEN. All Arvo
users share that quota, so clips are kept short.

Finished clips are copied into backend/data/videos and served by the
/generate-video/{job_id}/file endpoint. Railway's disk is not permanent, so
old clips disappear when the backend redeploys.
"""

from __future__ import annotations

import base64
import logging
import os
import shutil
import tempfile
import threading
import time
import uuid

from .provider import (
    VideoGenerationRequest,
    VideoJob,
    VideoJobStatus,
    VideoProvider,
    VideoProviderError,
)

logger = logging.getLogger("arvo.video")

SPACE_ID = os.environ.get("HF_VIDEO_SPACE", "Lightricks/ltx-video-distilled")
MAX_FREE_SECONDS = float(os.environ.get("FREE_VIDEO_MAX_SECONDS", "5"))
VIDEO_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "videos")
MAX_STORED_VIDEOS = 100
JOB_TTL_SECONDS = 3600

NEGATIVE_PROMPT = "worst quality, inconsistent motion, blurry, jittery, distorted, watermark, text"

# Width and height must be multiples of 32 for LTX-Video.
DIMENSIONS = {
    "16:9": (768, 416),
    "9:16": (416, 768),
    "1:1": (512, 512),
    "4:3": (640, 480),
}

_client = None
_client_lock = threading.Lock()
_jobs: dict[str, dict] = {}
_jobs_lock = threading.Lock()


def video_file_path(job_id: str) -> str | None:
    """Path of a finished clip, or None. Only ids this server created are valid."""
    if not job_id.isalnum():
        return None
    path = os.path.join(VIDEO_DIR, f"{job_id}.mp4")
    return path if os.path.exists(path) else None


def _get_client():
    global _client
    with _client_lock:
        if _client is None:
            try:
                from gradio_client import Client
            except ImportError as exc:
                raise VideoProviderError("Free video generation isn't installed on this server.") from exc
            token = os.environ.get("HF_TOKEN") or None
            try:
                _client = Client(SPACE_ID, token=token, verbose=False)
            except Exception as exc:  # network errors, Space asleep or renamed
                logger.warning("Could not connect to %s: %s", SPACE_ID, exc)
                raise VideoProviderError(
                    "The free video service isn't reachable right now. Please try again in a few minutes."
                ) from exc
        return _client


def _friendly_error(exc: Exception) -> str:
    text = str(exc)
    lower = text.lower()
    logger.warning("Free video generation failed: %s", text[:500])
    if "quota" in lower or "zerogpu" in lower or "gpu" in lower and "exceeded" in lower:
        return (
            "The free video service has used up today's GPU time. "
            "It resets daily, so please try again later."
        )
    if "queue" in lower and "full" in lower:
        return "The free video service is busy. Please try again in a few minutes."
    return "The free video service couldn't make this video. Please try again."


def _prune_old() -> None:
    now = time.time()
    with _jobs_lock:
        for job_id in [j for j, d in _jobs.items() if now - d["created"] > JOB_TTL_SECONDS]:
            _jobs.pop(job_id, None)
    try:
        files = sorted(
            (os.path.join(VIDEO_DIR, f) for f in os.listdir(VIDEO_DIR) if f.endswith(".mp4")),
            key=os.path.getmtime,
        )
        for path in files[:-MAX_STORED_VIDEOS]:
            os.remove(path)
    except OSError:
        pass


class FreeVideoProvider(VideoProvider):
    def start(self, request: VideoGenerationRequest) -> VideoJob:
        from gradio_client import handle_file

        client = _get_client()
        width, height = DIMENSIONS.get(request.aspect_ratio, DIMENSIONS["16:9"])
        duration = max(1.0, min(float(request.duration), MAX_FREE_SECONDS))

        image_path = None
        if request.reference_image_b64:
            fd, image_path = tempfile.mkstemp(suffix=".png")
            with os.fdopen(fd, "wb") as f:
                f.write(base64.b64decode(request.reference_image_b64))

        common = dict(
            prompt=request.prompt,
            negative_prompt=NEGATIVE_PROMPT,
            input_video_filepath=None,
            height_ui=height,
            width_ui=width,
            duration_ui=duration,
            ui_frames_to_use=9,
            seed_ui=42,
            randomize_seed=True,
            ui_guidance_scale=1,
            improve_texture_flag=request.quality == "high",
        )
        try:
            if image_path:
                job = client.submit(
                    input_image_filepath=handle_file(image_path),
                    mode="image-to-video",
                    api_name="/image_to_video",
                    **common,
                )
            else:
                job = client.submit(
                    input_image_filepath=None,
                    mode="text-to-video",
                    api_name="/text_to_video",
                    **common,
                )
        except Exception as exc:
            raise VideoProviderError(_friendly_error(exc)) from exc

        job_id = uuid.uuid4().hex
        with _jobs_lock:
            _jobs[job_id] = {"job": job, "created": time.time(), "image_path": image_path, "result": None}
        _prune_old()
        return VideoJob(id=job_id, status=VideoJobStatus.PENDING)

    def poll(self, job_id: str) -> VideoJob:
        if video_file_path(job_id):
            return VideoJob(id=job_id, status=VideoJobStatus.COMPLETED, video_url=f"/generate-video/{job_id}/file")

        with _jobs_lock:
            entry = _jobs.get(job_id)
        if entry is None:
            return VideoJob(
                id=job_id,
                status=VideoJobStatus.FAILED,
                error="This video is no longer available. Please generate it again.",
            )
        if entry["result"] is not None:
            return entry["result"]

        job = entry["job"]
        if not job.done():
            status = job.status()
            code = getattr(getattr(status, "code", None), "name", "")
            pending = code in ("STARTING", "JOINING_QUEUE", "QUEUE_FULL", "IN_QUEUE", "SENDING_DATA")
            return VideoJob(
                id=job_id,
                status=VideoJobStatus.PENDING if pending else VideoJobStatus.PROCESSING,
            )

        try:
            output = job.result()
            video = output[0]
            source = video.get("video") if isinstance(video, dict) else video
            os.makedirs(VIDEO_DIR, exist_ok=True)
            shutil.copyfile(source, os.path.join(VIDEO_DIR, f"{job_id}.mp4"))
            result = VideoJob(id=job_id, status=VideoJobStatus.COMPLETED, video_url=f"/generate-video/{job_id}/file")
        except Exception as exc:
            result = VideoJob(id=job_id, status=VideoJobStatus.FAILED, error=_friendly_error(exc))
        finally:
            if entry.get("image_path"):
                try:
                    os.remove(entry["image_path"])
                except OSError:
                    pass

        entry["result"] = result
        return result

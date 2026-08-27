from __future__ import annotations

import os
from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum

ASPECT_RATIOS = ("16:9", "9:16", "1:1", "4:3")
DURATIONS = (4, 5, 8, 10)  # seconds — a provider may only support a subset
QUALITIES = ("standard", "high")

MAX_REFERENCE_IMAGE_BYTES = 8_000_000


class VideoProviderError(Exception):
    pass


class VideoJobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class VideoGenerationRequest:
    prompt: str
    aspect_ratio: str = "16:9"
    duration: int = 5
    quality: str = "standard"
    reference_image_b64: str | None = None  # image-to-video starting frame


@dataclass
class VideoJob:
    id: str
    status: VideoJobStatus
    video_url: str | None = None
    thumbnail_url: str | None = None
    error: str | None = None
    progress: float | None = None  # 0-1 when the provider reports one


class VideoProvider(ABC):
    """Common interface every video-generation backend implements.

    Video generation is inherently asynchronous — start() kicks off a job and
    returns immediately, poll() checks on it. This shape is required
    regardless of vendor, since real video generation takes far longer than a
    single HTTP request should stay open.
    """

    @abstractmethod
    def start(self, request: VideoGenerationRequest) -> VideoJob:
        ...

    @abstractmethod
    def poll(self, job_id: str) -> VideoJob:
        ...


def get_video_provider() -> VideoProvider:
    provider_name = os.environ.get("VIDEO_PROVIDER", "cloud").lower()
    if provider_name == "local":
        from .local_provider import LocalVideoProvider

        return LocalVideoProvider()
    if provider_name == "cloud":
        from .cloud_provider import CloudVideoProvider

        return CloudVideoProvider()
    raise VideoProviderError(
        f"Unknown VIDEO_PROVIDER '{provider_name}'. Expected 'cloud' or 'local'."
    )

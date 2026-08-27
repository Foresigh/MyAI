from __future__ import annotations

import os
from abc import ABC, abstractmethod
from dataclasses import dataclass

ASPECT_RATIOS = ("1:1", "16:9", "9:16", "4:3", "3:4")
QUALITIES = ("standard", "high")
STYLES = ("none", "photorealistic", "digital-art", "illustration", "3d-render")

MAX_NUM_IMAGES = 4
MAX_REFERENCE_IMAGE_BYTES = 8_000_000


class ImageProviderError(Exception):
    pass


@dataclass
class ImageGenerationRequest:
    prompt: str
    aspect_ratio: str = "1:1"
    num_images: int = 1
    quality: str = "standard"
    style: str = "none"
    reference_image_b64: str | None = None  # raw base64 payload, no "data:" prefix


@dataclass
class GeneratedImage:
    base64_data: str
    mime_type: str = "image/png"


class ImageProvider(ABC):
    """Common interface every image-generation backend implements.

    Swapping providers (local <-> cloud, or one cloud vendor <-> another) means
    writing a new subclass here — nothing else in the app depends on how a
    provider actually produces pixels.
    """

    @abstractmethod
    def generate(self, request: ImageGenerationRequest) -> list[GeneratedImage]:
        ...


def get_image_provider() -> ImageProvider:
    provider_name = os.environ.get("IMAGE_PROVIDER", "cloud").lower()
    if provider_name == "local":
        from .local_provider import LocalImageProvider

        return LocalImageProvider()
    if provider_name == "cloud":
        from .cloud_provider import CloudImageProvider

        return CloudImageProvider()
    raise ImageProviderError(
        f"Unknown IMAGE_PROVIDER '{provider_name}'. Expected 'cloud' or 'local'."
    )

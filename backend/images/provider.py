"""
Image generation provider using Pollinations.ai (free, no API key required).
Matches the interface main.py expects: MAX_NUM_IMAGES, ImageGenerationRequest,
ImageProviderError, get_image_provider().
"""

from dataclasses import dataclass
from typing import Optional
from urllib.parse import quote
import base64

import httpx


MAX_NUM_IMAGES = 4

POLLINATIONS_BASE_URL = "https://image.pollinations.ai/prompt"

STYLE_TO_MODEL = {
    "photorealistic": "flux",
    "standard": "flux",
    "fast": "turbo",
}


class ImageProviderError(Exception):
    """Raised when image generation fails."""
    pass


@dataclass
class ImageGenerationRequest:
    prompt: str
    aspect_ratio: str = "1:1"
    num_images: int = 1
    quality: str = "standard"
    style: str = "photorealistic"
    reference_image_b64: Optional[str] = None


@dataclass
class GeneratedImage:
    base64_data: str
    mime_type: str = "image/jpeg"


class PollinationsImageProvider:
    def generate(self, request: ImageGenerationRequest) -> list[GeneratedImage]:
        width, height = _aspect_ratio_to_dimensions(request.aspect_ratio)
        model = STYLE_TO_MODEL.get(request.style, "flux")

        results = []
        try:
            with httpx.Client(timeout=60.0) as client:
                for i in range(request.num_images):
                    encoded_prompt = quote(request.prompt)
                    url = f"{POLLINATIONS_BASE_URL}/{encoded_prompt}"
                    params = {
                        "width": width,
                        "height": height,
                        "model": model,
                        "nologo": "true",
                        "seed": i * 1000 + (hash(request.prompt) % 1000),
                    }
                    response = client.get(url, params=params)
                    response.raise_for_status()
                    b64 = base64.b64encode(response.content).decode("utf-8")
                    results.append(GeneratedImage(base64_data=b64, mime_type="image/jpeg"))
        except httpx.HTTPError as exc:
            raise ImageProviderError(f"Image generation failed: {exc}") from exc

        return results


def _aspect_ratio_to_dimensions(aspect_ratio: str) -> tuple[int, int]:
    mapping = {
        "1:1": (1024, 1024),
        "16:9": (1344, 768),
        "9:16": (768, 1344),
        "4:3": (1152, 896),
        "3:4": (896, 1152),
    }
    return mapping.get(aspect_ratio, (1024, 1024))


def get_image_provider() -> PollinationsImageProvider:
    return PollinationsImageProvider()

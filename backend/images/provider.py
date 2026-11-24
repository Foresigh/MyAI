"""
Image generation provider using Pollinations.ai.

Without a key this uses the free "classic" API, which Pollinations limits to
1 image every 45 seconds per IP address and at most 768x768. Every Arvo user
shares the server's IP, so set POLLINATIONS_API_KEY (a secret "sk_" key from
https://enter.pollinations.ai/keys) to lift that limit. Keyed requests spend
the key's pollen balance.

Matches the interface main.py expects: MAX_NUM_IMAGES, ImageGenerationRequest,
ImageProviderError, get_image_provider().
"""

import base64
import logging
import math
import os
import re
from dataclasses import dataclass
from typing import Optional
from urllib.parse import quote

import httpx


MAX_NUM_IMAGES = 4

CLASSIC_URL = "https://image.pollinations.ai/prompt"
KEYED_URL = "https://gen.pollinations.ai/image"
CLASSIC_MAX_SIDE = 768
DEFAULT_KEYED_MODEL = "black-forest-labs/flux.1-schnell"

logger = logging.getLogger("arvo.images")
_RETRY_AFTER_RE = re.compile(r"retry after\s+(\d+)\s*s", re.I)


class ImageProviderError(Exception):
    """Raised when image generation fails. The message is shown to users."""
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
    def __init__(self) -> None:
        self.api_key = os.environ.get("POLLINATIONS_API_KEY", "").strip()
        self.model = os.environ.get("POLLINATIONS_IMAGE_MODEL", DEFAULT_KEYED_MODEL).strip()

    def generate(self, request: ImageGenerationRequest) -> list[GeneratedImage]:
        width, height = _aspect_ratio_to_dimensions(request.aspect_ratio)
        if not self.api_key:
            width, height = _fit_within(width, height, CLASSIC_MAX_SIDE)

        results: list[GeneratedImage] = []
        with httpx.Client(timeout=90.0) as client:
            for i in range(request.num_images):
                seed = i * 1000 + (hash(request.prompt) % 1000)
                try:
                    results.append(self._generate_one(client, request.prompt, width, height, seed))
                except ImageProviderError:
                    # Return what was made so far rather than nothing, e.g. when
                    # the free tier allows one image but more were requested.
                    if results:
                        logger.warning("Pollinations stopped after %d of %d images", len(results), request.num_images)
                        return results
                    raise
        return results

    def _generate_one(self, client: httpx.Client, prompt: str, width: int, height: int, seed: int) -> GeneratedImage:
        params: dict = {"width": width, "height": height, "seed": seed, "nologo": "true"}
        headers: dict = {}
        if self.api_key:
            url = f"{KEYED_URL}/{quote(prompt)}"
            params["model"] = self.model
            headers["Authorization"] = f"Bearer {self.api_key}"
        else:
            url = f"{CLASSIC_URL}/{quote(prompt)}"

        try:
            response = client.get(url, params=params, headers=headers)
        except httpx.HTTPError as exc:
            logger.warning("Pollinations request failed: %s", type(exc).__name__)
            raise ImageProviderError("Couldn't reach the image service. Please try again.") from exc

        content_type = response.headers.get("content-type", "")
        if response.status_code == 200 and content_type.startswith("image/"):
            return GeneratedImage(
                base64_data=base64.b64encode(response.content).decode("utf-8"),
                mime_type=content_type.split(";")[0],
            )

        raise ImageProviderError(self._error_message(response))

    def _error_message(self, response: httpx.Response) -> str:
        try:
            error = response.json().get("error") or {}
        except ValueError:
            error = {}
        code = str(error.get("code", ""))
        text = str(error.get("message", ""))
        logger.warning("Pollinations %s %s: %s", response.status_code, code, text[:300])

        if code == "FREE_LIMIT" or (response.status_code in (402, 429) and not self.api_key):
            match = _RETRY_AFTER_RE.search(text)
            wait = f" in {match.group(1)} seconds" if match else " in about a minute"
            return f"The free image service allows one picture at a time. Please try again{wait}."
        if response.status_code == 402:
            return "The image service balance has run out. Please let the Arvo admin know."
        if response.status_code in (401, 403):
            return "The image service key isn't valid. Please let the Arvo admin know."
        if response.status_code == 429:
            return "The image service is busy. Please try again in a minute."
        if response.status_code == 400 and text:
            return f"The image service couldn't make that picture: {text[:200]}"
        return f"Image generation failed (status {response.status_code}). Please try again."


def _aspect_ratio_to_dimensions(aspect_ratio: str) -> tuple[int, int]:
    mapping = {
        "1:1": (1024, 1024),
        "16:9": (1344, 768),
        "9:16": (768, 1344),
        "4:3": (1152, 896),
        "3:4": (896, 1152),
    }
    return mapping.get(aspect_ratio, (1024, 1024))


def _fit_within(width: int, height: int, max_side: int) -> tuple[int, int]:
    scale = min(1.0, max_side / max(width, height))
    # Keep both sides multiples of 16, which image models expect.
    return (max(16, math.floor(width * scale / 16) * 16), max(16, math.floor(height * scale / 16) * 16))


def get_image_provider() -> PollinationsImageProvider:
    return PollinationsImageProvider()

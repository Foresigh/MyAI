"""Cloud image generation via OpenAI's Images API (gpt-image-1).

Swap this file for a different vendor (Stability, etc.) without touching
anything else — callers only ever see the ImageProvider interface.
"""

from __future__ import annotations

import base64
import os

import requests

from .provider import GeneratedImage, ImageGenerationRequest, ImageProvider, ImageProviderError

API_BASE = "https://api.openai.com/v1"
MODEL = "gpt-image-1"

# gpt-image-1 only supports these exact sizes; we map our 5 requested aspect
# ratios onto the closest one since the vendor doesn't support arbitrary ratios.
ASPECT_RATIO_TO_SIZE = {
    "1:1": "1024x1024",
    "16:9": "1536x1024",
    "4:3": "1536x1024",
    "9:16": "1024x1536",
    "3:4": "1024x1536",
}

QUALITY_MAP = {
    "standard": "medium",
    "high": "high",
}

STYLE_PROMPT_SUFFIX = {
    "none": "",
    "photorealistic": ", photorealistic, sharp focus, realistic lighting",
    "digital-art": ", digital art, vibrant colors, detailed illustration",
    "illustration": ", hand-drawn illustration style, clean linework",
    "3d-render": ", 3D render, studio lighting, octane render style",
}


class CloudImageProvider(ImageProvider):
    def __init__(self) -> None:
        self.api_key = os.environ.get("IMAGE_API_KEY")

    def _headers(self) -> dict:
        if not self.api_key:
            raise ImageProviderError(
                "Image generation is not configured on this server. Set the IMAGE_API_KEY "
                "environment variable to an OpenAI API key with image access."
            )
        return {"Authorization": f"Bearer {self.api_key}"}

    def generate(self, request: ImageGenerationRequest) -> list[GeneratedImage]:
        size = ASPECT_RATIO_TO_SIZE.get(request.aspect_ratio, "1024x1024")
        quality = QUALITY_MAP.get(request.quality, "medium")
        prompt = request.prompt + STYLE_PROMPT_SUFFIX.get(request.style, "")

        if request.reference_image_b64:
            data = self._edit(prompt, size, request.num_images, request.reference_image_b64)
        else:
            data = self._create(prompt, size, quality, request.num_images)

        return [GeneratedImage(base64_data=item["b64_json"]) for item in data]

    def _create(self, prompt: str, size: str, quality: str, n: int) -> list[dict]:
        try:
            response = requests.post(
                f"{API_BASE}/images/generations",
                headers=self._headers(),
                json={
                    "model": MODEL,
                    "prompt": prompt,
                    "size": size,
                    "quality": quality,
                    "n": n,
                },
                timeout=120,
            )
        except requests.RequestException as exc:
            raise ImageProviderError(f"Could not reach the image provider: {exc}") from exc
        return self._parse(response)

    def _edit(self, prompt: str, size: str, n: int, reference_image_b64: str) -> list[dict]:
        try:
            image_bytes = base64.b64decode(reference_image_b64)
        except Exception as exc:
            raise ImageProviderError("Reference image is not valid base64 data.") from exc

        try:
            response = requests.post(
                f"{API_BASE}/images/edits",
                headers=self._headers(),
                data={"model": MODEL, "prompt": prompt, "size": size, "n": str(n)},
                files={"image": ("reference.png", image_bytes, "image/png")},
                timeout=120,
            )
        except requests.RequestException as exc:
            raise ImageProviderError(f"Could not reach the image provider: {exc}") from exc
        return self._parse(response)

    def _parse(self, response: requests.Response) -> list[dict]:
        if not response.ok:
            detail = response.text
            try:
                detail = response.json().get("error", {}).get("message", detail)
            except ValueError:
                pass
            raise ImageProviderError(f"Image provider returned an error: {detail}")

        try:
            return response.json()["data"]
        except (KeyError, ValueError) as exc:
            raise ImageProviderError("Image provider returned an unexpected response.") from exc

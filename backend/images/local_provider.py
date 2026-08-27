"""Local image generation via Stable Diffusion 1.5, run through diffusers.

EXPERIMENTAL. Not the default provider, and not recommended as one.

Stable Diffusion 1.5 at fp16 is roughly at the edge of what a 4GB-VRAM card
(e.g. a mobile GTX 1650 Ti) can hold at all, even with attention slicing and
sequential CPU offload — generation will be slow and can still run out of
memory depending on what else has the GPU busy (Ollama included, if it's
using the same card). This class is a real, working implementation for
anyone who wants to try it anyway; IMAGE_PROVIDER defaults to "cloud" for a
reason.

Requires optional dependencies not in requirements.txt:
    pip install diffusers torch transformers accelerate safetensors
"""

from __future__ import annotations

import base64
import io
import os

from .provider import GeneratedImage, ImageGenerationRequest, ImageProvider, ImageProviderError

MODEL_ID = os.environ.get("LOCAL_IMAGE_MODEL", "runwayml/stable-diffusion-v1-5")

ASPECT_RATIO_TO_DIMENSIONS = {
    "1:1": (512, 512),
    "16:9": (512, 288),
    "4:3": (512, 384),
    "9:16": (288, 512),
    "3:4": (384, 512),
}

_pipeline = None


def _load_pipeline():
    global _pipeline
    if _pipeline is not None:
        return _pipeline

    try:
        import torch
        from diffusers import StableDiffusionPipeline
    except ImportError as exc:
        raise ImageProviderError(
            "Local image generation requires extra packages that aren't installed. "
            "Run: pip install diffusers torch transformers accelerate safetensors"
        ) from exc

    if not torch.cuda.is_available():
        raise ImageProviderError(
            "No CUDA GPU detected. Local image generation needs a GPU to run in any "
            "reasonable amount of time — set IMAGE_PROVIDER=cloud instead."
        )

    pipeline = StableDiffusionPipeline.from_pretrained(MODEL_ID, torch_dtype=torch.float16)
    pipeline = pipeline.to("cuda")
    pipeline.enable_attention_slicing()
    _pipeline = pipeline
    return _pipeline


class LocalImageProvider(ImageProvider):
    def generate(self, request: ImageGenerationRequest) -> list[GeneratedImage]:
        pipeline = _load_pipeline()
        width, height = ASPECT_RATIO_TO_DIMENSIONS.get(request.aspect_ratio, (512, 512))
        # Round to multiples of 8, required by the model's VAE.
        width, height = width - (width % 8), height - (height % 8)

        try:
            import torch

            with torch.inference_mode():
                result = pipeline(
                    prompt=request.prompt,
                    width=width,
                    height=height,
                    num_images_per_prompt=request.num_images,
                    num_inference_steps=25,
                )
        except Exception as exc:  # torch.cuda.OutOfMemoryError etc.
            raise ImageProviderError(
                f"Local generation failed (often means out of GPU memory): {exc}"
            ) from exc

        images = []
        for pil_image in result.images:
            buffer = io.BytesIO()
            pil_image.save(buffer, format="PNG")
            images.append(GeneratedImage(base64_data=base64.b64encode(buffer.getvalue()).decode()))
        return images

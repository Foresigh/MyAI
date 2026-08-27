"""Local video generation: not implemented, deliberately.

Even the lightest usable open video models (e.g. Stable Video Diffusion,
AnimateDiff) need roughly 10-16GB of VRAM to run at all, and multiples of
that to run in reasonable time. A 4GB mobile GPU isn't in range — not "slow",
genuinely not able to load the model. Rather than download several GB of
weights that can't run, or fake a result, this provider reports that clearly.

If you later run this on a machine with a real GPU (12GB+ VRAM), this is
where a diffusers-based AnimateDiff/SVD pipeline would go, mirroring the
pattern in images/local_provider.py.
"""

from __future__ import annotations

from .provider import VideoGenerationRequest, VideoJob, VideoProvider, VideoProviderError


class LocalVideoProvider(VideoProvider):
    def start(self, request: VideoGenerationRequest) -> VideoJob:
        raise VideoProviderError(
            "Local video generation isn't practical on this machine's GPU (4GB VRAM is well "
            "under what even lightweight video models need, ~10GB+). Set VIDEO_PROVIDER=cloud "
            "and configure VIDEO_API_KEY instead, or run this on a machine with a larger GPU."
        )

    def poll(self, job_id: str) -> VideoJob:
        raise VideoProviderError("Local video generation is not available.")

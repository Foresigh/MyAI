"""Where Arvo keeps data that must survive redeploys (plan grants, videos).

Railway gives each deploy a fresh, empty disk, so anything written next to
the code is lost on every update. Attach a Railway volume to the backend
service and Railway sets RAILWAY_VOLUME_MOUNT_PATH automatically; Arvo then
stores its data there. ARVO_DATA_DIR overrides the location.
"""

import json
import logging
import os
import tempfile

logger = logging.getLogger("arvo.storage")

_LOCAL_DIR = os.path.join(os.path.dirname(__file__), "data")


def data_dir() -> str:
    path = os.environ.get("ARVO_DATA_DIR") or os.environ.get("RAILWAY_VOLUME_MOUNT_PATH") or _LOCAL_DIR
    os.makedirs(path, exist_ok=True)
    return path


def is_persistent() -> bool:
    """True when data lives somewhere that survives redeploys."""
    return bool(os.environ.get("ARVO_DATA_DIR") or os.environ.get("RAILWAY_VOLUME_MOUNT_PATH"))


def on_railway() -> bool:
    return bool(os.environ.get("RAILWAY_ENVIRONMENT") or os.environ.get("RAILWAY_PROJECT_ID"))


def write_json_atomic(path: str, value) -> None:
    """Write JSON so a crash mid-write can never leave a half-written file."""
    directory = os.path.dirname(path)
    os.makedirs(directory, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=directory, prefix=".tmp-", suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(value, f, indent=2)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    except BaseException:
        try:
            os.remove(tmp)
        except OSError:
            pass
        raise


def warn_if_temporary() -> None:
    if on_railway() and not is_persistent():
        logger.warning(
            "Arvo is saving plan grants and videos to temporary storage, so they will be "
            "erased on the next deploy. Attach a Railway volume to the backend service to keep them."
        )

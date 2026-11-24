export const MAX_IMAGES_PER_MESSAGE = 3;
const MAX_INPUT_BYTES = 20_000_000;
const MAX_SIDE = 1280;
const THUMB_SIDE = 160;

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export function isImageFile(file: File): boolean {
  return IMAGE_TYPES.includes(file.type);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`${file.name} couldn't be read as a picture.`));
    };
    img.src = url;
  });
}

function toJpeg(img: HTMLImageElement, maxSide: number, quality: number): string {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser couldn't process this picture.");
  // JPEG has no transparency, so paint a white background first.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

/**
 * Shrinks a picture so it uploads quickly and stays under the model's limits.
 * Returns the picture to send, plus a small thumbnail that is kept in chat history.
 */
export async function readImageAttachment(file: File): Promise<{ dataUrl: string; thumbUrl: string }> {
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error(`${file.name} is too large (limit 20MB).`);
  }
  const img = await loadImage(file);
  return {
    dataUrl: toJpeg(img, MAX_SIDE, 0.85),
    thumbUrl: toJpeg(img, THUMB_SIDE, 0.7),
  };
}

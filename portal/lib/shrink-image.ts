import { MAX_IMAGE_SIDE } from "@/lib/images";

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

/**
 * Shrinks a picture in the browser before upload: at most 1600 px on its longest side, saved as
 * WebP (or JPEG where the browser can't write WebP). Re-drawing it also drops hidden details such
 * as the phone's location. Throws if the browser can't read the file (for example some HEIC photos).
 */
export async function shrinkImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  let blob = await toBlob(canvas, "image/webp", 0.82);
  if (!blob || blob.type !== "image/webp") {
    // JPEG has no transparency: paint white behind the picture first.
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    blob = await toBlob(canvas, "image/jpeg", 0.85);
  }
  bitmap.close();
  if (!blob) throw new Error("Couldn't encode");
  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  return new File([blob], `picture.${ext}`, { type: blob.type });
}

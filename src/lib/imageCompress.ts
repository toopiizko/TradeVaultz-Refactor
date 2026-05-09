// Client-side image compression for slip uploads.
// Targets ~1600px longest edge, JPEG quality 0.8, returns a Blob (+ ext).
// Falls back to original if compression fails or makes it bigger.

export type Compressed = { blob: Blob; ext: string; width: number; height: number; bytes: number };

const MAX_EDGE = 1600;
const QUALITY = 0.8;

export async function compressImageBlob(input: Blob, opts?: { maxEdge?: number; quality?: number }): Promise<Compressed> {
  const maxEdge = opts?.maxEdge ?? MAX_EDGE;
  const quality = opts?.quality ?? QUALITY;
  try {
    const bitmap = await blobToBitmap(input);
    const { width: w0, height: h0 } = bitmap;
    const scale = Math.min(1, maxEdge / Math.max(w0, h0));
    const w = Math.round(w0 * scale);
    const h = Math.round(h0 * scale);

    const canvas = typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(w, h)
      : Object.assign(document.createElement("canvas"), { width: w, height: h });
    // @ts-ignore
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d ctx");
    // @ts-ignore
    ctx.drawImage(bitmap, 0, 0, w, h);
    // @ts-ignore
    bitmap.close?.();

    const out: Blob = "convertToBlob" in canvas
      // @ts-ignore
      ? await canvas.convertToBlob({ type: "image/jpeg", quality })
      : await new Promise<Blob>((res, rej) => (canvas as HTMLCanvasElement).toBlob(b => b ? res(b) : rej(new Error("toBlob failed")), "image/jpeg", quality));

    if (out.size >= input.size && /jpe?g/i.test(input.type)) {
      return { blob: input, ext: extFromType(input.type), width: w0, height: h0, bytes: input.size };
    }
    return { blob: out, ext: "jpg", width: w, height: h, bytes: out.size };
  } catch (e) {
    console.warn("compressImage failed, using original", e);
    return { blob: input, ext: extFromType(input.type) || "jpg", width: 0, height: 0, bytes: input.size };
  }
}

export async function compressDataUrl(dataUrl: string, opts?: { maxEdge?: number; quality?: number }): Promise<Compressed> {
  const blob = dataUrlToBlobRaw(dataUrl);
  return compressImageBlob(blob, opts);
}

function extFromType(type: string): string {
  const t = (type || "").toLowerCase();
  if (t.includes("png")) return "png";
  if (t.includes("webp")) return "webp";
  if (t.includes("heic")) return "heic";
  return "jpg";
}

function dataUrlToBlobRaw(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(",");
  const mime = /data:(.*?);base64/.exec(meta)?.[1] || "image/jpeg";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

async function blobToBitmap(blob: Blob): Promise<ImageBitmap> {
  if (typeof createImageBitmap === "function") {
    try { return await createImageBitmap(blob); } catch { /* fallback */ }
  }
  // Fallback via HTMLImageElement
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    // Wrap into a bitmap-like via canvas
    // @ts-ignore
    return img as unknown as ImageBitmap;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

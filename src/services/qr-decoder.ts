import jsQR from "jsqr";

export interface DecodeResult {
  content: string;
  type: "url" | "email" | "phone" | "wifi" | "text" | "geo" | "other";
  extractedUrl: string | null;
}

const URL_REGEX = /https?:\/\/[^\s<>"']+|www\.[^\s<>"']+/i;
const EMAIL_REGEX = /^mailto:(.+@.+\..+)/i;
const PHONE_REGEX = /^tel:\+(.+)/i;
const WIFI_REGEX = /^WIFI:/i;
const GEO_REGEX = /^geo:(.+)/i;

function detectType(content: string): DecodeResult["type"] {
  if (URL_REGEX.test(content)) return "url";
  if (EMAIL_REGEX.test(content)) return "email";
  if (PHONE_REGEX.test(content)) return "phone";
  if (WIFI_REGEX.test(content)) return "wifi";
  if (GEO_REGEX.test(content)) return "geo";
  return "text";
}

function extractUrl(content: string): string | null {
  const match = content.match(URL_REGEX);
  return match ? match[0] : null;
}

export function decodeFromImageData(
  imageData: ImageData,
): DecodeResult | null {
  const code = jsQR(imageData.data, imageData.width, imageData.height);
  if (!code) return null;

  const content = code.data;
  const type = detectType(content);
  const extractedUrl = extractUrl(content);

  return { content, type, extractedUrl };
}

export function decodeFromCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): DecodeResult | null {
  const context = canvas.getContext("2d");
  if (!context) return null;

  const imageData = context.getImageData(0, 0, width, height);
  return decodeFromImageData(imageData);
}

export async function decodeFromFile(file: File): Promise<DecodeResult | null> {
  let bitmap: ImageBitmap | null = null;
  let image: HTMLImageElement | null = null;
  let objectUrl: string | null = null;

  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return null;

    if ("createImageBitmap" in window) {
      bitmap = await createImageBitmap(file);
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      context.drawImage(bitmap, 0, 0);
    } else {
      objectUrl = URL.createObjectURL(file);
      image = new Image();
      await new Promise<void>((resolve, reject) => {
        image!.onload = () => resolve();
        image!.onerror = () => reject(new Error("Failed to load image"));
        image!.src = objectUrl!;
      });
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      context.drawImage(image, 0, 0);
    }

    return decodeFromCanvas(canvas, canvas.width, canvas.height);
  } catch {
    return null;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    bitmap?.close();
  }
}

export function normalizeUrl(raw: string): string {
  let url = raw.trim();

  if (!/^https?:\/\//i.test(url)) {
    url = "https://" + url;
  }

  url = url.replace(/\/+$/, "");

  try {
    const parsed = new URL(url);
    parsed.hostname = parsed.hostname.toLowerCase();
    return parsed.toString();
  } catch {
    return url;
  }
}

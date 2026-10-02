const MAX_OBJECT_URLS = 8;
const DATA_URL = /^data:([^;,]*)((?:;[^;,]*)*?)(;base64)?,/i;

const objectUrls = new Map<string, string>();

function decodeDataUrl(dataUrl: string): Blob | null {
  const header = DATA_URL.exec(dataUrl);
  if (!header) return null;
  const body = dataUrl.slice(header[0].length);
  const type = header[1] || "application/octet-stream";
  if (!header[3]) return new Blob([decodeURIComponent(body)], { type });
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

function canCreateObjectUrls(): boolean {
  return typeof URL !== "undefined" && typeof URL.createObjectURL === "function" && typeof Blob === "function";
}

export function objectUrlFor(url: string): string {
  if (!url.startsWith("data:") || !canCreateObjectUrls()) return url;
  const cached = objectUrls.get(url);
  if (cached) {
    objectUrls.delete(url);
    objectUrls.set(url, cached);
    return cached;
  }
  let blob: Blob | null;
  try {
    blob = decodeDataUrl(url);
  } catch {
    blob = null;
  }
  if (!blob) return url;
  const objectUrl = URL.createObjectURL(blob);
  objectUrls.set(url, objectUrl);
  while (objectUrls.size > MAX_OBJECT_URLS) {
    const [oldest, stale] = objectUrls.entries().next().value ?? [];
    if (oldest === undefined || stale === undefined) break;
    objectUrls.delete(oldest);
    URL.revokeObjectURL(stale);
  }
  return objectUrl;
}

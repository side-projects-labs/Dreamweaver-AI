export type SharedGenerateResult = {
  story: string;
  scene: string;
  imageUrl: string | null;
  imageError?: string;
  imageStatus?: number;
};

export type SharedStoryBook = {
  heroName: string;
  friendName: string;
  setting: string;
  moral: string;
  style: string;
  withImage: boolean;
  result: SharedGenerateResult;
  createdAt: string;
  viewCount?: number;
};

const SHARE_PREFIX = "storybook:share:";
const LAST_SHARE_ID_KEY = "storybook:share:last";

function isBrowser() {
  return typeof window !== "undefined";
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function createShareId(payload: SharedStoryBook) {
  const source = JSON.stringify(payload) + Date.now() + Math.random();
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(source)
  );
  return toHex(hash).slice(0, 20);
}

export function getSharedStoryFromLocal(id: string) {
  if (!isBrowser()) return null;
  const raw = localStorage.getItem(`${SHARE_PREFIX}${id}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SharedStoryBook;
  } catch {
    return null;
  }
}

export function getLastSharedId() {
  if (!isBrowser()) return null;
  return localStorage.getItem(LAST_SHARE_ID_KEY);
}

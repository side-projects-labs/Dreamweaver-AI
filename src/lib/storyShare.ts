import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
};

const SHARE_PREFIX = "storybook:share:";
const LAST_SHARE_ID_KEY = "storybook:share:last";

function isBrowser() {
  return typeof window !== "undefined";
}

let browserSupabase: SupabaseClient | null = null;

function getSupabaseClient() {
  if (!isBrowser()) throw new Error("브라우저 환경에서만 사용할 수 있습니다.");
  if (browserSupabase) return browserSupabase;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 설정이 필요합니다."
    );
  }
  browserSupabase = createClient(url, anonKey);
  return browserSupabase;
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

function dataUrlToBlob(dataUrl: string) {
  const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
  if (!match) return null;
  const mimeType = match[1] || "image/png";
  const base64 = match[2] || "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

function getFileExtFromMime(mimeType: string) {
  if (mimeType.includes("jpeg")) return "jpg";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("gif")) return "gif";
  return "png";
}

async function uploadShareImage(id: string, imageUrl: string) {
  const supabase = getSupabaseClient();
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }
  if (!imageUrl.startsWith("data:")) return null;
  const blob = dataUrlToBlob(imageUrl);
  if (!blob) return null;
  const ext = getFileExtFromMime(blob.type || "image/png");
  const path = `shares/${id}.${ext}`;
  const { error } = await supabase.storage
    .from("storybook-images")
    .upload(path, blob, {
      upsert: true,
      contentType: blob.type || "image/png",
    });
  if (error) throw new Error(`이미지 업로드 실패: ${error.message}`);
  const { data } = supabase.storage.from("storybook-images").getPublicUrl(path);
  return data.publicUrl;
}

export async function saveSharedStory(id: string, payload: SharedStoryBook) {
  const supabase = getSupabaseClient();
  const uploadedImageUrl = payload.result.imageUrl
    ? await uploadShareImage(id, payload.result.imageUrl)
    : null;

  const title =
    payload.result.story
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0)
      ?.replace(/^\*\*|\*\*$/g, "")
      ?.replace(/^#+\s*/, "")
      ?.trim() || "나만의 그림책";

  const { error } = await supabase.from("storybook_shares").upsert({
    id,
    title,
    hero_name: payload.heroName,
    friend_name: payload.friendName,
    setting: payload.setting,
    moral: payload.moral,
    style: payload.style,
    story: payload.result.story,
    image_url: uploadedImageUrl,
    image_error: payload.result.imageError ?? null,
    is_public: true,
  });
  if (error) {
    throw new Error(`공유 저장 실패: ${error.message}`);
  }

  if (!isBrowser()) return;
  localStorage.setItem(LAST_SHARE_ID_KEY, id);
}

export async function getSharedStory(id: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("storybook_shares")
    .select(
      "id, created_at, hero_name, friend_name, setting, moral, style, story, image_url, image_error"
    )
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return {
    heroName: data.hero_name ?? "",
    friendName: data.friend_name ?? "",
    setting: data.setting ?? "",
    moral: data.moral ?? "",
    style: data.style ?? "",
    withImage: Boolean(data.image_url),
    result: {
      story: data.story ?? "",
      scene: "",
      imageUrl: data.image_url ?? null,
      imageError: data.image_error ?? undefined,
    },
    createdAt: data.created_at ?? new Date().toISOString(),
  } as SharedStoryBook;
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

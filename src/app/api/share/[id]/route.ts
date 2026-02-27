import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabaseReadClient() {
  const key = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_ANON_KEY 설정이 필요합니다.");
  }
  return createClient(SUPABASE_URL, key);
}

function getSupabaseWriteClient() {
  const key = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !key) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 설정이 필요합니다."
    );
  }
  return createClient(SUPABASE_URL, key);
}

async function incrementViewCount(
  client: ReturnType<typeof getSupabaseWriteClient>,
  id: string,
  current: number
) {
  const { error: rpcError } = await client.rpc("increment_share_view_count", {
    share_id: id,
  });
  if (!rpcError) return true;

  const { error: updateError } = await client
    .from("storybook_shares")
    .update({ view_count: current + 1 })
    .eq("id", id);
  return !updateError;
}

async function dataUrlToBlob(dataUrl: string) {
  const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
  if (!match) return null;
  const mimeType = match[1] || "image/png";
  const base64 = match[2] || "";
  const buffer = Buffer.from(base64, "base64");
  return { buffer, mimeType };
}

function getFileExtFromMime(mimeType: string) {
  if (mimeType.includes("jpeg")) return "jpg";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("gif")) return "gif";
  return "png";
}

async function uploadShareImage(
  client: ReturnType<typeof getSupabaseWriteClient>,
  id: string,
  imageUrl: string
) {
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }
  if (!imageUrl.startsWith("data:")) return null;

  const blob = await dataUrlToBlob(imageUrl);
  if (!blob) return null;
  const ext = getFileExtFromMime(blob.mimeType || "image/png");
  const path = `shares/${id}.${ext}`;

  const { error } = await client.storage
    .from("storybook-images")
    .upload(path, blob.buffer, {
      upsert: true,
      contentType: blob.mimeType || "image/png",
    });
  if (error) throw new Error(`이미지 업로드 실패: ${error.message}`);
  const { data } = client.storage.from("storybook-images").getPublicUrl(path);
  return data.publicUrl;
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseWriteClient();
    const payload = (await req.json()) as {
      id: string;
      heroName: string;
      friendName: string;
      setting: string;
      moral: string;
      style: string;
      withImage: boolean;
      result: {
        story: string;
        imageUrl: string | null;
        imageError?: string;
      };
      createdAt: string;
    };

    const uploadedImageUrl = payload.result.imageUrl
      ? await uploadShareImage(supabase, payload.id, payload.result.imageUrl)
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
      id: payload.id,
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

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabaseRead = getSupabaseReadClient();
    const { data, error } = await supabaseRead
      .from("storybook_shares")
      .select(
        "id, created_at, hero_name, friend_name, setting, moral, style, story, image_url, image_error, view_count"
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const viewCount = typeof data.view_count === "number" ? data.view_count : 0;
    const supabaseWrite = getSupabaseWriteClient();
    const didIncrement = await incrementViewCount(supabaseWrite, id, viewCount);

    return NextResponse.json(
      {
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
        viewCount: didIncrement ? viewCount + 1 : viewCount,
      },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

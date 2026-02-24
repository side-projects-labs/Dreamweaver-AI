import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { z } from "zod";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function softTimeout<T>(promise: Promise<T>, ms: number): Promise<{ timedOut: boolean; value?: T }> {
  return Promise.race([
    promise.then((value) => ({ timedOut: false, value })),
    sleep(ms).then(() => ({ timedOut: true })),
  ]);
}

type HfImageFetchResult = { url: string | null; status?: number; error?: string };

async function fetchHuggingFaceImage(
  model: string,
  prompt: string,
  token: string,
  timeoutMs: number,
  attempts: number,
  backoffMs: number,
): Promise<HfImageFetchResult> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(`https://api-inference.huggingface.co/models/${model}?wait_for_model=true`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: prompt }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (resp.ok) {
        const arrayBuffer = await resp.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        return { url: `data:image/png;base64,${base64}`, status: resp.status };
      }
      // Retry on common transient statuses
      if ([502, 503, 504].includes(resp.status)) {
        const delay = backoffMs * Math.pow(2, attempt);
        await sleep(delay);
        continue;
      }
      // Non-retryable error → capture brief text
      const text = await resp.text().catch(() => "");
      return { url: null, status: resp.status, error: text?.slice(0, 500) };
    } catch (e: unknown) {
      const error = e as Error;
      clearTimeout(timeout);
      // Retry on timeout/AbortError or network errors
      const name = e?.name || "";
      if (name === "AbortError" || name === "TimeoutError") {
        const delay = backoffMs * Math.pow(2, attempt);
        await sleep(delay);
        continue;
      }
      return { url: null, error: e?.message };
    }
  }
  return { url: null, error: "Max attempts reached" };
}

const bodySchema = z.object({
  heroName: z.string().min(1),
  friendName: z.string().min(1),
  setting: z.string().min(1),
  moral: z.string().min(1),
  style: z.string().min(1),
  withImage: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const input = bodySchema.parse(json);

    const imageProvider = (process.env.IMAGE_PROVIDER || "hf").toLowerCase();

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const systemPrompt = `You are a children\'s story author. Create a short fairy tale (3-4 paragraphs) for kids. It must be heartwarming, simple Korean, and include a clear lesson.`;
    const userPrompt = `주인공: ${input.heroName}\n친구: ${input.friendName}\n배경: ${input.setting}\n교훈: ${input.moral}\n조건: 3~4문단, 제목 포함, 한국어.`;

    let story = "";
    if (!groq || !groq.apiKey) {
        return NextResponse.json({ error: "Missing GROQ_API_KEY" }, { status: 500 });
    }
    const storyResp = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.8,
    });
    story = storyResp.choices?.[0]?.message?.content?.trim() ?? "";
    if (!story) {
      return NextResponse.json({ error: "Failed to generate story" }, { status: 500 });
    }

    const sceneSummaryPrompt = `다음 동화에서 가장 핵심적인 한 장면을 1~2문장으로 간결하게 묘사해줘. 인물, 배경, 분위기를 포함하고, 한국어로 출력.\n\n동화:\n${story}`;
    let scene = "";
    const sceneResp = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "장면 요약가" },
        { role: "user", content: sceneSummaryPrompt },
      ],
      temperature: 0.7,
    });
    scene = sceneResp.choices?.[0]?.message?.content?.trim() ?? "";

    let imageUrl: string | null = null;
    let imageStatus: number | undefined;
    let imageError: string | undefined;
    const imageEnabled = typeof input.withImage === "boolean" ? input.withImage : process.env.ENABLE_IMAGE !== "false";
    if (imageEnabled) {
      try {
        const imagePrompt = `${scene}\n스타일: ${input.style}. 어린이를 위한 따뜻하고 안전한 표현.`;

        if (imageProvider === "hf") {
          const hfToken = process.env.HF_API_TOKEN;
          if (!hfToken) {
            imageUrl = null;
          } else {
            const model = process.env.HF_IMAGE_MODEL || "stabilityai/stable-diffusion-2";
            const timeoutMs = 120000;
            const attempts = 3;
            const backoffMs = 10000;
            const softMs = 100000;

            const result = await softTimeout(
              fetchHuggingFaceImage(
                model,
                imagePrompt,
                hfToken,
                timeoutMs,
                attempts,
                backoffMs,
              ),
              softMs,
            );
            if (result.timedOut) {
              imageUrl = null;
              imageError = "soft-timeout";
            } else {
              const { url, status, error } = result.value as HfImageFetchResult;
              imageUrl = url;
              imageStatus = status;
              imageError = error;
            }
          }
        } else {
          imageUrl = null;
        }
      } catch (e: any) {
        imageUrl = null;
        imageError = e?.message;
      }
    }

    return NextResponse.json({ story, scene, imageUrl, imageStatus, imageError });
  } catch (err: any) {
    const status = err?.status ?? err?.response?.status ?? 400;
    let message = err?.message ?? "Unknown error";

    // 친절한 429 메시지
    if (status === 429 || /quota/i.test(message)) {
      message = "요청이 거부되었습니다(429). OpenAI 요금제/결제 또는 사용 한도를 확인해주세요. https://platform.openai.com/settings/organization/usage 와 https://platform.openai.com/settings/organization/billing 를 확인하세요.";
      const headers = new Headers();
      headers.set("Retry-After", "60");
      return new NextResponse(JSON.stringify({ error: message }), { status: 429, headers });
    }

    return NextResponse.json({ error: message }, { status });
  }
}



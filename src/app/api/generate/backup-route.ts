import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function softTimeout<T>(
  promise: Promise<T>,
  ms: number
): Promise<{ timedOut: boolean; value?: T }> {
  return Promise.race([
    promise.then((value) => ({ timedOut: false, value })),
    sleep(ms).then(() => ({ timedOut: true })),
  ]);
}

type GeminiCandidate = {
  content?: {
    parts?: Array<{ text?: string }>;
  };
};

type GeminiGenerateResponse = {
  candidates?: GeminiCandidate[];
  error?: {
    message?: string;
  };
};

async function fetchGeminiText(
  model: string,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userPrompt }],
          },
        ],
      }),
    }
  );

  const json = (await resp.json().catch(() => ({}))) as GeminiGenerateResponse;
  if (!resp.ok) {
    throw new Error(json.error?.message || "Gemini text request failed");
  }
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .map((part) => part.text)
    .filter(Boolean)
    .join("\n")
    .trim();
  return text;
}

type ImageResult = { imageUrl: string | null; error?: string };

async function fetchGeminiImage(
  model: string,
  prompt: string,
  apiKey: string
): Promise<ImageResult> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelClient = genAI.getGenerativeModel({ model });
    const result = await modelClient.generateContent([
      {
        text: prompt,
      },
    ]);
    const response = result.response;
    const rawText =
      typeof response.text === "function" ? response.text() : response.text;
    const text = (rawText || "").trim();
    if (!text) {
      return { imageUrl: null, error: "Missing image output" };
    }

    let imageUrl = text.replace(/^"|"$/g, "").trim();
    if (!/^data:|^https?:\/\//.test(imageUrl)) {
      const looksBase64 = /^[A-Za-z0-9+/=]+$/.test(imageUrl);
      if (looksBase64) {
        imageUrl = `data:image/png;base64,${imageUrl}`;
      }
    }

    return { imageUrl };
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    return { imageUrl: null, error: error.message };
  }
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

    const geminiApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    const textModel = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
    const imageModel =
      process.env.GEMINI_IMAGE_MODEL || "gemini-2.0-flash-exp-image-generation";

    const systemPrompt = `You are a children\'s story author. Create a short fairy tale (3-4 paragraphs) for kids. It must be heartwarming, simple Korean, and include a clear lesson.`;
    const userPrompt = `주인공: ${input.heroName}\n친구: ${input.friendName}\n배경: ${input.setting}\n교훈: ${input.moral}\n조건: 3~4문단, 제목 포함, 한국어.`;

    if (!geminiApiKey) {
      return NextResponse.json(
        { error: "Missing NEXT_PUBLIC_GEMINI_API_KEY" },
        { status: 500 }
      );
    }
    const story = await fetchGeminiText(
      textModel,
      geminiApiKey,
      systemPrompt,
      userPrompt
    );
    if (!story) {
      return NextResponse.json(
        { error: "Failed to generate story" },
        { status: 500 }
      );
    }

    const sceneSummaryPrompt = `다음 동화에서 가장 핵심적인 한 장면을 1~2문장으로 간결하게 묘사해줘. 인물, 배경, 분위기를 포함하고, 한국어로 출력.\n\n동화:\n${story}`;
    const scene = await fetchGeminiText(
      textModel,
      geminiApiKey,
      "장면 요약가",
      sceneSummaryPrompt
    );

    let imageUrl: string | null = null;
    let imageError: string | undefined;
    const imageEnabled =
      typeof input.withImage === "boolean"
        ? input.withImage
        : process.env.ENABLE_IMAGE !== "false";
    if (imageEnabled) {
      try {
        const imagePrompt = `${scene}\n스타일: ${input.style}. 어린이를 위한 따뜻하고 안전한 표현.`;

        const timeoutMs = Number(process.env.IMAGE_TIMEOUT_MS) || 120000;
        const softMs = Math.min(timeoutMs, 100000);

        const result = await softTimeout(
          fetchGeminiImage(imageModel, imagePrompt, geminiApiKey),
          softMs
        );

        if (result.timedOut) {
          imageUrl = null;
          imageError = "soft-timeout";
        } else {
          const { imageUrl: url, error } = (result.value ?? {}) as ImageResult;
          imageUrl = url;
          imageError = error;
        }
      } catch (e: unknown) {
        const error = e instanceof Error ? e : new Error(String(e));
        imageUrl = null;
        imageError = error.message;
      }
    }

    return NextResponse.json({
      story,
      scene,
      imageUrl,
      imageError,
    });
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    const withStatus = e as { status?: number; response?: { status?: number } };
    const status = withStatus?.status ?? withStatus?.response?.status ?? 400;
    let message = error.message;

    // 친절한 429 메시지
    if (status === 429 || /quota/i.test(message)) {
      message =
        "요청이 거부되었습니다(429). Gemini 사용 한도/결제를 확인해주세요. https://aistudio.google.com/app/usage 와 https://aistudio.google.com/app/billing 를 확인하세요.";
      const headers = new Headers();
      headers.set("Retry-After", "60");
      return new NextResponse(JSON.stringify({ error: message }), {
        status: 429,
        headers,
      });
    }

    return NextResponse.json({ error: message }, { status });
  }
}

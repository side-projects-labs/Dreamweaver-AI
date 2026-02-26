import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  heroName: z.string().min(1),
  friendName: z.string().min(1),
  setting: z.string().min(1),
  moral: z.string().min(1),
  style: z.string().min(1),
  withImage: z.boolean().optional(),
});

type OpenAIImageResponse = {
  data?: Array<{
    b64_json?: string;
    url?: string;
  }>;
  error?: {
    message?: string;
  };
};

type GroqStreamChunk = {
  choices?: Array<{
    delta?: {
      content?: string;
    };
  }>;
};

function sanitizeKoreanText(input: string) {
  return input.replace(
    /[^\u1100-\u11FF\u3130-\u318F\uAC00-\uD7A30-9\s.,!?'"~:;()\-\n]/g,
    ""
  );
}

async function generateOpenAIImage(
  model: string,
  prompt: string,
  apiKey: string,
  options?: {
    timeoutMs?: number;
    onProgress?: (info: { elapsedMs: number }) => void;
  }
): Promise<{ imageUrl: string | null; error?: string }> {
  const controller = new AbortController();
  const timeoutMs = options?.timeoutMs ?? 180000;
  const startedAt = Date.now();
  const progressTimer = options?.onProgress
    ? setInterval(() => {
        options.onProgress?.({ elapsedMs: Date.now() - startedAt });
      }, 1000)
    : null;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt,
        size: process.env.OPENAI_IMAGE_SIZE || "1024x1024",
        quality: "low",
        n: 1,
      }),
      signal: controller.signal,
    });

    const json = (await resp.json().catch(() => ({}))) as OpenAIImageResponse;
    if (!resp.ok) {
      return {
        imageUrl: null,
        error: json.error?.message || "OpenAI image generation failed",
      };
    }
    const image = json.data?.[0]?.b64_json;
    if (!image) {
      const imageUrl = json.data?.[0]?.url ?? null;
      if (imageUrl) {
        return { imageUrl };
      }
      return { imageUrl: null, error: "Missing image output from OpenAI" };
    }

    return { imageUrl: `data:image/png;base64,${image}` };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    const cause = (err as { cause?: { code?: string; message?: string } })
      .cause;
    const detail = cause?.code || cause?.message;
    const base = detail ? `${err.message} (${detail})` : err.message;
    return {
      imageUrl: null,
      error: base,
    };
  } finally {
    clearTimeout(timeout);
    if (progressTimer) clearInterval(progressTimer);
  }
}

export async function POST(req: Request) {
  const json = await req.json();
  const input = bodySchema.parse(json);

  const systemPrompt = `당신은 어린이 동화책 전문 한국어 작가입니다.
반드시 한국어(한글)로만 작성하세요.
다른 언어(영어, 일본어, 중국어, 러시아어 등) 단어/문장을 절대 쓰지 마세요.
깨진 문자, 의미 없는 기호, 임의의 외국어 음절을 절대 출력하지 마세요.
허용 문자는 한글, 숫자, 공백, 줄바꿈, 기본 문장부호(.,!?'"~:;()-)만 사용하세요.
출력은 제목 1개 + 본문 3~4문단으로 구성하세요.
각 문단은 2~4문장으로 구성하고 문단 사이에는 한 줄 공백을 넣으세요.
문체는 쉽고 따뜻하며 어린이가 이해하기 쉬워야 합니다.
잔인함, 공포, 폭력, 혐오 요소는 금지합니다.
마지막 문단에서 교훈이 자연스럽게 드러나야 합니다.
한국어 외 표현이 필요하면 한국어로 풀어써서 대체하세요.`;
  const userPrompt = `아래 조건으로 동화책 본문을 작성해 주세요.
주인공: ${input.heroName}
친구: ${input.friendName}
배경: ${input.setting}
교훈: ${input.moral}
스타일: ${input.style}

출력 규칙:
1) 한국어(한글)로만 작성
2) 제목 1줄 + 본문 3~4문단
3) 각 문단 2~4문장
4) 문단 사이 빈 줄
5) 대사 1~2줄 포함`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        send("start", { ok: true });
        const groqApiKey = process.env.GROQ_API_KEY;
        if (!groqApiKey) {
          throw new Error("GROQ_API_KEY is missing");
        }

        const groqResponse = await fetch(
          "https://api.groq.com/openai/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${groqApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
              messages: [
                {
                  role: "system",
                  content: systemPrompt,
                },
                {
                  role: "user",
                  content: userPrompt,
                },
              ],
              temperature: 0.2,
              stream: true,
            }),
          }
        );

        if (!groqResponse.ok) {
          const detail = await groqResponse
            .text()
            .catch(() => "Failed to read Groq error body");
          throw new Error(
            `Groq request failed: ${groqResponse.status} ${detail}`
          );
        }
        if (!groqResponse.body) {
          throw new Error("Groq streaming response body is empty");
        }

        const reader = groqResponse.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let story = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;

            const data = trimmed.slice(5).trim();
            if (!data || data === "[DONE]") continue;

            try {
              const chunk = JSON.parse(data) as GroqStreamChunk;
              const rawDelta = chunk.choices?.[0]?.delta?.content ?? "";
              const delta = sanitizeKoreanText(rawDelta);
              if (!delta.trim()) continue;

              story += delta;
              send("story_delta", { delta });
            } catch {
              continue;
            }
          }
        }

        const tail = buffer.trim();
        if (tail.startsWith("data:")) {
          const data = tail.slice(5).trim();
          if (data && data !== "[DONE]") {
            try {
              const chunk = JSON.parse(data) as GroqStreamChunk;
              const rawDelta = chunk.choices?.[0]?.delta?.content ?? "";
              const delta = sanitizeKoreanText(rawDelta);
              if (delta.trim()) {
                story += delta;
                send("story_delta", { delta });
              }
            } catch {
              // ignore trailing parse errors
            }
          }
        }

        send("story_done", { story });

        const imageEnabled = Boolean(input.withImage);
        if (imageEnabled) {
          send("image_start", { ok: true });
          const openAiApiKey = process.env.OPENAI_API_KEY;
          if (!openAiApiKey) {
            throw new Error("OPENAI_API_KEY is missing");
          }
          const imageModel = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
          const imagePrompt = `storybook illustration, ${input.setting}, 주인공 ${input.heroName}와 친구 ${input.friendName}, ${input.style}, 따뜻하고 부드러운 색감, 어린이용`;
          const imageTimeoutMs = Number(
            process.env.OPENAI_IMAGE_TIMEOUT_MS ||
              process.env.IMAGE_TIMEOUT_MS ||
              180000
          );

          const { imageUrl, error } = await generateOpenAIImage(
            imageModel,
            imagePrompt,
            openAiApiKey,
            {
              timeoutMs: imageTimeoutMs,
              onProgress: ({ elapsedMs }) => {
                send("image_progress", { elapsedMs });
              },
            }
          );
          send("image_done", { imageUrl, imageError: error });
        }

        send("done", { ok: true });
      } catch (error) {
        console.error("Generation Error:", error);
        const message =
          error instanceof Error ? error.message : "Unknown error";
        send("error", { message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

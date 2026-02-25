import ollama from "ollama";
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

type OllamaImageResponse = {
  image?: string;
  response?: string;
  error?: string;
};

function normalizeOllamaHost(host: string) {
  const cleaned = host.trim();
  if (cleaned.startsWith("0.0.0.0")) {
    host = cleaned.replace(/^0\.0\.0\.0/, "127.0.0.1");
  } else {
    host = cleaned;
  }
  const withoutScheme = host.replace(/^https?:\/\//i, "");
  if (!/:\d+$/.test(withoutScheme)) {
    host = `${withoutScheme}:11434`;
  }
  if (!/^https?:\/\//i.test(host)) {
    return `http://${host}`;
  }
  return host;
}

async function generateOllamaImage(
  model: string,
  prompt: string,
  host: string,
  options?: {
    timeoutMs?: number;
    onProgress?: (info: { elapsedMs: number }) => void;
  }
): Promise<{ imageUrl: string | null; error?: string }> {
  const normalizedHost = normalizeOllamaHost(host);
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
    const url = `${normalizedHost.replace(/\/+$/, "")}/api/generate`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
      }),
      signal: controller.signal,
    });

    const json = (await resp.json().catch(() => ({}))) as OllamaImageResponse;
    if (!resp.ok) {
      return { imageUrl: null, error: json.error || "Ollama image failed" };
    }
    const image = json.image;
    if (!image) {
      const detail = json.response
        ? `Missing image output: ${json.response}`
        : "Missing image output";
      return { imageUrl: null, error: detail };
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
      error: `${base} [host=${normalizedHost}]`,
    };
  } finally {
    clearTimeout(timeout);
    if (progressTimer) clearInterval(progressTimer);
  }
}

export async function POST(req: Request) {
  const json = await req.json();
  const input = bodySchema.parse(json);

  const systemPrompt = `당신은 그림책 작가입니다. 쉬운 한국어로 따뜻하고 포근한 분위기의 짧은 그림책 이야기를 써주세요. 잔인함이나 무서운 요소는 피하고, 마지막에 교훈이 자연스럽게 드러나야 합니다. 문단은 비어 보이지 않도록 각 문단을 2-4문장으로 구성하고 너무 짧은 문단은 피하세요.`;
  const userPrompt = `주인공: ${input.heroName}\n친구: ${input.friendName}\n배경: ${input.setting}\n교훈: ${input.moral}\n형식: 제목 포함, 3~4문단, 한국어. 각 문단은 2-4문장, 문단 사이에는 빈 줄. 대사 1-2줄 포함.`;

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

        const response = await ollama.chat({
          model: "dolphin3",
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
          stream: true,
        });

        let story = "";
        for await (const part of response) {
          const delta = part.message?.content ?? "";
          if (delta) {
            story += delta;
            send("story_delta", { delta });
          }
        }
        send("story_done", { story });

        const imageEnabled = Boolean(input.withImage);
        if (imageEnabled) {
          send("image_start", { ok: true });
          const imageModel =
            process.env.OLLAMA_IMAGE_MODEL || "x/flux2-klein:9b";
          const ollamaHost = process.env.OLLAMA_HOST || "127.0.0.1:11434";
          const imagePrompt = `storybook illustration, ${input.setting}, 주인공 ${input.heroName}와 친구 ${input.friendName}, ${input.style}, 따뜻하고 부드러운 색감, 어린이용, 고품질`;
          const imageTimeoutMs = Number(
            process.env.OLLAMA_IMAGE_TIMEOUT_MS || 180000
          );

          const { imageUrl, error } = await generateOllamaImage(
            imageModel,
            imagePrompt,
            ollamaHost,
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
        console.error("Ollama Error:", error);
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

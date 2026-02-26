import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const recommendResponseSchema = z.object({
  heroName: z.string().min(1),
  friendName: z.string().min(1),
  setting: z.string().min(1),
  moral: z.string().min(1),
  style: z.string().min(1),
  withImage: z.boolean().optional(),
});

type GroqChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

const fallbackValues = {
  heroName: ["별이", "콩이", "토토", "나리", "하루"],
  friendName: ["구름이", "모모", "초롱이", "두리", "단비"],
  setting: [
    "반짝이는 별사탕 숲",
    "달빛이 흐르는 강가",
    "바람이 노래하는 언덕",
    "무지개 정원이 있는 마을",
    "포근한 구름 위 마을",
  ],
  moral: [
    "친구를 도우면 기쁨이 더 커져요",
    "나눔은 마음을 따뜻하게 만들어요",
    "서로 배려하면 모두가 행복해져요",
    "작은 용기가 큰 변화를 만들어요",
    "함께하면 어떤 길도 즐거워져요",
  ],
  style: [
    "따뜻한 파스텔톤의 만화 스타일",
    "부드러운 색감의 그림책 일러스트",
    "몽글몽글한 수채화 느낌",
    "아기자기한 동화책 삽화 스타일",
    "포근한 색감의 귀여운 캐릭터 스타일",
  ],
};

function sanitizeKoreanInput(value: string) {
  return value
    .replace(
      /[^\u1100-\u11FF\u3130-\u318F\uAC00-\uD7A30-9\s.,!?'"~:;()\-\n]/g,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}

function pickFallback(values: string[]) {
  return values[Math.abs(Date.now()) % values.length];
}

function normalizeValue(
  value: unknown,
  fallbackList: string[],
  maxLength: number
) {
  const raw = typeof value === "string" ? value : "";
  const sanitized = sanitizeKoreanInput(raw).slice(0, maxLength).trim();
  if (sanitized) return sanitized;
  return pickFallback(fallbackList);
}

function extractJson(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }
  const match = trimmed.match(/\{[\s\S]*\}/);
  return match?.[0] ?? "";
}

export async function POST(req: Request) {
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    return NextResponse.json(
      { error: "GROQ_API_KEY is missing" },
      { status: 500 }
    );
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const hint = typeof body === "object" && body ? JSON.stringify(body) : "";

  const systemPrompt = `당신은 어린이 동화책 입력값을 추천하는 한국어 어시스턴트입니다.
반드시 한국어(한글)로만 작성하세요.
출력은 JSON 한 덩어리만 허용합니다. 다른 텍스트를 절대 쓰지 마세요.
필드: heroName, friendName, setting, moral, style.
각 값은 1문장 이내로 간결하게 작성하세요.
형식: {"heroName":"...","friendName":"...","setting":"...","moral":"...","style":"..."}`;

  const userPrompt = `조건을 참고해서 동화책 입력값을 추천해 주세요.
요청 조건(있으면 참고): ${hint || "없음"}
JSON만 출력하세요.`;

  const model =
    process.env.GROQ_RECOMMEND_MODEL ||
    process.env.GROQ_MODEL ||
    "qwen/qwen3-32b";

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        stream: false,
      }),
    }
  );

  if (!response.ok) {
    const detail = await response
      .text()
      .catch(() => "Failed to read Groq error body");
    return NextResponse.json(
      { error: `Groq request failed: ${response.status} ${detail}` },
      { status: 500 }
    );
  }

  const json = (await response.json().catch(() => ({}))) as GroqChatResponse;
  const content = json.choices?.[0]?.message?.content ?? "";
  const jsonText = extractJson(content);
  let parsed: unknown = {};
  try {
    parsed = jsonText ? JSON.parse(jsonText) : {};
  } catch {
    parsed = {};
  }

  const safe = {
    heroName: normalizeValue(
      (parsed as { heroName?: unknown }).heroName,
      fallbackValues.heroName,
      20
    ),
    friendName: normalizeValue(
      (parsed as { friendName?: unknown }).friendName,
      fallbackValues.friendName,
      20
    ),
    setting: normalizeValue(
      (parsed as { setting?: unknown }).setting,
      fallbackValues.setting,
      60
    ),
    moral: normalizeValue(
      (parsed as { moral?: unknown }).moral,
      fallbackValues.moral,
      80
    ),
    style: normalizeValue(
      (parsed as { style?: unknown }).style,
      fallbackValues.style,
      60
    ),
    withImage:
      typeof (parsed as { withImage?: unknown }).withImage === "boolean"
        ? (parsed as { withImage?: boolean }).withImage
        : undefined,
  };

  const validated = recommendResponseSchema.safeParse(safe);
  if (!validated.success) {
    return NextResponse.json(
      {
        heroName: pickFallback(fallbackValues.heroName),
        friendName: pickFallback(fallbackValues.friendName),
        setting: pickFallback(fallbackValues.setting),
        moral: pickFallback(fallbackValues.moral),
        style: pickFallback(fallbackValues.style),
      },
      { status: 200 }
    );
  }

  return NextResponse.json(validated.data);
}

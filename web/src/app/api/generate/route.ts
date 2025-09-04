import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

const bodySchema = z.object({
  heroName: z.string().min(1),
  friendName: z.string().min(1),
  setting: z.string().min(1),
  moral: z.string().min(1),
  style: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const input = bodySchema.parse(json);

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    if (!openai.apiKey) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }

    const systemPrompt = `You are a children\'s story author. Create a short fairy tale (3-4 paragraphs) for kids. It must be heartwarming, simple Korean, and include a clear lesson.`;
    const userPrompt = `주인공: ${input.heroName}\n친구: ${input.friendName}\n배경: ${input.setting}\n교훈: ${input.moral}\n조건: 3~4문단, 제목 포함, 한국어.`;

    const storyResp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.8,
    });

    const story = storyResp.choices[0]?.message?.content?.trim() ?? "";
    if (!story) {
      return NextResponse.json({ error: "Failed to generate story" }, { status: 500 });
    }

    const sceneSummaryPrompt = `다음 동화에서 가장 핵심적인 한 장면을 1~2문장으로 간결하게 묘사해줘. 인물, 배경, 분위기를 포함하고, 한국어로 출력.\n\n동화:\n${story}`;
    const sceneResp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "장면 요약가" },
        { role: "user", content: sceneSummaryPrompt },
      ],
      temperature: 0.7,
    });
    const scene = sceneResp.choices[0]?.message?.content?.trim() ?? "";

    let imageUrl: string | null = null;
    try {
      const imagePrompt = `${scene}\n스타일: ${input.style}. 어린이를 위한 따뜻하고 안전한 표현.`;
      const image = await openai.images.generate({
        model: "gpt-image-1",
        prompt: imagePrompt,
        size: "1024x1024",
      });
      imageUrl = image.data?.[0]?.url ?? null;
    } catch (e) {
      imageUrl = null;
    }

    return NextResponse.json({ story, scene, imageUrl });
  } catch (err: any) {
    const message = err?.message ?? "Unknown error";
    const status = err?.status ?? 400;
    return NextResponse.json({ error: message }, { status });
  }
}



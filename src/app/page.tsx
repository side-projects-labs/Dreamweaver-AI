"use client";
import { useState } from "react";

type GenerateResponse = {
  story: string;
  scene: string;
  imageUrl: string | null;
};

export default function Home() {
  const [heroName, setHeroName] = useState("");
  const [friendName, setFriendName] = useState("");
  const [setting, setSetting] = useState("");
  const [moral, setMoral] = useState("");
  const [style, setStyle] = useState("");
  const [withImage, setWithImage] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  // Client-side HF test states
  const [hfToken, setHfToken] = useState("");
  const [hfModel, setHfModel] = useState("stabilityai/stable-diffusion-2");
  const [clientPrompt, setClientPrompt] = useState("");
  const [clientImageUrl, setClientImageUrl] = useState<string | null>(null);
  const [clientIsLoading, setClientIsLoading] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heroName, friendName, setting, moral, style, withImage }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "요청에 실패했습니다");
      }
      const data: GenerateResponse = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err?.message || "알 수 없는 오류");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen p-6 sm:p-10 max-w-3xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-semibold mb-6">나만의 동화책 작가</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">주인공 이름</label>
          <input value={heroName} onChange={(e) => setHeroName(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="예) 용감한 토끼, 레오" required />
        </div>
        <div>
          <label className="block text-sm mb-1">주인공의 친구</label>
          <input value={friendName} onChange={(e) => setFriendName(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="예) 지혜로운 거북이, 에이미" required />
        </div>
        <div>
          <label className="block text-sm mb-1">이야기 배경</label>
          <input value={setting} onChange={(e) => setSetting(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="예) 반짝이는 별사탕 강이 흐르는 숲속" required />
        </div>
        <div>
          <label className="block text-sm mb-1">이야기의 교훈</label>
          <input value={moral} onChange={(e) => setMoral(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="예) 서로 도우면 어떤 어려움도 이겨낼 수 있어요" required />
        </div>
        <div>
          <label className="block text-sm mb-1">그림 스타일</label>
          <input value={style} onChange={(e) => setStyle(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="예) 따뜻한 파스텔톤의 만화 스타일" required />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={withImage} onChange={(e) => setWithImage(e.target.checked)} />
          삽화 생성하기
        </label>
        <button type="submit" disabled={isLoading} className="w-full bg-black text-white rounded px-4 py-2 disabled:opacity-60">
          {isLoading ? "AI 작가님이 열심히 쓰는 중..." : "동화 만들기!"}
        </button>
        {isLoading && (
          <p className="text-sm text-gray-600">이야기 생성 후 삽화까지 순서대로 만들고 있어요...</p>
        )}
      </form>

      {error && (
        <p className="mt-4 text-red-600 text-sm">{error}</p>
      )}

      {result && (
        <div className="mt-8 space-y-4">
          <div className="prose max-w-none whitespace-pre-wrap">
            {result.story}
          </div>
          {result.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={result.imageUrl} alt="삽화" className="rounded border" />
          )}
        </div>
      )}

      <div className="mt-12 pt-8 border-t">
        <h2 className="text-xl font-semibold mb-4">클라이언트에서 HF 이미지 직접 테스트</h2>
        <p className="text-sm text-gray-600 mb-3">
          디버깅용. 브라우저에서 직접 Hugging Face Inference API를 호출합니다. 민감정보이므로 토큰은 안전한 환경에서만 입력하세요.
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-sm mb-1">HF API Token</label>
            <input
              type="password"
              value={hfToken}
              onChange={(e) => setHfToken(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="hf_xxx"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">모델</label>
            <input
              value={hfModel}
              onChange={(e) => setHfModel(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="stabilityai/stable-diffusion-2"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">프롬프트</label>
            <input
              value={clientPrompt}
              onChange={(e) => setClientPrompt(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="예) 초여름 숲속에서 웃고 있는 작은 토끼와 여우, 파스텔톤"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="bg-gray-900 text-white rounded px-4 py-2 disabled:opacity-60"
              disabled={clientIsLoading}
              onClick={async () => {
                setClientError(null);
                setClientImageUrl(null);
                if (!hfToken) {
                  setClientError("HF 토큰을 입력해주세요");
                  return;
                }
                if (!clientPrompt) {
                  setClientError("프롬프트를 입력해주세요");
                  return;
                }
                setClientIsLoading(true);
                try {
                  const resp = await fetch(`https://api-inference.huggingface.co/models/${encodeURIComponent(hfModel)}?wait_for_model=true`, {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${hfToken}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ inputs: clientPrompt }),
                  });
                  if (!resp.ok) {
                    let reason = `${resp.status} ${resp.statusText}`;
                    try {
                      const text = await resp.text();
                      if (text) reason += `\n${text}`;
                    } catch {}
                    throw new Error(reason);
                  }
                  const blob = await resp.blob();
                  const url = URL.createObjectURL(blob);
                  setClientImageUrl(url);
                } catch (e: any) {
                  setClientError(e?.message || "클라이언트 호출 실패");
                } finally {
                  setClientIsLoading(false);
                }
              }}
            >
              {clientIsLoading ? "생성 중..." : "클라이언트에서 생성하기"}
            </button>
          </div>
          {clientError && <p className="text-sm text-red-600">{clientError}</p>}
          {clientImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={clientImageUrl} alt="클라이언트 생성 결과" className="rounded border" />
          )}
        </div>
      </div>
    </div>
  );
}

"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createShareId,
  getLastSharedId,
  saveSharedStory,
  type SharedStoryBook,
} from "@/lib/storyShare";
import ThemeToggle from "@/components/ThemeToggle";
import BookViewer, { type BookPage } from "@/components/BookViewer";

type GenerateResponse = {
  story: string;
  scene: string;
  imageUrl: string | null;
  imageError?: string;
  imageStatus?: number;
};

type StoryInputPayload = {
  heroName: string;
  friendName: string;
  setting: string;
  moral: string;
  style: string;
  withImage: boolean;
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
  const [pageIndex, setPageIndex] = useState(0);
  const [showForm, setShowForm] = useState(true);
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipDirection, setFlipDirection] = useState<"next" | "prev" | null>(
    null
  );
  const [imageLoading, setImageLoading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isStoryRendering, setIsStoryRendering] = useState(false);
  const [generationId, setGenerationId] = useState(0);
  const [isRecommendLoading, setIsRecommendLoading] = useState(false);
  const [recommendStatus, setRecommendStatus] = useState<string | null>(null);
  const lastStoryCountRef = useRef(0);
  const pendingStoryRef = useRef<string[]>([]);
  const storyTimerRef = useRef<number | null>(null);

  const stopStoryTimer = () => {
    if (storyTimerRef.current !== null) {
      window.clearInterval(storyTimerRef.current);
      storyTimerRef.current = null;
    }
    setIsStoryRendering(false);
  };

  const startStoryTimer = () => {
    if (storyTimerRef.current !== null) return;
    setIsStoryRendering(true);
    storyTimerRef.current = window.setInterval(() => {
      const queue = pendingStoryRef.current;
      if (queue.length === 0) {
        stopStoryTimer();
        return;
      }
      const chunk = queue[0] ?? "";
      if (!chunk) {
        queue.shift();
        return;
      }
      const nextChar = chunk.slice(0, 1);
      const rest = chunk.slice(1);
      if (rest) {
        queue[0] = rest;
      } else {
        queue.shift();
      }
      setResult((prev) => {
        const next = prev ?? { story: "", scene: "", imageUrl: null };
        return { ...next, story: next.story + nextChar };
      });
    }, 30);
  };

  const runGeneration = async (payload: StoryInputPayload) => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setGenerationId((prev) => prev + 1);
    setImageLoading(payload.withImage);
    setIsStoryRendering(false);
    pendingStoryRef.current = [];
    stopStoryTimer();
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          heroName: payload.heroName,
          friendName: payload.friendName,
          setting: payload.setting,
          moral: payload.moral,
          style: payload.style,
          withImage: payload.withImage,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "요청에 실패했습니다");
      }
      if (!res.body) {
        throw new Error("스트리밍 응답을 읽을 수 없습니다");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      setResult({
        story: "",
        scene: "",
        imageUrl: null,
      });

      const applyEvent = (event: string, data: unknown) => {
        if (event === "story_delta") {
          const delta = (data as { delta?: string })?.delta ?? "";
          if (!delta) return;
          pendingStoryRef.current.push(delta);
          startStoryTimer();
          return;
        }
        if (event === "story_done") {
          setPageIndex((prev) => (prev === 0 ? 1 : prev));
          return;
        }
        if (event === "image_start") {
          setImageLoading(true);
          return;
        }
        if (event === "image_done") {
          const payload = data as {
            imageUrl?: string | null;
            imageError?: string;
          };
          setResult((prev) => {
            const next = prev ?? { story: "", scene: "", imageUrl: null };
            return {
              ...next,
              imageUrl: payload?.imageUrl ?? null,
              imageError: payload?.imageError,
            };
          });
          return;
        }
        if (event === "error") {
          const payload = data as { message?: string };
          throw new Error(payload?.message || "알 수 없는 오류");
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const lines = chunk.split("\n").filter(Boolean);
          let event = "message";
          const dataLines: string[] = [];
          for (const line of lines) {
            if (line.startsWith("event:")) {
              event = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              dataLines.push(line.slice(5).trim());
            }
          }
          const raw = dataLines.join("\n");
          if (!raw) continue;
          let parsed: unknown = raw;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          applyEvent(event, parsed);
        }
      }
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error.message || "알 수 없는 오류");
      setShowForm(false);
    } finally {
      setIsLoading(false);
    }
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await runGeneration({
      heroName,
      friendName,
      setting,
      moral,
      style,
      withImage,
    });
  }

  const handleRecommendAndGenerate = async () => {
    setRecommendStatus("추천 내용을 불러오는 중...");
    setIsRecommendLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          heroName,
          friendName,
          setting,
          moral,
          style,
          withImage,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "추천 요청에 실패했습니다");
      }
      const data = (await res.json()) as StoryInputPayload;
      const nextWithImage =
        typeof data.withImage === "boolean" ? data.withImage : withImage;

      setHeroName(data.heroName);
      setFriendName(data.friendName);
      setSetting(data.setting);
      setMoral(data.moral);
      setStyle(data.style);
      setWithImage(nextWithImage);
      setRecommendStatus("추천 완료. 바로 생성할게요.");

      await runGeneration({
        heroName: data.heroName,
        friendName: data.friendName,
        setting: data.setting,
        moral: data.moral,
        style: data.style,
        withImage: nextWithImage,
      });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      setRecommendStatus("추천에 실패했어요. 다시 시도해 주세요.");
      setError(error.message || "알 수 없는 오류");
    } finally {
      setIsRecommendLoading(false);
    }
  };

  async function handleShare() {
    if (!result?.story) return;
    setIsSharing(true);
    try {
      const payload: SharedStoryBook = {
        heroName,
        friendName,
        setting,
        moral,
        style,
        withImage,
        result,
        createdAt: new Date().toISOString(),
      };
      const id = await createShareId(payload);
      await saveSharedStory(id, payload);
      const shareUrl = `${window.location.origin}/share?id=${id}`;
      window.open(shareUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e.message || "공유 링크 생성 중 오류가 발생했습니다.");
    } finally {
      setIsSharing(false);
    }
  }

  function openLastSharedBook() {
    const lastId = getLastSharedId();
    if (!lastId) {
      setError("저장된 그림책이 없습니다.");
      return;
    }
    const shareUrl = `${window.location.origin}/share?id=${lastId}`;
    window.open(shareUrl, "_blank", "noopener,noreferrer");
  }

  const storyPages = useMemo(() => {
    if (!result?.story) return [];
    const paragraphs = result.story
      .split(/\n\s*\n/g)
      .map((part) => part.trim())
      .filter(Boolean);
    if (paragraphs.length === 0) return [];
    const first = paragraphs[0];
    const titleCandidate = first
      .replace(/^\*\*|\*\*$/g, "")
      .replace(/^#+\s*/, "")
      .trim();
    const isTitleOnly =
      titleCandidate.length > 0 && titleCandidate.length <= 40;
    const body = isTitleOnly ? paragraphs.slice(1) : paragraphs;
    if (body.length === 0) return [];
    const minCharsPerPage = 200;
    const pages: string[] = [];
    let buffer = "";
    for (const paragraph of body) {
      if (!buffer) {
        buffer = paragraph;
      } else {
        buffer = `${buffer}\n\n${paragraph}`;
      }
      if (buffer.length >= minCharsPerPage) {
        pages.push(buffer);
        buffer = "";
      }
    }
    if (buffer) pages.push(buffer);
    return pages;
  }, [result?.story]);

  const storyTitle = useMemo(() => {
    if (!result?.story) return "";
    const firstLine = result.story
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0);
    if (!firstLine) return "";
    return firstLine
      .replace(/^\*\*|\*\*$/g, "")
      .replace(/^#+\s*/, "")
      .trim();
  }, [result?.story]);

  useEffect(() => {
    setPageIndex(0);
    setIsFlipping(false);
    setFlipDirection(null);
    lastStoryCountRef.current = 0;
    setImageLoading(withImage);
    setIsStoryRendering(false);
  }, [generationId]);

  useEffect(() => {
    return () => stopStoryTimer();
  }, []);

  const bookPages: BookPage[] = useMemo(() => {
    if (!result) return [];
    return [
      {
        type: "cover",
        title: storyTitle || "나만의 그림책",
        subtitle: `${heroName} · ${friendName}`,
        setting,
      },
      ...storyPages.map((text) => ({
        type: "story" as const,
        text,
      })),
      {
        type: "back",
        text: "끝",
      },
    ];
  }, [result, storyPages, storyTitle, heroName, friendName, setting]);

  const maxPageIndex = Math.max(0, bookPages.length - 1);
  const currentPage = bookPages[Math.min(pageIndex, maxPageIndex)];

  useEffect(() => {
    const currentCount = storyPages.length;
    if (currentCount === 0) {
      lastStoryCountRef.current = 0;
      return;
    }
    if (currentCount > lastStoryCountRef.current) {
      const targetIndex = Math.min(currentCount, maxPageIndex);
      if (pageIndex < targetIndex) {
        setPageIndex(targetIndex);
      }
      lastStoryCountRef.current = currentCount;
    }
  }, [storyPages.length, maxPageIndex, pageIndex]);

  const handleNext = () => {
    if (isFlipping || pageIndex >= maxPageIndex) return;
    setIsFlipping(true);
    setFlipDirection("next");
    const flipDelayMs = 200;
    window.setTimeout(() => {
      setPageIndex((prev) => Math.min(maxPageIndex, prev + 1));
    }, flipDelayMs);
  };

  const handlePrev = () => {
    if (isFlipping || pageIndex <= 0) return;
    setIsFlipping(true);
    setFlipDirection("prev");
    const flipDelayMs = 200;
    window.setTimeout(() => {
      setPageIndex((prev) => Math.max(0, prev - 1));
    }, flipDelayMs);
  };

  return (
    <div className="min-h-screen p-6 sm:p-10 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold">
          나만의 그림책 작가
        </h1>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {!showForm && (
            <button
              type="button"
              className="text-sm border rounded px-3 py-1.5 btn-theme cursor-pointer"
              onClick={() => {
                setShowForm(true);
                setResult(null);
                setError(null);
              }}
            >
              새로 만들기
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <form onSubmit={onSubmit} className="space-y-4 mb-10">
          <div>
            <label className="block text-sm mb-1">주인공 이름</label>
            <input
              value={heroName}
              onChange={(e) => setHeroName(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="예) 용감한 토끼, 레오"
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">주인공의 친구</label>
            <input
              value={friendName}
              onChange={(e) => setFriendName(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="예) 지혜로운 거북이, 에이미"
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">이야기 배경</label>
            <input
              value={setting}
              onChange={(e) => setSetting(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="예) 반짝이는 별사탕 강이 흐르는 숲속"
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">이야기의 교훈</label>
            <input
              value={moral}
              onChange={(e) => setMoral(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="예) 서로 도우면 어떤 어려움도 이겨낼 수 있어요"
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">그림 스타일</label>
            <input
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="예) 따뜻한 파스텔톤의 만화 스타일"
              required
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={withImage}
              onChange={(e) => setWithImage(e.target.checked)}
            />
            삽화 생성하기
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleRecommendAndGenerate}
              disabled={isLoading || isRecommendLoading}
              aria-busy={isRecommendLoading}
              className="w-full rounded px-4 py-2 text-sm font-medium border btn-theme cursor-pointer"
            >
              {isRecommendLoading
                ? "추천 생성 중..."
                : "AI로 내용 추천받고 바로 만들기"}
            </button>
            <button
              type="submit"
              disabled={isLoading || isRecommendLoading}
              className="w-full rounded px-4 py-2 text-sm font-medium border btn-theme cursor-pointer"
            >
              {isLoading ? "그림책 만드는 중..." : "그림책 만들기!"}
            </button>
          </div>
          <p className="text-xs text-black/60" role="status" aria-live="polite">
            {recommendStatus ?? ""}
          </p>
        </form>
      )}

      {error && <p className="mt-4 text-red-600 text-sm">{error}</p>}

      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          className="text-sm border rounded px-3 py-1.5 btn-theme cursor-pointer"
          onClick={handleShare}
          disabled={!result?.story || isSharing || isStoryRendering}
        >
          {isSharing ? "공유 링크 생성 중..." : "공유하기"}
        </button>
        <button
          type="button"
          className="text-sm border rounded px-3 py-1.5 btn-theme cursor-pointer"
          onClick={openLastSharedBook}
        >
          마지막 공유 열기
        </button>
      </div>

      {result && (
        <BookViewer
          currentPage={currentPage}
          pageIndex={pageIndex}
          maxPageIndex={maxPageIndex}
          totalPages={bookPages.length}
          onPrev={handlePrev}
          onNext={handleNext}
          isFlipping={isFlipping}
          flipDirection={flipDirection}
          onFlipEnd={() => setIsFlipping(false)}
          imageUrl={result.imageUrl}
          imageError={result.imageError}
          withImage={withImage}
          imageLoading={imageLoading}
          isLoading={isLoading}
          storyPlaceholder="이야기를 불러오는 중입니다..."
        />
      )}
    </div>
  );
}

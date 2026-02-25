"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  getLastSharedId,
  getSharedStory,
  getSharedStoryFromLocal,
  type SharedStoryBook,
} from "@/lib/storyShare";

type BookPage =
  | {
      type: "cover";
      title: string;
      subtitle: string;
      setting: string;
    }
  | {
      type: "story";
      text: string;
    }
  | {
      type: "back";
      text: string;
    };

function SharePageContent() {
  const searchParams = useSearchParams();
  const [shared, setShared] = useState<SharedStoryBook | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipDirection, setFlipDirection] = useState<"next" | "prev" | null>(
    null
  );

  const shareId = useMemo(() => {
    const queryId = searchParams.get("id");
    return queryId || getLastSharedId();
  }, [searchParams]);

  useEffect(() => {
    let mounted = true;
    async function loadShared() {
      if (!shareId) {
        if (!mounted) return;
        setError("공유 ID가 없습니다.");
        setShared(null);
        return;
      }
      const loaded = await getSharedStory(shareId);
      if (loaded) {
        if (!mounted) return;
        setError(null);
        setShared(loaded);
        return;
      }
      const localFallback = getSharedStoryFromLocal(shareId);
      if (!mounted) return;
      if (localFallback) {
        setError(null);
        setShared(localFallback);
        return;
      }
      setError("해당 공유 그림책을 찾을 수 없습니다.");
      setShared(null);
    }
    void loadShared();
    return () => {
      mounted = false;
    };
  }, [shareId]);

  const storyPages = useMemo(() => {
    if (!shared?.result.story) return [];
    const paragraphs = shared.result.story
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
  }, [shared?.result.story]);

  const storyTitle = useMemo(() => {
    if (!shared?.result.story) return "";
    const firstLine = shared.result.story
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0);
    if (!firstLine) return "";
    return firstLine
      .replace(/^\*\*|\*\*$/g, "")
      .replace(/^#+\s*/, "")
      .trim();
  }, [shared?.result.story]);

  const bookPages: BookPage[] = useMemo(() => {
    if (!shared) return [];
    return [
      {
        type: "cover",
        title: storyTitle || "나만의 그림책",
        subtitle: `${shared.heroName} · ${shared.friendName}`,
        setting: shared.setting,
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
  }, [shared, storyPages, storyTitle]);

  const maxPageIndex = Math.max(0, bookPages.length - 1);
  const currentPage = bookPages[Math.min(pageIndex, maxPageIndex)];

  useEffect(() => {
    setPageIndex(0);
    setIsFlipping(false);
    setFlipDirection(null);
  }, [shareId]);

  const handleNext = () => {
    if (isFlipping || pageIndex >= maxPageIndex) return;
    setIsFlipping(true);
    setFlipDirection("next");
    window.setTimeout(() => {
      setPageIndex((prev) => Math.min(maxPageIndex, prev + 1));
    }, 1300);
  };

  const handlePrev = () => {
    if (isFlipping || pageIndex <= 0) return;
    setIsFlipping(true);
    setFlipDirection("prev");
    window.setTimeout(() => {
      setPageIndex((prev) => Math.max(0, prev - 1));
    }, 1300);
  };

  return (
    <div className="min-h-screen p-6 sm:p-10 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-semibold">공유된 그림책</h1>
        <Link
          href="/"
          className="text-sm border rounded px-3 py-1.5 hover:bg-gray-50"
        >
          홈으로
        </Link>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {shared && currentPage && (
        <div className="rounded-[28px] bg-[#efe2d0] shadow-lg border overflow-hidden book-shell">
          <div className="page-flip-layer">
            {isFlipping && (
              <div
                className={`page-flip ${flipDirection ?? ""}`}
                onAnimationEnd={() => setIsFlipping(false)}
              />
            )}
          </div>
          <div className="grid md:grid-cols-2 gap-0 min-h-[520px]">
            <div className="relative bg-[#e6d5c0] p-6 sm:p-8 min-h-[520px] flex items-center justify-center">
              {shared.result.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={shared.result.imageUrl}
                  alt="공유 삽화"
                  className="max-h-[420px] w-full object-contain rounded-xl shadow"
                />
              ) : (
                <div className="text-sm text-black/70 text-center">
                  삽화가 없습니다.
                  {shared.result.imageError && (
                    <div className="mt-2 text-xs text-black/60">
                      {shared.result.imageError}
                    </div>
                  )}
                </div>
              )}
              <div className="absolute right-0 top-0 h-full w-4 bg-gradient-to-l from-[#e6d7c3] to-transparent" />
            </div>
            <div className="bg-[#f8f1e6] p-6 sm:p-8 min-h-[520px] flex flex-col text-black">
              {currentPage.type === "cover" && (
                <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
                  <p className="text-2xl sm:text-3xl font-semibold">
                    {currentPage.title}
                  </p>
                  <p className="text-sm sm:text-base text-black/70">
                    {currentPage.subtitle}
                  </p>
                  <p className="text-sm text-black/60">{currentPage.setting}</p>
                  <div className="mt-6 text-xs text-black/50">
                    Dreamweaver Storybook
                  </div>
                </div>
              )}
              {currentPage.type === "story" && (
                <div className="text-base sm:text-lg leading-7 whitespace-pre-wrap flex-1">
                  {currentPage.text}
                </div>
              )}
              {currentPage.type === "back" && (
                <div className="flex-1 flex items-center justify-center text-2xl sm:text-3xl font-semibold text-black/70">
                  {currentPage.text}
                </div>
              )}
              <div className="mt-6 flex items-center justify-between text-sm text-black/70">
                <button
                  type="button"
                  className="px-3 py-1.5 border border-black/20 rounded disabled:opacity-40"
                  disabled={pageIndex === 0}
                  onClick={handlePrev}
                >
                  이전
                </button>
                <span>
                  {bookPages.length > 0
                    ? `${pageIndex + 1} / ${bookPages.length}`
                    : "1 / 1"}
                </span>
                <button
                  type="button"
                  className="px-3 py-1.5 border border-black/20 rounded disabled:opacity-40"
                  disabled={pageIndex >= maxPageIndex}
                  onClick={handleNext}
                >
                  다음
                </button>
              </div>
              <div className="text-xs text-black/50 mt-4">
                공유 ID: {shareId}
              </div>
            </div>
          </div>
        </div>
      )}
      <style jsx>{`
        .book-shell {
          position: relative;
        }
        .page-flip-layer {
          pointer-events: none;
          position: absolute;
          inset: 0;
          z-index: 5;
        }
        .page-flip {
          position: absolute;
          inset: 0;
          perspective: 1200px;
        }
        .page-flip::before {
          content: "";
          position: absolute;
          top: 0;
          height: 100%;
          width: 50%;
          background: linear-gradient(120deg, #f8f1e6 0%, #e6d5c0 100%);
          box-shadow: 0 12px 35px rgba(0, 0, 0, 0.2);
          backface-visibility: hidden;
          border-radius: 0 18px 18px 0;
          filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.12));
        }
        .page-flip.next::before {
          left: 50%;
          transform-origin: left center;
          animation: flipNext 1300ms cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
        }
        .page-flip.prev::before {
          left: 0;
          transform-origin: right center;
          animation: flipPrev 1300ms cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
        }
        @keyframes flipNext {
          0% {
            transform: rotateY(0deg);
            opacity: 1;
          }
          100% {
            transform: rotateY(-180deg) rotateZ(-2deg) scale(0.98);
            opacity: 0.2;
          }
        }
        @keyframes flipPrev {
          0% {
            transform: rotateY(0deg);
            opacity: 1;
          }
          100% {
            transform: rotateY(180deg) rotateZ(2deg) scale(0.98);
            opacity: 0.2;
          }
        }
        .page-flip::after {
          content: "";
          position: absolute;
          top: 0;
          height: 100%;
          width: 50%;
          right: 0;
          background: linear-gradient(
            to left,
            rgba(0, 0, 0, 0.08),
            rgba(255, 255, 255, 0.35),
            rgba(255, 255, 255, 0)
          );
          mix-blend-mode: multiply;
          opacity: 0;
          border-radius: 0 18px 18px 0;
        }
        .page-flip.next::after {
          right: 0;
          opacity: 1;
        }
        .page-flip.prev::after {
          left: 0;
          right: auto;
          opacity: 1;
          transform: scaleX(-1);
        }
      `}</style>
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense
      fallback={<div className="min-h-screen p-6 sm:p-10">불러오는 중...</div>}
    >
      <SharePageContent />
    </Suspense>
  );
}

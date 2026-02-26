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
import ThemeToggle from "@/components/ThemeToggle";
import BookViewer, { type BookPage } from "@/components/BookViewer";

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
    <div className="min-h-screen p-6 sm:p-10 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-semibold">공유된 그림책</h1>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/"
            className="text-sm border rounded px-3 py-1.5 btn-theme cursor-pointer"
          >
            홈으로
          </Link>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {shared && (
        <>
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
            imageUrl={shared.result.imageUrl}
            imageError={shared.result.imageError}
          />
          <div className="text-xs text-black/50 mt-4">공유 ID: {shareId}</div>
        </>
      )}
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

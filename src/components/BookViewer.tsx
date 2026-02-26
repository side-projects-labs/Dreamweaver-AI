"use client";

import type { CSSProperties } from "react";

export type BookPage =
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

type BookViewerProps = {
  currentPage?: BookPage;
  pageIndex: number;
  maxPageIndex: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  isFlipping: boolean;
  flipDirection: "next" | "prev" | null;
  onFlipEnd: () => void;
  imageUrl?: string | null;
  imageError?: string;
  withImage?: boolean;
  imageLoading?: boolean;
  isLoading?: boolean;
  storyPlaceholder?: string;
};

export default function BookViewer({
  currentPage,
  pageIndex,
  maxPageIndex,
  totalPages,
  onPrev,
  onNext,
  isFlipping,
  flipDirection,
  onFlipEnd,
  imageUrl,
  imageError,
  withImage = false,
  imageLoading = false,
  isLoading = false,
  storyPlaceholder,
}: BookViewerProps) {
  if (!currentPage) return null;

  const bookShellClass =
    "rounded-[28px] shadow-lg border border-black overflow-hidden book-shell cover-shell";
  const bookShellStyle = {
    "--flip-start": "var(--cover-flip-start)",
    "--flip-end": "var(--cover-flip-end)",
  } as CSSProperties;

  return (
    <div className="mt-6">
      <div className={bookShellClass} style={bookShellStyle}>
        <div className="page-flip-layer">
          {isFlipping && (
            <div
              className={`page-flip ${flipDirection ?? ""}`}
              onAnimationEnd={onFlipEnd}
            />
          )}
        </div>
        <div className="grid md:grid-cols-2 gap-0 min-h-[600px]">
          <div className="relative p-6 sm:p-8 min-h-[600px] flex items-center justify-center cover-left">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt="삽화"
                className="max-h-[420px] w-full object-contain rounded-xl shadow"
              />
            ) : withImage && (imageLoading || isLoading) ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-center">
                <img
                  src="/sample-illustration.svg"
                  alt="삽화 미리보기"
                  className="max-h-[360px] w-full object-contain rounded-xl shadow opacity-70 animate-pulse"
                />
                <div className="text-sm text-black/70">삽화를 그리는 중...</div>
              </div>
            ) : (
              <div className="text-sm text-black/70 text-center">
                삽화가 아직 없어요.
                {imageError && (
                  <div className="mt-2 text-xs text-black/60">{imageError}</div>
                )}
              </div>
            )}
            <div className="absolute right-0 top-0 h-full w-4 bg-gradient-to-l cover-divider to-transparent" />
          </div>
          <div className="p-6 sm:p-8 min-h-[520px] flex flex-col text-black cover-right">
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
                {currentPage.text || storyPlaceholder || ""}
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
                className="px-3 py-1.5 border rounded btn-theme cursor-pointer"
                disabled={pageIndex === 0}
                onClick={onPrev}
              >
                이전
              </button>
              <span>
                {totalPages > 0 ? `${pageIndex + 1} / ${totalPages}` : "1 / 1"}
              </span>
              <button
                type="button"
                className="px-3 py-1.5 border rounded btn-theme cursor-pointer"
                disabled={pageIndex >= maxPageIndex}
                onClick={onNext}
              >
                다음
              </button>
            </div>
          </div>
        </div>
      </div>
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
          background: linear-gradient(
            120deg,
            var(--flip-start, #ffffff) 0%,
            var(--flip-end, #ffffff) 100%
          );
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
        .cover-shell {
          background: var(--cover-shell);
        }
        .cover-left {
          background: var(--cover-left);
        }
        .cover-right {
          background: var(--cover-right);
        }
        .cover-divider {
          --tw-gradient-from: var(--cover-divider);
        }
      `}</style>
    </div>
  );
}

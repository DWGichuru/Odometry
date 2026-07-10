"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface EntrySheetProps {
  open: boolean;
  onClose: () => void;
}

export default function EntrySheet({ open, onClose }: EntrySheetProps) {
  const router = useRouter();
  const sheetRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    dragStart.current = e.touches[0].clientY;
    setDragging(true);
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!dragging || !sheetRef.current) return;
      const dy = e.touches[0].clientY - dragStart.current;
      if (dy > 0) {
        sheetRef.current.style.transform = `translateY(${dy}px)`;
        sheetRef.current.style.transition = "none";
      }
    },
    [dragging],
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!dragging || !sheetRef.current) return;
      const dy = e.changedTouches[0].clientY - dragStart.current;
      setDragging(false);

      if (dy > 100) {
        onClose();
      }

      sheetRef.current.style.transform = "";
      sheetRef.current.style.transition = "transform 0.2s ease-out";
    },
    [dragging, onClose],
  );

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[55] bg-overlay-scrim backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div
        ref={sheetRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="fixed inset-x-0 bottom-0 z-[60] rounded-t-[var(--radius-xl)] border border-b-0 border-border bg-surface px-[14px] pb-[calc(26px+env(safe-area-inset-bottom,0px))] pt-[10px] shadow-md transition-transform duration-200 ease-out"
      >
        <div className="mx-auto mb-4 h-[4px] w-[38px] rounded-full bg-border-light" />

        <h2 className="mb-[3px] text-[17px] font-bold tracking-[-0.01em]">
          Log a shift
        </h2>
        <p className="mb-4 text-[13px] text-muted">
          Three ways in. The camera does the typing for you.
        </p>

        <button
          className="mb-4 flex w-full items-center gap-[14px] rounded-[var(--radius-md)] p-4 text-white"
          style={{
            background: "var(--accent-gradient-strong)",
            boxShadow:
              "0 8px 22px -6px color-mix(in srgb, var(--accent) 60%, transparent)",
          }}
          onClick={() => {
            onClose();
            router.push("/capture?type=start");
          }}
        >
          <span className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-[var(--radius-md)] bg-white/20 text-white">
            <svg
              viewBox="0 0 24 24"
              width={23}
              height={23}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 8.5h3.2l1.6-2.4h8.4l1.6 2.4H21v10H3z" />
              <circle cx="12" cy="13" r="3.4" />
            </svg>
          </span>
          <span className="flex-1 text-left">
            <span className="flex items-center gap-[7px] text-[15px] font-bold">
              Start live shift
              <span className="rounded-full bg-white/20 px-[7px] py-[2px] text-[9.5px] font-extrabold uppercase tracking-[0.05em] text-white">
                Fastest
              </span>
            </span>
            <span className="mt-[2px] block text-[12.5px] text-white/85">
              Snap the odometer. We do the rest.
            </span>
          </span>
          <span className="text-[18px] text-white/80">›</span>
        </button>

        <div className="mb-3 flex items-center gap-[10px] text-[10.5px] font-bold uppercase tracking-[0.06em] text-faint">
          <span className="h-px flex-1 bg-border" />
          or log it the old way
          <span className="h-px flex-1 bg-border" />
        </div>

        <button
          className="mb-[9px] flex w-full items-center gap-[14px] rounded-[var(--radius-md)] border border-border bg-background p-[14px] text-left"
          onClick={() => {
            onClose();
            router.push("/import");
          }}
        >
          <span className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[var(--radius-md)] bg-surface-raised text-text-secondary">
            <svg
              viewBox="0 0 24 24"
              width={22}
              height={22}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <circle cx="8.5" cy="9.5" r="1.5" />
              <path d="m4 17 4.5-4.5 3 3L15 12l5 5" />
            </svg>
          </span>
          <span className="flex-1">
            <span className="flex items-center gap-[7px] text-[15px] font-bold">
              Import screenshot
            </span>
            <span className="mt-[2px] block text-[12.5px] text-muted">
              Read stats from an earnings summary
            </span>
          </span>
          <span className="text-[18px] text-faint">›</span>
        </button>

        <button
          className="flex w-full items-center gap-[14px] rounded-[var(--radius-md)] border border-border bg-background p-[14px] text-left"
          onClick={() => {
            onClose();
            router.push("/shifts/new");
          }}
        >
          <span className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[var(--radius-md)] bg-surface-raised text-text-secondary">
            <svg
              viewBox="0 0 24 24"
              width={22}
              height={22}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z" />
              <path d="M14.5 5.5l3 3" />
            </svg>
          </span>
          <span className="flex-1">
            <span className="flex items-center gap-[7px] text-[15px] font-bold">
              Enter manually
            </span>
            <span className="mt-[2px] block text-[12.5px] text-muted">
              Type it all in yourself
            </span>
          </span>
          <span className="text-[18px] text-faint">›</span>
        </button>
      </div>
    </>
  );
}

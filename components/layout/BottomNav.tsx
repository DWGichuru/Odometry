"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getOpenSession } from "@/actions/session";
import type { ShiftSession } from "@/types/shift-session";
import EntrySheet from "@/components/layout/EntrySheet";

function isActive(pathname: string, route: string, exact = false): boolean {
  if (exact) return pathname === route;
  return pathname.startsWith(route);
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function BottomNav({ authenticated }: { authenticated: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [session, setSession] = useState<ShiftSession | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!authenticated) return;
    getOpenSession().then((result) => {
      if ("session" in result && result.session) {
        setSession(result.session);
        setElapsed(
          Math.floor(
            (Date.now() - new Date(result.session.startedAt).getTime()) / 1000,
          ),
        );
      }
    });
  }, [authenticated]);

  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => {
      setElapsed(
        Math.floor(
          (Date.now() - new Date(session.startedAt).getTime()) / 1000,
        ),
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [session]);

  const handleFabTap = useCallback(() => {
    if (session) {
      router.push("/capture?type=end");
    } else {
      setSheetOpen(true);
    }
  }, [session, router]);

  if (!authenticated) return null;

  const shiftsActive =
    isActive(pathname, "/shifts") && !isActive(pathname, "/shifts/new", true);

  return (
    <>
      <EntrySheet open={sheetOpen} onClose={() => setSheetOpen(false)} />

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-stretch border-t border-border bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-xl"
      >
      <Link
        href="/dashboard"
        className={`flex flex-1 flex-col items-center justify-center gap-[3px] text-[10px] font-semibold tracking-[0.01em] no-underline ${
          isActive(pathname, "/dashboard") ? "text-accent" : "text-muted"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          width={24}
          height={24}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V21h14V9.5" />
        </svg>
        Dashboard
      </Link>

      <Link
        href="/shifts"
        className={`flex flex-1 flex-col items-center justify-center gap-[3px] text-[10px] font-semibold tracking-[0.01em] no-underline ${
          shiftsActive ? "text-accent" : "text-muted"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          width={24}
          height={24}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8 6h13" />
          <path d="M8 12h13" />
          <path d="M8 18h13" />
          <circle cx="3.5" cy="6" r="1" />
          <circle cx="3.5" cy="12" r="1" />
          <circle cx="3.5" cy="18" r="1" />
        </svg>
        Shifts
      </Link>

      <Link
        href="/trends"
        className={`flex flex-1 flex-col items-center justify-center gap-[3px] text-[10px] font-semibold tracking-[0.01em] no-underline ${
          isActive(pathname, "/trends") ? "text-accent" : "text-muted"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          width={24}
          height={24}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 17l6-6 4 4 7-8" />
          <path d="M17 7h4v4" />
        </svg>
        Trends
      </Link>

      <Link
        href="/profile"
        className={`flex flex-1 flex-col items-center justify-center gap-[3px] text-[10px] font-semibold tracking-[0.01em] no-underline ${
          isActive(pathname, "/profile") ? "text-accent" : "text-muted"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          width={24}
          height={24}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
        </svg>
        Profile
      </Link>

      <div className="flex flex-[0_0_auto] flex-col items-center justify-center px-[18px] pb-0 pl-[6px] text-[10px] font-semibold tracking-[0.01em] text-muted no-underline">
        <button
          onClick={handleFabTap}
          aria-label={session ? "End shift" : "Log a shift"}
          className={`mt-[-22px] flex items-center justify-center gap-[7px] rounded-full text-accent-ink ${
            session
              ? "h-[52px] w-auto bg-live px-[18px] text-[#05271c] shadow-[0_6px_16px_rgba(16,185,129,0.42)]"
              : "h-[52px] w-[52px] bg-accent shadow-[0_6px_16px_color-mix(in_srgb,var(--accent)_45%,transparent)]"
          }`}
        >
          {session ? (
            <>
              <span
                className="dot-live"
                style={{ background: "#05271c", boxShadow: "none" }}
              />
              <span className="text-[13.5px] font-bold tabular-nums">
                {formatElapsed(elapsed)}
              </span>
            </>
          ) : (
            <svg
              viewBox="0 0 24 24"
              width={26}
              height={26}
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          )}
        </button>
      </div>
    </nav>
    </>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function isActive(pathname: string, route: string, exact = false): boolean {
  if (exact) return pathname === route;
  return pathname.startsWith(route);
}

export default function BottomNav({ authenticated }: { authenticated: boolean }) {
  const pathname = usePathname();

  if (!authenticated) return null;

  const shiftsActive =
    isActive(pathname, "/shifts") && !isActive(pathname, "/shifts/new", true);

  return (
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

      <Link
        href="/shifts/new"
        className="flex flex-[0_0_auto] flex-col items-center justify-center px-[18px] pb-0 pl-[6px] text-[10px] font-semibold tracking-[0.01em] text-muted no-underline"
      >
        <span className="mt-[-22px] flex h-[52px] w-[52px] items-center justify-center rounded-full bg-accent text-accent-ink shadow-[0_6px_16px_color-mix(in_srgb,var(--accent)_45%,transparent)]">
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
        </span>
      </Link>
    </nav>
  );
}

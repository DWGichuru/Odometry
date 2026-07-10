"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getOpenSession } from "@/actions/session";
import type { ShiftSession } from "@/types/shift-session";

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatStartTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function LiveBanner() {
  const router = useRouter();
  const [session, setSession] = useState<ShiftSession | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
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
  }, []);

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

  if (!session) return null;

  return (
    <section
      className="relative mb-[14px] mt-[12px] overflow-hidden rounded-[var(--radius-lg)] border p-[16px] shadow-md"
      style={{
        borderColor: "color-mix(in srgb, var(--live) 40%, var(--border))",
        background: `linear-gradient(120% 140% at 0% 0%, var(--live-muted), transparent 60%), var(--surface)`,
      }}
    >
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-[7px] text-[11px] font-bold uppercase tracking-[0.08em] text-live">
          <span className="dot-live" />
          Shift in progress
        </span>
        <span className="text-[11.5px] text-muted">
          Started {formatStartTime(session.startedAt)}
        </span>
      </div>

      <div className="mb-[2px] mt-[12px] text-[40px] font-bold leading-none tracking-[-0.03em] tabular-nums">
        {formatElapsed(elapsed)}
        <small className="text-[17px] font-semibold tracking-normal text-muted">
          {" "}elapsed
        </small>
      </div>

      <div className="mt-[14px] flex gap-[8px]">
        <div className="flex-1 rounded-[var(--radius-md)] bg-surface-raised p-[10px] px-[12px]">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-muted">
            Start odometer
          </div>
          <div className="mt-[3px] font-mono text-[15px] font-bold tabular-nums">
            {String(Math.round(session.startOdometer)).padStart(6, "0")} km
          </div>
        </div>
        <div className="flex-1 rounded-[var(--radius-md)] bg-surface-raised p-[10px] px-[12px]">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-muted">
            Distance so far
          </div>
          <div className="mt-[3px] font-mono text-[15px] font-bold tabular-nums text-muted">
            — km
          </div>
        </div>
      </div>

      <button
        onClick={() => router.push("/capture?type=end")}
        className="mt-[14px] flex w-full items-center justify-center gap-[8px] rounded-[var(--radius-md)] bg-live p-[13px] text-[14.5px] font-semibold text-[#05271c]"
      >
        <span>⏹</span>
        End shift · snap odometer
      </button>
    </section>
  );
}

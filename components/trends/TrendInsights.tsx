"use client";

import { useState } from "react";
import { generateTrendInsights, type InsightData } from "@/actions/insights";

interface TrendInsightsProps {
  initialRemaining: number;
  initialLatest: InsightData | null;
}

const MONTHLY_CAP = 5;

function formatGeneratedAt(iso: string): string {
  return `Generated ${new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

export default function TrendInsights({
  initialRemaining,
  initialLatest,
}: TrendInsightsProps) {
  const [remaining, setRemaining] = useState(initialRemaining);
  const [latest, setLatest] = useState<InsightData | null>(initialLatest);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const result = await generateTrendInsights();
    setLoading(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setLatest(result.data);
    setRemaining(result.data.remaining);
  }

  const exhausted = remaining === 0;
  const quotaText = exhausted
    ? "You've used all 5 insights this month - they reset next month"
    : `${remaining} of ${MONTHLY_CAP} insights left this month`;

  return (
    <section className="mb-4 rounded-lg border border-border bg-surface shadow-md p-5">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[15px] font-semibold tracking-[-0.01em]">
          Insights
        </span>
        <span
          className={`text-xs font-medium ${exhausted ? "text-warning" : "text-muted"}`}
        >
          {quotaText}
        </span>
      </div>

      <div className="mt-3">
        {error && (
          <div className="mb-3.5 flex items-start gap-2 rounded-[var(--radius-md)] border border-danger/30 bg-danger-muted px-3 py-2.5 text-[13px] text-danger">
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}

        {latest ? (
          <div>
            <div className="mb-3.5">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.04em] text-accent">
                Best times to work
              </div>
              <div className="text-[14px] leading-relaxed text-text-secondary">
                {latest.bestTimes}
              </div>
            </div>
            <div className="mb-3.5">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.04em] text-accent">
                Ideal shift length
              </div>
              <div className="text-[14px] leading-relaxed text-text-secondary">
                {latest.idealShiftLength}
              </div>
            </div>
            <div>
              <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.04em] text-accent">
                What&apos;s not working
              </div>
              <div className="text-[14px] leading-relaxed text-text-secondary">
                {latest.notWorking}
              </div>
            </div>
            <div className="mt-3.5 text-[11.5px] text-faint">
              {formatGeneratedAt(latest.createdAt)}
            </div>
          </div>
        ) : (
          <p className="mb-3.5 text-[13.5px] text-muted">
            Get insights on your shift history: your best times to work, your
            ideal shift length, and what isn&apos;t working.
          </p>
        )}

        <div className="mt-4 flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleClick}
            disabled={loading || exhausted}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-accent px-[18px] text-[13.5px] font-semibold text-accent-ink disabled:cursor-not-allowed disabled:bg-surface-raised disabled:text-faint"
          >
            {loading && (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/35 border-t-white" />
            )}
            {loading ? "Generating..." : "Get insights"}
          </button>
        </div>
      </div>
    </section>
  );
}

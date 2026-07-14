import type { ReactNode } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getExportContext } from "@/lib/export-data";
import { summarizeShifts } from "@/lib/export";
import { formatMoney } from "@/lib/currency";
import { formatDistance, KM_PER_MILE } from "@/lib/units";
import PeriodForm from "@/components/export/PeriodForm";
import Link from "next/link";

const DOWNLOAD_ICON = (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

export default async function ExportPage({
  searchParams,
}: {
  searchParams: Promise<{
    period?: string;
    year?: string;
    month?: string;
    start?: string;
    end?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const params = await searchParams;

  const now = new Date();
  const periodParam = params.period || "month";
  const yearParam = params.year || String(now.getUTCFullYear());
  const monthParam = params.month || String(now.getUTCMonth() + 1);
  const startParam = params.start || "";
  const endParam = params.end || "";

  const ctx = await getExportContext(session.user.id, {
    period: periodParam,
    year: yearParam,
    month: monthParam,
    start: startParam,
    end: endParam,
  });

  const queryString = new URLSearchParams({
    period: periodParam,
    year: yearParam,
    month: monthParam,
    start: startParam,
    end: endParam,
  }).toString();

  let body: ReactNode;

  if ("error" in ctx) {
    body = (
      <div className="mb-[18px] rounded-[var(--radius-md)] border border-dashed border-border bg-surface p-[18px] text-[13.5px] text-muted">
        {ctx.error} Finish selecting a period above to see your totals.
      </div>
    );
  } else {
    const summary = summarizeShifts(ctx.shifts);
    const currencyCode = ctx.currency;
    const distanceUnit = ctx.distanceUnit;
    const populated = summary.shiftCount > 0;

    const distanceRate =
      distanceUnit === "MI"
        ? summary.earningsPerKm * KM_PER_MILE
        : summary.earningsPerKm;

    const statItems = [
      { value: `${summary.totalHours.toFixed(1)}h`, label: "Hours" },
      { value: String(summary.totalTrips), label: "Trips" },
      {
        value: formatDistance(summary.totalDistanceKm, distanceUnit),
        label: "Distance",
      },
      {
        value: formatMoney(summary.earningsPerHour, currencyCode),
        label: "Per hour",
      },
      {
        value: formatMoney(summary.earningsPerTrip, currencyCode),
        label: "Per trip",
      },
      {
        value: formatMoney(distanceRate, currencyCode),
        label: distanceUnit === "MI" ? "Per mi" : "Per km",
      },
    ];

    body = (
      <>
        <section className="mb-[14px] rounded-lg border border-border bg-surface p-[18px] shadow-[var(--card-shadow)]">
          <div className="text-[13px] font-semibold text-text-secondary">
            {ctx.period.label}
          </div>
          <div className="mt-2 text-[38px] font-bold leading-none tracking-[-0.03em] tabular-nums">
            {formatMoney(summary.totalEarnings, currencyCode)}
          </div>
          <div className="mt-[10px] inline-flex items-center px-3 py-1 rounded-full bg-surface-raised text-text-secondary text-[12.5px] font-semibold">
            {summary.shiftCount} shift{summary.shiftCount === 1 ? "" : "s"}{" "}
            logged
          </div>
          {!populated && (
            <div className="mt-[10px] px-3 py-[10px] rounded-[var(--radius-md)] border border-dashed border-border text-[12.5px] text-muted">
              No shifts in this period.
            </div>
          )}
        </section>

        <div className="grid grid-cols-3 gap-[10px] mb-[18px]">
          {statItems.map((item) => (
            <div
              key={item.label}
              className="rounded-[var(--radius-md)] border border-border bg-surface p-[13px]"
            >
              <div className="text-[18px] font-bold tracking-[-0.02em] tabular-nums">
                {item.value}
              </div>
              <div className="mt-[3px] text-[10.5px] text-muted">
                {item.label}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 mb-[18px]">
          {populated ? (
            <>
              <Link
                href={`/api/export/pdf?${queryString}`}
                className="btn btn-accent"
              >
                {DOWNLOAD_ICON}
                Download PDF summary
              </Link>
              <Link
                href={`/api/export/csv?${queryString}`}
                className="btn btn-quiet"
              >
                {DOWNLOAD_ICON}
                Download CSV ({summary.shiftCount} row
                {summary.shiftCount === 1 ? "" : "s"})
              </Link>
            </>
          ) : (
            <>
              <span className="btn btn-accent opacity-45 cursor-not-allowed">
                {DOWNLOAD_ICON}
                Download PDF summary
              </span>
              <span className="btn btn-quiet opacity-45 cursor-not-allowed">
                {DOWNLOAD_ICON}
                Download CSV
              </span>
            </>
          )}
        </div>
      </>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 p-4">
      <div className="pt-[6px] pb-[14px]">
        <h1 className="text-2xl font-bold tracking-tight">Export</h1>
        <p className="mt-1 text-[13px] text-muted">
          Download your earnings as a PDF or CSV.
        </p>
      </div>

      <PeriodForm
        currentPeriod={(periodParam as "month" | "year" | "range") || "month"}
        currentYear={yearParam}
        currentMonth={monthParam}
        currentStart={startParam}
        currentEnd={endParam}
      />

      {body}

      <p className="text-[11.5px] text-faint text-center leading-[1.5]">
        Includes shifts entered manually, via screenshot, or by odometer photo.
      </p>
    </div>
  );
}

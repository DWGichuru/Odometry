import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { aggregateTrends } from "@/lib/trends";
import { currencySymbol } from "@/lib/currency";
import { kmToMiles, KM_PER_MILE } from "@/lib/units";
import TrendLineChart from "@/components/trends/TrendLineChart";
import Link from "next/link";

const EXPORT_LINK = (
  <Link
    href="/export"
    aria-label="Export earnings"
    className="flex items-center justify-center w-[34px] h-[34px] flex-none rounded-[var(--radius-sm)] border border-border bg-surface text-text-secondary hover:text-foreground transition-colors"
  >
    <svg
      viewBox="0 0 24 24"
      width="17"
      height="17"
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
  </Link>
);

export default async function TrendsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const params = await searchParams;
  const period = params.period === "month" ? "month" : "week";

  const userPrefs = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { currency: true, distanceUnit: true },
  });
  const currencyCode = userPrefs?.currency ?? "USD";
  const moneyUnit = currencySymbol(currencyCode);
  const distanceUnit = userPrefs?.distanceUnit ?? "MI";
  const distanceLabel = distanceUnit === "MI" ? "mi" : "km";
  const distanceMultiplier = distanceUnit === "MI" ? KM_PER_MILE : 1;

  const dbShifts = await prisma.shift.findMany({
    where: { userId: session.user.id },
    orderBy: { date: "asc" },
  });

  const shifts = dbShifts.map((s) => ({
    date: s.date.toISOString(),
    startTime: s.startTime.toISOString(),
    endTime: s.endTime.toISOString(),
    amountEarned: s.amountEarned,
    tripsCompleted: s.tripsCompleted,
    startOdometer: s.startOdometer,
    endOdometer: s.endOdometer,
  }));

  if (shifts.length === 0) {
    return (
      <div className="mx-auto w-full max-w-4xl flex-1 p-4">
        <div className="flex items-center justify-between pt-2 pb-4">
          <h1 className="text-2xl font-bold tracking-tight">Trends</h1>
          <div className="flex items-center gap-2">
            {EXPORT_LINK}
            <div className="pill-toggle">
              <Link href="/trends?period=week" className="active">Week</Link>
              <Link href="/trends?period=month">Month</Link>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-10 text-center shadow-md">
          <h2 className="text-[17px] font-semibold text-text-secondary">
            No shifts yet.
          </h2>
          <p className="mt-2 text-[14px] text-muted">
            <Link
              href="/shifts/new"
              className="font-medium text-accent hover:underline"
            >
              Log a shift
            </Link>{" "}
            to start seeing your earnings trends.
          </p>
        </div>
      </div>
    );
  }

  const points = aggregateTrends(shifts, period);

  const labels = points.map((p) => p.periodLabel);
  const tipLabels = points.map((p) => p.tipLabel);

  const ratesSeries = [
    {
      key: "hour",
      name: "Per hour",
      color: "var(--chart-earnings)",
      unit: moneyUnit,
      defaultSelected: true,
      end: true,
      data: points.map((p) => p.earningsPerHour),
    },
    {
      key: "trip",
      name: "Per trip",
      color: "var(--chart-hours)",
      unit: moneyUnit,
      end: true,
      data: points.map((p) => p.earningsPerTrip),
    },
    {
      key: "km",
      name: `Per ${distanceLabel}`,
      color: "var(--chart-trips)",
      unit: moneyUnit,
      end: true,
      data: points.map((p) => p.earningsPerKm * distanceMultiplier),
    },
  ];

  const totalsSeries = [
    {
      key: "earn",
      name: "Earnings",
      color: "var(--chart-earnings)",
      unit: moneyUnit,
      area: true,
      defaultSelected: true,
      end: true,
      data: points.map((p) => p.totalEarnings),
    },
    {
      key: "hours",
      name: "Hours",
      color: "var(--chart-hours)",
      unit: "h",
      area: false,
      end: false,
      data: points.map((p) => p.totalHours),
    },
    {
      key: "trips",
      name: "Trips",
      color: "var(--chart-trips)",
      unit: "",
      area: false,
      end: false,
      data: points.map((p) => p.totalTrips),
    },
    {
      key: "km",
      name: "Distance",
      color: "var(--chart-km)",
      unit: distanceLabel,
      area: false,
      end: false,
      data: points.map((p) =>
        distanceUnit === "MI" ? kmToMiles(p.totalDistanceKm) : p.totalDistanceKm,
      ),
    },
  ];

  const hintPeriod = period === "month" ? "month" : "week";
  const totalLabel = period === "month" ? "months" : "weeks";

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 p-4">
      <div className="flex items-center justify-between pt-2 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">Trends</h1>
        <div className="flex items-center gap-2">
          {EXPORT_LINK}
          <div className="pill-toggle">
            <Link
              href="/trends?period=week"
              className={period === "week" ? "active" : ""}
            >
              Week
            </Link>
            <Link
              href="/trends?period=month"
              className={period === "month" ? "active" : ""}
            >
              Month
            </Link>
          </div>
        </div>
      </div>

      <section className="mb-4 rounded-lg border border-border bg-surface shadow-md p-5">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-[15px] font-semibold tracking-[-0.01em]">Your rates</span>
          <span className="text-xs font-medium text-muted">Per hour, trip &amp; {distanceLabel}</span>
        </div>
        <p className="text-xs text-muted mb-2">
          Tap a rate to view it &middot; drag across the chart for any {hintPeriod}.
        </p>
        <TrendLineChart
          key={period}
          labels={labels}
          tipLabels={tipLabels}
          series={ratesSeries}
        />
      </section>

      <section className="rounded-lg border border-border bg-surface shadow-md p-5">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-[15px] font-semibold tracking-[-0.01em]">Totals</span>
          <span className="text-xs font-medium text-muted">
            Last {points.length} {totalLabel}
          </span>
        </div>
        <p className="text-xs text-muted mb-2">
          Tap a series to view it &middot; drag across the chart for any {hintPeriod}.
        </p>
        <TrendLineChart
          key={period}
          labels={labels}
          tipLabels={tipLabels}
          series={totalsSeries}
        />
      </section>
    </div>
  );
}

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { aggregateTrends } from "@/lib/trends";
import TrendLineChart from "@/components/trends/TrendLineChart";
import Link from "next/link";

export default async function TrendsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const params = await searchParams;
  const period = params.period === "month" ? "month" : "week";

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
          <div className="pill-toggle">
            <Link href="/trends?period=week" className="active">Week</Link>
            <Link href="/trends?period=month">Month</Link>
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

  const maxRate = Math.max(
    ...points.map((p) => Math.max(p.earningsPerHour, p.earningsPerTrip, p.earningsPerKm)),
    0,
  );
  const sharedMax = Math.ceil(maxRate / 2) * 2 + 2;

  const ratesSeries = [
    {
      key: "hour",
      name: "Per hour",
      color: "var(--chart-earnings)",
      unit: "$",
      on: true,
      end: true,
      data: points.map((p) => p.earningsPerHour),
    },
    {
      key: "trip",
      name: "Per trip",
      color: "var(--chart-hours)",
      unit: "$",
      on: true,
      end: true,
      data: points.map((p) => p.earningsPerTrip),
    },
    {
      key: "km",
      name: "Per km",
      color: "var(--chart-trips)",
      unit: "$",
      on: true,
      end: true,
      data: points.map((p) => p.earningsPerKm),
    },
  ];

  const totalsSeries = [
    {
      key: "earn",
      name: "Earnings",
      color: "var(--chart-earnings)",
      unit: "$",
      area: true,
      on: true,
      end: true,
      data: points.map((p) => p.totalEarnings),
    },
    {
      key: "hours",
      name: "Hours",
      color: "var(--chart-hours)",
      unit: "h",
      area: false,
      on: true,
      end: false,
      data: points.map((p) => p.totalHours),
    },
    {
      key: "trips",
      name: "Trips",
      color: "var(--chart-trips)",
      unit: "",
      area: false,
      on: false,
      end: false,
      data: points.map((p) => p.totalTrips),
    },
    {
      key: "km",
      name: "Distance",
      color: "var(--chart-km)",
      unit: "km",
      area: false,
      on: false,
      end: false,
      data: points.map((p) => p.totalDistanceKm),
    },
  ];

  const hintPeriod = period === "month" ? "month" : "week";
  const totalLabel = period === "month" ? "months" : "weeks";

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 p-4">
      <div className="flex items-center justify-between pt-2 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">Trends</h1>
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

      <section className="mb-4 rounded-lg border border-border bg-surface shadow-md p-5">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-[15px] font-semibold tracking-[-0.01em]">Your rates</span>
          <span className="text-xs font-medium text-muted">Per hour, trip &amp; km</span>
        </div>
        <p className="text-xs text-muted mb-2">
          Tap a rate to hide it &middot; drag across the chart for any {hintPeriod}.
        </p>
        <TrendLineChart
          key={period}
          labels={labels}
          tipLabels={tipLabels}
          series={ratesSeries}
          sharedMax={sharedMax}
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
          Tap a series to hide it &middot; drag across the chart for any {hintPeriod}.
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

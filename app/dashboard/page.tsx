import StatCard from "@/components/dashboard/StatCard";
import ShiftListItem from "@/components/shifts/ShiftListItem";
import {
  PLATFORM_FILL,
  PLATFORM_LABELS,
} from "@/lib/platform";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { NoticeBanner } from "@/components/billing/NoticeBanner";
import Link from "next/link";

function daysBetween(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const MS_PER_HOUR = 3_600_000;

function formatMoney(value: number): string {
  return `$${value.toFixed(2)}`;
}

function shiftHours(endTime: string, startTime: string): number {
  return (
    (new Date(endTime).getTime() - new Date(startTime).getTime()) /
    MS_PER_HOUR
  );
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateRange(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);

  const sameMonth = monday.getMonth() === sunday.getMonth();

  const start = monday.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const end = sunday.toLocaleDateString("en-US", {
    month: sameMonth ? undefined : "short",
    day: "numeric",
  });

  return `${start} - ${end}`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const sub = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { status: true, freeTrialEndsAt: true, isLifetimeFree: true },
  });

  const trialEnd = sub?.freeTrialEndsAt
    ? new Date(sub.freeTrialEndsAt)
    : null;
  const trialDaysRemaining = trialEnd
    ? Math.max(0, daysBetween(new Date(), trialEnd))
    : 0;
  const showTrialBanner =
    sub?.status === "trialing" && !sub.isLifetimeFree && trialDaysRemaining <= 7;

  const params = await searchParams;

  const today = new Date();
  const monday = params.week
    ? getMonday(new Date(`${params.week}T00:00:00`))
    : getMonday(today);

  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  monday.setHours(0, 0, 0, 0);

  const prevMonday = new Date(monday);
  prevMonday.setDate(prevMonday.getDate() - 7);
  const nextMonday = new Date(monday);
  nextMonday.setDate(nextMonday.getDate() + 7);

  const dbShifts = await prisma.shift.findMany({
    where: {
      userId: session.user.id,
      date: { gte: monday, lte: sunday },
    },
    orderBy: { date: "desc" },
  });

  const shifts = dbShifts.map((s) => ({
    ...s,
    date: s.date.toISOString().slice(0, 10),
    startTime: s.startTime.toISOString(),
    endTime: s.endTime.toISOString(),
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));

  let totalHours = 0;
  let totalEarnings = 0;
  let totalTrips = 0;
  let totalDistanceKm = 0;

  for (const shift of shifts) {
    totalHours += shiftHours(shift.endTime, shift.startTime);
    totalEarnings += shift.amountEarned;
    totalTrips += shift.tripsCompleted;
    totalDistanceKm += shift.endOdometer - shift.startOdometer;
  }

  const perHour = totalHours > 0 ? totalEarnings / totalHours : 0;
  const perTrip = totalTrips > 0 ? totalEarnings / totalTrips : 0;
  const perKm = totalDistanceKm > 0 ? totalEarnings / totalDistanceKm : 0;

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });

  const shiftsByDate = new Map(shifts.map((s) => [s.date, s]));
  const maxDayEarnings = Math.max(
    0,
    ...weekDays.map((d) => shiftsByDate.get(d)?.amountEarned ?? 0),
  );

  const latestDate = shifts
    .map((s) => s.date)
    .sort()
    .at(-1) ?? weekDays[0];

  const platformMap = new Map<string, number>();
  for (const s of shifts) {
    platformMap.set(
      s.platform,
      (platformMap.get(s.platform) ?? 0) + s.amountEarned,
    );
  }
  const platformTotals: { platform: string; earned: number }[] = [
    ...platformMap.entries(),
  ]
    .map(([platform, earned]) => ({ platform, earned }))
    .sort((a, b) => b.earned - a.earned);

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 p-4">
      <div className="flex items-center justify-between pt-2 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <div className="flex items-center gap-1 rounded-3xl border border-border bg-surface-raised">
          <Link
            href={`/dashboard?week=${prevMonday.toISOString().slice(0, 10)}`}
            className="flex h-7 w-8 items-center justify-center rounded-3xl text-[13px] font-medium text-muted transition-colors hover:text-text-secondary"
          >
            &#8249;
          </Link>
          <span className="px-1 text-[13px] font-medium text-text-secondary">
            {formatDateRange(monday)}
          </span>
          <Link
            href={`/dashboard?week=${nextMonday.toISOString().slice(0, 10)}`}
            className="flex h-7 w-8 items-center justify-center rounded-3xl text-[13px] font-medium text-muted transition-colors hover:text-text-secondary"
          >
            &#8250;
          </Link>
        </div>
      </div>

      {showTrialBanner && (
        <NoticeBanner variant="warn" title={`Trial ends in ${trialDaysRemaining} day${trialDaysRemaining !== 1 ? "s" : ""}`}>
          <Link href="/billing" className="underline hover:no-underline">Subscribe now</Link> to keep logging shifts without interruption.
        </NoticeBanner>
      )}

      {shifts.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-10 text-center shadow-md">
          <p className="text-[17px] font-semibold text-text-secondary">
            No shifts this week.
          </p>
          <p className="mt-2 text-[14px] text-muted">
            <Link
              href="/shifts/new"
              className="font-medium text-accent hover:underline"
            >
              Log a shift
            </Link>{" "}
            or check a different week.
          </p>
        </div>
      ) : (
        <>
          <section
            aria-label="Earnings this week"
            className="mb-4 rounded-lg border border-border bg-surface bg-[radial-gradient(120%_140%_at_0%_0%,color-mix(in_srgb,var(--accent)_16%,transparent)_0%,transparent_55%)] p-5 shadow-md"
          >
            <div className="mb-2.5 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
              Earned this week
            </div>
            <div className="text-[44px] leading-none font-bold tracking-tighter tabular-nums">
              {formatMoney(totalEarnings)}
            </div>
            <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-3xl bg-surface-raised px-2.5 py-1 text-[13px] font-medium text-text-secondary">
              {shifts.length} shift{shifts.length !== 1 ? "s" : ""} logged
            </div>

            <div className="mt-5 mb-1.5 flex h-18 items-end gap-2">
              {weekDays.map((date, i) => {
                const shift = shiftsByDate.get(date);
                const heightPct =
                  maxDayEarnings > 0 && shift
                    ? Math.round((shift.amountEarned / maxDayEarnings) * 100)
                    : 0;
                return (
                  <div
                    key={date}
                    className="group relative flex h-full flex-1 flex-col items-center justify-end"
                  >
                    <span className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-10 -translate-x-1/2 translate-y-0.5 rounded-sm border border-border-light bg-surface-raised px-2 py-1 text-xs font-semibold whitespace-nowrap opacity-0 shadow-md transition group-hover:translate-y-0 group-hover:opacity-100">
                      {shift
                        ? formatMoney(shift.amountEarned)
                        : "No shift"}
                      <span className="block text-[10px] font-medium text-muted">
                        {DAY_LETTERS[i]}
                        {shift
                          ? ` · ${PLATFORM_LABELS[shift.platform]}`
                          : ""}
                      </span>
                    </span>
                    {shift ? (
                      <div
                        className={`w-full max-w-8.5 rounded-t-sm ${
                          date === latestDate
                            ? "bg-accent"
                            : "bg-[color-mix(in_srgb,var(--accent)_68%,var(--surface))]"
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />
                    ) : (
                      <div className="h-1 w-full max-w-8.5 rounded-sm bg-border-light" />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mb-5 flex gap-2" aria-hidden="true">
              {weekDays.map((date, i) => (
                <span
                  key={date}
                  className={`flex-1 text-center text-[11px] font-medium ${
                    date === latestDate
                      ? "font-bold text-accent"
                      : "text-faint"
                  }`}
                >
                  {DAY_LETTERS[i]}
                </span>
              ))}
            </div>

            {totalEarnings > 0 && (
              <>
                <div
                  className="mb-3 flex h-2.5 gap-0.5 overflow-hidden rounded-[5px]"
                  role="img"
                  aria-label={`Earnings by platform: ${platformTotals
                    .map(
                      (p) =>
                        `${PLATFORM_LABELS[p.platform as keyof typeof PLATFORM_LABELS]} ${formatMoney(p.earned)}`,
                    )
                    .join(", ")}`}
                >
                  {platformTotals.map(({ platform, earned }) => (
                    <div
                      key={platform}
                      className={
                        PLATFORM_FILL[platform as keyof typeof PLATFORM_FILL]
                      }
                      style={{
                        width: `${(earned / totalEarnings) * 100}%`,
                      }}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {platformTotals.map(({ platform, earned }) => (
                    <span
                      key={platform}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary"
                    >
                      <span
                        className={`h-2 w-2 rounded-[3px] ${PLATFORM_FILL[platform as keyof typeof PLATFORM_FILL]}`}
                      />
                      {
                        PLATFORM_LABELS[
                          platform as keyof typeof PLATFORM_LABELS
                        ]
                      }{" "}
                      <span className="text-muted tabular-nums">
                        {formatMoney(earned)}
                      </span>
                    </span>
                  ))}
                </div>
              </>
            )}
          </section>

          <div className="mb-6 grid grid-cols-3 gap-3">
            <StatCard
              label="Avg per hour"
              value={formatMoney(perHour)}
              backLabel="Hours worked"
              backValue={`${totalHours.toFixed(1)}h`}
            />
            <StatCard
              label="Avg per trip"
              value={formatMoney(perTrip)}
              backLabel="Trips completed"
              backValue={String(totalTrips)}
            />
            <StatCard
              label="Avg per km"
              value={formatMoney(perKm)}
              backLabel="Distance covered"
              backValue={`${totalDistanceKm}km`}
            />
          </div>

          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[17px] font-semibold tracking-tight">
              This week&apos;s shifts
            </h2>
          </div>

          <div className="flex flex-col gap-2">
            {shifts.map((shift) => (
              <ShiftListItem
                key={shift.id}
                id={shift.id}
                date={shift.date}
                platform={shift.platform}
                startTime={shift.startTime}
                endTime={shift.endTime}
                amountEarned={shift.amountEarned}
                tripsCompleted={shift.tripsCompleted}
                distanceKm={shift.distanceKm}
                startOdometer={shift.startOdometer}
                endOdometer={shift.endOdometer}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

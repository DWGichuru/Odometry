import StatCard from "@/components/dashboard/StatCard";
import { computeShiftStats, mockShifts } from "@/lib/mock-data";
import { Platform, type Shift } from "@/types/shift";

const PLATFORM_LABELS: Record<Platform, string> = {
  [Platform.UBER]: "Uber",
  [Platform.LYFT]: "Lyft",
  [Platform.DOORDASH]: "DoorDash",
};

// Tailwind needs literal class names, so platform styles are looked up, not built.
const PLATFORM_BADGE: Record<Platform, string> = {
  [Platform.UBER]:
    "bg-[color-mix(in_srgb,var(--uber)_12%,transparent)] text-uber",
  [Platform.LYFT]:
    "bg-[color-mix(in_srgb,var(--lyft)_12%,transparent)] text-lyft",
  [Platform.DOORDASH]:
    "bg-[color-mix(in_srgb,var(--doordash)_12%,transparent)] text-doordash",
};

const PLATFORM_FILL: Record<Platform, string> = {
  [Platform.UBER]: "bg-uber",
  [Platform.LYFT]: "bg-lyft",
  [Platform.DOORDASH]: "bg-doordash",
};

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const MS_PER_HOUR = 3_600_000;

function formatMoney(value: number): string {
  return `$${value.toFixed(2)}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function shiftHours(shift: Shift): number {
  return (
    (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) /
    MS_PER_HOUR
  );
}

// Mon-Sun ISO dates for the week containing the given date.
function weekOf(dateStr: string): string[] {
  const date = new Date(`${dateStr}T00:00:00Z`);
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setUTCDate(monday.getUTCDate() + i);
    return day.toISOString().slice(0, 10);
  });
}

export default function DashboardPage() {
  const stats = computeShiftStats(mockShifts);

  const perHour =
    stats.totalHours > 0 ? stats.totalEarnings / stats.totalHours : 0;
  const perTrip =
    stats.totalTrips > 0 ? stats.totalEarnings / stats.totalTrips : 0;
  const perKm =
    stats.totalDistanceKm > 0
      ? stats.totalEarnings / stats.totalDistanceKm
      : 0;

  const latestDate = mockShifts
    .map((s) => s.date)
    .sort()
    .at(-1)!;
  const weekDays = weekOf(latestDate);
  const shiftsByDate = new Map(mockShifts.map((s) => [s.date, s]));
  const maxDayEarnings = Math.max(
    ...weekDays.map((d) => shiftsByDate.get(d)?.amountEarned ?? 0),
  );

  const platformTotals = [...mockShifts]
    .sort((a, b) => b.amountEarned - a.amountEarned)
    .map((s) => ({ platform: s.platform, earned: s.amountEarned }));

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 p-4">
      <div className="flex items-center justify-between pt-2 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <span className="rounded-3xl border border-border bg-surface-raised px-3.5 py-1.5 text-[13px] font-medium text-text-secondary">
          This week
        </span>
      </div>

      <section
        aria-label="Earnings this week"
        className="mb-4 rounded-lg border border-border bg-surface bg-[radial-gradient(120%_140%_at_0%_0%,color-mix(in_srgb,var(--accent)_16%,transparent)_0%,transparent_55%)] p-5 shadow-md"
      >
        <div className="mb-2.5 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
          Earned this week
        </div>
        <div className="text-[44px] leading-none font-bold tracking-tighter tabular-nums">
          {formatMoney(stats.totalEarnings)}
        </div>
        {/* Mock trend: real week-over-week comparison arrives with persistence (feature #5) */}
        <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-3xl bg-success-muted px-2.5 py-1 text-[13px] font-semibold text-success">
          &#9650; 12% <span className="font-medium text-muted">vs last week</span>
        </div>

        <div className="mt-5 mb-1.5 flex h-18 items-end gap-2">
          {weekDays.map((date, i) => {
            const shift = shiftsByDate.get(date);
            const heightPct = shift
              ? Math.round((shift.amountEarned / maxDayEarnings) * 100)
              : 0;
            return (
              <div
                key={date}
                className="group relative flex h-full flex-1 flex-col items-center justify-end"
              >
                <span className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-10 -translate-x-1/2 translate-y-0.5 rounded-sm border border-border-light bg-surface-raised px-2 py-1 text-xs font-semibold whitespace-nowrap opacity-0 shadow-md transition group-hover:translate-y-0 group-hover:opacity-100">
                  {shift ? formatMoney(shift.amountEarned) : "No shift"}
                  <span className="block text-[10px] font-medium text-muted">
                    {DAY_LETTERS[i]}
                    {shift ? ` · ${PLATFORM_LABELS[shift.platform]}` : ""}
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
                date === latestDate ? "font-bold text-accent" : "text-faint"
              }`}
            >
              {DAY_LETTERS[i]}
            </span>
          ))}
        </div>

        <div
          className="mb-3 flex h-2.5 gap-0.5 overflow-hidden rounded-[5px]"
          role="img"
          aria-label={`Earnings by platform: ${platformTotals
            .map((p) => `${PLATFORM_LABELS[p.platform]} ${formatMoney(p.earned)}`)
            .join(", ")}`}
        >
          {platformTotals.map(({ platform, earned }) => (
            <div
              key={platform}
              className={PLATFORM_FILL[platform]}
              style={{ width: `${(earned / stats.totalEarnings) * 100}%` }}
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
                className={`h-2 w-2 rounded-[3px] ${PLATFORM_FILL[platform]}`}
              />
              {PLATFORM_LABELS[platform]}{" "}
              <span className="text-muted tabular-nums">
                {formatMoney(earned)}
              </span>
            </span>
          ))}
        </div>
      </section>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <StatCard
          label="Avg per hour"
          value={formatMoney(perHour)}
          backLabel="Hours worked"
          backValue={`${stats.totalHours.toFixed(1)}h`}
        />
        <StatCard
          label="Avg per trip"
          value={formatMoney(perTrip)}
          backLabel="Trips completed"
          backValue={String(stats.totalTrips)}
        />
        <StatCard
          label="Avg per km"
          value={formatMoney(perKm)}
          backLabel="Distance covered"
          backValue={`${stats.totalDistanceKm}km`}
        />
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[17px] font-semibold tracking-tight">
          Recent shifts
        </h2>
      </div>

      <div className="flex flex-col gap-2">
        {mockShifts.map((shift) => (
          <div
            key={shift.id}
            className="flex items-center gap-3.5 rounded-md border border-border bg-surface px-4 py-3.5 shadow-sm"
          >
            <div className="w-11 shrink-0 rounded-sm bg-surface-raised py-1.5 text-center">
              <div className="text-[17px] leading-none font-bold tracking-tight">
                {shift.date.slice(8, 10)}
              </div>
              <div className="mt-0.5 text-[10px] font-semibold tracking-wider text-muted uppercase">
                {new Date(`${shift.date}T00:00:00Z`).toLocaleDateString(
                  "en-US",
                  { month: "short", timeZone: "UTC" },
                )}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <span
                className={`mb-1 inline-block rounded-sm px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${PLATFORM_BADGE[shift.platform]}`}
              >
                {PLATFORM_LABELS[shift.platform]}
              </span>
              <div className="text-[13px] leading-relaxed text-text-secondary">
                {formatTime(shift.startTime)} &ndash; {formatTime(shift.endTime)}{" "}
                &middot; {shift.tripsCompleted} trips &middot; {shift.distanceKm}{" "}
                km
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[17px] font-bold tracking-tight tabular-nums">
                {formatMoney(shift.amountEarned)}
              </div>
              <div className="mt-0.5 text-xs font-semibold text-success">
                ${Math.round(shift.amountEarned / shiftHours(shift))}/h
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

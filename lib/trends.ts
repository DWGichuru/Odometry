export interface TrendPoint {
  period: string;
  periodLabel: string;
  tipLabel: string;
  totalEarnings: number;
  totalHours: number;
  totalTrips: number;
  totalDistanceKm: number;
  earningsPerHour: number;
  earningsPerTrip: number;
  earningsPerKm: number;
}

interface ShiftInput {
  date: string | Date;
  startTime: string | Date;
  endTime: string | Date;
  amountEarned: number;
  tripsCompleted: number;
  startOdometer: number;
  endOdometer: number;
}

function getISOWeek(d: Date): { year: number; week: number } {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: date.getUTCFullYear(), week };
}

function getMondayOfISOWeek(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const firstMonday = new Date(jan4);
  firstMonday.setUTCDate(jan4.getUTCDate() - jan4Day + 1);
  firstMonday.setUTCDate(firstMonday.getUTCDate() + (week - 1) * 7);
  return firstMonday;
}

function formatMonthShort(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
}

function formatMonthLong(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
}

function formatWeekLabel(d: Date): string {
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

function formatWeekTip(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function formatMonthLabel(year: number, month: number): string {
  return formatMonthShort(new Date(Date.UTC(year, month)));
}

function formatMonthTip(year: number, month: number): string {
  return `${formatMonthLong(new Date(Date.UTC(year, month)))} ${year}`;
}

const MS_PER_HOUR = 3_600_000;

function shiftHours(endTime: string | Date, startTime: string | Date): number {
  return (new Date(endTime).getTime() - new Date(startTime).getTime()) / MS_PER_HOUR;
}

export function aggregateTrends(
  shifts: ShiftInput[],
  period: "week" | "month" = "week",
): TrendPoint[] {
  if (period !== "week" && period !== "month") {
    period = "week";
  }

  const groups = new Map<string, ShiftInput[]>();

  for (const s of shifts) {
    const d = new Date(s.date);
    let key: string;

    if (period === "week") {
      const { year, week } = getISOWeek(d);
      key = `${year}-W${String(week).padStart(2, "0")}`;
    } else {
      key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    }

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(s);
  }

  const points: TrendPoint[] = [];

  for (const [key, groupShifts] of groups) {
    let totalEarnings = 0;
    let totalHours = 0;
    let totalTrips = 0;
    let totalDistanceKm = 0;

    for (const s of groupShifts) {
      totalEarnings += s.amountEarned;
      totalHours += shiftHours(s.endTime, s.startTime);
      totalTrips += s.tripsCompleted;
      totalDistanceKm += s.endOdometer - s.startOdometer;
    }

    const earningsPerHour = totalHours > 0 ? totalEarnings / totalHours : 0;
    const earningsPerTrip = totalTrips > 0 ? totalEarnings / totalTrips : 0;
    const earningsPerKm = totalDistanceKm > 0 ? totalEarnings / totalDistanceKm : 0;

    let periodLabel: string;
    let tipLabel: string;

    if (period === "week") {
      const [y, w] = key.split("-W");
      const monday = getMondayOfISOWeek(Number(y), Number(w));
      periodLabel = formatWeekLabel(monday);
      tipLabel = formatWeekTip(monday);
    } else {
      const [y, m] = key.split("-");
      periodLabel = formatMonthLabel(Number(y), Number(m) - 1);
      tipLabel = formatMonthTip(Number(y), Number(m) - 1);
    }

    points.push({
      period: key,
      periodLabel,
      tipLabel,
      totalEarnings,
      totalHours,
      totalTrips,
      totalDistanceKm,
      earningsPerHour,
      earningsPerTrip,
      earningsPerKm,
    });
  }

  points.sort((a, b) => a.period.localeCompare(b.period));
  return points;
}

export function formatTrendTotal(unit: string | undefined, value: number): string {
  if (unit === "$") return `$${value.toLocaleString()}`;
  const suffix = unit ? ` ${unit}` : "";
  return `${value.toLocaleString()}${suffix}`;
}

export function formatTrendRate(value: number): string {
  return `$${value.toFixed(2)}`;
}

import { kmToMiles } from "./units";

export interface ResolvedPeriod {
  start: Date;
  end: Date;
  label: string;
  filenameSuffix: string;
}

export interface ExportSummary {
  totalEarnings: number;
  totalHours: number;
  totalTrips: number;
  totalDistanceKm: number;
  earningsPerHour: number;
  earningsPerTrip: number;
  earningsPerKm: number;
  shiftCount: number;
}

export interface ShiftInput {
  startTime: string | Date;
  endTime: string | Date;
  amountEarned: number;
  tripsCompleted: number;
  startOdometer: number;
  endOdometer: number;
}

export interface CsvShiftInput {
  date: string | Date;
  platform: string;
  startTime: string | Date;
  endTime: string | Date;
  amountEarned: number;
  tripsCompleted: number;
  startOdometer: number;
  endOdometer: number;
  entrySource: string;
}

const MS_PER_HOUR = 3_600_000;

function shiftHours(end: string | Date, start: string | Date): number {
  return (new Date(end).getTime() - new Date(start).getTime()) / MS_PER_HOUR;
}

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatCsvDate(d: string | Date): string {
  return new Date(d).toISOString().slice(0, 10);
}

function formatCsvDateTime(d: string | Date): string {
  return new Date(d).toISOString().replace("T", " ").slice(0, 19);
}

export function resolveExportPeriod(
  params: Record<string, string | string[] | undefined>,
): ResolvedPeriod | { error: string } {
  const get = (key: string): string | null =>
    typeof params[key] === "string" ? (params[key] as string) : null;

  const period = get("period");
  const yearStr = get("year");
  const monthStr = get("month");
  const startStr = get("start");
  const endStr = get("end");

  if (period === "month") {
    if (!yearStr || !/^\d{4}$/.test(yearStr))
      return { error: "Year is required and must be a 4-digit number." };
    if (!monthStr || !/^(0?[1-9]|1[0-2])$/.test(monthStr))
      return { error: "Month must be a number from 1 to 12." };

    const year = Number(yearStr);
    const month = Number(monthStr);
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const label = new Date(Date.UTC(year, month - 1)).toLocaleDateString(
      "en-US",
      { month: "long", year: "numeric", timeZone: "UTC" },
    );
    const suffix = `${year}-${String(month).padStart(2, "0")}`;

    return { start, end, label, filenameSuffix: suffix };
  }

  if (period === "year") {
    if (!yearStr || !/^\d{4}$/.test(yearStr))
      return { error: "Year is required and must be a 4-digit number." };

    const year = Number(yearStr);
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year, 12, 0, 23, 59, 59, 999));

    return {
      start,
      end,
      label: String(year),
      filenameSuffix: String(year),
    };
  }

  if (period === "range") {
    if (!startStr) return { error: "Start date is required." };
    if (!endStr) return { error: "End date is required." };

    const startMatch = startStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const endMatch = endStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (!startMatch) return { error: "Start date must be in YYYY-MM-DD format." };
    if (!endMatch) return { error: "End date must be in YYYY-MM-DD format." };

    const start = new Date(
      Date.UTC(Number(startMatch[1]), Number(startMatch[2]) - 1, Number(startMatch[3])),
    );
    const end = new Date(
      Date.UTC(
        Number(endMatch[1]),
        Number(endMatch[2]) - 1,
        Number(endMatch[3]),
        23,
        59,
        59,
        999,
      ),
    );

    if (isNaN(start.getTime())) return { error: "Invalid start date." };
    if (isNaN(end.getTime())) return { error: "Invalid end date." };
    if (end < start) return { error: "End date must not be before start date." };

    const fmt = (d: Date) =>
      d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      });
    const label = `${fmt(start)} - ${fmt(end)}`;
    const suffix = `${startMatch[1]}-${startMatch[2]}-${startMatch[3]}_to_${endMatch[1]}-${endMatch[2]}-${endMatch[3]}`;

    return { start, end, label, filenameSuffix: suffix };
  }

  if (!period) return { error: "Period type is required." };
  return { error: `Unknown period type: ${period}` };
}

export function summarizeShifts(shifts: ShiftInput[]): ExportSummary {
  const shiftCount = shifts.length;

  if (shiftCount === 0) {
    return {
      totalEarnings: 0,
      totalHours: 0,
      totalTrips: 0,
      totalDistanceKm: 0,
      earningsPerHour: 0,
      earningsPerTrip: 0,
      earningsPerKm: 0,
      shiftCount: 0,
    };
  }

  let totalEarnings = 0;
  let totalHours = 0;
  let totalTrips = 0;
  let totalDistanceKm = 0;

  for (const s of shifts) {
    totalEarnings += s.amountEarned;
    totalHours += shiftHours(s.endTime, s.startTime);
    totalTrips += s.tripsCompleted;
    totalDistanceKm += s.endOdometer - s.startOdometer;
  }

  return {
    totalEarnings,
    totalHours,
    totalTrips,
    totalDistanceKm,
    earningsPerHour: totalHours > 0 ? totalEarnings / totalHours : 0,
    earningsPerTrip: totalTrips > 0 ? totalEarnings / totalTrips : 0,
    earningsPerKm: totalDistanceKm > 0 ? totalEarnings / totalDistanceKm : 0,
    shiftCount,
  };
}

const CSV_HEADERS = [
  "Date",
  "Platform",
  "Start Time",
  "End Time",
  "Hours",
  "Amount Earned",
  "Currency",
  "Trips",
  "Distance",
  "Distance Unit",
  "Entry Source",
];

export function shiftsToCsv(
  shifts: CsvShiftInput[],
  distanceUnit: "KM" | "MI",
  currencyCode: string,
): string {
  const rows = [CSV_HEADERS.join(",")];

  for (const s of shifts) {
    const hours = shiftHours(s.endTime, s.startTime);
    const distanceKm = s.endOdometer - s.startOdometer;
    const distance = distanceUnit === "MI" ? kmToMiles(distanceKm) : distanceKm;

    const fields = [
      formatCsvDate(s.date),
      s.platform,
      formatCsvDateTime(s.startTime),
      formatCsvDateTime(s.endTime),
      hours.toFixed(2),
      s.amountEarned.toFixed(2),
      currencyCode,
      String(s.tripsCompleted),
      distance.toFixed(1),
      distanceUnit,
      s.entrySource,
    ];

    rows.push(fields.map(escapeCsvField).join(","));
  }

  return rows.join("\n");
}

import { isCalendarDate } from "@/lib/shift-time";
import { Platform } from "@/types/shift";

export interface ExtractedShiftFields {
  date: string | null;
  platform: Platform | null;
  startTime: string | null;
  endTime: string | null;
  amountEarned: number | null;
  tripsCompleted: number | null;
  endOdometer: number | null;
}

function normalizePlatform(value: string): Platform | null {
  const upper = value.trim().toUpperCase();
  if (upper === Platform.UBER) return Platform.UBER;
  if (upper === Platform.LYFT) return Platform.LYFT;
  if (upper === Platform.DOORDASH) return Platform.DOORDASH;
  return null;
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return n;
}

function parseString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseDate(value: unknown): string | null {
  const text = parseString(value);
  return text && isCalendarDate(text) ? text : null;
}

const TIME_24H = /^(\d{1,2}):(\d{2})(?::\d{2})?$/;
const TIME_12H = /^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?$/i;

/** Normalizes `17:00`, `5:00 PM` or `5pm` to `HH:MM`; anything else is null. */
function parseClockTime(value: unknown): string | null {
  const text = parseString(value);
  if (!text) return null;

  let hours: number;
  let minutes: number;
  const h24 = text.match(TIME_24H);
  const h12 = text.match(TIME_12H);
  if (h24) {
    hours = Number(h24[1]);
    minutes = Number(h24[2]);
  } else if (h12) {
    const hour12 = Number(h12[1]);
    if (hour12 < 1 || hour12 > 12) return null;
    hours = (hour12 % 12) + (h12[3].toLowerCase() === "p" ? 12 : 0);
    minutes = Number(h12[2] ?? 0);
  } else {
    return null;
  }

  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function roundOrNull(value: number | null): number | null {
  return value === null ? null : Math.round(value);
}

function stripCodeFences(raw: string): string {
  let text = raw.trim();
  const fencePattern = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/;
  const match = text.match(fencePattern);
  if (match) {
    text = match[1].trim();
  }
  return text;
}

export function parseExtractionResponse(rawJson: string): ExtractedShiftFields {
  const empty: ExtractedShiftFields = {
    date: null,
    platform: null,
    startTime: null,
    endTime: null,
    amountEarned: null,
    tripsCompleted: null,
    endOdometer: null,
  };

  if (!rawJson || !rawJson.trim()) return empty;

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFences(rawJson));
  } catch {
    return empty;
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return empty;
  }

  const obj = parsed as Record<string, unknown>;

  return {
    date: parseDate(obj.date),
    platform:
      typeof obj.platform === "string"
        ? normalizePlatform(obj.platform)
        : null,
    startTime: parseClockTime(obj.startTime) ?? parseClockTime(obj.start_time),
    endTime: parseClockTime(obj.endTime) ?? parseClockTime(obj.end_time),
    amountEarned:
      parseNumber(obj.amountEarned) ??
      parseNumber(obj.amount_earned) ??
      parseNumber(obj.earnings),
    tripsCompleted: roundOrNull(
      parseNumber(obj.tripsCompleted) ??
        parseNumber(obj.trips_completed) ??
        parseNumber(obj.trips),
    ),
    endOdometer:
      parseNumber(obj.endOdometer) ??
      parseNumber(obj.end_odometer) ??
      parseNumber(obj.odometer),
  };
}

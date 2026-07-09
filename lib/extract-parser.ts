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
    date: parseString(obj.date),
    platform:
      typeof obj.platform === "string"
        ? normalizePlatform(obj.platform)
        : null,
    startTime: parseString(obj.startTime) ?? parseString(obj.start_time),
    endTime: parseString(obj.endTime) ?? parseString(obj.end_time),
    amountEarned:
      parseNumber(obj.amountEarned) ??
      parseNumber(obj.amount_earned) ??
      parseNumber(obj.earnings),
    tripsCompleted:
      parseNumber(obj.tripsCompleted) ??
      parseNumber(obj.trips_completed) ??
      parseNumber(obj.trips),
    endOdometer:
      parseNumber(obj.endOdometer) ??
      parseNumber(obj.end_odometer) ??
      parseNumber(obj.odometer),
  };
}

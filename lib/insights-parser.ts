export interface ParsedInsights {
  bestTimes: string;
  idealShiftLength: string;
  notWorking: string;
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

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function parseInsightsResponse(raw: string): ParsedInsights | null {
  if (!raw || !raw.trim()) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFences(raw));
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  const obj = parsed as Record<string, unknown>;

  const bestTimes = nonEmptyString(obj.bestTimes);
  const idealShiftLength = nonEmptyString(obj.idealShiftLength);
  const notWorking = nonEmptyString(obj.notWorking);

  if (!bestTimes || !idealShiftLength || !notWorking) {
    return null;
  }

  return { bestTimes, idealShiftLength, notWorking };
}

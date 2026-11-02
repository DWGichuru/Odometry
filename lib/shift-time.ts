export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CLOCK_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** True for a `YYYY-MM-DD` string naming a day that exists (rejects `2026-02-30`). */
export function isCalendarDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** True for a 24-hour `HH:MM` string. */
export function isClockTime(value: string): boolean {
  return CLOCK_TIME_PATTERN.test(value);
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Re-encodes an instant as the wall-clock time it showed in `timeZone`, stored as
 * UTC, the same floating form manual shifts use. A shift spanning a DST change
 * gains or loses that hour in its duration, as manual entry does.
 */
export function toFloatingTime(instant: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);

  return new Date(
    Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
      get("second"),
      instant.getUTCMilliseconds(),
    ),
  );
}

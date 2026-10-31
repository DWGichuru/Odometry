import { describe, expect, it } from "vitest";
import { isValidTimeZone, toFloatingTime } from "@/lib/shift-time";

describe("toFloatingTime", () => {
  it("stores the local wall-clock time as UTC", () => {
    const instant = new Date("2026-10-31T00:00:00Z"); // 5:00 PM PDT on Oct 30
    expect(toFloatingTime(instant, "America/Los_Angeles").toISOString()).toBe(
      "2026-10-30T17:00:00.000Z",
    );
  });

  it("moves the calendar day back when local time is before UTC midnight", () => {
    const instant = new Date("2026-10-31T06:30:00Z"); // 11:30 PM PDT on Oct 30
    expect(toFloatingTime(instant, "America/Los_Angeles").toISOString()).toBe(
      "2026-10-30T23:30:00.000Z",
    );
  });

  it("uses the offset in effect on each side of a DST change", () => {
    // US clocks fall back at 2:00 AM PDT on 2026-11-01.
    expect(toFloatingTime(new Date("2026-11-01T08:30:00Z"), "America/Los_Angeles").toISOString()).toBe(
      "2026-11-01T01:30:00.000Z",
    );
    expect(toFloatingTime(new Date("2026-11-01T10:30:00Z"), "America/Los_Angeles").toISOString()).toBe(
      "2026-11-01T02:30:00.000Z",
    );
  });

  it("handles non-hour offsets and midnight without a 24:00 hour", () => {
    expect(toFloatingTime(new Date("2026-10-30T18:30:00Z"), "Asia/Kolkata").toISOString()).toBe(
      "2026-10-31T00:00:00.000Z",
    );
  });

  it("is the identity for UTC and keeps milliseconds", () => {
    const instant = new Date("2026-10-30T12:34:56.789Z");
    expect(toFloatingTime(instant, "UTC").toISOString()).toBe(instant.toISOString());
  });
});

describe("isValidTimeZone", () => {
  it("accepts IANA zones and rejects anything else", () => {
    expect(isValidTimeZone("America/Toronto")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});

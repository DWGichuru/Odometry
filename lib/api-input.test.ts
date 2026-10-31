import { describe, expect, it } from "vitest";
import { parseSessionShiftFields, requireNumber, requireTimeZone } from "@/lib/api-input";

describe("requireNumber", () => {
  it("returns finite numbers", () => {
    expect(requireNumber({ startOdometer: 45000.5 }, "startOdometer")).toBe(45000.5);
    expect(requireNumber({ startOdometer: 0 }, "startOdometer")).toBe(0);
  });

  it.each([undefined, null, "45000", NaN, Infinity])("rejects %s", (value) => {
    expect(() => requireNumber({ startOdometer: value }, "startOdometer")).toThrow(
      "startOdometer must be a number",
    );
  });
});

describe("parseSessionShiftFields", () => {
  it("accepts a fully reviewed body", () => {
    expect(
      parseSessionShiftFields({
        date: "2026-10-29",
        platform: "LYFT",
        amountEarned: 152.75,
        tripsCompleted: 11,
      }),
    ).toEqual({ date: "2026-10-29", platform: "LYFT", amountEarned: 152.75, tripsCompleted: 11 });
  });

  it("treats missing and null fields as null so the service defaults apply", () => {
    expect(parseSessionShiftFields({ platform: null })).toEqual({
      date: null,
      platform: null,
      amountEarned: null,
      tripsCompleted: null,
    });
  });

  it.each([
    ["a non-ISO date", { date: "10/29/2026" }, "YYYY-MM-DD"],
    ["an impossible date", { date: "2026-02-30" }, "real calendar date"],
    ["an unknown platform", { platform: "BOLT" }, "platform must be one of"],
    ["lowercase platform", { platform: "uber" }, "platform must be one of"],
    ["negative earnings", { amountEarned: -1 }, "amountEarned"],
    ["string earnings", { amountEarned: "12" }, "amountEarned"],
    ["fractional trips", { tripsCompleted: 2.5 }, "tripsCompleted must be a whole number"],
  ])("rejects %s", (_label, body, message) => {
    expect(() => parseSessionShiftFields(body)).toThrow(message);
  });
});

describe("requireTimeZone", () => {
  it("returns a valid IANA zone", () => {
    expect(requireTimeZone({ timeZone: "America/Toronto" })).toBe("America/Toronto");
  });

  it.each([undefined, null, "", "Mars/Olympus", -300])("rejects %s", (value) => {
    expect(() => requireTimeZone({ timeZone: value })).toThrow("timeZone must be an IANA time zone");
  });
});

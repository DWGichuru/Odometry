import { describe, expect, it } from "vitest";
import { mergeShiftUpdate, type StoredShift } from "@/lib/shift-update";
import { KM_PER_MILE } from "@/lib/units";

const existing: StoredShift = {
  date: new Date("2026-10-30T00:00:00.000Z"),
  platform: "UBER",
  startTime: new Date("2026-10-30T17:00:00.000Z"),
  endTime: new Date("2026-10-30T21:30:00.000Z"),
  amountEarned: 120,
  tripsCompleted: 8,
  startOdometer: 1000,
  endOdometer: 1080.5,
};

describe("mergeShiftUpdate - omitted fields", () => {
  it("keeps stored km odometer values unconverted for MI users", () => {
    const { formData } = mergeShiftUpdate({ amountEarned: 50 }, existing, "MI");
    expect(formData.startOdometer).toBe("1000");
    expect(formData.endOdometer).toBe("1080.5");
    expect(formData.distance).toBe("");
    expect(formData.amountEarned).toBe("50");
  });

  it("falls back to stored times as UTC HH:MM", () => {
    const { formData } = mergeShiftUpdate({ amountEarned: 50 }, existing, "MI");
    expect(formData.startTime).toBe("17:00");
    expect(formData.endTime).toBe("21:30");
    expect(formData.date).toBe("2026-10-30");
  });

  it("reports no time fields sent", () => {
    const { timesSent } = mergeShiftUpdate({ amountEarned: 50 }, existing, "MI");
    expect(timesSent).toBe(false);
  });

  it("treats null like an omitted field", () => {
    const { formData, timesSent } = mergeShiftUpdate(
      { startTime: null, endOdometer: null } as unknown as Record<string, never>,
      existing,
      "MI",
    );
    expect(formData.startTime).toBe("17:00");
    expect(formData.endOdometer).toBe("1080.5");
    expect(timesSent).toBe(false);
  });
});

describe("mergeShiftUpdate - sent fields", () => {
  it("keeps the stored start time when only endTime is sent", () => {
    const { formData, timesSent } = mergeShiftUpdate({ endTime: "23:00" }, existing, "KM");
    expect(formData.startTime).toBe("17:00");
    expect(formData.endTime).toBe("23:00");
    expect(timesSent).toBe(true);
  });

  it("flags a date-only change as a time change", () => {
    const { timesSent } = mergeShiftUpdate({ date: "2026-10-31" }, existing, "KM");
    expect(timesSent).toBe(true);
  });

  it("converts only the odometer field the MI client sent", () => {
    const { formData } = mergeShiftUpdate({ endOdometer: 700 }, existing, "MI");
    expect(Number(formData.endOdometer)).toBeCloseTo(700 * KM_PER_MILE, 6);
    expect(formData.startOdometer).toBe("1000");
  });

  it("passes KM values through unchanged", () => {
    const { formData } = mergeShiftUpdate(
      { startOdometer: 900, endOdometer: 950 },
      existing,
      "KM",
    );
    expect(formData.startOdometer).toBe("900");
    expect(formData.endOdometer).toBe("950");
  });

  it("converts every field of a full MI payload as before", () => {
    const { formData, timesSent } = mergeShiftUpdate(
      {
        date: "2026-10-29",
        platform: "LYFT",
        startTime: "08:00",
        endTime: "12:15",
        amountEarned: "99.5",
        tripsCompleted: 6,
        odoMode: "odometer",
        startOdometer: 600,
        endOdometer: 650,
      },
      existing,
      "MI",
    );
    expect(formData).toMatchObject({
      date: "2026-10-29",
      platform: "LYFT",
      startTime: "08:00",
      endTime: "12:15",
      amountEarned: "99.5",
      tripsCompleted: "6",
      odoMode: "odometer",
      distance: "",
    });
    expect(Number(formData.startOdometer)).toBeCloseTo(600 * KM_PER_MILE, 6);
    expect(Number(formData.endOdometer)).toBeCloseTo(650 * KM_PER_MILE, 6);
    expect(timesSent).toBe(true);
  });

  it("converts distance in distance mode", () => {
    const { formData } = mergeShiftUpdate(
      { odoMode: "distance", distance: 10 },
      existing,
      "MI",
    );
    expect(formData.odoMode).toBe("distance");
    expect(Number(formData.distance)).toBeCloseTo(10 * KM_PER_MILE, 6);
    expect(formData.endOdometer).toBe("1080.5");
  });
});

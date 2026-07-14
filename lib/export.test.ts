import { describe, it, expect } from "vitest";
import {
  resolveExportPeriod,
  summarizeShifts,
  shiftsToCsv,
} from "./export";
import type { ShiftInput, CsvShiftInput } from "./export";

function shift(
  startTime: string,
  hours: number,
  earned: number,
  trips: number,
  km: number,
): ShiftInput {
  const start = new Date(startTime);
  const end = new Date(start.getTime() + hours * 3_600_000);
  return {
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    amountEarned: earned,
    tripsCompleted: trips,
    startOdometer: 1000,
    endOdometer: 1000 + km,
  };
}

function csvShift(
  date: string,
  overrides: Partial<CsvShiftInput> = {},
): CsvShiftInput {
  const start = new Date(`${date}T08:00:00Z`);
  const end = new Date(start.getTime() + 4 * 3_600_000);
  return {
    date: `${date}T00:00:00Z`,
    platform: "UBER",
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    amountEarned: 100,
    tripsCompleted: 5,
    startOdometer: 1000,
    endOdometer: 1040,
    entrySource: "MANUAL",
    ...overrides,
  };
}

describe("resolveExportPeriod", () => {
  it("resolves a month period", () => {
    const result = resolveExportPeriod({
      period: "month",
      year: "2026",
      month: "7",
    });
    if ("error" in result) throw new Error(result.error);
    expect(result.start.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(result.end.toISOString()).toBe("2026-07-31T23:59:59.999Z");
    expect(result.label).toBe("July 2026");
    expect(result.filenameSuffix).toBe("2026-07");
  });

  it("resolves a year period", () => {
    const result = resolveExportPeriod({ period: "year", year: "2026" });
    if ("error" in result) throw new Error(result.error);
    expect(result.start.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(result.end.toISOString()).toBe("2026-12-31T23:59:59.999Z");
    expect(result.label).toBe("2026");
    expect(result.filenameSuffix).toBe("2026");
  });

  it("resolves a range period", () => {
    const result = resolveExportPeriod({
      period: "range",
      start: "2026-03-01",
      end: "2026-03-15",
    });
    if ("error" in result) throw new Error(result.error);
    expect(result.start.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(result.end.toISOString()).toBe("2026-03-15T23:59:59.999Z");
    expect(result.label).toBe("Mar 1, 2026 - Mar 15, 2026");
    expect(result.filenameSuffix).toBe("2026-03-01_to_2026-03-15");
  });

  it("handles February in a leap year (29 days)", () => {
    const result = resolveExportPeriod({
      period: "month",
      year: "2024",
      month: "2",
    });
    if ("error" in result) throw new Error(result.error);
    expect(result.start.toISOString()).toBe("2024-02-01T00:00:00.000Z");
    expect(result.end.toISOString()).toBe("2024-02-29T23:59:59.999Z");
    expect(result.label).toBe("February 2024");
  });

  it("handles February in a non-leap year (28 days)", () => {
    const result = resolveExportPeriod({
      period: "month",
      year: "2025",
      month: "2",
    });
    if ("error" in result) throw new Error(result.error);
    expect(result.end.toISOString()).toBe("2025-02-28T23:59:59.999Z");
  });

  it("handles Dec-to-Jan boundary via range", () => {
    const result = resolveExportPeriod({
      period: "range",
      start: "2025-12-15",
      end: "2026-01-10",
    });
    if ("error" in result) throw new Error(result.error);
    expect(result.start.toISOString()).toBe("2025-12-15T00:00:00.000Z");
    expect(result.end.toISOString()).toBe("2026-01-10T23:59:59.999Z");
    expect(result.label).toBe("Dec 15, 2025 - Jan 10, 2026");
  });

  it("returns error for bad month number (13)", () => {
    const result = resolveExportPeriod({
      period: "month",
      year: "2026",
      month: "13",
    });
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("Month");
    }
  });

  it("returns error for bad month number (0)", () => {
    const result = resolveExportPeriod({
      period: "month",
      year: "2026",
      month: "0",
    });
    expect("error" in result).toBe(true);
  });

  it("rejects a short numeric year instead of letting Date.UTC reinterpret it", () => {
    const result = resolveExportPeriod({ period: "year", year: "99" });
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("4-digit");
    }
  });

  it("returns error for non-numeric year in month period", () => {
    const result = resolveExportPeriod({
      period: "month",
      year: "abc",
      month: "7",
    });
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("Year");
    }
  });

  it("returns error for non-numeric year in year period", () => {
    const result = resolveExportPeriod({ period: "year", year: "xyz" });
    expect("error" in result).toBe(true);
  });

  it("returns error when end is before start in range", () => {
    const result = resolveExportPeriod({
      period: "range",
      start: "2026-03-15",
      end: "2026-03-01",
    });
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("before");
    }
  });

  it("returns error for missing period type", () => {
    const result = resolveExportPeriod({});
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("Period type");
    }
  });

  it("returns error for unknown period type", () => {
    const result = resolveExportPeriod({ period: "day" });
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("Unknown");
    }
  });

  it("returns error for invalid date format in range", () => {
    const result = resolveExportPeriod({
      period: "range",
      start: "not-a-date",
      end: "2026-03-15",
    });
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("YYYY-MM-DD");
    }
  });

  it("allows leading zero in month", () => {
    const result = resolveExportPeriod({
      period: "month",
      year: "2026",
      month: "07",
    });
    if ("error" in result) throw new Error(result.error);
    expect(result.start.toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });
});

describe("summarizeShifts", () => {
  it("returns zeros for empty shifts", () => {
    const result = summarizeShifts([]);
    expect(result).toEqual({
      totalEarnings: 0,
      totalHours: 0,
      totalTrips: 0,
      totalDistanceKm: 0,
      earningsPerHour: 0,
      earningsPerTrip: 0,
      earningsPerKm: 0,
      shiftCount: 0,
    });
  });

  it("summarizes a single shift correctly", () => {
    const result = summarizeShifts([shift("2026-07-01T08:00:00Z", 4, 80, 5, 40)]);
    expect(result.shiftCount).toBe(1);
    expect(result.totalEarnings).toBe(80);
    expect(result.totalHours).toBeCloseTo(4);
    expect(result.totalTrips).toBe(5);
    expect(result.totalDistanceKm).toBe(40);
    expect(result.earningsPerHour).toBeCloseTo(20);
    expect(result.earningsPerTrip).toBeCloseTo(16);
    expect(result.earningsPerKm).toBeCloseTo(2);
  });

  it("summarizes multiple shifts", () => {
    const result = summarizeShifts([
      shift("2026-07-01T08:00:00Z", 4, 80, 5, 40),
      shift("2026-07-02T10:00:00Z", 3, 60, 4, 30),
    ]);
    expect(result.shiftCount).toBe(2);
    expect(result.totalEarnings).toBe(140);
    expect(result.totalHours).toBeCloseTo(7);
    expect(result.totalTrips).toBe(9);
    expect(result.totalDistanceKm).toBe(70);
    expect(result.earningsPerHour).toBeCloseTo(20);
    expect(result.earningsPerTrip).toBeCloseTo(15.555, 2);
    expect(result.earningsPerKm).toBeCloseTo(2);
  });

  it("returns zero rates when hours are zero", () => {
    const start = new Date("2026-07-01T08:00:00Z");
    const result = summarizeShifts([
      {
        startTime: start.toISOString(),
        endTime: start.toISOString(),
        amountEarned: 80,
        tripsCompleted: 5,
        startOdometer: 1000,
        endOdometer: 1040,
      },
    ]);
    expect(result.totalHours).toBe(0);
    expect(result.earningsPerHour).toBe(0);
    expect(result.earningsPerTrip).toBeCloseTo(16);
    expect(result.earningsPerKm).toBeCloseTo(2);
  });

  it("returns zero rates when trips are zero", () => {
    const result = summarizeShifts([shift("2026-07-01T08:00:00Z", 4, 80, 0, 40)]);
    expect(result.totalTrips).toBe(0);
    expect(result.earningsPerTrip).toBe(0);
    expect(result.earningsPerHour).toBeCloseTo(20);
    expect(result.earningsPerKm).toBeCloseTo(2);
  });

  it("returns zero rates when distance is zero", () => {
    const result = summarizeShifts([shift("2026-07-01T08:00:00Z", 4, 80, 5, 0)]);
    expect(result.totalDistanceKm).toBe(0);
    expect(result.earningsPerKm).toBe(0);
    expect(result.earningsPerHour).toBeCloseTo(20);
    expect(result.earningsPerTrip).toBeCloseTo(16);
  });
});

describe("shiftsToCsv", () => {
  it("returns header row only for empty shifts", () => {
    const result = shiftsToCsv([], "KM", "USD");
    const lines = result.split("\n");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("Date");
    expect(lines[0]).toContain("Platform");
    expect(lines[0]).toContain("Amount Earned");
    expect(lines[0]).toContain("Distance");
    expect(lines[0]).toContain("Entry Source");
  });

  it("produces one row per shift", () => {
    const result = shiftsToCsv(
      [
        csvShift("2026-07-01", { platform: "UBER" }),
        csvShift("2026-07-02", { platform: "LYFT" }),
      ],
      "KM",
      "USD",
    );
    const lines = result.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("Date");
    expect(lines[1]).toContain("UBER");
    expect(lines[2]).toContain("LYFT");
  });

  it("formats date as YYYY-MM-DD", () => {
    const result = shiftsToCsv([csvShift("2026-07-01")], "KM", "USD");
    const lines = result.split("\n");
    expect(lines[1]).toMatch(/^2026-07-01,/);
  });

  it("includes calculated hours and distance as plain numbers", () => {
    const result = shiftsToCsv([csvShift("2026-07-01")], "KM", "USD");
    const lines = result.split("\n");
    const values = lines[1].split(",");
    const hoursIdx = 4;
    const distanceIdx = 8;
    const distanceUnitIdx = 9;
    expect(Number(values[hoursIdx])).toBeCloseTo(4);
    expect(values[distanceIdx]).toBe("40.0");
    expect(values[distanceUnitIdx]).toBe("KM");
  });

  it("converts distance to miles when unit is MI", () => {
    const result = shiftsToCsv([csvShift("2026-07-01")], "MI", "USD");
    const lines = result.split("\n");
    const values = lines[1].split(",");
    const distanceIdx = 8;
    const distanceUnitIdx = 9;
    expect(Number(values[distanceIdx])).toBeCloseTo(24.9, 1);
    expect(values[distanceUnitIdx]).toBe("MI");
  });

  it("exports amount earned as a plain number with a separate currency column", () => {
    const result = shiftsToCsv(
      [csvShift("2026-07-01", { amountEarned: 1234.5 })],
      "KM",
      "USD",
    );
    const lines = result.split("\n");
    const values = lines[1].split(",");
    const amountIdx = 5;
    const currencyIdx = 6;
    expect(values[amountIdx]).toBe("1234.50");
    expect(values[currencyIdx]).toBe("USD");
  });

  it("escapes fields containing commas", () => {
    const s = csvShift("2026-07-01", { platform: "UBER,EXTRA" as never });
    const result = shiftsToCsv([s], "KM", "USD");
    const lines = result.split("\n");
    expect(lines[1]).toContain('"UBER,EXTRA"');
  });

  it("escapes fields containing double quotes", () => {
    const s = csvShift("2026-07-01", {
      platform: 'PLATFORM "X"' as never,
    });
    const result = shiftsToCsv([s], "KM", "USD");
    const lines = result.split("\n");
    expect(lines[1]).toContain('"PLATFORM ""X"""');
  });

  it("quotes fields containing newlines", () => {
    const s = csvShift("2026-07-01", { platform: "UBER\nLYFT" as never });
    const result = shiftsToCsv([s], "KM", "USD");
    expect(result).toContain('"UBER\nLYFT"');
  });

  it("includes all 11 columns in correct order", () => {
    const result = shiftsToCsv([csvShift("2026-07-01")], "KM", "USD");
    const header = result.split("\n")[0];
    const cols = header.split(",");
    expect(cols).toEqual([
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
    ]);
  });
});

import { describe, it, expect } from "vitest";
import { aggregateTrends, formatTrendTotal, formatTrendRate, formatAxisTick } from "./trends";

function shift(date: string, hours: number, earned: number, trips: number, km: number) {
  const start = new Date(`${date}T08:00:00Z`);
  const end = new Date(start.getTime() + hours * 3_600_000);
  return {
    date: `${date}T00:00:00Z`,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    amountEarned: earned,
    tripsCompleted: trips,
    startOdometer: 1000,
    endOdometer: 1000 + km,
  };
}

describe("aggregateTrends", () => {
  it("returns empty for no shifts", () => {
    expect(aggregateTrends([], "week")).toEqual([]);
    expect(aggregateTrends([], "month")).toEqual([]);
  });

  it("defaults to week for invalid period", () => {
    const s = shift("2025-06-15", 4, 80, 5, 40);
    const result = aggregateTrends([s], "day" as "week");
    expect(result).toHaveLength(1);
  });

  it("single shift computes ratios correctly", () => {
    const s = shift("2025-06-15", 4, 80, 5, 40);
    const result = aggregateTrends([s], "week");
    expect(result).toHaveLength(1);
    expect(result[0].totalEarnings).toBe(80);
    expect(result[0].totalHours).toBeCloseTo(4);
    expect(result[0].totalTrips).toBe(5);
    expect(result[0].totalDistanceKm).toBe(40);
    expect(result[0].earningsPerHour).toBeCloseTo(20);
    expect(result[0].earningsPerTrip).toBeCloseTo(16);
    expect(result[0].earningsPerKm).toBeCloseTo(2);
  });

  it("zero hours gives earningsPerHour = 0", () => {
    const start = new Date("2025-06-15T08:00:00Z");
    const end = new Date(start);
    const s = {
      date: "2025-06-15T00:00:00Z",
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      amountEarned: 80,
      tripsCompleted: 5,
      startOdometer: 1000,
      endOdometer: 1040,
    };
    const result = aggregateTrends([s], "week");
    expect(result[0].totalHours).toBe(0);
    expect(result[0].earningsPerHour).toBe(0);
  });

  it("zero trips gives earningsPerTrip = 0", () => {
    const s = shift("2025-06-15", 4, 80, 0, 40);
    const result = aggregateTrends([s], "week");
    expect(result[0].totalTrips).toBe(0);
    expect(result[0].earningsPerTrip).toBe(0);
  });

  it("groups shifts in same ISO week", () => {
    const a = shift("2025-06-16", 4, 80, 5, 40);
    const b = shift("2025-06-17", 3, 60, 4, 30);
    const result = aggregateTrends([a, b], "week");
    expect(result).toHaveLength(1);
    expect(result[0].totalEarnings).toBe(140);
    expect(result[0].totalHours).toBeCloseTo(7);
    expect(result[0].totalTrips).toBe(9);
    expect(result[0].totalDistanceKm).toBe(70);
  });

  it("groups shifts in same calendar month", () => {
    const a = shift("2025-06-10", 4, 80, 5, 40);
    const b = shift("2025-06-20", 3, 60, 4, 30);
    const result = aggregateTrends([a, b], "month");
    expect(result).toHaveLength(1);
    expect(result[0].totalEarnings).toBe(140);
  });

  it("splits shifts across different months", () => {
    const a = shift("2025-05-28", 4, 80, 5, 40);
    const b = shift("2025-06-02", 4, 80, 5, 40);
    const result = aggregateTrends([a, b], "month");
    expect(result).toHaveLength(2);
    expect(result[0].period).toBe("2025-05");
    expect(result[1].period).toBe("2025-06");
  });

  it("splits shifts across different ISO weeks", () => {
    const a = shift("2025-06-08", 4, 80, 5, 40);
    const b = shift("2025-06-09", 4, 80, 5, 40);
    const result = aggregateTrends([a, b], "week");
    expect(result).toHaveLength(2);
    expect(result[1].period > result[0].period).toBe(true);
  });

  it("formats the weekly period label as a full month/day", () => {
    const s = shift("2025-02-19", 4, 80, 5, 40);
    const result = aggregateTrends([s], "week");
    expect(result[0].periodLabel).toBe("Feb 17");
  });

  it("sorts periods oldest first", () => {
    const a = shift("2025-07-01", 4, 80, 5, 40);
    const b = shift("2025-06-01", 4, 80, 5, 40);
    const c = shift("2025-01-01", 4, 80, 5, 40);
    const result = aggregateTrends([a, b, c], "month");
    expect(result[0].period).toBe("2025-01");
    expect(result[1].period).toBe("2025-06");
    expect(result[2].period).toBe("2025-07");
  });
});

describe("formatTrendTotal", () => {
  it("formats dollar amounts", () => {
    expect(formatTrendTotal("$", 1234)).toBe("$1,234");
    expect(formatTrendTotal("$", 0)).toBe("$0");
  });

  it("formats hours", () => {
    expect(formatTrendTotal("h", 27)).toBe("27 h");
    expect(formatTrendTotal("h", 0)).toBe("0 h");
  });

  it("formats distance", () => {
    expect(formatTrendTotal("km", 310)).toBe("310 km");
  });

  it("formats trips (no unit)", () => {
    expect(formatTrendTotal("", 41)).toBe("41");
  });
});

describe("formatTrendRate", () => {
  it("formats to 2 decimal places with dollar sign", () => {
    expect(formatTrendRate(19.726)).toBe("$19.73");
    expect(formatTrendRate(0)).toBe("$0.00");
    expect(formatTrendRate(1.1)).toBe("$1.10");
  });
});

describe("formatAxisTick", () => {
  it("rounds to whole numbers when the series max is 10 or more", () => {
    expect(formatAxisTick("$", 23.33, 43)).toBe("$23");
    expect(formatAxisTick("$", 0, 43)).toBe("$0");
    expect(formatAxisTick("h", 5.6, 20)).toBe("6 h");
    expect(formatAxisTick("km", 310.4, 400)).toBe("310 km");
    expect(formatAxisTick("", 41.5, 50)).toBe("42");
    expect(formatAxisTick(undefined, 3.2, 20)).toBe("3");
  });

  it("keeps one decimal when the series max is under 10, to avoid duplicate-looking ticks", () => {
    expect(formatAxisTick("$", 2.5, 2.55)).toBe("$2.5");
    expect(formatAxisTick("$", 1.275, 2.55)).toBe("$1.3");
    expect(formatAxisTick("$", 0, 2.55)).toBe("$0.0");
  });
});

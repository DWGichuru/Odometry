import { describe, expect, it } from "vitest";
import { computeShiftStats, mockShifts } from "@/lib/mock-data";

describe("computeShiftStats", () => {
  it("returns zeros for no shifts", () => {
    expect(computeShiftStats([])).toEqual({
      totalHours: 0,
      totalEarnings: 0,
      totalTrips: 0,
      totalDistanceKm: 0,
    });
  });

  it("sums the mock shifts", () => {
    const stats = computeShiftStats(mockShifts);
    expect(stats.totalHours).toBeCloseTo(13.25);
    expect(stats.totalEarnings).toBeCloseTo(472.5);
    expect(stats.totalTrips).toBe(37);
    expect(stats.totalDistanceKm).toBe(342);
  });

  it("derives distance from odometers, not the stored distanceKm", () => {
    const [shift] = mockShifts;
    const stats = computeShiftStats([{ ...shift, distanceKm: 0 }]);
    expect(stats.totalDistanceKm).toBe(shift.endOdometer - shift.startOdometer);
  });
});

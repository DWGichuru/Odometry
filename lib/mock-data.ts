import { EntrySource, Platform, type Shift } from "@/types/shift";

// Matches prototypes/dashboard-v2.html: one car, odometer readings chain
// across shifts so distanceKm always equals endOdometer - startOdometer.
export const mockShifts: Shift[] = [
  {
    id: "shift-3",
    userId: "user-mock",
    date: "2026-07-08",
    platform: Platform.UBER,
    startTime: "2026-07-08T17:30:00",
    endTime: "2026-07-08T21:45:00",
    amountEarned: 182.0,
    tripsCompleted: 14,
    startOdometer: 45210,
    endOdometer: 45338,
    distanceKm: 128,
    entrySource: EntrySource.MANUAL,
    createdAt: "2026-07-08T21:50:00",
    updatedAt: "2026-07-08T21:50:00",
  },
  {
    id: "shift-2",
    userId: "user-mock",
    date: "2026-07-07",
    platform: Platform.DOORDASH,
    startTime: "2026-07-07T11:00:00",
    endTime: "2026-07-07T14:30:00",
    amountEarned: 104.5,
    tripsCompleted: 12,
    startOdometer: 45142,
    endOdometer: 45210,
    distanceKm: 68,
    entrySource: EntrySource.MANUAL,
    createdAt: "2026-07-07T14:35:00",
    updatedAt: "2026-07-07T14:35:00",
  },
  {
    id: "shift-1",
    userId: "user-mock",
    date: "2026-07-06",
    platform: Platform.LYFT,
    startTime: "2026-07-06T18:00:00",
    endTime: "2026-07-06T23:30:00",
    amountEarned: 186.0,
    tripsCompleted: 11,
    startOdometer: 44996,
    endOdometer: 45142,
    distanceKm: 146,
    entrySource: EntrySource.MANUAL,
    createdAt: "2026-07-06T23:40:00",
    updatedAt: "2026-07-06T23:40:00",
  },
];

export interface ShiftStats {
  totalHours: number;
  totalEarnings: number;
  totalTrips: number;
  totalDistanceKm: number;
}

const MS_PER_HOUR = 3_600_000;

export function computeShiftStats(shifts: Shift[]): ShiftStats {
  return shifts.reduce<ShiftStats>(
    (totals, shift) => ({
      totalHours:
        totals.totalHours +
        (new Date(shift.endTime).getTime() -
          new Date(shift.startTime).getTime()) /
          MS_PER_HOUR,
      totalEarnings: totals.totalEarnings + shift.amountEarned,
      totalTrips: totals.totalTrips + shift.tripsCompleted,
      totalDistanceKm:
        totals.totalDistanceKm + (shift.endOdometer - shift.startOdometer),
    }),
    { totalHours: 0, totalEarnings: 0, totalTrips: 0, totalDistanceKm: 0 },
  );
}

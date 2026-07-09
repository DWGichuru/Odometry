import { EntrySource, type Shift } from "@/types/shift";
import type { Platform } from "@/types/shift";

export interface ShiftFormData {
  date: string;
  platform: Platform;
  startTime: string;
  endTime: string;
  amountEarned: string;
  tripsCompleted: string;
  odoMode: "odometer" | "distance";
  startOdometer: string;
  distance: string;
  endOdometer: string;
}

export type ShiftEntryErrors = Partial<Record<string, string>>;

function empty(s: string): boolean {
  return s.trim() === "";
}

export function validateShiftEntry(data: ShiftFormData): ShiftEntryErrors {
  const errors: ShiftEntryErrors = {};

  if (!data.date) errors.date = "Required";
  if (!data.startTime) errors.startTime = "Required";
  if (!data.endTime) errors.endTime = "Required";

  const amount = Number(data.amountEarned);
  if (empty(data.amountEarned) || Number.isNaN(amount)) {
    errors.amountEarned = "Required";
  } else if (amount < 0) {
    errors.amountEarned = "Must be 0 or more";
  }

  const trips = Number(data.tripsCompleted);
  if (empty(data.tripsCompleted) || Number.isNaN(trips)) {
    errors.tripsCompleted = "Required";
  } else if (!Number.isInteger(trips) || trips < 0) {
    errors.tripsCompleted = "Must be a whole number (0 or more)";
  }

  const endOdo = Number(data.endOdometer);
  if (empty(data.endOdometer) || Number.isNaN(endOdo)) {
    errors.endOdometer = "Required";
  } else if (endOdo < 0) {
    errors.endOdometer = "Must be 0 or more";
  }

  if (data.odoMode === "odometer") {
    const startOdo = Number(data.startOdometer);
    if (empty(data.startOdometer) || Number.isNaN(startOdo)) {
      errors.startOdometer = "Required";
    } else if (startOdo < 0) {
      errors.startOdometer = "Must be 0 or more";
    } else if (!isNaN(endOdo) && startOdo >= endOdo) {
      errors.startOdometer = "Must be less than end odometer";
    }
  } else {
    const distance = Number(data.distance);
    if (empty(data.distance) || Number.isNaN(distance)) {
      errors.distance = "Required";
    } else if (distance <= 0) {
      errors.distance = "Must be more than 0";
    } else if (!isNaN(endOdo) && distance > endOdo) {
      errors.distance = "Cannot exceed end odometer";
    }
  }

  return errors;
}

export function isValid(entry: ShiftEntryErrors): boolean {
  return Object.keys(entry).length === 0;
}

export function buildShift(
  data: ShiftFormData,
  userId: string,
  entrySource: EntrySource = EntrySource.MANUAL,
): Shift {
  const date = data.date;
  const endOdometer = Number(data.endOdometer);
  const startOdometer =
    data.odoMode === "odometer"
      ? Number(data.startOdometer)
      : endOdometer - Number(data.distance);

  const distanceKm = Math.round((endOdometer - startOdometer) * 100) / 100;

  const startDate = new Date(`${date}T00:00:00`);
  const [sh, sm] = data.startTime.split(":").map(Number);
  const [eh, em] = data.endTime.split(":").map(Number);
  startDate.setHours(sh, sm);

  const endDate = new Date(`${date}T00:00:00`);
  endDate.setHours(eh, em);
  if (endDate <= startDate) {
    endDate.setDate(endDate.getDate() + 1);
  }

  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    userId,
    date,
    platform: data.platform,
    startTime: startDate.toISOString(),
    endTime: endDate.toISOString(),
    amountEarned: Number(data.amountEarned),
    tripsCompleted: Number(data.tripsCompleted),
    startOdometer: Math.round(startOdometer * 100) / 100,
    endOdometer,
    distanceKm,
    entrySource,
    createdAt: now,
    updatedAt: now,
  };
}

const MS_PER_HOUR = 3_600_000;

export function getShiftHours(shift: Shift): number {
  return (
    (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) /
    MS_PER_HOUR
  );
}

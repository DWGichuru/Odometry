import type { ShiftFormData } from "@/lib/shift-entry";
import { convertOdometerFieldsToKm } from "@/lib/units";

export interface ShiftUpdateBody {
  date?: string;
  platform?: string;
  startTime?: string;
  endTime?: string;
  amountEarned?: string | number;
  tripsCompleted?: string | number;
  odoMode?: "odometer" | "distance";
  startOdometer?: string | number;
  distance?: string | number;
  endOdometer?: string | number;
}

export interface StoredShift {
  date: Date;
  platform: string;
  startTime: Date;
  endTime: Date;
  amountEarned: number;
  tripsCompleted: number;
  startOdometer: number;
  endOdometer: number;
}

export interface MergedShiftUpdate {
  formData: ShiftFormData;
  timesSent: boolean;
}

function isOmitted(value: unknown): value is null | undefined {
  return value === undefined || value === null;
}

function sentOrEmpty(value: string | number | undefined | null): string {
  return isOmitted(value) ? "" : String(value);
}

// Stored manual/screenshot times are floating UTC, so the UTC clock is the
// driver's wall-clock time.
function toUtcHHMM(date: Date): string {
  return date.toISOString().slice(11, 16);
}

/**
 * Fills a partial PATCH body from the stored shift. Stored fallbacks are put in
 * the form's input shape (`HH:MM` times, km odometer) and only odometer values
 * the client sent are converted from the user's unit.
 */
export function mergeShiftUpdate(
  body: ShiftUpdateBody,
  existing: StoredShift,
  unit: "KM" | "MI",
): MergedShiftUpdate {
  const converted = convertOdometerFieldsToKm(
    {
      startOdometer: sentOrEmpty(body.startOdometer),
      distance: sentOrEmpty(body.distance),
      endOdometer: sentOrEmpty(body.endOdometer),
    },
    unit,
  );

  const formData: ShiftFormData = {
    date: String(body.date ?? existing.date.toISOString().split("T")[0]),
    platform: (body.platform ?? existing.platform) as ShiftFormData["platform"],
    startTime: String(body.startTime ?? toUtcHHMM(existing.startTime)),
    endTime: String(body.endTime ?? toUtcHHMM(existing.endTime)),
    amountEarned: String(body.amountEarned ?? existing.amountEarned),
    tripsCompleted: String(body.tripsCompleted ?? existing.tripsCompleted),
    odoMode: body.odoMode ?? "odometer",
    startOdometer: isOmitted(body.startOdometer)
      ? String(existing.startOdometer)
      : converted.startOdometer,
    distance: converted.distance,
    endOdometer: isOmitted(body.endOdometer)
      ? String(existing.endOdometer)
      : converted.endOdometer,
  };

  const timesSent =
    !isOmitted(body.date) || !isOmitted(body.startTime) || !isOmitted(body.endTime);

  return { formData, timesSent };
}

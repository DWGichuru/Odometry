export const KM_PER_MILE = 1.60934;

export function kmToMiles(km: number): number {
  return km / KM_PER_MILE;
}

export function milesToKm(mi: number): number {
  return mi * KM_PER_MILE;
}

export function formatDistance(km: number, unit: "KM" | "MI"): string {
  const value = unit === "MI" ? kmToMiles(km) : km;
  const label = unit === "MI" ? "mi" : "km";
  return `${value.toFixed(1)} ${label}`;
}

export interface OdometerFields {
  startOdometer: string;
  distance: string;
  endOdometer: string;
}

export function convertOdometerFieldsToKm(
  fields: OdometerFields,
  unit: "KM" | "MI",
): OdometerFields {
  if (unit === "KM") return fields;

  function convert(value: string): string {
    if (value.trim() === "") return value;
    const n = Number(value);
    if (Number.isNaN(n)) return value;
    return String(milesToKm(n));
  }

  return {
    startOdometer: convert(fields.startOdometer),
    distance: convert(fields.distance),
    endOdometer: convert(fields.endOdometer),
  };
}

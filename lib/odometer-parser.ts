export interface OdometerReading {
  reading: number | null;
  unit: "km" | "mi" | null;
}

function stripCodeFences(raw: string): string {
  let text = raw.trim();
  const fencePattern = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/;
  const match = text.match(fencePattern);
  if (match) {
    text = match[1].trim();
  }
  return text;
}

export function parseOdometerResponse(raw: string): OdometerReading {
  const empty: OdometerReading = { reading: null, unit: null };

  if (!raw || !raw.trim()) return empty;

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFences(raw));
  } catch {
    return empty;
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return empty;
  }

  const obj = parsed as Record<string, unknown>;

  const reading = typeof obj.reading === "number" && !Number.isNaN(obj.reading)
    ? obj.reading
    : null;

  const unit =
    typeof obj.unit === "string" &&
    (obj.unit === "km" || obj.unit === "mi")
      ? obj.unit
      : null;

  return { reading, unit };
}

export interface PlausibilityResult {
  valid: boolean;
  reading: number;
  confidence: "high" | "low";
  warnings: string[];
}

export function checkOdometerPlausibility(
  reading: number,
  lastEndOdometer: number | null,
): PlausibilityResult {
  const warnings: string[] = [];

  if (typeof reading !== "number" || Number.isNaN(reading) || reading <= 0) {
    return { valid: false, reading, confidence: "low", warnings: ["The reading is not a valid odometer value."] };
  }

  if (reading < 1000) {
    warnings.push("This looks like a trip meter, not the odometer. Point at the total-distance display, or type the number in.");
  }

  if (reading > 1_000_000) {
    warnings.push("The reading is unusually high. Double-check the photo.");
  }

  if (lastEndOdometer !== null) {
    if (reading < lastEndOdometer) {
      warnings.push("Reading is lower than your last saved shift. Did you reset the trip meter?");
    } else if (reading === lastEndOdometer) {
      warnings.push("The reading is the same as your last shift. The car may not have moved.");
    }
  }

  return {
    valid: true,
    reading,
    confidence: warnings.length === 0 ? "high" : "low",
    warnings,
  };
}

import { describe, expect, it } from "vitest";
import {
  parseOdometerResponse,
  checkOdometerPlausibility,
} from "@/lib/odometer-parser";

describe("parseOdometerResponse", () => {
  it("parses a valid JSON response with reading and km unit", () => {
    const result = parseOdometerResponse(
      JSON.stringify({ reading: 45128, unit: "km" }),
    );
    expect(result).toEqual({ reading: 45128, unit: "km" });
  });

  it("parses a valid JSON response with mi unit", () => {
    const result = parseOdometerResponse(
      JSON.stringify({ reading: 78123, unit: "mi" }),
    );
    expect(result).toEqual({ reading: 78123, unit: "mi" });
  });

  it("parses a response wrapped in markdown code fences", () => {
    const result = parseOdometerResponse(
      '```json\n{"reading": 45128, "unit": "km"}\n```',
    );
    expect(result).toEqual({ reading: 45128, unit: "km" });
  });

  it("parses a response wrapped in code fences without language tag", () => {
    const result = parseOdometerResponse(
      '```\n{"reading": 45128, "unit": "km"}\n```',
    );
    expect(result).toEqual({ reading: 45128, unit: "km" });
  });

  it("returns null reading when reading is missing", () => {
    const result = parseOdometerResponse(
      JSON.stringify({ unit: "km" }),
    );
    expect(result).toEqual({ reading: null, unit: "km" });
  });

  it("returns null unit when unit is missing", () => {
    const result = parseOdometerResponse(
      JSON.stringify({ reading: 45128 }),
    );
    expect(result).toEqual({ reading: 45128, unit: null });
  });

  it("returns null unit when unit is an unrecognized value", () => {
    const result = parseOdometerResponse(
      JSON.stringify({ reading: 45128, unit: "mph" }),
    );
    expect(result).toEqual({ reading: 45128, unit: null });
  });

  it("returns null reading when reading is not a number", () => {
    const result = parseOdometerResponse(
      JSON.stringify({ reading: "forty-five thousand", unit: "km" }),
    );
    expect(result).toEqual({ reading: null, unit: "km" });
  });

  it("returns null reading when reading is NaN", () => {
    const result = parseOdometerResponse(
      JSON.stringify({ reading: NaN, unit: "km" }),
    );
    expect(result).toEqual({ reading: null, unit: "km" });
  });

  it("returns all nulls for empty string", () => {
    const result = parseOdometerResponse("");
    expect(result).toEqual({ reading: null, unit: null });
  });

  it("returns all nulls for whitespace-only input", () => {
    const result = parseOdometerResponse("   ");
    expect(result).toEqual({ reading: null, unit: null });
  });

  it("returns all nulls for non-JSON string", () => {
    const result = parseOdometerResponse("the odometer says 45128");
    expect(result).toEqual({ reading: null, unit: null });
  });

  it("returns all nulls for a non-object JSON value (array)", () => {
    const result = parseOdometerResponse('[{"reading": 45128}]');
    expect(result).toEqual({ reading: null, unit: null });
  });

  it("returns all nulls for a non-object JSON value (string)", () => {
    const result = parseOdometerResponse('"45128"');
    expect(result).toEqual({ reading: null, unit: null });
  });

  it("handles leading/trailing whitespace around JSON", () => {
    const result = parseOdometerResponse(
      '  \n  {"reading": 45128, "unit": "km"}  \n  ',
    );
    expect(result).toEqual({ reading: 45128, unit: "km" });
  });
});

describe("checkOdometerPlausibility", () => {
  it("returns valid with high confidence for a normal reading with continuity", () => {
    const result = checkOdometerPlausibility(50000, 48219);
    expect(result.valid).toBe(true);
    expect(result.confidence).toBe("high");
    expect(result.warnings).toEqual([]);
    expect(result.reading).toBe(50000);
  });

  it("returns valid with high confidence when there is no last end odometer", () => {
    const result = checkOdometerPlausibility(50000, null);
    expect(result.valid).toBe(true);
    expect(result.confidence).toBe("high");
    expect(result.warnings).toEqual([]);
  });

  it("returns invalid for zero", () => {
    const result = checkOdometerPlausibility(0, null);
    expect(result.valid).toBe(false);
  });

  it("returns invalid for negative reading", () => {
    const result = checkOdometerPlausibility(-100, null);
    expect(result.valid).toBe(false);
  });

  it("returns invalid for NaN", () => {
    const result = checkOdometerPlausibility(NaN, null);
    expect(result.valid).toBe(false);
  });

  it("flags readings under 1000 as a probable trip meter", () => {
    const result = checkOdometerPlausibility(523, null);
    expect(result.valid).toBe(true);
    expect(result.confidence).toBe("low");
    expect(result.warnings).toContain(
      "This looks like a trip meter, not the odometer. Point at the total-distance display, or type the number in.",
    );
  });

  it("flags readings over 1,000,000 as suspicious", () => {
    const result = checkOdometerPlausibility(9_999_999, null);
    expect(result.valid).toBe(true);
    expect(result.confidence).toBe("low");
    expect(result.warnings).toContain(
      "The reading is unusually high. Double-check the photo.",
    );
  });

  it("flags continuity failure when reading is less than last end odometer", () => {
    const result = checkOdometerPlausibility(40000, 48219);
    expect(result.valid).toBe(true);
    expect(result.confidence).toBe("low");
    expect(result.warnings).toContain(
      "Reading is lower than your last saved shift. Did you reset the trip meter?",
    );
  });

  it("passes continuity when reading is greater than last end odometer", () => {
    const result = checkOdometerPlausibility(49000, 48219);
    expect(result.valid).toBe(true);
    expect(result.confidence).toBe("high");
    expect(result.warnings).toEqual([]);
  });

  it("flags when reading equals last end odometer (car did not move)", () => {
    const result = checkOdometerPlausibility(48219, 48219);
    expect(result.valid).toBe(true);
    expect(result.confidence).toBe("low");
    expect(result.warnings).toContain(
      "The reading is the same as your last shift. The car may not have moved.",
    );
  });

  it("skips continuity check when lastEndOdometer is null", () => {
    const result = checkOdometerPlausibility(100, null);
    expect(result.valid).toBe(true);
    expect(result.warnings).not.toContain(
      "Reading is lower than your last saved shift. Did you reset the trip meter?",
    );
  });

  it("returns multiple warnings when multiple checks fail", () => {
    const result = checkOdometerPlausibility(500, 1000);
    expect(result.valid).toBe(true);
    expect(result.confidence).toBe("low");
    expect(result.warnings.length).toBe(2);
    expect(result.warnings).toContain(
      "This looks like a trip meter, not the odometer. Point at the total-distance display, or type the number in.",
    );
    expect(result.warnings).toContain(
      "Reading is lower than your last saved shift. Did you reset the trip meter?",
    );
  });
});

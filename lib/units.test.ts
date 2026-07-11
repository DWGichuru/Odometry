import { describe, expect, it } from "vitest";
import {
  kmToMiles,
  milesToKm,
  formatDistance,
  convertOdometerFieldsToKm,
  KM_PER_MILE,
} from "@/lib/units";

describe("kmToMiles", () => {
  it("converts km to miles", () => {
    expect(kmToMiles(KM_PER_MILE)).toBeCloseTo(1, 5);
    expect(kmToMiles(160.934)).toBeCloseTo(100, 3);
  });

  it("converts zero", () => {
    expect(kmToMiles(0)).toBe(0);
  });
});

describe("milesToKm", () => {
  it("converts miles to km", () => {
    expect(milesToKm(1)).toBeCloseTo(KM_PER_MILE, 5);
    expect(milesToKm(100)).toBeCloseTo(160.934, 3);
  });

  it("round-trips with kmToMiles", () => {
    expect(milesToKm(kmToMiles(500))).toBeCloseTo(500, 6);
  });
});

describe("formatDistance", () => {
  it("formats km as-is with a km suffix", () => {
    expect(formatDistance(164, "KM")).toBe("164.0 km");
  });

  it("converts and formats miles with a mi suffix", () => {
    expect(formatDistance(160.934, "MI")).toBe("100.0 mi");
  });

  it("formats zero", () => {
    expect(formatDistance(0, "KM")).toBe("0.0 km");
    expect(formatDistance(0, "MI")).toBe("0.0 mi");
  });
});

describe("convertOdometerFieldsToKm", () => {
  it("passes fields through unchanged for KM", () => {
    const fields = { startOdometer: "100", distance: "50", endOdometer: "150" };
    expect(convertOdometerFieldsToKm(fields, "KM")).toEqual(fields);
  });

  it("converts each populated field from miles to km", () => {
    const result = convertOdometerFieldsToKm(
      { startOdometer: "100", distance: "", endOdometer: "150" },
      "MI",
    );
    expect(Number(result.startOdometer)).toBeCloseTo(milesToKm(100), 5);
    expect(result.distance).toBe("");
    expect(Number(result.endOdometer)).toBeCloseTo(milesToKm(150), 5);
  });

  it("leaves empty strings empty", () => {
    const result = convertOdometerFieldsToKm(
      { startOdometer: "", distance: "", endOdometer: "" },
      "MI",
    );
    expect(result).toEqual({ startOdometer: "", distance: "", endOdometer: "" });
  });

  it("leaves malformed numbers untouched", () => {
    const result = convertOdometerFieldsToKm(
      { startOdometer: "abc", distance: "", endOdometer: "150" },
      "MI",
    );
    expect(result.startOdometer).toBe("abc");
  });
});

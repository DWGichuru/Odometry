import { describe, expect, it } from "vitest";
import { parseExtractionResponse } from "@/lib/extract-parser";
import { Platform } from "@/types/shift";

describe("parseExtractionResponse", () => {
  it("parses a fully valid response", () => {
    const result = parseExtractionResponse(
      JSON.stringify({
        date: "2025-07-08",
        platform: "UBER",
        startTime: "18:00",
        endTime: "22:30",
        amountEarned: 150.0,
        tripsCompleted: 12,
        endOdometer: 45128,
      }),
    );

    expect(result.date).toBe("2025-07-08");
    expect(result.platform).toBe(Platform.UBER);
    expect(result.startTime).toBe("18:00");
    expect(result.endTime).toBe("22:30");
    expect(result.amountEarned).toBe(150);
    expect(result.tripsCompleted).toBe(12);
    expect(result.endOdometer).toBe(45128);
  });

  it("returns null for endOdometer (common -- Uber screenshots lack it)", () => {
    const result = parseExtractionResponse(
      JSON.stringify({
        date: "2025-07-08",
        platform: "UBER",
        startTime: "18:00",
        endTime: "22:30",
        amountEarned: 150.0,
        tripsCompleted: 12,
        endOdometer: null,
      }),
    );

    expect(result.endOdometer).toBeNull();
    expect(result.date).toBe("2025-07-08");
  });

  it("handles partially missing fields", () => {
    const result = parseExtractionResponse(
      JSON.stringify({
        date: "2025-07-08",
        platform: "UBER",
        amountEarned: 150.0,
      }),
    );

    expect(result.date).toBe("2025-07-08");
    expect(result.platform).toBe(Platform.UBER);
    expect(result.amountEarned).toBe(150);
    expect(result.startTime).toBeNull();
    expect(result.endTime).toBeNull();
    expect(result.tripsCompleted).toBeNull();
    expect(result.endOdometer).toBeNull();
  });

  it("returns all nulls for completely invalid JSON", () => {
    const result = parseExtractionResponse("not json at all");

    expect(result.date).toBeNull();
    expect(result.platform).toBeNull();
    expect(result.startTime).toBeNull();
    expect(result.endTime).toBeNull();
    expect(result.amountEarned).toBeNull();
    expect(result.tripsCompleted).toBeNull();
    expect(result.endOdometer).toBeNull();
  });

  it("returns all nulls for empty string", () => {
    const result = parseExtractionResponse("");

    expect(result.date).toBeNull();
    expect(result.platform).toBeNull();
  });

  it("returns all nulls for whitespace-only input", () => {
    const result = parseExtractionResponse("   \n  ");

    expect(result.date).toBeNull();
  });

  it("returns null for fields with wrong types", () => {
    const result = parseExtractionResponse(
      JSON.stringify({
        date: 20250708,
        platform: 123,
        amountEarned: "not-a-number",
        tripsCompleted: "twelve",
      }),
    );

    expect(result.date).toBeNull();
    expect(result.platform).toBeNull();
    expect(result.amountEarned).toBeNull();
    expect(result.tripsCompleted).toBeNull();
  });

  it("strips markdown code fences around JSON", () => {
    const result = parseExtractionResponse(
      '```json\n{"date":"2025-07-08","platform":"UBER","amountEarned":150}\n```',
    );

    expect(result.date).toBe("2025-07-08");
    expect(result.platform).toBe(Platform.UBER);
    expect(result.amountEarned).toBe(150);
  });

  it("strips code fences without language tag", () => {
    const result = parseExtractionResponse(
      '```\n{"date":"2025-07-08","platform":"UBER"}\n```',
    );

    expect(result.date).toBe("2025-07-08");
    expect(result.platform).toBe(Platform.UBER);
  });

  it("returns all nulls for a non-object JSON value (array)", () => {
    const result = parseExtractionResponse(JSON.stringify([1, 2, 3]));

    expect(result.date).toBeNull();
    expect(result.platform).toBeNull();
  });

  it("returns all nulls for a non-object JSON value (string)", () => {
    const result = parseExtractionResponse(JSON.stringify("just a string"));

    expect(result.date).toBeNull();
  });

  it("normalizes platform case-insensitively", () => {
    expect(
      parseExtractionResponse(
        JSON.stringify({ platform: "uber" }),
      ).platform,
    ).toBe(Platform.UBER);

    expect(
      parseExtractionResponse(
        JSON.stringify({ platform: "Uber" }),
      ).platform,
    ).toBe(Platform.UBER);

    expect(
      parseExtractionResponse(
        JSON.stringify({ platform: "UBER" }),
      ).platform,
    ).toBe(Platform.UBER);

    expect(
      parseExtractionResponse(
        JSON.stringify({ platform: "Lyft" }),
      ).platform,
    ).toBe(Platform.LYFT);

    expect(
      parseExtractionResponse(
        JSON.stringify({ platform: "DOORDASH" }),
      ).platform,
    ).toBe(Platform.DOORDASH);
  });

  it("returns null for unrecognized platform", () => {
    const result = parseExtractionResponse(
      JSON.stringify({ platform: "Bolt" }),
    );

    expect(result.platform).toBeNull();
  });

  it("handles snake_case field names from the model", () => {
    const result = parseExtractionResponse(
      JSON.stringify({
        date: "2025-07-08",
        platform: "UBER",
        start_time: "09:00",
        end_time: "17:00",
        amount_earned: 200,
        trips_completed: 8,
        end_odometer: 50000,
      }),
    );

    expect(result.startTime).toBe("09:00");
    expect(result.endTime).toBe("17:00");
    expect(result.amountEarned).toBe(200);
    expect(result.tripsCompleted).toBe(8);
    expect(result.endOdometer).toBe(50000);
  });

  it("handles alternative field names", () => {
    const result = parseExtractionResponse(
      JSON.stringify({
        date: "2025-07-08",
        platform: "UBER",
        earnings: 150,
        trips: 12,
        odometer: 45128,
      }),
    );

    expect(result.amountEarned).toBe(150);
    expect(result.tripsCompleted).toBe(12);
    expect(result.endOdometer).toBe(45128);
  });
});

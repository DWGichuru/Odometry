import { describe, expect, it } from "vitest";
import { buildInsightsPrompt } from "@/lib/openai";

const SHIFTS = [
  {
    date: "2026-06-01",
    weekday: "Monday",
    startTime: "9:00 AM",
    endTime: "1:00 PM",
    durationHours: 4,
    amountEarned: 100,
    tripsCompleted: 8,
    distanceKm: 80,
    platform: "UBER",
  },
  {
    date: "2026-06-02",
    weekday: "Tuesday",
    startTime: "10:00 AM",
    endTime: "2:00 PM",
    durationHours: 4,
    amountEarned: 90,
    tripsCompleted: 7,
    distanceKm: 75,
    platform: "LYFT",
  },
];

describe("buildInsightsPrompt", () => {
  it("includes the driver's name when provided", () => {
    const prompt = buildInsightsPrompt(SHIFTS, "Jordan");

    expect(prompt).toContain("Jordan");
  });

  it("doesn't break or emit a placeholder when the name is absent", () => {
    const prompt = buildInsightsPrompt(SHIFTS);

    expect(prompt).not.toContain("undefined");
    expect(prompt).not.toContain("null");
    expect(prompt).not.toMatch(/\bDriver\b/);
  });

  it("still embeds every shift row", () => {
    const prompt = buildInsightsPrompt(SHIFTS, "Jordan");

    expect(prompt).toContain(
      "2026-06-01 | Monday | 9:00 AM-1:00 PM | 4.00h | $100.00 | 8 trips | 80.0km | UBER",
    );
    expect(prompt).toContain(
      "2026-06-02 | Tuesday | 10:00 AM-2:00 PM | 4.00h | $90.00 | 7 trips | 75.0km | LYFT",
    );
  });

  it("writes to the driver in second person", () => {
    const prompt = buildInsightsPrompt(SHIFTS, "Jordan");

    expect(prompt).toMatch(/\byou\b/i);
    expect(prompt).toMatch(/\byour\b/i);
  });

  it("instructs the model to be honest and critical, not just encouraging", () => {
    const prompt = buildInsightsPrompt(SHIFTS, "Jordan");

    expect(prompt).toMatch(/critical/i);
    expect(prompt).toMatch(/honest/i);
  });
});

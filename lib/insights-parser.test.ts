import { describe, expect, it } from "vitest";
import { parseInsightsResponse } from "@/lib/insights-parser";

const VALID = {
  bestTimes: "You earn the most on Friday and Saturday evenings.",
  idealShiftLength: "Shifts around 5 hours earn the best per hour.",
  notWorking: "Tuesday mornings consistently earn less than the rest of the week.",
};

describe("parseInsightsResponse", () => {
  it("parses a well-formed JSON response", () => {
    expect(parseInsightsResponse(JSON.stringify(VALID))).toEqual(VALID);
  });

  it("parses a response wrapped in markdown code fences", () => {
    const raw = `\`\`\`json\n${JSON.stringify(VALID)}\n\`\`\``;
    expect(parseInsightsResponse(raw)).toEqual(VALID);
  });

  it("parses a response wrapped in code fences without a language tag", () => {
    const raw = `\`\`\`\n${JSON.stringify(VALID)}\n\`\`\``;
    expect(parseInsightsResponse(raw)).toEqual(VALID);
  });

  it("returns null for invalid JSON", () => {
    expect(parseInsightsResponse("not json")).toBeNull();
  });

  it("returns null when a field is missing", () => {
    const { notWorking: _notWorking, ...rest } = VALID;
    expect(parseInsightsResponse(JSON.stringify(rest))).toBeNull();
  });

  it("returns null when a field is an empty string", () => {
    expect(
      parseInsightsResponse(JSON.stringify({ ...VALID, bestTimes: "   " })),
    ).toBeNull();
  });

  it("returns null when a field is the wrong type", () => {
    expect(
      parseInsightsResponse(JSON.stringify({ ...VALID, idealShiftLength: 5 })),
    ).toBeNull();
  });

  it("returns null for an empty string input", () => {
    expect(parseInsightsResponse("")).toBeNull();
  });
});

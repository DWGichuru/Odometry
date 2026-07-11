import { describe, expect, it } from "vitest";
import { currencySymbol, formatMoney, isSupportedCurrency } from "@/lib/currency";

describe("isSupportedCurrency", () => {
  it("accepts the five supported codes", () => {
    expect(isSupportedCurrency("USD")).toBe(true);
    expect(isSupportedCurrency("EUR")).toBe(true);
    expect(isSupportedCurrency("GBP")).toBe(true);
    expect(isSupportedCurrency("CAD")).toBe(true);
    expect(isSupportedCurrency("AUD")).toBe(true);
  });

  it("rejects an unsupported code", () => {
    expect(isSupportedCurrency("JPY")).toBe(false);
    expect(isSupportedCurrency("")).toBe(false);
  });
});

describe("currencySymbol", () => {
  it("returns the right symbol per currency", () => {
    expect(currencySymbol("USD")).toBe("$");
    expect(currencySymbol("CAD")).toBe("$");
    expect(currencySymbol("EUR")).toBe("€");
    expect(currencySymbol("GBP")).toBe("£");
  });

  it("falls back to USD's symbol for an unsupported code", () => {
    expect(currencySymbol("JPY")).toBe("$");
  });
});

describe("formatMoney", () => {
  it("formats USD and CAD with a dollar sign", () => {
    expect(formatMoney(1234.5, "USD")).toBe("$1,234.50");
    expect(formatMoney(1234.5, "CAD")).toBe("$1,234.50");
  });

  it("formats EUR and GBP with their own symbols", () => {
    expect(formatMoney(99, "EUR")).toBe("€99.00");
    expect(formatMoney(99, "GBP")).toBe("£99.00");
  });

  it("formats zero", () => {
    expect(formatMoney(0, "USD")).toBe("$0.00");
  });

  it("falls back to USD formatting for an unsupported code", () => {
    expect(formatMoney(10, "JPY")).toBe("$10.00");
  });
});

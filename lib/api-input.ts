import { badRequest } from "@/lib/api-auth";
import type { SessionShiftFields } from "@/lib/services/shift-session";
import { isValidTimeZone } from "@/lib/shift-time";
import { Platform } from "@/types/shift";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function requireNumber(body: Record<string, unknown>, key: string): number {
  const value = body[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw badRequest(`${key} must be a number`);
  }
  return value;
}

export function requireTimeZone(body: Record<string, unknown>): string {
  const value = body.timeZone;
  if (typeof value !== "string" || !isValidTimeZone(value)) {
    throw badRequest("timeZone must be an IANA time zone, e.g. America/Toronto");
  }
  return value;
}

function optionalNonNegative(value: unknown, key: string, integer: boolean): number | null {
  if (value === undefined || value === null) return null;
  const valid =
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    (!integer || Number.isInteger(value));
  if (!valid) {
    throw badRequest(`${key} must be a ${integer ? "whole number" : "number"} of 0 or more`);
  }
  return value;
}

function optionalDate(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
    throw badRequest("date must be in YYYY-MM-DD format");
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw badRequest("date is not a real calendar date");
  }
  return value;
}

function optionalPlatform(value: unknown): Platform | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !(Object.values(Platform) as string[]).includes(value)) {
    throw badRequest(`platform must be one of ${Object.values(Platform).join(", ")}`);
  }
  return value as Platform;
}

export function parseSessionShiftFields(body: Record<string, unknown>): SessionShiftFields {
  return {
    date: optionalDate(body.date),
    platform: optionalPlatform(body.platform),
    amountEarned: optionalNonNegative(body.amountEarned, "amountEarned", false),
    tripsCompleted: optionalNonNegative(body.tripsCompleted, "tripsCompleted", true),
  };
}

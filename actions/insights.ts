"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasAccess } from "@/lib/subscription";
import { callOpenAIChat, buildInsightsPrompt } from "@/lib/openai";
import { parseInsightsResponse } from "@/lib/insights-parser";
import { alertOnFailure } from "@/lib/alert";

const MONTHLY_CAP = 5;
const MIN_SHIFTS = 5;

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export type InsightData = {
  bestTimes: string;
  idealShiftLength: string;
  notWorking: string;
  remaining: number;
  createdAt: string;
};

async function checkAccess(): Promise<{ error: string } | { userId: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in." };
  }

  const sub = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { status: true, freeTrialEndsAt: true, isLifetimeFree: true },
  });

  if (!hasAccess(sub)) {
    return { error: "Your free trial has ended. Subscribe to continue." };
  }

  return { userId: session.user.id };
}

function startOfCurrentMonthUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function countThisMonthsInsights(userId: string): Promise<number> {
  return prisma.insight.count({
    where: { userId, createdAt: { gte: startOfCurrentMonthUTC() } },
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export async function generateTrendInsights(): Promise<
  { success: true; data: InsightData } | { error: string }
> {
  const access = await checkAccess();
  if ("error" in access) return access;
  const { userId } = access;

  const usedThisMonth = await countThisMonthsInsights(userId);
  if (usedThisMonth >= MONTHLY_CAP) {
    return {
      error: "You've used all 5 insight requests this month. They reset next month.",
    };
  }

  const [shifts, user] = await Promise.all([
    prisma.shift.findMany({
      where: { userId },
      orderBy: { date: "asc" },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    }),
  ]);

  if (shifts.length < MIN_SHIFTS) {
    return { error: "Log a few more shifts before requesting insights." };
  }

  const prompt = buildInsightsPrompt(
    shifts.map((s) => ({
      date: s.date.toISOString().slice(0, 10),
      weekday: WEEKDAYS[s.startTime.getUTCDay()],
      startTime: formatTime(s.startTime),
      endTime: formatTime(s.endTime),
      durationHours: (s.endTime.getTime() - s.startTime.getTime()) / 3_600_000,
      amountEarned: s.amountEarned,
      tripsCompleted: s.tripsCompleted,
      distanceKm: s.endOdometer - s.startOdometer,
      platform: s.platform,
    })),
    user?.name ?? undefined,
  );

  let rawResponse: string;
  try {
    rawResponse = await callOpenAIChat(prompt);
  } catch (e) {
    await alertOnFailure("Trend insights generation failed", e);
    return { error: "Could not generate insights right now. Try again later." };
  }

  const parsed = parseInsightsResponse(rawResponse);
  if (!parsed) {
    await alertOnFailure(
      "Trend insights response failed to parse",
      new Error(rawResponse),
    );
    return { error: "Could not generate insights right now. Try again later." };
  }

  let insight;
  try {
    insight = await prisma.insight.create({
      data: {
        userId,
        bestTimes: parsed.bestTimes,
        idealShiftLength: parsed.idealShiftLength,
        notWorking: parsed.notWorking,
      },
    });
  } catch (err) {
    await alertOnFailure("Failed to save trend insight", err);
    throw err;
  }

  return {
    success: true,
    data: {
      bestTimes: insight.bestTimes,
      idealShiftLength: insight.idealShiftLength,
      notWorking: insight.notWorking,
      remaining: MONTHLY_CAP - (usedThisMonth + 1),
      createdAt: insight.createdAt.toISOString(),
    },
  };
}

export type InsightsStatus = {
  remaining: number;
  latest: InsightData | null;
};

export async function getInsightsStatus(): Promise<
  { success: true; data: InsightsStatus } | { error: string }
> {
  const access = await checkAccess();
  if ("error" in access) return access;
  const { userId } = access;

  const [usedThisMonth, latest] = await Promise.all([
    countThisMonthsInsights(userId),
    prisma.insight.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const remaining = Math.max(0, MONTHLY_CAP - usedThisMonth);

  return {
    success: true,
    data: {
      remaining,
      latest: latest
        ? {
            bestTimes: latest.bestTimes,
            idealShiftLength: latest.idealShiftLength,
            notWorking: latest.notWorking,
            remaining,
            createdAt: latest.createdAt.toISOString(),
          }
        : null,
    },
  };
}

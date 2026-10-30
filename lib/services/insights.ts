import { prisma } from "@/lib/prisma";
import { callOpenAIChat, buildInsightsPrompt } from "@/lib/openai";
import { parseInsightsResponse } from "@/lib/insights-parser";
import { alertOnFailure } from "@/lib/alert";
import { requireSubscription } from "@/lib/services/access";
import { fail, type ServiceFailure } from "@/lib/services/result";

const MONTHLY_CAP = 5;
const MIN_SHIFTS = 5;

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export type InsightData = {
  bestTimes: string;
  idealShiftLength: string;
  notWorking: string;
  remaining: number;
  createdAt: string;
};

export type InsightsStatus = {
  remaining: number;
  latest: InsightData | null;
};

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
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
}

export async function generateTrendInsights(
  userId: string,
): Promise<{ success: true; data: InsightData } | ServiceFailure> {
  const denied = await requireSubscription(userId);
  if (denied) return denied;

  const usedThisMonth = await countThisMonthsInsights(userId);
  if (usedThisMonth >= MONTHLY_CAP) {
    return fail(
      "RATE_LIMITED",
      "You've used all 5 insight requests this month. They reset next month.",
    );
  }

  const [shifts, user] = await Promise.all([
    prisma.shift.findMany({ where: { userId }, orderBy: { date: "asc" } }),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
  ]);

  if (shifts.length < MIN_SHIFTS) {
    return fail("UNPROCESSABLE", "Log a few more shifts before requesting insights.");
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

  const unavailable = fail("UPSTREAM_ERROR", "Could not generate insights right now. Try again later.");

  let rawResponse: string;
  try {
    rawResponse = await callOpenAIChat(prompt);
  } catch (e) {
    await alertOnFailure("Trend insights generation failed", e);
    return unavailable;
  }

  const parsed = parseInsightsResponse(rawResponse);
  if (!parsed) {
    await alertOnFailure("Trend insights response failed to parse", new Error(rawResponse));
    return unavailable;
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

export async function getInsightsStatus(
  userId: string,
): Promise<{ success: true; data: InsightsStatus } | ServiceFailure> {
  const denied = await requireSubscription(userId);
  if (denied) return denied;

  const [usedThisMonth, latest] = await Promise.all([
    countThisMonthsInsights(userId),
    prisma.insight.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } }),
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

import { prisma } from "@/lib/prisma";
import { resolveExportPeriod } from "@/lib/export";

export async function getExportContext(
  userId: string,
  params: Record<string, string | string[] | undefined>,
) {
  const period = resolveExportPeriod(params);
  if ("error" in period) return { error: period.error };

  const [user, shifts] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { currency: true, distanceUnit: true },
    }),
    prisma.shift.findMany({
      where: { userId, date: { gte: period.start, lte: period.end } },
      orderBy: { date: "asc" },
    }),
  ]);

  return {
    period,
    currency: user?.currency ?? "USD",
    distanceUnit: (user?.distanceUnit ?? "MI") as "KM" | "MI",
    shifts,
  };
}

export type ExportContext = Awaited<ReturnType<typeof getExportContext>>;

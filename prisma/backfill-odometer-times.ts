// One-off: converts ODOMETER shifts saved before the floating-time fix from real
// instants to wall-clock time. Dry run unless --apply. Rows whose times are whole
// minutes are skipped: they were rewritten as HH:MM wall-clock time by an edit, and
// a server-stamped instant almost never lands on :00.000.
//   npx tsx prisma/backfill-odometer-times.ts --tz America/Toronto --before 2026-11-01T00:00:00Z [--user a@b.com] [--apply]
import { parseArgs } from "node:util";
import { prisma } from "../lib/prisma";
import { isValidTimeZone, toFloatingTime } from "../lib/shift-time";

const { values } = parseArgs({
  options: {
    tz: { type: "string" },
    // Shifts saved after the fix deployed are already floating. This does not make
    // re-runs safe: converted rows keep their milliseconds, so --apply only once.
    before: { type: "string" },
    user: { type: "string" },
    apply: { type: "boolean", default: false },
  },
});

function isWholeMinute(d: Date): boolean {
  return d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
}

async function backfill() {
  const { tz, user, apply } = values;
  const before = new Date(values.before ?? "");
  if (!tz || !isValidTimeZone(tz) || Number.isNaN(before.getTime())) {
    throw new Error("Usage: --tz <IANA zone> --before <ISO timestamp> [--user <email>] [--apply]");
  }

  const shifts = await prisma.shift.findMany({
    where: {
      entrySource: "ODOMETER",
      createdAt: { lt: before },
      ...(user && { user: { email: user } }),
    },
    select: { id: true, startTime: true, endTime: true },
    orderBy: { startTime: "asc" },
  });

  const skipped = shifts.filter((s) => isWholeMinute(s.startTime) && isWholeMinute(s.endTime));
  const updates = shifts.filter((s) => !skipped.includes(s)).map((s) => ({
    id: s.id,
    from: [s.startTime, s.endTime],
    startTime: toFloatingTime(s.startTime, tz),
    endTime: toFloatingTime(s.endTime, tz),
  }));

  for (const u of updates) {
    console.log(
      `${u.id}  ${u.from[0].toISOString()} -> ${u.startTime.toISOString()}  ` +
        `${u.from[1].toISOString()} -> ${u.endTime.toISOString()}`,
    );
  }
  console.log(`${updates.length} ODOMETER shift(s) ${apply ? "updated" : "would be updated (dry run)"}.`);
  console.log(`${skipped.length} skipped as already wall-clock: ${skipped.map((s) => s.id).join(", ") || "none"}`);

  if (apply && updates.length > 0) {
    await prisma.$transaction(
      updates.map((u) =>
        prisma.shift.update({
          where: { id: u.id },
          data: { startTime: u.startTime, endTime: u.endTime },
        }),
      ),
    );
  }
}

backfill()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

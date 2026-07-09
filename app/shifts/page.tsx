import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ShiftListItem from "@/components/shifts/ShiftListItem";
import Link from "next/link";

export default async function ShiftsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const dbShifts = await prisma.shift.findMany({
    where: { userId: session.user.id },
    orderBy: { date: "desc" },
  });

  const shifts = dbShifts.map((s) => ({
    ...s,
    date: s.date.toISOString().slice(0, 10),
    startTime: s.startTime.toISOString(),
    endTime: s.endTime.toISOString(),
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 p-4">
      <div className="flex items-center justify-between pt-2 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">Shifts</h1>
        <Link
          href="/shifts/new"
          className="rounded-md bg-accent px-4 py-2 text-[14px] font-semibold text-accent-ink transition-opacity hover:opacity-90"
        >
          Log shift
        </Link>
      </div>

      {shifts.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-10 text-center shadow-md">
          <p className="text-[17px] font-semibold text-text-secondary">
            No shifts yet.
          </p>
          <p className="mt-2 text-[14px] text-muted">
            <Link
              href="/shifts/new"
              className="font-medium text-accent hover:underline"
            >
              Log your first shift
            </Link>
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {shifts.map((shift) => (
            <ShiftListItem
              key={shift.id}
              id={shift.id}
              date={shift.date}
              platform={shift.platform}
              startTime={shift.startTime}
              endTime={shift.endTime}
              amountEarned={shift.amountEarned}
              tripsCompleted={shift.tripsCompleted}
              distanceKm={shift.distanceKm}
              startOdometer={shift.startOdometer}
              endOdometer={shift.endOdometer}
            />
          ))}
        </div>
      )}
    </div>
  );
}

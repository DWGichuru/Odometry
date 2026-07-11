import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ShiftListItem from "@/components/shifts/ShiftListItem";
import { NoticeBanner } from "@/components/billing/NoticeBanner";
import Link from "next/link";

function daysBetween(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export default async function ShiftsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const sub = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { status: true, freeTrialEndsAt: true, isLifetimeFree: true },
  });

  const userPrefs = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { currency: true, distanceUnit: true },
  });
  const currencyCode = userPrefs?.currency ?? "USD";
  const distanceUnit = userPrefs?.distanceUnit ?? "MI";

  const trialEnd = sub?.freeTrialEndsAt
    ? new Date(sub.freeTrialEndsAt)
    : null;
  const trialDaysRemaining = trialEnd
    ? Math.max(0, daysBetween(new Date(), trialEnd))
    : 0;
  const showTrialBanner =
    sub?.status === "trialing" && !sub.isLifetimeFree && trialDaysRemaining <= 7;

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
        <div className="flex items-center gap-2">
          <Link
            href="/import"
            className="inline-flex items-center gap-1.5 rounded-md border border-accent bg-transparent px-4 py-2 text-[14px] font-semibold text-accent transition-colors hover:bg-accent-muted"
          >
            <svg
              width={15}
              height={15}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
            Import
          </Link>
          <Link
            href="/shifts/new"
            className="rounded-md bg-accent px-4 py-2 text-[14px] font-semibold text-accent-ink transition-opacity hover:opacity-90"
          >
            Log shift
          </Link>
        </div>
      </div>

      {showTrialBanner && (
        <NoticeBanner variant="warn" title={`Trial ends in ${trialDaysRemaining} day${trialDaysRemaining !== 1 ? "s" : ""}`}>
          <Link href="/billing" className="underline hover:no-underline">Subscribe now</Link> to keep logging shifts without interruption.
        </NoticeBanner>
      )}

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
              currency={currencyCode}
              distanceUnit={distanceUnit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

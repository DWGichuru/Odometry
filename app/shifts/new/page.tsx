import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ShiftForm from "@/components/shifts/ShiftForm";

export default async function NewShiftPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const userPrefs = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { currency: true, distanceUnit: true },
  });

  return (
    <div className="mx-auto w-full max-w-lg flex-1 p-4">
      <div className="pt-2 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">Log shift</h1>
        <p className="mt-1 text-[13px] text-muted">
          Enter one shift&apos;s stats. Odometer missing? Switch to distance and
          it&apos;s back-calculated.
        </p>
      </div>
      <ShiftForm
        currency={userPrefs?.currency ?? "USD"}
        distanceUnit={userPrefs?.distanceUnit ?? "MI"}
      />
    </div>
  );
}

import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ShiftForm from "@/components/shifts/ShiftForm";
import DeleteShiftButton from "@/components/shifts/DeleteShiftButton";
import Link from "next/link";

interface EditShiftPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditShiftPage({ params }: EditShiftPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const { id } = await params;

  const dbShift = await prisma.shift.findUnique({ where: { id } });

  if (!dbShift || dbShift.userId !== session.user.id) {
    notFound();
  }

  const shift = {
    id: dbShift.id,
    date: dbShift.date.toISOString().slice(0, 10),
    platform: dbShift.platform,
    startTime: dbShift.startTime.toISOString(),
    endTime: dbShift.endTime.toISOString(),
    amountEarned: dbShift.amountEarned,
    tripsCompleted: dbShift.tripsCompleted,
    startOdometer: dbShift.startOdometer,
    endOdometer: dbShift.endOdometer,
  };

  return (
    <div className="mx-auto w-full max-w-lg flex-1 p-4">
      <div className="flex items-center justify-between pt-2 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">Edit shift</h1>
        <Link
          href="/shifts"
          className="text-[14px] font-medium text-muted transition-colors hover:text-text-secondary"
        >
          Cancel
        </Link>
      </div>
      <ShiftForm shift={shift} />
      <div className="mt-6 flex justify-center">
        <DeleteShiftButton shiftId={shift.id} />
      </div>
    </div>
  );
}

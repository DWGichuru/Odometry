import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PreferencesForm from "@/components/profile/PreferencesForm";
import Link from "next/link";

function initials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function formatMemberSince(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

function daysBetween(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

const BADGE_LABELS: Record<string, string> = {
  trialing: "Free trial",
  active: "Active",
  past_due: "Past due",
  canceled: "Canceled",
};

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      currency: true,
      distanceUnit: true,
      createdAt: true,
      subscription: {
        select: {
          status: true,
          freeTrialEndsAt: true,
          isLifetimeFree: true,
        },
      },
    },
  });

  if (!user) redirect("/sign-in");

  const displayName = user.name ?? "User";
  const displayEmail = user.email ?? "";

  const sub = user.subscription;
  const trialEnd = sub?.freeTrialEndsAt
    ? new Date(sub.freeTrialEndsAt)
    : null;
  const trialDaysRemaining = trialEnd
    ? Math.max(0, daysBetween(new Date(), trialEnd))
    : 0;

  return (
    <div className="mx-auto w-full max-w-lg flex-1 p-4">
      <div className="pt-2 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
      </div>

      <div className="mx-auto mb-0 mt-2 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-accent-muted text-[28px] font-bold text-accent">
        {initials(user.name)}
      </div>

      <div className="mb-5 text-center">
        <span className="block text-xl font-bold tracking-[-0.01em]">
          {displayName}
        </span>
        <span className="mt-0.5 block text-[14px] text-muted">
          {displayEmail}
        </span>
      </div>

      <PreferencesForm
        name={displayName}
        email={displayEmail}
        plan={
          sub
            ? {
                status: sub.status as "trialing" | "active" | "past_due" | "canceled",
                label: sub.isLifetimeFree
                  ? "Lifetime Free"
                  : BADGE_LABELS[sub.status] ?? sub.status,
                trialDaysRemaining,
              }
            : null
        }
        memberSince={formatMemberSince(user.createdAt)}
        currency={user.currency}
        distanceUnit={user.distanceUnit}
      />

      <Link
        href="/billing"
        className="mt-5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-3.5 text-[15px] font-semibold text-text-secondary transition-colors hover:bg-surface-raised"
      >
        Manage billing
      </Link>

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/sign-in" });
        }}
      >
        <button
          type="submit"
          className="mt-2.5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-3.5 text-[15px] font-semibold text-danger transition-colors hover:bg-danger-muted"
        >
          <svg
            viewBox="0 0 24 24"
            width={18}
            height={18}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <path d="M10 17l5-5-5-5" />
            <path d="M15 12H3" />
          </svg>
          Sign out
        </button>
      </form>
    </div>
  );
}

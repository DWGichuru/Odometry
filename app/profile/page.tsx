import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

const CURRENCY_NAMES: Record<string, string> = {
  USD: "US Dollar",
  EUR: "Euro",
  GBP: "British Pound",
  CAD: "Canadian Dollar",
  AUD: "Australian Dollar",
};

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

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, currency: true, createdAt: true },
  });

  if (!user) redirect("/sign-in");

  const displayName = user.name ?? "User";
  const displayEmail = user.email ?? "";
  const currencyCode = user.currency ?? "USD";
  const currencyName = CURRENCY_NAMES[currencyCode] ?? currencyCode;

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

      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-md">
        <div className="flex items-center justify-between border-b border-border-light px-4 py-3.5">
          <span className="text-[14px] text-muted">Name</span>
          <span className="text-[14px] font-semibold text-text-secondary">
            {displayName}
          </span>
        </div>
        <div className="flex items-center justify-between border-b border-border-light px-4 py-3.5">
          <span className="text-[14px] text-muted">Email</span>
          <span className="text-[14px] font-semibold text-text-secondary">
            {displayEmail}
          </span>
        </div>
        <div className="flex items-center justify-between border-b border-border-light px-4 py-3.5">
          <span className="text-[14px] text-muted">Currency</span>
          <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-text-secondary">
            <span className="rounded-md bg-surface-raised px-2 py-0.5 text-[12px] font-bold tracking-[0.02em]">
              {currencyCode}
            </span>{" "}
            {currencyName}
          </span>
        </div>
        <div className="flex items-center justify-between px-4 py-3.5">
          <span className="text-[14px] text-muted">Member since</span>
          <span className="text-[14px] font-semibold text-text-secondary">
            {formatMemberSince(user.createdAt)}
          </span>
        </div>
      </div>

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/sign-in" });
        }}
      >
        <button
          type="submit"
          className="mt-5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-3.5 text-[15px] font-semibold text-danger transition-colors hover:bg-danger-muted"
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

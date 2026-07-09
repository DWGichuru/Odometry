import { auth, signOut } from "@/auth";
import Link from "next/link";

export default async function UserHeader() {
  const session = await auth();

  if (!session?.user) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Link
        href="/dashboard"
        className="text-[13px] font-medium text-muted transition-colors hover:text-text-secondary"
      >
        Dashboard
      </Link>
      <Link
        href="/shifts"
        className="text-[13px] font-medium text-muted transition-colors hover:text-text-secondary"
      >
        Shifts
      </Link>
      <span className="min-w-0 flex-1 text-right text-[13px] text-text-secondary">
        <span className="block truncate font-medium text-foreground">
          {session.user.name}
        </span>
        {session.user.email && (
          <span className="truncate text-[12px] text-muted">
            {session.user.email}
          </span>
        )}
      </span>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/sign-in" });
        }}
      >
        <button
          type="submit"
          className="cursor-pointer rounded-sm border border-border bg-surface px-3 py-1.5 text-[13px] font-medium text-muted transition-colors hover:bg-surface-raised hover:text-text-secondary"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}

import { auth, signOut } from "@/auth";

export default async function UserHeader() {
  const session = await auth();

  if (!session?.user) return null;

  return (
    <div className="flex items-center gap-3 border-b border-border-light px-4 py-3.5">
      <span className="min-w-0 flex-1 text-right">
        <span className="block truncate text-[13px] font-semibold text-foreground">
          {session.user.name}
        </span>
        {session.user.email && (
          <span className="text-[12px] text-muted">{session.user.email}</span>
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
          className="cursor-pointer rounded-lg border border-border bg-surface px-3 py-1.5 text-[13px] font-medium text-muted transition-colors hover:bg-surface-raised hover:text-text-secondary"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}

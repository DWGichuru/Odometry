import Link from "next/link";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token;

  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-8 shadow-md">
        <div className="mb-8 text-center">
          <h1 className="text-[26px] font-bold tracking-tight leading-tight">
            Set a new password
          </h1>
          <p className="mt-2 text-[14px] text-muted">
            Choose a new password for your account
          </p>
        </div>

        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <div className="rounded-sm border border-danger-muted bg-danger-muted px-4 py-6 text-center">
            <p className="text-[15px] font-semibold text-danger">Invalid link</p>
            <p className="mt-2 text-[13px] text-muted">
              This reset link is missing a token. Please request a new one.
            </p>
            <Link
              href="/forgot-password"
              className="mt-4 inline-block rounded-md bg-accent px-6 py-2.5 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90"
            >
              Request reset link
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

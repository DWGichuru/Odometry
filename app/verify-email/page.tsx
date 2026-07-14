"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { confirmEmailVerification } from "@/actions/verify-email";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [result, setResult] = useState<{
    success?: boolean;
    error?: string;
  } | null>(null);
  const [pending, setPending] = useState(false);

  if (!token) {
    return (
      <div className="mx-auto mt-20 max-w-md rounded-sm border border-danger-muted bg-danger-muted px-4 py-6 text-center">
        <p className="text-[15px] font-semibold text-danger">Invalid link</p>
        <p className="mt-2 text-[13px] text-muted">
          This verification link is missing a token. Please check your email and try again.
        </p>
      </div>
    );
  }

  async function handleVerify() {
    setPending(true);
    const res = await confirmEmailVerification(token!);
    setResult(res);
    setPending(false);
  }

  if (result?.success) {
    return (
      <div className="mx-auto mt-20 max-w-md rounded-sm border border-success-muted bg-success-muted px-4 py-6 text-center">
        <p className="text-[15px] font-semibold text-success">Email verified</p>
        <p className="mt-2 text-[13px] text-muted">
          Your email has been verified. You can now sign in.
        </p>
        <Link
          href="/sign-in"
          className="mt-4 inline-block rounded-md bg-accent px-6 py-2.5 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (result?.error) {
    return (
      <div className="mx-auto mt-20 max-w-md rounded-sm border border-danger-muted bg-danger-muted px-4 py-6 text-center">
        <p className="text-[15px] font-semibold text-danger">Verification failed</p>
        <p className="mt-2 text-[13px] text-muted">{result.error}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-20 max-w-md rounded-sm border border-border bg-surface px-4 py-6 text-center">
      <p className="text-[15px] font-semibold">Verify your email</p>
      <p className="mt-2 text-[13px] text-muted">
        Click the button below to confirm your email address.
      </p>
      <button
        type="button"
        onClick={handleVerify}
        disabled={pending}
        className="mt-4 w-full cursor-pointer rounded-md bg-accent py-3 font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Verifying..." : "Verify email"}
      </button>
    </div>
  );
}

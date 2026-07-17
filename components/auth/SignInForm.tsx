"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { sendVerificationEmail, type SendVerificationResult } from "@/actions/verify-email";

const labelClasses = "mb-1.5 block text-xs font-medium text-muted";
const inputClasses =
  "w-full rounded-sm border border-border bg-background px-3 py-2.5 text-[15px] focus:border-accent focus:ring-2 focus:ring-accent-muted focus:outline-none";

export default function SignInForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resendResult, setResendResult] = useState<SendVerificationResult | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setUnverifiedEmail(null);
    setPending(true);

    const form = new FormData(e.currentTarget);
    const email = form.get("email") as string;
    const password = form.get("password") as string;

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setPending(false);

    if (result?.error) {
      if (result.error === "email_not_verified") {
        setUnverifiedEmail(email);
      } else {
        setError("Invalid email or password.");
      }
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  async function handleResend() {
    if (!unverifiedEmail) return;
    const result = await sendVerificationEmail(unverifiedEmail);
    setResendResult(result)
  }

  if (unverifiedEmail) {
    return (
      <div className="rounded-sm border border-warning-muted bg-warning-muted px-4 py-6 text-center">
        <p className="text-[15px] font-semibold text-warning">Verify your email</p>
        <p className="mt-2 text-[13px] text-muted">
          You need to verify your email before signing in. Check your inbox for the verification link.
        </p>
        {resendResult ? (
          <p className="mt-3 text-[13px] text-success">
            {resendResult === "sent" && "Verification email resent. Check your inbox."}
            {resendResult === "skipped-cooldown" &&
              "You already requested one recently — check your inbox, or try again in a minute."}
            {resendResult === "skipped-verification" &&
              "That email is already verified. Try signing in again."}
            {resendResult === "failed" &&
              "We couldn't send that email right now. Please try again shortly."}
          </p>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            className="mt-4 w-full cursor-pointer rounded-md bg-accent py-3 font-semibold text-accent-ink transition-opacity hover:opacity-90"
          >
            Resend verification email
          </button>
        )}
        <button
          type="button"
          onClick={() => setUnverifiedEmail(null)}
          className="mt-2 w-full cursor-pointer rounded-md bg-transparent py-2 text-sm text-muted hover:text-foreground"
        >
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="email" className={labelClasses}>
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          className={inputClasses}
        />
      </div>

      <div>
        <label htmlFor="password" className={labelClasses}>
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="Your password"
          className={inputClasses}
        />
      </div>

      {error && (
        <p className="rounded-sm border border-danger-muted bg-danger-muted px-3 py-2.5 text-[13px] font-medium text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 w-full cursor-pointer rounded-md bg-accent py-3 font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}

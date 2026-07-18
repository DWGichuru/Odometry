"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/actions/password-reset";

const labelClasses = "mb-1.5 block text-xs font-medium text-muted";
const inputClasses =
  "w-full rounded-sm border border-border bg-background px-3 py-2.5 text-[15px] focus:border-accent focus:ring-2 focus:ring-accent-muted focus:outline-none";

export default function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);

    const form = new FormData(e.currentTarget);
    const email = form.get("email") as string;

    await requestPasswordReset(email);

    setPending(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-sm border border-success-muted bg-success-muted px-4 py-6 text-center">
        <p className="text-[15px] font-semibold text-success">Check your email</p>
        <p className="mt-2 text-[13px] text-muted">
          If an account exists for that email, we sent a link to reset your password.
        </p>
        <Link
          href="/sign-in"
          className="mt-4 inline-block rounded-md bg-accent px-6 py-2.5 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90"
        >
          Back to sign in
        </Link>
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

      <button
        type="submit"
        disabled={pending}
        className="mt-1 w-full cursor-pointer rounded-md bg-accent py-3 font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Sending..." : "Send reset link"}
      </button>

      <p className="text-center text-[13px] text-muted">
        <Link href="/sign-in" className="font-medium text-accent hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

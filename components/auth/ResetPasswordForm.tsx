"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { confirmPasswordReset } from "@/actions/password-reset";

const labelClasses = "mb-1.5 block text-xs font-medium text-muted";
const inputClasses =
  "w-full rounded-sm border border-border bg-background px-3 py-2.5 text-[15px] focus:border-accent focus:ring-2 focus:ring-accent-muted focus:outline-none";

export default function ResetPasswordForm({ token }: { token: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const password = passwordRef.current?.value ?? "";
    const confirm = confirmRef.current?.value ?? "";

    if (password !== confirm) {
      if (passwordRef.current) passwordRef.current.value = "";
      if (confirmRef.current) confirmRef.current.value = "";
      setError("Passwords do not match. Please re-enter.");
      return;
    }

    setPending(true);
    const result = await confirmPasswordReset(token, password);
    setPending(false);

    if (!result.success) {
      setError(result.error ?? "Something went wrong. Please try again.");
      return;
    }

    setSuccess(true);
  }

  if (success) {
    return (
      <div className="rounded-sm border border-success-muted bg-success-muted px-4 py-6 text-center">
        <p className="text-[15px] font-semibold text-success">Password updated</p>
        <p className="mt-2 text-[13px] text-muted">
          Your password has been reset. You can now sign in with your new password.
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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="password" className={labelClasses}>
          New password
        </label>
        <input
          ref={passwordRef}
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="At least 8 characters"
          className={inputClasses}
        />
      </div>

      <div>
        <label htmlFor="confirm" className={labelClasses}>
          Confirm new password
        </label>
        <input
          ref={confirmRef}
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="Re-enter password"
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
        {pending ? "Resetting..." : "Reset password"}
      </button>
    </form>
  );
}

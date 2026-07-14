"use client";

import { useActionState, useRef, useCallback, useState, type FormEvent } from "react";
import { register } from "@/actions/auth";
import Link from "next/link";

const labelClasses = "mb-1.5 block text-xs font-medium text-muted";
const inputClasses =
  "w-full rounded-sm border border-border bg-background px-3 py-2.5 text-[15px] focus:border-accent focus:ring-2 focus:ring-accent-muted focus:outline-none";

const initialState = { error: undefined as string | undefined, success: undefined as boolean | undefined };

export default function SignUpForm() {
  const [state, formAction, pending] = useActionState(register, initialState);
  const [localError, setLocalError] = useState<string | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback((e: FormEvent<HTMLFormElement>) => {
    setLocalError(null);
    const password = passwordRef.current?.value ?? "";
    const confirm = confirmRef.current?.value ?? "";

    if (password !== confirm) {
      e.preventDefault();
      if (passwordRef.current) passwordRef.current.value = "";
      if (confirmRef.current) confirmRef.current.value = "";
      setLocalError("Passwords do not match. Please re-enter.");
    }
  }, []);

  const displayError = localError ?? state?.error;

  if (state?.success) {
    return (
      <div className="rounded-sm border border-success-muted bg-success-muted px-4 py-6 text-center">
        <p className="text-[15px] font-semibold text-success">Check your email</p>
        <p className="mt-2 text-[13px] text-muted">
          We sent a verification link to your inbox. Click the link to verify your account, then sign in.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="name" className={labelClasses}>
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          placeholder="Your name"
          className={inputClasses}
        />
      </div>

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
          Confirm password
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

      {displayError && (
        <p className="rounded-sm border border-danger-muted bg-danger-muted px-3 py-2.5 text-[13px] font-medium text-danger">
          {displayError}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 w-full cursor-pointer rounded-md bg-accent py-3 font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Creating account..." : "Create account"}
      </button>

      <p className="text-center text-[13px] text-muted">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

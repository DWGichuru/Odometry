"use client";

import { useState, useTransition } from "react";
import { deleteAccount } from "@/actions/account";
import PasswordInput from "@/components/auth/PasswordInput";

const CONFIRM_WORD = "DELETE";

const labelClasses = "mb-1.5 block text-xs font-medium text-muted";
const inputClasses =
  "w-full rounded-sm border border-border bg-background px-3 py-2.5 text-[15px] focus:border-accent focus:ring-2 focus:ring-accent-muted focus:outline-none";

interface DeleteAccountProps {
  hasPassword: boolean;
}

export default function DeleteAccount({ hasPassword }: DeleteAccountProps) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canDelete = confirmText === CONFIRM_WORD && (!hasPassword || password !== "");

  function close() {
    setOpen(false);
    setConfirmText("");
    setPassword("");
    setError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await deleteAccount(hasPassword ? password : undefined);
      setError(result.error);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2.5 flex w-full cursor-pointer items-center justify-center rounded-lg px-4 py-3 text-[14px] font-medium text-muted transition-colors hover:text-danger"
      >
        Delete account
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mt-5 flex flex-col gap-4 rounded-lg border border-danger/30 bg-surface p-4"
    >
      <div>
        <h2 className="text-[15px] font-bold text-danger">Delete account</h2>
        <p className="mt-1 text-[13px] text-muted">
          This permanently deletes your account, every shift, and your insights, and
          cancels any subscription. It cannot be undone.
        </p>
      </div>

      <div>
        <label htmlFor="delete-confirm" className={labelClasses}>
          Type {CONFIRM_WORD} to confirm
        </label>
        <input
          id="delete-confirm"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          className={inputClasses}
        />
      </div>

      {hasPassword && (
        <div>
          <label htmlFor="delete-password" className={labelClasses}>
            Password
          </label>
          <PasswordInput
            id="delete-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className={inputClasses}
          />
        </div>
      )}

      {error && (
        <p className="rounded-sm border border-danger-muted bg-danger-muted px-3 py-2.5 text-[13px] font-medium text-danger">
          {error}
        </p>
      )}

      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={close}
          disabled={pending}
          className="flex-1 cursor-pointer rounded-md border border-border bg-surface py-3 text-[15px] font-semibold text-text-secondary transition-colors hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!canDelete || pending}
          className="flex-1 cursor-pointer rounded-md bg-danger py-3 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Deleting..." : "Delete forever"}
        </button>
      </div>
    </form>
  );
}

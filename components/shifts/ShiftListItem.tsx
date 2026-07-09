"use client";

import { useState } from "react";
import Link from "next/link";
import { PLATFORM_BADGE, PLATFORM_LABELS } from "@/lib/platform";
import { deleteShift } from "@/actions/shifts";

interface ShiftListItemProps {
  id: string;
  date: string;
  platform: string;
  startTime: string;
  endTime: string;
  amountEarned: number;
  tripsCompleted: number;
  distanceKm: number;
  startOdometer: number;
  endOdometer: number;
}

function formatMoney(value: number): string {
  return `$${value.toFixed(2)}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function shiftHours(endTime: string, startTime: string): number {
  return (
    (new Date(endTime).getTime() - new Date(startTime).getTime()) /
    3_600_000
  );
}

export default function ShiftListItem({
  id,
  date,
  platform,
  startTime,
  endTime,
  amountEarned,
  tripsCompleted,
  distanceKm,
}: ShiftListItemProps) {
  const hours = shiftHours(endTime, startTime);
  const perHour = hours > 0 ? amountEarned / hours : 0;
  const [confirming, setConfirming] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [deleteError, setDeleteError] = useState(false);

  if (deleted) return null;

  async function handleDelete() {
    setDeleteError(false);
    const result = await deleteShift(id);
    if (result.error) {
      setDeleteError(true);
      setConfirming(false);
      return;
    }
    setDeleted(true);
  }

  return (
    <div className="flex items-center gap-3.5 rounded-md border border-border bg-surface px-4 py-3.5 shadow-sm">
      <div className="w-11 shrink-0 rounded-sm bg-surface-raised py-1.5 text-center">
        <div className="text-[17px] leading-none font-bold tracking-tight">
          {date.slice(8, 10)}
        </div>
        <div className="mt-0.5 text-[10px] font-semibold tracking-wider text-muted uppercase">
          {new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
            month: "short",
            timeZone: "UTC",
          })}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <span
          className={`mb-1 inline-block rounded-sm px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${(PLATFORM_BADGE as Record<string, string>)[platform]}`}
        >
          {(PLATFORM_LABELS as Record<string, string>)[platform]}
        </span>
        <div className="text-[13px] leading-relaxed text-text-secondary">
          {formatTime(startTime)} &ndash; {formatTime(endTime)} &middot;{" "}
          {tripsCompleted} trips &middot; {distanceKm} km
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <Link
            href={`/shifts/${id}/edit`}
            className="text-[12px] font-medium text-muted transition-colors hover:text-accent"
          >
            Edit
          </Link>
          <span className="text-[12px] text-border">&middot;</span>
          {confirming ? (
            <>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="cursor-pointer text-[12px] font-medium text-muted transition-colors hover:text-text-secondary"
              >
                Cancel
              </button>
              <span className="text-[12px] text-border">&middot;</span>
              <button
                type="button"
                onClick={handleDelete}
                className="cursor-pointer text-[12px] font-medium text-danger transition-colors hover:opacity-80"
              >
                Confirm
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="cursor-pointer text-[12px] font-medium text-muted transition-colors hover:text-danger"
            >
              Delete
            </button>
          )}
        </div>
        {deleteError && (
          <p className="mt-1 text-[12px] font-medium text-danger">
            Could not delete. Try again.
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[17px] font-bold tracking-tight tabular-nums">
          {formatMoney(amountEarned)}
        </div>
        <div className="mt-0.5 text-xs font-semibold text-success">
          ${Math.round(perHour)}/h
        </div>
      </div>
    </div>
  );
}

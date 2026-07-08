"use client";

import { useState } from "react";

interface StatCardProps {
  label: string;
  value: string;
  backLabel: string;
  backValue: string;
}

const faceClasses =
  "relative col-start-1 row-start-1 flex min-h-[88px] flex-col justify-center rounded-md border border-border bg-surface px-4 py-3.5 shadow-sm [backface-visibility:hidden]";

export default function StatCard({
  label,
  value,
  backLabel,
  backValue,
}: StatCardProps) {
  const [flipped, setFlipped] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setFlipped((f) => !f)}
      aria-label={`${label}: ${value}. Flip to show ${backLabel.toLowerCase()}.`}
      className="group cursor-pointer text-left [perspective:800px]"
    >
      <span
        className={`grid h-full transition-transform duration-500 [transform-style:preserve-3d] ${
          flipped ? "[transform:rotateY(180deg)]" : ""
        }`}
      >
        <span className={faceClasses}>
          <FlipHint />
          <span className="block text-2xl font-bold tracking-tight tabular-nums">
            {value}
          </span>
          <span className="mt-0.5 block text-xs font-medium text-muted">
            {label}
          </span>
        </span>
        <span
          className={`${faceClasses} bg-surface-raised [transform:rotateY(180deg)]`}
        >
          <FlipHint />
          <span className="block text-2xl font-bold tracking-tight tabular-nums">
            {backValue}
          </span>
          <span className="mt-0.5 block text-xs font-medium text-muted">
            {backLabel}
          </span>
        </span>
      </span>
    </button>
  );
}

function FlipHint() {
  return (
    <svg
      className="absolute top-2.5 right-2.5 h-3 w-3 text-faint transition-colors group-hover:text-muted"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 3 4 7l4 4" />
      <path d="M4 7h16" />
      <path d="m16 21 4-4-4-4" />
      <path d="M20 17H4" />
    </svg>
  );
}

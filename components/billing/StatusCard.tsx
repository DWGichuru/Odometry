import type { ReactNode } from "react";

interface StatusCardProps {
  children: ReactNode;
}

export function StatusCard({ children }: StatusCardProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--card-shadow)] mb-4">
      {children}
    </div>
  );
}

interface StatusRowProps {
  label: string;
  children: ReactNode;
}

export function StatusRow({ label, children }: StatusRowProps) {
  return (
    <div className="flex items-center justify-between px-[18px] py-3.5 border-b border-border-light last:border-b-0">
      <span className="text-[14px] text-muted">{label}</span>
      <span className="text-[14px] font-semibold text-text-secondary">
        {children}
      </span>
    </div>
  );
}

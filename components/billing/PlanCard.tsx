import type { ReactNode } from "react";

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5"/>
    </svg>
  );
}

interface PlanFeatureProps {
  children: ReactNode;
}

function PlanFeature({ children }: PlanFeatureProps) {
  return (
    <div className="flex items-start gap-2.5 py-2 text-[14px] text-text-secondary">
      <span className="flex-none mt-0.5 text-accent"><CheckIcon /></span>
      {children}
    </div>
  );
}

export function PlanCard() {
  return (
    <div className="rounded-2xl border border-border bg-surface shadow-[var(--card-shadow)] overflow-hidden mb-4 p-[18px]">
      <div className="flex items-baseline justify-between mb-3.5">
        <span className="text-base font-bold">Pro</span>
        <span className="text-[15px] font-bold">
          $3.99<small className="text-xs font-medium text-muted">/mo</small>
        </span>
      </div>
      <PlanFeature>Unlimited shift logging across Uber, Lyft &amp; DoorDash</PlanFeature>
      <PlanFeature>Screenshot import with automatic stat extraction</PlanFeature>
      <PlanFeature>Combined earnings, hours &amp; distance dashboard</PlanFeature>
      <div className="flex items-center justify-between pt-3 mt-1.5 border-t border-border-light text-[14px]">
        <span className="text-text-secondary">Free for your first 3 months</span>
        <span className="text-success font-bold">$0</span>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { updateProfilePreferences } from "@/actions/profile";
import { StatusBadge } from "@/components/billing/StatusBadge";
import { CURRENCY_NAMES } from "@/lib/currency";

type DistanceUnit = "KM" | "MI";

interface PlanInfo {
  status: "trialing" | "active" | "past_due" | "canceled";
  label: string;
  trialDaysRemaining: number;
}

interface PreferencesFormProps {
  name: string;
  email: string;
  plan: PlanInfo | null;
  memberSince: string;
  currency: string;
  distanceUnit: DistanceUnit;
}

const selectClasses =
  "rounded-full border border-border bg-surface-raised px-2.5 py-1 text-[13px] font-bold text-text-secondary";

export default function PreferencesForm({
  name,
  email,
  plan,
  memberSince,
  currency,
  distanceUnit,
}: PreferencesFormProps) {
  const [currentCurrency, setCurrentCurrency] = useState(currency);
  const [currentUnit, setCurrentUnit] = useState<DistanceUnit>(distanceUnit);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function save(nextCurrency: string, nextUnit: DistanceUnit) {
    setError(null);
    startTransition(async () => {
      const result = await updateProfilePreferences(nextCurrency, nextUnit);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    });
  }

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-md">
        <div className="flex items-center justify-between border-b border-border-light px-4 py-3.5">
          <span className="text-[14px] text-muted">Name</span>
          <span className="text-[14px] font-semibold text-text-secondary">{name}</span>
        </div>
        <div className="flex items-center justify-between border-b border-border-light px-4 py-3.5">
          <span className="text-[14px] text-muted">Email</span>
          <span className="text-[14px] font-semibold text-text-secondary">{email}</span>
        </div>
        <div className="flex items-center justify-between border-b border-border-light px-4 py-3.5">
          <span className="text-[14px] text-muted">Plan</span>
          <span className="text-[14px] font-semibold text-text-secondary">
            {plan ? (
              <>
                <StatusBadge variant={plan.status} label={plan.label} />{" "}
                {plan.trialDaysRemaining > 0 && plan.status === "trialing" && (
                  <span className="text-[12px] font-medium text-muted">
                    {plan.trialDaysRemaining}d left
                  </span>
                )}
              </>
            ) : (
              "—"
            )}
          </span>
        </div>
        <div className="flex items-center justify-between border-b border-border-light px-4 py-3.5">
          <span className="text-[14px] text-muted">Currency</span>
          <select
            value={currentCurrency}
            onChange={(e) => {
              setCurrentCurrency(e.target.value);
              save(e.target.value, currentUnit);
            }}
            className={selectClasses}
          >
            {Object.entries(CURRENCY_NAMES).map(([code, label]) => (
              <option key={code} value={code}>
                {code} - {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-between border-b border-border-light px-4 py-3.5">
          <span className="text-[14px] text-muted">Distance unit</span>
          <select
            value={currentUnit}
            onChange={(e) => {
              const next = e.target.value as DistanceUnit;
              setCurrentUnit(next);
              save(currentCurrency, next);
            }}
            className={selectClasses}
          >
            <option value="KM">Kilometers (km)</option>
            <option value="MI">Miles (mi)</option>
          </select>
        </div>
        <div className="flex items-center justify-between px-4 py-3.5">
          <span className="text-[14px] text-muted">Member since</span>
          <span className="text-[14px] font-semibold text-text-secondary">{memberSince}</span>
        </div>
      </div>

      {(saved || error) && (
        <div
          className={`mt-2.5 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold ${
            error ? "bg-danger-muted text-danger" : "bg-success-muted text-success"
          }`}
        >
          {error ?? "✓ Saved"}
        </div>
      )}
    </>
  );
}

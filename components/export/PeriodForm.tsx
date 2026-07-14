"use client";

import { useEffect, useRef, useState } from "react";

type PeriodMode = "month" | "year" | "range";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function yearOptions(currentYear: number) {
  const years: number[] = [];
  for (let y = currentYear; y >= 2020; y--) {
    years.push(y);
  }
  return years;
}

interface PeriodFormProps {
  currentPeriod: PeriodMode;
  currentYear: string;
  currentMonth: string;
  currentStart: string;
  currentEnd: string;
}

export default function PeriodForm({
  currentPeriod,
  currentYear,
  currentMonth,
  currentStart,
  currentEnd,
}: PeriodFormProps) {
  const [mode, setMode] = useState<PeriodMode>(currentPeriod);
  const formRef = useRef<HTMLFormElement>(null);
  const isFirstRender = useRef(true);
  const todayYear = new Date().getFullYear();

  function submit() {
    formRef.current?.requestSubmit();
  }

  function submitIfRangeComplete() {
    const data = new FormData(formRef.current!);
    if (data.get("start") && data.get("end")) submit();
  }

  // Switching tabs (Month/Year/Custom) should re-query with whatever is
  // already selected, not just when the user happens to also change a
  // field's value - otherwise picking "Year" when the default year is
  // already correct never submits anything.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (mode === "range") {
      submitIfRangeComplete();
    } else {
      submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const modes: { key: PeriodMode; label: string }[] = [
    { key: "month", label: "Month" },
    { key: "year", label: "Year" },
    { key: "range", label: "Custom" },
  ];

  return (
    <form ref={formRef} method="get" action="/export">
      <input type="hidden" name="period" value={mode} />

      <div className="rounded-lg border border-border bg-surface p-[14px] shadow-[var(--card-shadow)] mb-4">
        <div className="flex gap-[2px] p-[3px] rounded-full bg-surface-raised border border-border">
          {modes.map((m) => (
            <button
              key={m.key}
              type="button"
              aria-pressed={mode === m.key}
              onClick={() => setMode(m.key)}
              className={`flex-1 h-8 rounded-full text-[13px] font-semibold cursor-pointer border-0 transition-colors ${
                mode === m.key
                  ? "bg-accent text-accent-ink"
                  : "bg-transparent text-muted"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {mode === "month" && (
          <div className="flex gap-2 mt-3">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-muted tracking-[0.02em]">
                Month
              </label>
              <select
                name="month"
                defaultValue={currentMonth}
                onChange={submit}
                className="h-[38px] px-[10px] rounded-[var(--radius-sm)] border border-border bg-surface-raised text-foreground text-[13.5px]"
              >
                {MONTHS.map((name, i) => (
                  <option key={i} value={String(i + 1)}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-muted tracking-[0.02em]">
                Year
              </label>
              <select
                name="year"
                defaultValue={currentYear}
                onChange={submit}
                className="h-[38px] px-[10px] rounded-[var(--radius-sm)] border border-border bg-surface-raised text-foreground text-[13.5px]"
              >
                {yearOptions(todayYear).map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {mode === "year" && (
          <div className="mt-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-muted tracking-[0.02em]">
                Year
              </label>
              <select
                name="year"
                defaultValue={currentYear}
                onChange={submit}
                className="h-[38px] px-[10px] rounded-[var(--radius-sm)] border border-border bg-surface-raised text-foreground text-[13.5px]"
              >
                {yearOptions(todayYear).map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {mode === "range" && (
          <div className="flex gap-2 mt-3">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-muted tracking-[0.02em]">
                Start
              </label>
              <input
                type="date"
                name="start"
                defaultValue={currentStart}
                onChange={submitIfRangeComplete}
                className="h-[38px] px-[10px] rounded-[var(--radius-sm)] border border-border bg-surface-raised text-foreground text-[13.5px]"
              />
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-muted tracking-[0.02em]">
                End
              </label>
              <input
                type="date"
                name="end"
                defaultValue={currentEnd}
                onChange={submitIfRangeComplete}
                className="h-[38px] px-[10px] rounded-[var(--radius-sm)] border border-border bg-surface-raised text-foreground text-[13.5px]"
              />
            </div>
          </div>
        )}
      </div>
    </form>
  );
}

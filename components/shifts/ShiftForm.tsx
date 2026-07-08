"use client";

import { type FormEvent, useState } from "react";
import { PLATFORM_BADGE, PLATFORM_LABELS } from "@/lib/platform";
import { Platform } from "@/types/shift";
import type { Shift } from "@/types/shift";
import {
  buildShift,
  getShiftHours,
  isValid,
  validateShiftEntry,
} from "@/lib/shift-entry";
import type { ShiftEntryErrors, ShiftFormData } from "@/lib/shift-entry";

type OdoMode = "odometer" | "distance";

function todayLocal(): string {
  return new Date().toLocaleDateString("en-CA");
}

const labelClasses = "mb-1.5 block text-xs font-medium text-muted";
const inputClasses =
  "w-full rounded-sm border border-border bg-background px-3 py-2.5 text-[15px] tabular-nums focus:border-accent focus:ring-2 focus:ring-accent-muted focus:outline-none";
const errorClasses = "mt-1 text-xs text-danger";

function formatMoney(value: number): string {
  return `$${value.toFixed(2)}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ShiftForm({ userId }: { userId: string }) {
  const [date, setDate] = useState(todayLocal());
  const [platform, setPlatform] = useState<Platform>(Platform.UBER);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [amountEarned, setAmountEarned] = useState("");
  const [tripsCompleted, setTripsCompleted] = useState("");
  const [odoMode, setOdoMode] = useState<OdoMode>("odometer");
  const [startOdometer, setStartOdometer] = useState("");
  const [distance, setDistance] = useState("");
  const [endOdometer, setEndOdometer] = useState("");

  const [errors, setErrors] = useState<ShiftEntryErrors>({});
  const [shifts, setShifts] = useState<Shift[]>([]);

  function formData(): ShiftFormData {
    return {
      date,
      platform,
      startTime,
      endTime,
      amountEarned,
      tripsCompleted,
      odoMode,
      startOdometer,
      distance,
      endOdometer,
    };
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const data = formData();
    const entryErrors = validateShiftEntry(data);
    if (!isValid(entryErrors)) {
      setErrors(entryErrors);
      return;
    }

    const shift = buildShift(data, userId);
    setShifts((prev) => [shift, ...prev]);
    setErrors({});

    setStartTime("");
    setEndTime("");
    setAmountEarned("");
    setTripsCompleted("");
    setStartOdometer("");
    setDistance("");
    setEndOdometer("");
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="mb-6 rounded-lg border border-border bg-surface p-5 shadow-md"
      >
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="date" className={labelClasses}>
              Date
            </label>
            <input
              id="date"
              name="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClasses}
            />
            {errors.date && <p className={errorClasses}>{errors.date}</p>}
          </div>

          <fieldset>
            <legend className={labelClasses}>Platform</legend>
            <div className="flex gap-1 rounded-md bg-surface-raised p-1">
              {Object.values(Platform).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlatform(p)}
                  aria-pressed={platform === p}
                  className={`flex-1 cursor-pointer rounded-sm py-2 text-[13px] font-semibold transition-colors ${
                    platform === p
                      ? "bg-surface shadow-sm"
                      : "text-muted hover:text-text-secondary"
                  }`}
                >
                  {PLATFORM_LABELS[p]}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="startTime" className={labelClasses}>
                Start time
              </label>
              <input
                id="startTime"
                name="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={inputClasses}
              />
              {errors.startTime && (
                <p className={errorClasses}>{errors.startTime}</p>
              )}
            </div>
            <div>
              <label htmlFor="endTime" className={labelClasses}>
                End time
              </label>
              <input
                id="endTime"
                name="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={inputClasses}
              />
              {errors.endTime && (
                <p className={errorClasses}>{errors.endTime}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="amountEarned" className={labelClasses}>
                Amount earned
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[15px] text-muted">
                  $
                </span>
                <input
                  id="amountEarned"
                  name="amountEarned"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amountEarned}
                  onChange={(e) => setAmountEarned(e.target.value)}
                  className={`${inputClasses} pl-7`}
                />
              </div>
              {errors.amountEarned && (
                <p className={errorClasses}>{errors.amountEarned}</p>
              )}
            </div>
            <div>
              <label htmlFor="tripsCompleted" className={labelClasses}>
                Trips completed
              </label>
              <input
                id="tripsCompleted"
                name="tripsCompleted"
                inputMode="numeric"
                placeholder="0"
                value={tripsCompleted}
                onChange={(e) => setTripsCompleted(e.target.value)}
                className={inputClasses}
              />
              {errors.tripsCompleted && (
                <p className={errorClasses}>{errors.tripsCompleted}</p>
              )}
            </div>
          </div>

          <fieldset>
            <legend className={labelClasses}>Distance entry</legend>
            <div className="mb-3 flex gap-1 rounded-md bg-surface-raised p-1">
              <button
                type="button"
                onClick={() => {
                  setOdoMode("odometer");
                  setDistance("");
                }}
                aria-pressed={odoMode === "odometer"}
                className={`flex-1 cursor-pointer rounded-sm py-2 text-[13px] font-semibold transition-colors ${
                  odoMode === "odometer"
                    ? "bg-surface shadow-sm"
                    : "text-muted hover:text-text-secondary"
                }`}
              >
                Start odometer
              </button>
              <button
                type="button"
                onClick={() => {
                  setOdoMode("distance");
                  setStartOdometer("");
                }}
                aria-pressed={odoMode === "distance"}
                className={`flex-1 cursor-pointer rounded-sm py-2 text-[13px] font-semibold transition-colors ${
                  odoMode === "distance"
                    ? "bg-surface shadow-sm"
                    : "text-muted hover:text-text-secondary"
                }`}
              >
                Distance covered
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {odoMode === "odometer" ? (
                <div>
                  <label htmlFor="startOdometer" className={labelClasses}>
                    Start odometer (km)
                  </label>
                  <input
                    id="startOdometer"
                    name="startOdometer"
                    inputMode="decimal"
                    placeholder="0"
                    value={startOdometer}
                    onChange={(e) => setStartOdometer(e.target.value)}
                    className={inputClasses}
                  />
                  {errors.startOdometer && (
                    <p className={errorClasses}>{errors.startOdometer}</p>
                  )}
                </div>
              ) : (
                <div>
                  <label htmlFor="distance" className={labelClasses}>
                    Distance covered (km)
                  </label>
                  <input
                    id="distance"
                    name="distance"
                    inputMode="decimal"
                    placeholder="0"
                    value={distance}
                    onChange={(e) => setDistance(e.target.value)}
                    className={inputClasses}
                  />
                  {errors.distance && (
                    <p className={errorClasses}>{errors.distance}</p>
                  )}
                </div>
              )}
              <div>
                <label htmlFor="endOdometer" className={labelClasses}>
                  End odometer (km)
                </label>
                <input
                  id="endOdometer"
                  name="endOdometer"
                  inputMode="decimal"
                  placeholder="0"
                  value={endOdometer}
                  onChange={(e) => setEndOdometer(e.target.value)}
                  className={inputClasses}
                />
                {errors.endOdometer && (
                  <p className={errorClasses}>{errors.endOdometer}</p>
                )}
              </div>
            </div>
          </fieldset>

          <button
            type="submit"
            className="mt-1 w-full cursor-pointer rounded-md bg-accent py-3 font-semibold text-accent-ink transition-opacity hover:opacity-90"
          >
            Add shift
          </button>
        </div>
      </form>

      {shifts.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-[17px] font-semibold tracking-tight">
              Entered shifts
            </h2>
            <span className="rounded-3xl border border-border bg-surface-raised px-2.5 py-0.5 text-[11px] font-medium text-muted">
              Not saved yet
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {shifts.map((shift) => {
              const hours = getShiftHours(shift);
              const perHour =
                hours > 0 ? shift.amountEarned / hours : 0;

              return (
                <div
                  key={shift.id}
                  className="flex items-center gap-3.5 rounded-md border border-border bg-surface px-4 py-3.5 shadow-sm"
                >
                  <div className="w-11 shrink-0 rounded-sm bg-surface-raised py-1.5 text-center">
                    <div className="text-[17px] leading-none font-bold tracking-tight">
                      {shift.date.slice(8, 10)}
                    </div>
                    <div className="mt-0.5 text-[10px] font-semibold tracking-wider text-muted uppercase">
                      {new Date(
                        `${shift.date}T00:00:00`,
                      ).toLocaleDateString("en-US", {
                        month: "short",
                      })}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <span
                      className={`mb-1 inline-block rounded-sm px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${PLATFORM_BADGE[shift.platform]}`}
                    >
                      {PLATFORM_LABELS[shift.platform]}
                    </span>
                    <div className="text-[13px] leading-relaxed text-text-secondary">
                      {formatTime(shift.startTime)} &ndash;{" "}
                      {formatTime(shift.endTime)} &middot; {shift.tripsCompleted}{" "}
                      trips &middot; {shift.distanceKm} km
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[17px] font-bold tracking-tight tabular-nums">
                      {formatMoney(shift.amountEarned)}
                    </div>
                    <div className="mt-0.5 text-xs font-semibold text-success">
                      ${Math.round(perHour)}/h
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

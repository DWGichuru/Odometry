"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PLATFORM_LABELS } from "@/lib/platform";
import { Platform } from "@/types/shift";
import { isValid, validateShiftEntry } from "@/lib/shift-entry";
import type { ShiftEntryErrors, ShiftFormData } from "@/lib/shift-entry";
import { createShift, updateShift } from "@/actions/shifts";

type OdoMode = "odometer" | "distance";

interface ShiftFormProps {
  shift?: {
    id: string;
    date: string;
    platform: string;
    startTime: string;
    endTime: string;
    amountEarned: number;
    tripsCompleted: number;
    startOdometer: number;
    endOdometer: number;
  };
}

function todayLocal(): string {
  return new Date().toLocaleDateString("en-CA");
}

const labelClasses = "mb-1.5 block text-xs font-medium text-muted";
const inputClasses =
  "w-full rounded-sm border border-border bg-background px-3 py-2.5 text-[15px] tabular-nums focus:border-accent focus:ring-2 focus:ring-accent-muted focus:outline-none";
const errorClasses = "mt-1 text-xs text-danger";

export default function ShiftForm({ shift }: ShiftFormProps) {
  const router = useRouter();
  const editing = Boolean(shift);

  const [date, setDate] = useState(shift?.date ?? todayLocal());
  const [platform, setPlatform] = useState<Platform>(
    (shift?.platform as Platform) ?? Platform.UBER,
  );
  const [startTime, setStartTime] = useState(
    shift
      ? new Date(shift.startTime).toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "UTC",
        })
      : "",
  );
  const [endTime, setEndTime] = useState(
    shift
      ? new Date(shift.endTime).toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "UTC",
        })
      : "",
  );
  const [amountEarned, setAmountEarned] = useState(
    shift ? String(shift.amountEarned) : "",
  );
  const [tripsCompleted, setTripsCompleted] = useState(
    shift ? String(shift.tripsCompleted) : "",
  );
  const [odoMode, setOdoMode] = useState<OdoMode>("odometer");
  const [startOdometer, setStartOdometer] = useState(
    shift ? String(shift.startOdometer) : "",
  );
  const [distance, setDistance] = useState("");
  const [endOdometer, setEndOdometer] = useState(
    shift ? String(shift.endOdometer) : "",
  );

  const [errors, setErrors] = useState<ShiftEntryErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setServerError(null);
    setSaved(false);

    const data = formData();
    const entryErrors = validateShiftEntry(data);
    if (!isValid(entryErrors)) {
      setErrors(entryErrors);
      return;
    }

    setSaving(true);

    const fd = new FormData();
    fd.set("date", date);
    fd.set("platform", platform);
    fd.set("startTime", startTime);
    fd.set("endTime", endTime);
    fd.set("amountEarned", amountEarned);
    fd.set("tripsCompleted", tripsCompleted);
    fd.set("odoMode", odoMode);
    fd.set("startOdometer", startOdometer);
    fd.set("distance", distance);
    fd.set("endOdometer", endOdometer);

    const result = editing
      ? await updateShift(shift!.id, undefined, fd)
      : await createShift(undefined, fd);
    setSaving(false);

    if (result.error) {
      setServerError(result.error);
      return;
    }

    if (editing) {
      router.push("/shifts");
      return;
    }

    setSaved(true);
    setStartTime("");
    setEndTime("");
    setAmountEarned("");
    setTripsCompleted("");
    setStartOdometer("");
    setDistance("");
    setEndOdometer("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-border bg-surface p-5 shadow-md"
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
          <div className="min-w-0">
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
          <div className="min-w-0">
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

        {serverError && (
          <p className="rounded-sm border border-danger-muted bg-danger-muted px-3 py-2.5 text-[13px] font-medium text-danger">
            {serverError}
          </p>
        )}

        {saved && (
          <p className="rounded-sm border border-success-muted bg-success-muted px-3 py-2.5 text-[13px] font-medium text-success">
            Shift saved.
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="mt-1 w-full cursor-pointer rounded-md bg-accent py-3 font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving..." : editing ? "Save changes" : "Add shift"}
        </button>
      </div>
    </form>
  );
}

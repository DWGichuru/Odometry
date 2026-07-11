"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Platform, EntrySource } from "@/types/shift";
import { PLATFORM_LABELS } from "@/lib/platform";
import { extractShiftFromScreenshot } from "@/actions/import";
import { createShift } from "@/actions/shifts";
import { getProfilePreferences } from "@/actions/profile";
import { currencySymbol } from "@/lib/currency";
import type { ExtractedShiftFields } from "@/lib/extract-parser";

type Step = "input" | "loading" | "review";

const labelClasses = "mb-1.5 block text-xs font-medium text-muted";
const inputClasses =
  "w-full rounded-md border border-border bg-background px-3 py-2.5 text-[15px] tabular-nums focus:border-accent focus:ring-2 focus:ring-accent-muted focus:outline-none";

export default function ImportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("input");
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [extractError, setExtractError] = useState(false);

  const [reviewData, setReviewData] = useState<ExtractedShiftFields>(defaultFields());
  const [startOdo, setStartOdo] = useState("");
  const [endOdo, setEndOdo] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [distanceUnit, setDistanceUnit] = useState<"KM" | "MI">("MI");

  useEffect(() => {
    getProfilePreferences().then((result) => {
      if ("error" in result) return;
      setCurrency(result.currency);
      setDistanceUnit(result.distanceUnit);
    });
  }, []);

  const distanceLabel = distanceUnit === "MI" ? "mi" : "km";
  const moneySymbol = currencySymbol(currency);

  function defaultFields(): ExtractedShiftFields {
    return {
      date: "",
      platform: Platform.UBER,
      startTime: "",
      endTime: "",
      amountEarned: 0,
      tripsCompleted: 0,
      endOdometer: 0,
    };
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setFileName(f.name);
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  async function handleExtract(e: FormEvent) {
    e.preventDefault();
    if (!file) return;

    setExtractError(false);
    setStep("loading");

    const fd = new FormData();
    fd.set("file", file);
    fd.set("startOdometer", "");

    const result = await extractShiftFromScreenshot(fd);
    if ("error" in result) {
      setExtractError(true);
      return;
    }

    const fields = result.data;
    setReviewData({
      date: fields.date ?? "",
      platform: fields.platform ?? Platform.UBER,
      startTime: fields.startTime ?? "",
      endTime: fields.endTime ?? "",
      amountEarned: fields.amountEarned ?? 0,
      tripsCompleted: fields.tripsCompleted ?? 0,
      endOdometer: fields.endOdometer ?? 0,
    });
    setStartOdo(fields.startOdometer ?? "");
    setEndOdo(
      fields.endOdometer != null ? String(fields.endOdometer) : "",
    );
    setStep("review");
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaveError(null);

    if (
      !reviewData.date ||
      !reviewData.platform ||
      reviewData.amountEarned == null ||
      !startOdo ||
      !endOdo
    ) {
      setSaveError("Please fill in date, platform, earnings, start odometer, and end odometer.");
      return;
    }

    const fd = new FormData();
    fd.set("date", reviewData.date);
    fd.set("platform", reviewData.platform);
    fd.set("startTime", reviewData.startTime || "");
    fd.set("endTime", reviewData.endTime || "");
    fd.set("amountEarned", String(reviewData.amountEarned ?? 0));
    fd.set("tripsCompleted", String(reviewData.tripsCompleted ?? 0));
    fd.set("odoMode", "odometer");
    fd.set("startOdometer", startOdo);
    fd.set("distance", "");
    fd.set("endOdometer", endOdo);

    const result = await createShift(undefined, fd, EntrySource.SCREENSHOT);
    if (result.error) {
      setSaveError(result.error);
      return;
    }

    router.push("/shifts");
  }

  function computeDistance(): string {
    const s = Number(startOdo);
    const e = Number(endOdo);
    if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return `\u2014 ${distanceLabel}`;
    return `${(e - s).toFixed(1)} ${distanceLabel}`;
  }

  return (
    <div className="mx-auto w-full max-w-lg flex-1 p-4">
      <div className="flex items-center gap-2.5 pt-2 pb-1">
        <Link
          href="/shifts"
          className="text-[20px] leading-none text-muted no-underline"
        >
          &#8592;
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Import shift</h1>
      </div>
      <p className="mt-0.5 mb-[18px] text-[13px] text-muted">
        Upload your end-of-shift summary. The AI reads the stats for you to
        review and complete.
      </p>

      {step === "input" && (
        <div className="rounded-lg border border-border bg-surface shadow-md">
          <div className="flex flex-col gap-4 p-5">
            <div>
              <label className={labelClasses}>Earnings screenshot</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={openFilePicker}
                className={`flex w-full cursor-pointer flex-col items-center justify-center gap-2.5 rounded-lg border-2 px-5 py-[34px] text-center transition-colors ${
                  fileName
                    ? "border-solid border-accent bg-accent-muted"
                    : "border-dashed border-border-light bg-background hover:border-accent hover:bg-accent-muted"
                }`}
              >
                <svg
                  width={26}
                  height={26}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={fileName ? "text-accent" : "text-accent"}
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <path d="m17 8-5-5-5 5" />
                  <path d="M12 3v12" />
                </svg>
                {fileName ? (
                  <>
                    <span className="text-[13px] font-semibold text-accent">
                      {fileName}
                    </span>
                    <span className="text-[12px] text-muted">
                      Tap to choose a different screenshot
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[15px] font-semibold text-foreground">
                      Tap to select a screenshot
                    </span>
                    <span className="text-[12px] text-muted">
                      Upload your end-of-shift earnings summary
                    </span>
                  </>
                )}
              </button>
            </div>

            <button
              type="submit"
              disabled={!file}
              onClick={handleExtract}
              className="mt-1 w-full cursor-pointer rounded-md bg-accent py-3 text-[14px] font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55"
            >
              Import shift data
            </button>
          </div>
        </div>
      )}

      {step === "loading" && (
        <>
          <div className="rounded-lg border border-border bg-surface shadow-md">
            <div className="flex flex-col items-center gap-[18px] px-5 py-14">
              <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-border border-t-accent" />
              <div className="text-center">
                <div className="text-[15px] font-semibold">
                  Extracting shift data...
                </div>
                <div className="mt-1 text-[13px] text-muted">
                  Reading earnings, trips and times from your screenshot.
                </div>
              </div>
            </div>
          </div>

          {extractError && (
            <div className="mt-4 rounded-lg border border-border bg-surface shadow-md">
              <div className="flex flex-col items-center gap-3.5 px-5 py-8">
                <div className="w-full rounded-md border border-danger-muted bg-danger-muted px-3 py-2.5 text-center text-[13px] font-medium text-danger">
                  Couldn&apos;t read that screenshot. Make sure it&apos;s the
                  earnings summary and try again.
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStep("input");
                    setExtractError(false);
                  }}
                  className="cursor-pointer rounded-md bg-accent px-4 py-2 text-[14px] font-semibold text-accent-ink transition-opacity hover:opacity-90"
                >
                  Try again
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {step === "review" && (
        <div className="rounded-lg border border-border bg-surface shadow-md">
          <form onSubmit={handleSave} className="flex flex-col gap-4 p-5">
            <div className="flex items-center gap-2 rounded-md bg-surface-raised px-3 py-2 text-[12px] text-muted">
              <svg
                width={14}
                height={14}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 12l2 2 4-4" />
                <circle cx="12" cy="12" r="10" />
              </svg>
              Extracted from {fileName}. Check each field before saving.
            </div>

            <div>
              <label htmlFor="review-date" className={labelClasses}>
                Date
              </label>
              <input
                id="review-date"
                type="date"
                value={reviewData.date ?? ""}
                onChange={(e) =>
                  setReviewData({ ...reviewData, date: e.target.value })
                }
                className={inputClasses}
              />
            </div>

            <fieldset>
              <legend className={labelClasses}>Platform</legend>
              <div className="flex gap-1 rounded-md bg-surface-raised p-1">
                {Object.values(Platform).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() =>
                      setReviewData({ ...reviewData, platform: p })
                    }
                    aria-pressed={reviewData.platform === p}
                    className={`flex-1 cursor-pointer rounded-sm py-2 text-[13px] font-semibold transition-colors ${
                      reviewData.platform === p
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
                <label htmlFor="review-startTime" className={labelClasses}>
                  Start time
                </label>
                <input
                  id="review-startTime"
                  type="time"
                  value={reviewData.startTime ?? ""}
                  onChange={(e) =>
                    setReviewData({
                      ...reviewData,
                      startTime: e.target.value,
                    })
                  }
                  className={inputClasses}
                />
              </div>
              <div>
                <label htmlFor="review-endTime" className={labelClasses}>
                  End time
                </label>
                <input
                  id="review-endTime"
                  type="time"
                  value={reviewData.endTime ?? ""}
                  onChange={(e) =>
                    setReviewData({
                      ...reviewData,
                      endTime: e.target.value,
                    })
                  }
                  className={inputClasses}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="review-amountEarned" className={labelClasses}>
                  Amount earned
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[15px] text-muted">
                    {moneySymbol}
                  </span>
                  <input
                    id="review-amountEarned"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={
                      reviewData.amountEarned
                        ? String(reviewData.amountEarned)
                        : ""
                    }
                    onChange={(e) =>
                      setReviewData({
                        ...reviewData,
                        amountEarned: Number(e.target.value) || 0,
                      })
                    }
                    className={`${inputClasses} pl-7`}
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="review-tripsCompleted"
                  className={labelClasses}
                >
                  Trips completed
                </label>
                <input
                  id="review-tripsCompleted"
                  inputMode="numeric"
                  placeholder="0"
                  value={
                    reviewData.tripsCompleted
                      ? String(reviewData.tripsCompleted)
                      : ""
                  }
                  onChange={(e) =>
                    setReviewData({
                      ...reviewData,
                      tripsCompleted: Number(e.target.value) || 0,
                    })
                  }
                  className={inputClasses}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="review-startOdo" className={labelClasses}>
                  Start odometer ({distanceLabel})
                </label>
                <input
                  id="review-startOdo"
                  inputMode="decimal"
                  placeholder="0"
                  value={startOdo}
                  onChange={(e) => setStartOdo(e.target.value)}
                  className={inputClasses}
                />
              </div>
              <div>
                <label htmlFor="review-endOdo" className={labelClasses}>
                  End odometer ({distanceLabel})
                </label>
                <input
                  id="review-endOdo"
                  inputMode="decimal"
                  placeholder="0"
                  value={endOdo}
                  onChange={(e) => setEndOdo(e.target.value)}
                  className={inputClasses}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-transparent bg-accent-muted px-3.5 py-3">
              <span className="text-[13px] font-semibold text-accent">
                Distance covered
              </span>
              <span className="text-[18px] font-bold text-accent tabular-nums">
                {computeDistance()}
              </span>
            </div>

            {saveError && (
              <p className="rounded-md border border-danger-muted bg-danger-muted px-3 py-2.5 text-[13px] font-medium text-danger">
                {saveError}
              </p>
            )}

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setStep("input")}
                className="flex flex-1 cursor-pointer items-center justify-center rounded-md bg-surface-raised py-3 text-[14px] font-semibold text-text-secondary transition-opacity hover:opacity-85"
              >
                Back
              </button>
              <button
                type="submit"
                className="flex flex-[2] cursor-pointer items-center justify-center rounded-md bg-accent py-3 text-[14px] font-semibold text-accent-ink transition-opacity hover:opacity-90"
              >
                Save shift
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

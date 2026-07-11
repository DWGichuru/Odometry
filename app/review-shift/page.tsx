"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCompletedSession } from "@/actions/session";
import { extractShiftFromScreenshot } from "@/actions/import";
import { createShiftFromSession } from "@/actions/review-shift";
import { getProfilePreferences } from "@/actions/profile";
import type { ShiftSession } from "@/types/shift-session";
import type { ExtractedShiftFields } from "@/lib/extract-parser";
import { PLATFORM_LABELS } from "@/lib/platform";
import { currencySymbol } from "@/lib/currency";
import { kmToMiles } from "@/lib/units";

type Step = "screenshot" | "loading" | "summary";

export default function ReviewShiftPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("screenshot");
  const [session, setSession] = useState<ShiftSession | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [extractedFields, setExtractedFields] =
    useState<ExtractedShiftFields | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [distanceUnit, setDistanceUnit] = useState<"KM" | "MI">("MI");

  useEffect(() => {
    getCompletedSession().then((result) => {
      if ("session" in result && result.session) {
        setSession(result.session);
      } else {
        router.push("/dashboard");
      }
    });
  }, [router]);

  useEffect(() => {
    getProfilePreferences().then((result) => {
      if ("error" in result) return;
      setCurrency(result.currency);
      setDistanceUnit(result.distanceUnit);
    });
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setFileName(f.name);
    setErrorMessage(null);
  };

  const handleSave = async () => {
    if (!session || !extractedFields) return;
    setSaving(true);
    setSaveError(null);

    try {
      const result = await createShiftFromSession(session.id, extractedFields);
      if ("error" in result) {
        setSaveError(result.error);
        setSaving(false);
        return;
      }
      router.push("/dashboard");
    } catch {
      setSaveError("Something went wrong. Please try again.");
      setSaving(false);
    }
  };

  const handleImport = async () => {
    if (!file || !session) return;
    setStep("loading");
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("startOdometer", String(session.startOdometer));

      const result = await extractShiftFromScreenshot(formData);

      if ("error" in result) {
        setErrorMessage(result.error);
        setStep("screenshot");
        return;
      }

      setExtractedFields(result.data);
      setStep("summary");
    } catch {
      setErrorMessage("Could not extract shift data. Try again.");
      setStep("screenshot");
    }
  };

  if (!session) return null;

  const unit = distanceUnit === "MI" ? "mi" : "km";
  const moneySymbol = currencySymbol(currency);
  const toDisplay = (km: number) => (distanceUnit === "MI" ? kmToMiles(km) : km);

  const distanceDisplay =
    session.endOdometer != null
      ? toDisplay(session.endOdometer - session.startOdometer).toFixed(1)
      : "0.0";

  const startedAt = new Date(session.startedAt);
  const endedAt = session.endedAt ? new Date(session.endedAt) : new Date();
  const diffMs = endedAt.getTime() - startedAt.getTime();
  const hours = Math.floor(diffMs / 3_600_000);
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000);
  const duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  const formatTime = (d: Date) =>
    d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  const formatOdo = (v: number) =>
    String(Math.round(v)).padStart(6, "0");

  return (
    <div className="mx-auto w-full max-w-lg flex-1 p-4">
      <div className="flex items-center gap-[10px] py-[6px]">
        <Link href="/dashboard" className="text-[19px] text-muted">
          ←
        </Link>
        <h1 className="text-[21px] font-bold tracking-[-0.02em]">Finish shift</h1>
      </div>

      <div className="px-0 pt-[10px] pb-[14px]">
        <div className="mb-4 flex items-center gap-[6px]">
          <div className="h-[3px] flex-1 rounded-full bg-live" />
          <div className="h-[3px] flex-1 rounded-full bg-live" />
          <div
            className={`h-[3px] flex-1 rounded-full ${step === "summary" ? "bg-live" : "bg-accent"}`}
          />
          <div className="h-[3px] flex-1 rounded-full bg-border" />
        </div>
        <div className="flex justify-between text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">
          <span>Odometer read</span>
          <span className={step === "summary" ? "text-accent" : ""}>Earnings</span>
          <span>Save</span>
        </div>
      </div>

      {step !== "summary" && (
        <div className="mb-3 flex items-center gap-[12px] rounded-[var(--radius-md)] border p-[13px]"
          style={{ borderColor: "color-mix(in srgb, var(--live) 35%, var(--border))", background: "var(--live-muted)" }}>
          <div className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-live font-extrabold text-[#05271c]">
            ✓
          </div>
          <div>
            <div className="text-[13.5px] font-semibold">
              Shift closed · {duration} · {distanceDisplay} {unit}
            </div>
            <div className="text-[11.5px] text-muted">
              Time: {formatTime(startedAt)} → {formatTime(endedAt)}
            </div>
            <div className="text-[11.5px] text-muted">
              Odometer: {formatOdo(toDisplay(session.startOdometer))} {unit} →{" "}
              {session.endOdometer != null
                ? `${formatOdo(toDisplay(session.endOdometer))} ${unit}`
                : `— ${unit}`}
            </div>
          </div>
        </div>
      )}

      {step === "screenshot" && (
        <div className="rounded-[var(--radius-lg)] border border-border bg-surface shadow-md">
          <div className="flex flex-col gap-[16px] p-[20px]">
            <div>
              <label className="mb-[6px] block text-[12px] font-medium text-muted">
                Earnings screenshot
              </label>
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`flex w-full cursor-pointer flex-col items-center justify-center gap-[10px] rounded-[var(--radius-lg)] border-2 bg-background px-[20px] py-[34px] text-center transition-colors ${fileName ? "border-solid border-accent bg-accent-muted" : "border-dashed border-border-light hover:border-accent hover:bg-accent-muted"}`}
              >
                <svg
                  viewBox="0 0 24 24"
                  width={26}
                  height={26}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-accent"
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
                    <span className="block text-[15px] font-semibold text-foreground">
                      Tap to select a screenshot
                    </span>
                    <span className="block text-[12px] text-muted">
                      Upload your end-of-shift earnings summary
                    </span>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </button>
            </div>

            <button
              onClick={handleImport}
              disabled={!file}
              className="mt-[4px] w-full rounded-[var(--radius-md)] bg-accent p-[12px] text-[14px] font-semibold text-accent-ink transition-opacity disabled:cursor-not-allowed disabled:opacity-55"
            >
              Import shift data
            </button>
          </div>
        </div>
      )}

      {step === "loading" && (
        <div className="flex flex-col items-center gap-[18px] rounded-[var(--radius-lg)] border border-border bg-surface px-[20px] py-[56px] shadow-md">
          <div className="h-[40px] w-[40px] animate-spin rounded-full border-[3px] border-border border-t-accent" />
          <div className="text-center">
            <div className="text-[15px] font-semibold">Extracting shift data...</div>
            <div className="mt-[4px] text-[13px] text-muted">
              Reading earnings, trips and times from your screenshot.
            </div>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="mt-[12px] rounded-[var(--radius-md)] border border-danger/40 bg-danger-muted px-4 py-3 text-center text-[13px] font-semibold text-danger">
          {errorMessage}
        </div>
      )}

      {step === "screenshot" && (
        <div className="mt-[12px] text-center text-[12.5px] text-muted">
          Don&apos;t have one?{" "}
          <Link
            href="/shifts/new"
            className="font-semibold text-accent hover:underline"
          >
            Enter earnings by hand
          </Link>
        </div>
      )}

      {step === "summary" && extractedFields && (
        <>
          <div
            className="mx-0 mb-[10px] mt-[10px] rounded-[var(--radius-lg)] border border-border p-[14px] px-[16px]"
            style={{
              background: `radial-gradient(120% 140% at 0% 0%, color-mix(in srgb, var(--accent) 16%, transparent) 0%, transparent 55%), var(--surface)`,
            }}
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Earned this shift
            </div>
            <div className="mt-[6px] text-[34px] font-bold leading-none tracking-[-0.03em] tabular-nums">
              {moneySymbol}{(extractedFields.amountEarned ?? 0).toFixed(2)}
            </div>
            <div
              className="mt-[8px] inline-flex items-center gap-[6px] rounded-full px-[10px] py-[4px] text-[12px] font-semibold"
              style={{ background: "var(--live-muted)", color: "var(--live)" }}
            >
              <span>✓</span> Nothing left to type
            </div>
          </div>

          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface">
            <div className="flex items-center gap-[12px] border-b border-border px-[14px] py-[8px]">
              <span className="text-[12px]">🖼</span>
              <span className="text-[13px] text-text-secondary">Date</span>
              <span className="ml-auto text-[13.5px] font-semibold tabular-nums">
                {extractedFields.date
                  ? new Date(`${extractedFields.date}T00:00:00`).toLocaleDateString(
                      "en-US",
                      { weekday: "short", month: "short", day: "numeric" },
                    )
                  : formatTime(startedAt)}
              </span>
            </div>
            <div className="flex items-center gap-[12px] border-b border-border px-[14px] py-[8px]">
              <span className="text-[12px]">🖼</span>
              <span className="text-[13px] text-text-secondary">Platform</span>
              <span className="ml-auto text-[13.5px] font-semibold"
                style={{ color: extractedFields.platform ? "var(--uber)" : undefined }}>
                {extractedFields.platform
                  ? PLATFORM_LABELS[extractedFields.platform]
                  : "—"}
              </span>
            </div>
            <div className="flex items-center gap-[12px] border-b border-border px-[14px] py-[8px]">
              <span className="text-[12px]">⏱</span>
              <span className="text-[13px] text-text-secondary">Start time</span>
              <span className="ml-auto text-[13.5px] font-semibold tabular-nums">
                {formatTime(startedAt)}
              </span>
            </div>
            <div className="flex items-center gap-[12px] border-b border-border px-[14px] py-[8px]">
              <span className="text-[12px]">⏱</span>
              <span className="text-[13px] text-text-secondary">End time</span>
              <span className="ml-auto text-[13.5px] font-semibold tabular-nums">
                {formatTime(endedAt)}
              </span>
            </div>
            <div className="flex items-center gap-[12px] border-b border-border px-[14px] py-[8px]">
              <span className="text-[12px]">🖼</span>
              <span className="text-[13px] text-text-secondary">Amount earned</span>
              <span className="ml-auto text-[13.5px] font-semibold tabular-nums">
                {moneySymbol}{(extractedFields.amountEarned ?? 0).toFixed(2)}
              </span>
            </div>
            <div className="flex items-center gap-[12px] border-b border-border px-[14px] py-[8px]">
              <span className="text-[12px]">🖼</span>
              <span className="text-[13px] text-text-secondary">Trips completed</span>
              <span className="ml-auto text-[13.5px] font-semibold tabular-nums">
                {extractedFields.tripsCompleted ?? 0}
              </span>
            </div>
            <div className="flex items-center gap-[12px] border-b border-border px-[14px] py-[8px]">
              <span className="text-[12px]">📷</span>
              <span className="text-[13px] text-text-secondary">Start odometer</span>
              <span className="ml-auto text-[13.5px] font-semibold tabular-nums">
                {formatOdo(toDisplay(session.startOdometer))} {unit}
              </span>
            </div>
            <div className="flex items-center gap-[12px] border-b border-border px-[14px] py-[8px]">
              <span className="text-[12px]">📷</span>
              <span className="text-[13px] text-text-secondary">End odometer</span>
              <span className="ml-auto text-[13.5px] font-semibold tabular-nums">
                {session.endOdometer != null
                  ? `${formatOdo(toDisplay(session.endOdometer))} ${unit}`
                  : `— ${unit}`}
              </span>
            </div>
            <div
              className="flex items-center gap-[12px] px-[14px] py-[8px] bg-accent-muted"
            >
              <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full"
                style={{ background: "color-mix(in srgb, var(--accent) 22%, transparent)" }}>
                ∑
              </span>
              <span className="text-[13px] font-bold text-accent">Distance covered</span>
              <span className="ml-auto text-[13.5px] font-bold tabular-nums text-accent">
                {distanceDisplay} {unit}
              </span>
            </div>
          </div>

          <div className="mt-[14px] mb-0 flex justify-center gap-[14px] text-[11px] text-muted">
            <span>📷 Odometer photo</span>
            <span>🖼 Screenshot</span>
            <span>⏱ Timestamped</span>
          </div>

          <div className="mt-[12px] mb-[14px] text-center">
            <Link
              href="/shifts/new"
              className="text-[11.5px] font-semibold text-accent"
            >
              Something wrong? Edit fields
            </Link>
          </div>

          {saveError && (
            <div className="mt-[12px] rounded-[var(--radius-md)] border border-danger/40 bg-danger-muted px-4 py-3 text-center text-[13px] font-semibold text-danger">
              {saveError}
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 px-[16px] py-[14px] pb-[20px]"
            style={{ background: "linear-gradient(transparent, var(--background) 32%)" }}>
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full rounded-[var(--radius-md)] bg-accent p-[13px] text-[14.5px] font-semibold text-accent-ink disabled:opacity-55"
            >
              {saving ? "Saving..." : "Save shift"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

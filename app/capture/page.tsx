"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { extractOdometerFromPhoto } from "@/actions/odometer-extract";
import { startShiftSession, endShiftSession } from "@/actions/shift-session";
import { getOpenSession } from "@/actions/session";

interface CapturePageProps {
  searchParams: Promise<{ type?: string }>;
}

type AppState = "framing" | "processing" | "review";

interface ReviewData {
  reading: number;
  unit: string | null;
  confidence: "high" | "low";
  warnings: string[];
  lastEndOdometer: number | null;
}

export default function CapturePage({ searchParams }: CapturePageProps) {
  const router = useRouter();
  const [captureType, setCaptureType] = useState<"start" | "end">("start");
  const [state, setState] = useState<AppState>("framing");
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [editedReading, setEditedReading] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sessionMeta, setSessionMeta] = useState<{
    startOdometer: number;
    startedAt: string;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    searchParams.then((params) => {
      if (params.type === "end") setCaptureType("end");
    });
  }, [searchParams]);

  useEffect(() => {
    async function startCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setCameraError(true);
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraReady(true);
      } catch {
        setCameraError(true);
      }
    }

    startCamera();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (state !== "review" || captureType !== "end") return;
    getOpenSession().then((result) => {
      if ("session" in result && result.session) {
        setSessionMeta({
          startOdometer: result.session.startOdometer,
          startedAt: result.session.startedAt,
        });
      }
    });
  }, [state, captureType]);

  const captureFrame = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return reject(new Error("Camera not ready"));

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas context unavailable"));
      ctx.drawImage(video, 0, 0);

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("Failed to capture frame"));
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            const base64 = dataUrl.split(",")[1];
            resolve(base64);
          };
          reader.readAsDataURL(blob);
        },
        "image/jpeg",
        0.85,
      );
    });
  }, []);

  const readFileAsBase64 = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(",")[1];
        resolve(base64);
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }, []);

  const processImage = useCallback(async (base64: string) => {
    setState("processing");
    setErrorMessage(null);

    try {
      const result = await extractOdometerFromPhoto(base64);
      if ("error" in result) {
        setErrorMessage(result.error);
        setState("framing");
        return;
      }

      setReviewData(result.data);
      setThumbnailUrl(`data:image/jpeg;base64,${base64}`);
      setEditedReading(String(result.data.reading));
      setState("review");
    } catch {
      setErrorMessage("Could not read the odometer. Try a clearer photo.");
      setState("framing");
    }
  }, []);

  const handleShutter = useCallback(async () => {
    if (cameraError) return;
    try {
      const base64 = await captureFrame();
      await processImage(base64);
    } catch {
      setErrorMessage("Could not capture the photo. Try again.");
    }
  }, [cameraError, captureFrame, processImage]);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const base64 = await readFileAsBase64(file);
        await processImage(base64);
      } catch {
        setErrorMessage("Could not read the selected file.");
      }
    },
    [readFileAsBase64, processImage],
  );

  const handleRetake = useCallback(() => {
    setState("framing");
    setReviewData(null);
    setThumbnailUrl(null);
    setErrorMessage(null);
    setSessionMeta(null);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!reviewData) return;
    setConfirming(true);
    const reading = parseFloat(editedReading) || reviewData.reading;

    try {
      const result =
        captureType === "start"
          ? await startShiftSession(reading)
          : await endShiftSession(reading);

      if ("error" in result) {
        setErrorMessage(result.error);
        setConfirming(false);
        return;
      }

      router.push("/dashboard");
    } catch {
      setErrorMessage("Something went wrong. Please try again.");
      setConfirming(false);
    }
  }, [reviewData, editedReading, captureType, router]);

  const reading = reviewData?.reading ?? 0;
  const confidence = reviewData?.confidence ?? "low";
  const isConfident = confidence === "high";
  const unit = reviewData?.unit ?? "km";

  const formatOdo = (v: number) =>
    String(Math.round(v)).padStart(6, "0");

  const formatTime = () =>
    new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  const startMetaText = reviewData?.lastEndOdometer
    ? `Continues from your last shift (${formatOdo(reviewData.lastEndOdometer)} km). Shift starts at ${formatTime()}.`
    : `Shift starts at ${formatTime()}.`;

  const endMetaText =
    sessionMeta && reviewData
      ? `${(reading - sessionMeta.startOdometer).toFixed(1)} km covered since ${new Date(sessionMeta.startedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}. Shift ends at ${formatTime()}.`
      : `Shift ends at ${formatTime()}.`;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#0a0c0f]">
      <canvas ref={canvasRef} className="hidden" />

      <div className="absolute inset-0 overflow-hidden">
        {!cameraError && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`absolute inset-0 h-full w-full object-cover ${state === "processing" ? "brightness-[0.45] saturate-[0.6]" : ""}`}
            onLoadedMetadata={() => setCameraReady(true)}
          />
        )}

        {cameraError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <label className="flex cursor-pointer flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-overlay-ink/30 px-10 py-16 text-overlay-ink">
              <svg
                viewBox="0 0 24 24"
                width={40}
                height={40}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 8.5h3.2l1.6-2.4h8.4l1.6 2.4H21v10H3z" />
                <circle cx="12" cy="13" r="3.4" />
              </svg>
              <span className="text-[15px] font-semibold">Tap to select a photo</span>
              <span className="text-[12px] text-overlay-ink-muted">
                Camera unavailable. Upload a photo instead.
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
            </label>
          </div>
        )}

        {!cameraError && state === "framing" && (
          <>
            <div
              className="absolute inset-0"
              style={{
                background: "var(--overlay-scrim)",
                WebkitMask:
                  "linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)",
                WebkitMaskComposite: "xor",
                maskComposite: "exclude",
                padding: "260px 26px 340px",
              }}
            />

            <div
              className="pointer-events-none absolute left-[26px] right-[26px] top-[260px] h-[180px] rounded-[var(--radius-lg)]"
              style={{ boxShadow: "0 0 0 2px var(--guide-stroke)" }}
            >
              <div className="absolute left-[-3px] top-[-3px] h-[26px] w-[26px] rounded-tl-[var(--radius-lg)] border-l-[3px] border-t-[3px] border-guide-stroke" />
              <div className="absolute bottom-[-3px] right-[-3px] h-[26px] w-[26px] rounded-br-[var(--radius-lg)] border-b-[3px] border-r-[3px] border-guide-stroke" />
            </div>

            <div className="absolute left-0 right-0 top-[456px] text-center text-[13.5px] font-semibold text-overlay-ink [text-shadow:0_1px_8px_#000]">
              Line up the odometer inside the frame
            </div>
          </>
        )}

        {!cameraError && state === "framing" && errorMessage && (
          <div className="absolute bottom-[160px] left-4 right-4 rounded-[var(--radius-md)] border border-danger/40 bg-danger-muted px-4 py-3 text-center text-[13px] font-semibold text-danger">
            {errorMessage}
          </div>
        )}

        {state === "processing" && (
          <div className="absolute bottom-0 left-0 right-0 z-25 flex flex-col items-center gap-[14px] rounded-t-[var(--radius-xl)] border border-b-0 border-border bg-surface px-[16px] pb-[48px] pt-[42px] shadow-md">
            <div className="h-[38px] w-[38px] animate-spin rounded-full border-[3px] border-border border-t-accent" />
            <div className="text-center">
              <div className="text-[15px] font-semibold">Reading the odometer...</div>
              <div className="mt-[4px] text-[12.5px] text-muted">
                Checking the number against your last shift.
              </div>
            </div>
          </div>
        )}

        {state === "review" && reviewData && (
          <div className="absolute bottom-0 left-0 right-0 z-25 rounded-t-[var(--radius-xl)] border border-b-0 border-border bg-surface px-[16px] pb-[26px] pt-[20px] shadow-md">
            {thumbnailUrl && (
              <div className="absolute left-[16px] top-[-44px] h-[62px] w-[62px] overflow-hidden rounded-[var(--radius-md)] border-[3px] border-surface bg-[#0a0c0f] shadow-md">
                <img
                  src={thumbnailUrl}
                  alt="Captured odometer"
                  className="h-full w-full object-cover"
                />
              </div>
            )}

            <div
              className={`mx-auto flex w-fit items-center gap-[8px] rounded-full px-[12px] py-[8px] text-[12.5px] font-semibold ${isConfident ? "bg-confidence-high-muted text-confidence-high" : "bg-confidence-low-muted text-confidence-low"}`}
            >
              <span>{isConfident ? "✓" : "!"}</span>
              {isConfident ? "Read clearly" : "Check this reading"}
            </div>

            <div className="flex items-baseline justify-center gap-[8px] px-0 py-[18px] pb-[16px]">
              <span className="font-mono text-[40px] font-bold tracking-[0.06em] tabular-nums">
                {formatOdo(reading)}
              </span>
              <span className="text-[15px] font-semibold text-muted">
                {unit}
              </span>
            </div>

            {isConfident && (
              <div className="mt-0 text-center text-[11.5px] text-muted">
                {captureType === "end" ? endMetaText : startMetaText}
              </div>
            )}

            {!isConfident && (
              <>
                <div className="mt-[14px] flex gap-[10px] rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--warning)_35%,transparent)] bg-confidence-low-muted p-[12px]">
                  <span>⚠️</span>
                  <span className="text-[12.5px] leading-[1.45] text-text-secondary">
                    {reviewData.warnings.map((w, i) => (
                      <span key={i}>
                        {w}
                        {i < reviewData.warnings.length - 1 && <><br /><br /></>}
                      </span>
                    ))}
                  </span>
                </div>

                <div className="mt-[14px]">
                  <label className="mb-[6px] block text-[11.5px] font-semibold text-muted">
                    {captureType === "end" ? "End odometer (km)" : "Start odometer (km)"}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editedReading}
                    onChange={(e) => setEditedReading(e.target.value)}
                    className="w-full rounded-[var(--radius-md)] border border-border bg-background p-[12px] font-mono text-[17px] tracking-[0.06em] text-foreground outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-muted)]"
                  />
                </div>
              </>
            )}

            {errorMessage && (
              <div className="mt-[14px] rounded-[var(--radius-md)] border border-danger/40 bg-danger-muted px-4 py-3 text-center text-[13px] font-semibold text-danger">
                {errorMessage}
              </div>
            )}

            <div className="mt-[18px] flex gap-[10px]">
              <button
                onClick={handleRetake}
                className="flex flex-1 items-center justify-center gap-[8px] rounded-[var(--radius-md)] border border-transparent bg-surface-raised p-[13px] text-[14.5px] font-semibold text-text-secondary"
              >
                Retake
              </button>
              <button
                onClick={handleConfirm}
                disabled={confirming}
                className="flex flex-[2] items-center justify-center gap-[8px] rounded-[var(--radius-md)] border border-transparent bg-accent p-[13px] text-[14.5px] font-semibold text-accent-ink disabled:opacity-55"
              >
                {confirming
                  ? "Saving..."
                  : captureType === "start"
                    ? "Start shift"
                    : "Confirm and continue"}
              </button>
            </div>
          </div>
        )}
      </div>

      {state !== "processing" && (
        <>
          <div className="absolute left-0 right-0 top-0 flex h-[46px] items-center justify-between px-[28px] text-[14px] font-semibold tabular-nums text-white">
            <span>{formatTime()}</span>
            <span>▮▮▮ ▾ 82%</span>
          </div>

          <div className="absolute left-0 right-0 top-[52px] z-20 flex items-center justify-between px-[18px]">
            <Link
              href="/dashboard"
              className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-overlay-chrome text-[16px] text-overlay-ink backdrop-blur-[8px]"
            >
              ✕
            </Link>
            <div className="text-[14.5px] font-bold text-white">
              {captureType === "end" ? "End odometer" : "Start odometer"}
            </div>
            <button className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-overlay-chrome text-[16px] text-overlay-ink backdrop-blur-[8px]">
              ⚡
            </button>
          </div>

          <div className="absolute bottom-0 left-0 right-0 z-20 flex h-[132px] items-center justify-between bg-[linear-gradient(transparent,rgba(6,8,11,0.86)_45%)] px-[34px]">
            <label className="flex h-[38px] w-[38px] cursor-pointer items-center justify-center rounded-full bg-overlay-chrome text-[16px] text-overlay-ink backdrop-blur-[8px]">
              🖼
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
            </label>

            <button
              onClick={handleShutter}
              className="flex h-[72px] w-[72px] cursor-pointer items-center justify-center rounded-full border-[4px] border-white/85 bg-transparent p-[5px]"
            >
              <span className="block h-full w-full rounded-full bg-white" />
            </button>

            <button className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-overlay-chrome text-[16px] text-overlay-ink backdrop-blur-[8px]">
              ⚡
            </button>
          </div>
        </>
      )}
    </div>
  );
}

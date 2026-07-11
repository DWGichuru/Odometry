"use client";

import { useEffect, useState } from "react";
import { detectInstallPlatform, type InstallPlatform } from "@/lib/pwa-install";
import { useInstallPrompt } from "@/components/pwa/InstallPromptProvider";

interface InstallModalProps {
  open: boolean;
  onClose: () => void;
}

interface Step {
  title: string;
  detail?: string;
}

const IOS_STEPS: Step[] = [
  { title: "Tap the Share icon", detail: "In Safari's toolbar (the square with an arrow)" },
  { title: 'Scroll down, tap "Add to Home Screen"' },
  { title: "Tap Add", detail: "Top right corner" },
];

const ANDROID_FALLBACK_STEPS: Step[] = [
  { title: "Open the browser menu", detail: "Top-right corner (⋮)" },
  { title: 'Tap "Add to Home Screen" or "Install app"' },
  { title: "Confirm to finish" },
];

function StepList({ steps }: { steps: Step[] }) {
  return (
    <div>
      {steps.map((step, i) => (
        <div
          key={step.title}
          className={`flex items-start gap-[13px] py-3 ${i > 0 ? "border-t border-border-light" : ""}`}
        >
          <div className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full bg-surface-raised text-[13px] font-bold text-text-secondary">
            {i + 1}
          </div>
          <div>
            <div className="text-sm font-semibold">{step.title}</div>
            {step.detail && <div className="mt-0.5 text-[12.5px] text-muted">{step.detail}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function InstallModal({ open, onClose }: InstallModalProps) {
  const { canInstallNatively, promptInstall } = useInstallPrompt();
  const [platform, setPlatform] = useState<InstallPlatform>("other");

  useEffect(() => {
    setPlatform(detectInstallPlatform(navigator.userAgent));
  }, []);

  if (!open) return null;

  async function handleInstallClick() {
    await promptInstall();
    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 z-[55] bg-overlay-scrim backdrop-blur-[2px]" onClick={onClose} />

      <div className="fixed inset-x-0 bottom-0 z-[60] rounded-t-[var(--radius-xl)] border border-b-0 border-border bg-surface px-[14px] pb-[calc(26px+env(safe-area-inset-bottom,0px))] pt-[10px] shadow-md">
        <div className="mx-auto mb-4 h-[4px] w-[38px] rounded-full bg-border-light" />

        {platform === "android" && canInstallNatively ? (
          <>
            <div
              className="mb-[14px] flex items-center gap-[14px] rounded-[var(--radius-md)] p-[14px] text-white"
              style={{ background: "var(--accent-gradient-strong)" }}
            >
              <div className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-[var(--radius-md)] bg-white/20 text-xl">
                ⤓
              </div>
              <div>
                <div className="text-[15px] font-bold">Install Odometry</div>
                <div className="mt-0.5 text-[12.5px] text-white/85">
                  One tap adds it to your home screen
                </div>
              </div>
            </div>

            <button
              type="button"
              className="w-full rounded-[var(--radius-md)] bg-accent p-[13px] text-[14.5px] font-semibold text-accent-ink"
              onClick={handleInstallClick}
            >
              Install app
            </button>
            <button
              type="button"
              className="mt-2 w-full rounded-[var(--radius-md)] bg-surface-raised p-[13px] text-[14.5px] font-semibold text-text-secondary"
              onClick={onClose}
            >
              Not now
            </button>
          </>
        ) : (
          <>
            <h2 className="mb-[3px] text-[17px] font-bold tracking-[-0.01em]">Install Odometry</h2>
            <p className="mb-2 text-[13px] text-muted">
              Add it to your home screen in three taps
            </p>

            <StepList steps={platform === "ios" ? IOS_STEPS : ANDROID_FALLBACK_STEPS} />

            <button
              type="button"
              className="mt-[14px] w-full rounded-[var(--radius-md)] bg-surface-raised p-[13px] text-[14.5px] font-semibold text-text-secondary"
              onClick={onClose}
            >
              Got it
            </button>
          </>
        )}
      </div>
    </>
  );
}

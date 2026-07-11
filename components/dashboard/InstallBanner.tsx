"use client";

import { useEffect, useState } from "react";
import {
  detectInstallPlatform,
  shouldShowInstallBanner,
  type InstallDismissState,
} from "@/lib/pwa-install";
import { useInstallPrompt } from "@/components/pwa/InstallPromptProvider";
import InstallModal from "@/components/dashboard/InstallModal";

const DISMISS_KEY = "odometry-install-dismiss";

function readDismissState(): InstallDismissState | null {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as InstallDismissState;
  } catch {
    return null;
  }
}

function writeDismissState(state: InstallDismissState) {
  localStorage.setItem(DISMISS_KEY, JSON.stringify(state));
}

export default function InstallBanner() {
  const { justInstalled } = useInstallPrompt();
  const [visible, setVisible] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    const platform = detectInstallPlatform(navigator.userAgent);
    if (platform === "other") return;

    setVisible(shouldShowInstallBanner(readDismissState(), Date.now()));
  }, []);

  useEffect(() => {
    if (!justInstalled) return;
    writeDismissState({ count: 2, dismissedAt: Date.now() });
    setVisible(false);
  }, [justInstalled]);

  function handleDismiss() {
    const current = readDismissState();
    writeDismissState({ count: (current?.count ?? 0) + 1, dismissedAt: Date.now() });
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <>
      <section
        onClick={() => setModalOpen(true)}
        className="relative mb-[14px] mt-[12px] flex cursor-pointer items-center gap-3 overflow-hidden rounded-[var(--radius-lg)] border p-3.5 shadow-md"
        style={{
          borderColor: "color-mix(in srgb, var(--accent) 35%, var(--border))",
          background:
            "linear-gradient(120% 140% at 0% 0%, var(--accent-muted), transparent 60%), var(--surface)",
        }}
      >
        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-[var(--radius-md)] bg-accent text-lg text-accent-ink">
          ⤓
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">Install Odometry</div>
          <div className="mt-0.5 text-xs text-muted">
            Add it to your home screen for quicker access
          </div>
        </div>
        <div className="flex-none text-lg text-faint">›</div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleDismiss();
          }}
          aria-label="Dismiss"
          className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-surface-raised text-xs text-muted"
        >
          ✕
        </button>
      </section>

      <InstallModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { discardShiftSession } from "@/actions/shift-session";

interface DiscardShiftButtonProps {
  sessionId: string;
}

export default function DiscardShiftButton({ sessionId }: DiscardShiftButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDiscard() {
    setError(null);
    setDiscarding(true);
    const result = await discardShiftSession(sessionId);
    if ("error" in result) {
      setError(result.error);
      setConfirming(false);
      setDiscarding(false);
      return;
    }
    router.push("/dashboard");
  }

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-2">
        {confirming ? (
          <>
            <span className="text-[13px] text-muted">Discard this shift? It won&apos;t be saved.</span>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="cursor-pointer text-[13px] font-medium text-muted transition-colors hover:text-text-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDiscard}
              disabled={discarding}
              className="cursor-pointer rounded-sm bg-danger px-2.5 py-1 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-55"
            >
              Discard
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="cursor-pointer text-[13px] font-medium text-muted transition-colors hover:text-danger"
          >
            Discard shift
          </button>
        )}
      </div>
      {error && (
        <p className="mt-1 text-[12px] font-medium text-danger">{error}</p>
      )}
    </div>
  );
}

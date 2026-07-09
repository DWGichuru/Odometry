"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteShift } from "@/actions/shifts";

interface DeleteShiftButtonProps {
  shiftId: string;
}

export default function DeleteShiftButton({ shiftId }: DeleteShiftButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setError(null);
    const result = await deleteShift(shiftId);
    if (result.error) {
      setError(result.error);
      setConfirming(false);
      return;
    }
    router.push("/shifts");
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        {confirming ? (
          <>
            <span className="text-[13px] text-muted">Delete this shift?</span>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="cursor-pointer text-[13px] font-medium text-muted transition-colors hover:text-text-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="cursor-pointer rounded-sm bg-danger px-2.5 py-1 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              Delete
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="cursor-pointer text-[13px] font-medium text-muted transition-colors hover:text-danger"
          >
            Delete shift
          </button>
        )}
      </div>
      {error && (
        <p className="mt-1 text-[12px] font-medium text-danger">{error}</p>
      )}
    </div>
  );
}

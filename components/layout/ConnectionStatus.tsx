"use client";

import { useEffect, useState } from "react";

export default function ConnectionStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    function handleOnline() {
      setIsOnline(true);
      setShowReconnected(true);
    }
    function handleOffline() {
      setIsOnline(false);
      setShowReconnected(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!showReconnected) return;
    const timeout = setTimeout(() => setShowReconnected(false), 3000);
    return () => clearTimeout(timeout);
  }, [showReconnected]);

  if (!isOnline) {
    return (
      <div
        role="status"
        className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-warning-muted px-4 py-2 text-[13px] font-medium text-warning"
        style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top, 0px))" }}
      >
        You&apos;re offline - some actions won&apos;t work
      </div>
    );
  }

  if (showReconnected) {
    return (
      <div
        role="status"
        className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-success-muted px-4 py-2 text-[13px] font-medium text-success"
        style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top, 0px))" }}
      >
        Back online
      </div>
    );
  }

  return null;
}

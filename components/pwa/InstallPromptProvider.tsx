"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface InstallPromptContextValue {
  canInstallNatively: boolean;
  promptInstall: () => Promise<"accepted" | "dismissed" | null>;
  justInstalled: boolean;
}

const InstallPromptContext = createContext<InstallPromptContextValue>({
  canInstallNatively: false,
  promptInstall: async () => null,
  justInstalled: false,
});

export function useInstallPrompt() {
  return useContext(InstallPromptContext);
}

export default function InstallPromptProvider({ children }: { children: ReactNode }) {
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [canInstallNatively, setCanInstallNatively] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      deferredPromptRef.current = event as BeforeInstallPromptEvent;
      setCanInstallNatively(true);
    }

    function handleAppInstalled() {
      deferredPromptRef.current = null;
      setCanInstallNatively(false);
      setJustInstalled(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function promptInstall(): Promise<"accepted" | "dismissed" | null> {
    const deferredPrompt = deferredPromptRef.current;
    if (!deferredPrompt) return null;
    deferredPromptRef.current = null;
    setCanInstallNatively(false);
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    return outcome;
  }

  return (
    <InstallPromptContext.Provider
      value={{ canInstallNatively, promptInstall, justInstalled }}
    >
      {children}
    </InstallPromptContext.Provider>
  );
}

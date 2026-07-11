"use client";

import { usePathname } from "next/navigation";
import BottomNav from "@/components/layout/BottomNav";
import ConnectionStatus from "@/components/layout/ConnectionStatus";
import ServiceWorkerRegistration from "@/components/layout/ServiceWorkerRegistration";
import InstallPromptProvider from "@/components/pwa/InstallPromptProvider";
import type { ReactNode } from "react";

interface AppShellProps {
  children: ReactNode;
  authenticated: boolean;
}

export default function AppShell({ children, authenticated }: AppShellProps) {
  const pathname = usePathname();
  const showNav = pathname !== "/";

  return (
    <InstallPromptProvider>
      <ServiceWorkerRegistration />
      <ConnectionStatus />
      <main
        className={`flex-1 pt-[env(safe-area-inset-top,0px)] ${showNav && authenticated ? "pb-[calc(4rem+env(safe-area-inset-bottom,0px))]" : ""}`}
      >
        {children}
      </main>
      {showNav && <BottomNav authenticated={authenticated} />}
    </InstallPromptProvider>
  );
}

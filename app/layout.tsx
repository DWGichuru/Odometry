import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { auth } from "@/auth";
import UserHeader from "@/components/auth/UserHeader";
import BottomNav from "@/components/layout/BottomNav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Shift Recorder",
  description: "Log your rideshare and delivery shifts across platforms.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <UserHeader />
        <main className="flex-1 pb-[calc(4rem+env(safe-area-inset-bottom,0px))]">
          {children}
        </main>
        <BottomNav authenticated={Boolean(session?.user?.id)} />
      </body>
    </html>
  );
}

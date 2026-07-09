import type { ReactNode } from "react";

type NoticeVariant = "warn" | "danger" | "info";

interface NoticeBannerProps {
  variant: NoticeVariant;
  title: string;
  children: ReactNode;
  icon?: ReactNode;
}

const ICONS: Record<NoticeVariant, ReactNode> = {
  warn: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  danger: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  info: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
};

const STYLES: Record<NoticeVariant, string> = {
  warn: "bg-warning-muted text-warning [&_.body]:text-text-secondary",
  danger: "bg-danger-muted text-danger [&_.body]:text-text-secondary",
  info: "bg-accent-muted text-accent [&_.body]:text-text-secondary",
};

export function NoticeBanner({ variant, title, children, icon }: NoticeBannerProps) {
  return (
    <div className={`flex gap-3 rounded-2xl p-3.5 text-[13.5px] leading-[1.45] mb-4 ${STYLES[variant]}`}>
      <div className="flex-none mt-px">{icon ?? ICONS[variant]}</div>
      <div>
        <strong className="block font-bold mb-0.5">{title}</strong>
        <span className="body font-medium">{children}</span>
      </div>
    </div>
  );
}

export function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}

export function ArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
      <polyline points="10 17 15 12 10 7"/>
      <line x1="15" y1="12" x2="3" y2="12"/>
    </svg>
  );
}

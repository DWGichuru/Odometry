type BadgeVariant = "trialing" | "active" | "past_due" | "canceled";

interface StatusBadgeProps {
  variant: BadgeVariant;
  label: string;
}

const STYLES: Record<BadgeVariant, string> = {
  trialing: "text-accent bg-accent-muted",
  active: "text-success bg-success-muted",
  past_due: "text-warning bg-warning-muted",
  canceled: "text-danger bg-danger-muted",
};

const DOT: Record<BadgeVariant, string> = {
  trialing: "bg-accent",
  active: "bg-success",
  past_due: "bg-warning",
  canceled: "bg-danger",
};

export function StatusBadge({ variant, label }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold tracking-[0.01em] px-2.5 py-1 rounded-full ${STYLES[variant]}`}>
      <span className={`w-[7px] h-[7px] rounded-full ${DOT[variant]}`} />
      {label}
    </span>
  );
}

type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "purple";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variants: Record<BadgeVariant, string> = {
  default: "bg-slate-100 text-slate-700",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700",
  info: "bg-blue-100 text-blue-700",
  purple: "bg-purple-100 text-purple-700",
};

export function Badge({
  children,
  variant = "default",
  className = "",
}: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        variants[variant],
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

// Helpers for common status values
export function DeploymentStatusBadge({
  status,
}: {
  status: string;
}) {
  const map: Record<string, BadgeVariant> = {
    upcoming: "info",
    active: "success",
    completed: "default",
  };
  return <Badge variant={map[status] ?? "default"}>{status}</Badge>;
}

export function InternStatusBadge({ status }: { status: string }) {
  const map: Record<string, BadgeVariant> = {
    pending: "warning",
    active: "success",
    completed: "info",
    withdrawn: "danger",
  };
  return <Badge variant={map[status] ?? "default"}>{status}</Badge>;
}

export function RoleBadge({ role }: { role: string }) {
  const map: Record<string, BadgeVariant> = {
    admin: "danger",
    faculty: "purple",
    intern: "info",
  };
  return <Badge variant={map[role] ?? "default"}>{role}</Badge>;
}

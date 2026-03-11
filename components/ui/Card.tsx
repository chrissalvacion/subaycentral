import React from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  iconBg?: string;
  sub?: string;
}

export function StatCard({
  title,
  value,
  icon,
  iconBg = "bg-indigo-100 text-indigo-600",
  sub,
}: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
      <div className={`p-3 rounded-xl ${iconBg}`}>{icon}</div>
      <div>
        <p className="text-sm text-slate-500">{title}</p>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  action?: React.ReactNode;
}

export function Card({ children, className = "", title, action }: CardProps) {
  return (
    <div
      className={[
        "bg-white rounded-xl border border-slate-100 shadow-sm",
        className,
      ].join(" ")}
    >
      {(title || action) && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          {title && (
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          )}
          {action}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}

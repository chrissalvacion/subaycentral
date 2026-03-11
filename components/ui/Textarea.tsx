import React from "react";

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({
  label,
  error,
  id,
  className = "",
  rows = 3,
  ...props
}: TextareaProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-slate-700"
        >
          {label}
          {props.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <textarea
        id={inputId}
        rows={rows}
        className={[
          "block w-full rounded-lg border px-3 py-2 text-sm text-slate-900 resize-y",
          "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent",
          "placeholder:text-slate-400 transition-colors",
          error
            ? "border-red-400 bg-red-50"
            : "border-slate-300 bg-white hover:border-slate-400",
          className,
        ].join(" ")}
        {...props}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

type ClassValue = string | false | null | undefined;

export function cn(...inputs: ClassValue[]) {
  return inputs
    .flat()
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return "—";
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${m} ${ampm}`;
}

export function formatHours(hours: number | null | undefined): string {
  if (hours == null) return "—";
  return `${Number(hours).toFixed(2)} hrs`;
}

export function getProgressPercent(rendered: number, required: number): number {
  if (!required) return 0;
  return Math.min(100, Math.round((rendered / required) * 100));
}

export function getMonthOptions() {
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(2024, i, 1);
    return {
      value: String(i + 1).padStart(2, "0"),
      label: d.toLocaleString("en-PH", { month: "long" }),
    };
  });
}

export function getCurrentMonthYear() {
  const now = new Date();
  return {
    month: String(now.getMonth() + 1).padStart(2, "0"),
    year: String(now.getFullYear()),
  };
}

export function calculateExpectedEndDate(
  startDate: string | null | undefined,
  requiredHours: number | null | undefined,
  renderedHours: number | null | undefined,
  dutyHoursPerDay: number | null | undefined
): string | null {
  if (!startDate) return null;

  const required = Number(requiredHours ?? 0);
  const rendered = Number(renderedHours ?? 0);
  const dutyHours = Number(dutyHoursPerDay ?? 8);
  const safeDutyHours = dutyHours > 0 ? dutyHours : 8;

  const remainingHours = Math.max(0, required - rendered);
  const daysNeeded = Math.ceil(remainingHours / safeDutyHours);

  const start = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;

  start.setDate(start.getDate() + Math.max(0, daysNeeded - 1));
  return start.toISOString().slice(0, 10);
}

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

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const dateOnlyMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const monthIndex = Number(dateOnlyMatch[2]) - 1;
    const day = Number(dateOnlyMatch[3]);
    if (monthIndex >= 0 && monthIndex < 12 && day >= 1 && day <= 31) {
      return `${monthNames[monthIndex]} ${day}, ${year}`;
    }
  }

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;

  const year = date.getUTCFullYear();
  const monthIndex = date.getUTCMonth();
  const day = date.getUTCDate();
  return `${monthNames[monthIndex]} ${day}, ${year}`;
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
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  return monthNames.map((label, index) => ({
    value: String(index + 1).padStart(2, "0"),
    label,
  }));
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
  dutyHoursPerDay: number | null | undefined,
  dutyDaysPerWeek?: number | null | undefined
): string | null {
  if (!startDate) return null;

  const required = Number(requiredHours ?? 0);
  const rendered = Number(renderedHours ?? 0);
  const dutyHours = Number(dutyHoursPerDay ?? 8);
  const daysPerWeek = Number(dutyDaysPerWeek ?? 5);
  const safeDutyHours = dutyHours > 0 ? dutyHours : 8;
  const safeDutyDaysPerWeek = Math.max(1, Math.min(7, Math.floor(daysPerWeek) || 5));

  const remainingHours = Math.max(0, required - rendered);
  const dutyDaysNeeded = Math.ceil(remainingHours / safeDutyHours);

  const start = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;

  if (dutyDaysNeeded <= 1) {
    return start.toISOString().slice(0, 10);
  }

  const additionalDutyDays = dutyDaysNeeded - 1;
  const fullWeeks = Math.floor(additionalDutyDays / safeDutyDaysPerWeek);
  const remainingDutyDays = additionalDutyDays % safeDutyDaysPerWeek;
  const calendarDaysToAdd = fullWeeks * 7 + remainingDutyDays;

  start.setDate(start.getDate() + calendarDaysToAdd);
  return start.toISOString().slice(0, 10);
}

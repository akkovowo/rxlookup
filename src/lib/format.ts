export function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function initials(name: string) {
  return name
    .split(/[\s.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function nowLabel() {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
}

export function remainParts(until: string | null | undefined) {
  if (!until) return null;
  const end = Date.parse(until.includes("T") ? until : until.replace(" ", "T") + "Z");
  if (!Number.isFinite(end)) return null;
  const ms = end - Date.now();
  if (ms <= 0) return null;
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return {
    days,
    hours,
    minutes,
    totalHours: days * 24 + hours,
    totalMinutes: hours * 60 + minutes,
  };
}

export function remainLabel(until: string | null | undefined) {
  const parts = remainParts(until);
  if (!parts) return "Inactive";
  if (parts.days > 0) return `${parts.days}d ${parts.hours}h`;
  return `${parts.hours}h ${parts.minutes}m`;
}

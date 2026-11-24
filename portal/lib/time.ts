// All dates are shown and entered in Pakistan time (Asia/Karachi, fixed UTC+5, no daylight saving).
const ZONE = "Asia/Karachi";
const OFFSET = "+05:00";

/**
 * "2026-11-30T23:59" typed in Pakistan time → "2026-11-30T18:59:00.000Z". Some browsers send
 * seconds too ("2026-11-30T23:59:00" or "…:00.000"); those are accepted.
 */
export function karachiInputToISO(local: string): string {
  const m = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::(\d{2})(?:\.\d{1,3})?)?$/.exec(local);
  if (!m) throw new Error(`Not a date and time: ${local}`);
  const date = new Date(`${m[1]}:${m[2] ?? "00"}${OFFSET}`);
  if (Number.isNaN(date.getTime())) throw new Error(`Not a date and time: ${local}`);
  return date.toISOString();
}

function parts(iso: string): Record<string, string> {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  return Object.fromEntries(fmt.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
}

/** ISO → "2026-11-30T23:59" in Pakistan time, for datetime-local inputs. */
export function isoToKarachiInput(iso: string): string {
  const p = parts(iso);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** "2026-11-15" (a plain date) or an ISO timestamp → "15 Nov 2026". */
export function formatDate(isoOrDate: string): string {
  const plain = /^\d{4}-\d{2}-\d{2}$/.test(isoOrDate);
  const date = plain ? new Date(`${isoOrDate}T12:00:00${OFFSET}`) : new Date(isoOrDate);
  return new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, day: "numeric", month: "short", year: "numeric" }).format(date);
}

/** ISO → "30 Nov 2026, 11:59 pm". */
export function formatDateTime(iso: string): string {
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, hour: "numeric", minute: "2-digit", hour12: true })
    .format(new Date(iso))
    .replace(/\s?(am|pm)$/i, (m) => ` ${m.trim().toLowerCase()}`);
  return `${formatDate(iso)}, ${time}`;
}

/** "just now", "5 min ago", "3 h ago", otherwise the date. */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const seconds = Math.round((now.getTime() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  return formatDate(iso);
}

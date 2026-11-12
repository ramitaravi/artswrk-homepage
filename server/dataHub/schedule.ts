/** Heartbeat cron is UTC-only. Schedule 07:17 and 08:17 UTC; exactly one
 * falls at 03:17 America/New_York. Allow delayed delivery within that hour.
 * This gate is used only by the scheduled callback, never manual admin runs. */
export function isDataHubDailyWindow(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  const minute = Number(parts.find((p) => p.type === "minute")?.value);
  return hour === 3 && minute >= 17;
}

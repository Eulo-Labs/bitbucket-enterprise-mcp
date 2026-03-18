/**
 * Format an ISO timestamp string into a two-part display suitable for audit log tables.
 * Date line: "Mar 13, 2026"  (abbreviated month, UTC)
 * Time line: "07:05 UTC"     (24-hour, UTC)
 */
export function formatTimestamp(ts: string): { date: string; time: string } {
  const d = new Date(ts);
  const date = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const time =
    d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'UTC',
    }) + ' UTC';
  return { date, time };
}

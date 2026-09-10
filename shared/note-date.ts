export function noteTimestamp(now = new Date()): string {
  return now.toISOString();
}

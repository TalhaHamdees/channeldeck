/** Every calendar day (YYYY-MM-DD, UTC) in [from, to], inclusive. */
export function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  for (
    let d = new Date(`${from}T00:00:00Z`);
    d <= new Date(`${to}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

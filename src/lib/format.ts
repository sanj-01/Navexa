// Indian rupee formatter. Uses Intl "en-IN" so 4,00,000 groups the way an
// Indian entrepreneur reads. Feeds every fee and threshold in the UI.

export function inr(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (value === 0) return "Free";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

export function inrShort(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

export function daysRange(range: [number, number] | undefined): string | null {
  if (!range) return null;
  const [lo, hi] = range;
  if (lo === 0 && hi <= 1) return "same day";
  if (lo === hi) return `${lo} days`;
  return `${lo}–${hi} days`;
}

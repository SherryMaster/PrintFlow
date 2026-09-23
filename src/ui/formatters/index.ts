const rupees = new Intl.NumberFormat("en-PK", {
  useGrouping: true,
  maximumFractionDigits: 0,
});

export function formatMoney(paisa: bigint | string | null): string {
  if (paisa === null) return "Quote required";
  if (typeof paisa === "string" && !/^-?\d+$/.test(paisa)) {
    throw new Error("Paisa must be an integer decimal string");
  }
  const value = BigInt(paisa);
  const magnitude = value < 0n ? -value : value;
  return `${value < 0n ? "−" : ""}PKR ${rupees.format(magnitude / 100n)}.${(magnitude % 100n).toString().padStart(2, "0")}`;
}

const localCalendarDate = new Intl.DateTimeFormat("en-PK", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function formatLocalDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error("Expected a local calendar date");
  const date = new Date(`${value}T12:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new Error("Invalid local calendar date");
  }
  return localCalendarDate.format(date);
}

export function formatShopInstant(
  value: string | Date,
  timeZone: "Asia/Karachi",
): string {
  if (typeof value === "string" && !/(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new Error("Expected a timezone qualified instant");
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid UTC instant");
  return new Intl.DateTimeFormat("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  }).format(date);
}

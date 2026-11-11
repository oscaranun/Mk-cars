/** Accept numeric form values and Argentine formatted amounts without losing cents. */
export function parseMoney(value: unknown, max = 100_000_000): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null
  let raw = String(value).trim()
  if (!raw || raw.length > 30) return null
  if (raw.includes(",")) {
    // Argentine input: 1.250,50 or 1250,50. Reject mixed/ambiguous separators.
    if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(raw)) return null
    raw = raw.replace(/\./g, "").replace(",", ".")
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(raw)) {
    raw = raw.replace(/\./g, "")
  }
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) return null
  const [whole, fraction = ""] = raw.split(".")
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"))
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > max * 100) return null
  return cents / 100
}

export type VehicleCategory = "auto" | "suv" | "pickup"

export type CatalogEntry = {
  id: string
  brand: string
  model: string
  category: VehicleCategory | null
  aliases: string[]
}

type IndexedEntry = CatalogEntry & { brandKey: string; modelKey: string; tokens: string[] }

const BRAND_ALIASES: Record<string, string[]> = {
  Volkswagen: ["vw", "volks"],
  Chevrolet: ["chevy", "chev"],
  "Mercedes-Benz": ["mercedes", "mb", "benz"],
  Citroën: ["citroen"],
  "Great Wall": ["gwm"],
  RAM: ["dodge ram"],
}

export const MAX_RESULTS = 8

export function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, " ")
    .trim()
}

function compact(value: string) {
  return value.replace(/\s+/g, "")
}

export function indexCatalog(entries: CatalogEntry[]): IndexedEntry[] {
  return entries.map((entry) => {
    const brandKey = normalize(entry.brand)
    const modelKey = normalize(entry.model)
    const words = [brandKey, modelKey, ...(BRAND_ALIASES[entry.brand] ?? []), ...entry.aliases.map(normalize)].join(" ")
    const parts = words.split(" ").filter(Boolean)
    const tokens = Array.from(new Set([...parts, compact(modelKey), ...entry.aliases.map((a) => compact(normalize(a)))]))
    return { ...entry, brandKey, modelKey, tokens }
  })
}

export function searchCatalog(index: IndexedEntry[], query: string): CatalogEntry[] {
  const terms = normalize(query).split(" ").filter(Boolean)
  if (!terms.length) return []
  const joined = compact(normalize(query))

  const scored: { entry: IndexedEntry; score: number }[] = []
  for (const entry of index) {
    if (!terms.every((term) => entry.tokens.some((token) => token.startsWith(term)))) continue
    const full = compact(`${entry.brandKey}${entry.modelKey}`)
    const model = compact(entry.modelKey)
    let score = 0
    if (model === joined || full === joined) score += 100
    else if (model.startsWith(joined)) score += 60
    else if (full.startsWith(joined)) score += 40
    if (terms.some((term) => compact(entry.modelKey) === term)) score += 30
    score -= entry.model.length / 10
    scored.push({ entry, score })
  }

  return scored
    .sort((a, b) => b.score - a.score || a.entry.brand.localeCompare(b.entry.brand))
    .slice(0, MAX_RESULTS)
    .map(({ entry }) => ({
      id: entry.id,
      brand: entry.brand,
      model: entry.model,
      category: entry.category,
      aliases: entry.aliases,
    }))
}

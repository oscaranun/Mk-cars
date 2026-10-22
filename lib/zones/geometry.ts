export type Point = { lat: number; lng: number }
export type Ring = [number, number][]

/** Coordinates are GeoJSON [longitude, latitude]. Boundaries count as inside. */
export function containsPoint(ring: Ring, { lat, lng }: Point) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || ring.length < 4) return false
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x, y] = ring[i],
      [px, py] = ring[j]
    const cross = (lng - x) * (py - y) - (lat - y) * (px - x)
    if (
      Math.abs(cross) < 1e-10 &&
      lng >= Math.min(x, px) &&
      lng <= Math.max(x, px) &&
      lat >= Math.min(y, py) &&
      lat <= Math.max(y, py)
    )
      return true
    if (y > lat !== py > lat && lng < ((px - x) * (lat - y)) / (py - y) + x) inside = !inside
  }
  return inside
}

export function parseRing(raw: string): Ring | null {
  try {
    const value = JSON.parse(raw)
    if (value?.type === "Polygon" && value.coordinates?.length !== 1) return null
    const ring = value?.type === "Polygon" ? value.coordinates?.[0] : value
    if (!Array.isArray(ring) || ring.length < 4 || ring.length > 500) return null
    if (
      !ring.every(
        (p: unknown) =>
          Array.isArray(p) &&
          p.length === 2 &&
          p.every((n: unknown) => typeof n === "number" && Number.isFinite(n)) &&
          Math.abs(p[0]) <= 180 &&
          Math.abs(p[1]) <= 90,
      )
    )
      return null
    if (ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1]) return null
    const area = ring
      .slice(1)
      .reduce((sum: number, p: number[], i: number) => sum + ring[i][0] * p[1] - p[0] * ring[i][1], 0)
    if (Math.abs(area) < 1e-12) return null
    return ring
  } catch {
    return null
  }
}

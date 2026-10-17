type LngLat = readonly [number, number]

export const COVERAGE_POLYGON: readonly LngLat[] = [
  [-68.9262035, -32.8670088],
  [-68.8837786, -32.8487368],
  [-68.879953, -32.8431329],
  [-68.8758821, -32.8432977],
  [-68.8744598, -32.8541343],
  [-68.8214165, -32.852033],
  [-68.8234396, -32.8667617],
  [-68.8128456, -32.867359],
  [-68.8187312, -32.8731262],
  [-68.8261371, -32.8766686],
  [-68.8010255, -32.8788929],
  [-68.7926877, -32.8818585],
  [-68.7649521, -32.8970764],
  [-68.7593976, -32.8981368],
  [-68.7610652, -32.9035314],
  [-68.7709725, -32.9223273],
  [-68.7724071, -32.9731882],
  [-68.7687777, -33.0084535],
  [-68.7784153, -33.0417211],
  [-68.8492869, -33.0415977],
  [-68.8614871, -33.0428312],
  [-68.8737977, -33.0413922],
  [-68.896408, -33.043859],
  [-68.9023425, -33.0419678],
  [-68.9398138, -33.0472713],
  [-68.9364786, -33.0404877],
  [-68.9732019, -33.0362939],
  [-68.965845, -33.0198765],
  [-68.9109992, -32.9846054],
  [-68.8989461, -32.9782695],
  [-68.9043902, -32.9727561],
  [-68.8884625, -32.9450501],
  [-68.8785552, -32.9401417],
  [-68.8944461, -32.9014415],
  [-68.8875306, -32.8807876],
  [-68.8873344, -32.8748356],
  [-68.9262035, -32.8670088],
]

export const COVERAGE_BOUNDS = COVERAGE_POLYGON.reduce(
  (b, [lng, lat]) => ({
    west: Math.min(b.west, lng),
    east: Math.max(b.east, lng),
    south: Math.min(b.south, lat),
    north: Math.max(b.north, lat),
  }),
  { west: Infinity, east: -Infinity, south: Infinity, north: -Infinity },
)

export function isInCoverage(lat: number, lng: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  let inside = false
  for (let i = 0, j = COVERAGE_POLYGON.length - 1; i < COVERAGE_POLYGON.length; j = i++) {
    const [xi, yi] = COVERAGE_POLYGON[i]
    const [xj, yj] = COVERAGE_POLYGON[j]
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

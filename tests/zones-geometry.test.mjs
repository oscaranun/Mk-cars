import { test } from "node:test"
import assert from "node:assert/strict"
import { parseRing, containsPoint } from "../lib/zones/geometry.ts"

test("zone boundaries include edges and do not include distant addresses", () => {
  const ring = parseRing("[[-69,-33],[-68,-33],[-68,-32],[-69,-32],[-69,-33]]")
  assert.ok(ring)
  assert.equal(containsPoint(ring, { lat: -32.5, lng: -68.5 }), true)
  assert.equal(containsPoint(ring, { lat: -32.5, lng: -69 }), true)
  assert.equal(containsPoint(ring, { lat: 0, lng: 0 }), false)
  assert.equal(containsPoint(ring, { lat: NaN, lng: -68.5 }), false)
})

test("invalid or ambiguous geometry is rejected rather than extending an operating area", () => {
  for (const raw of [
    "not json",
    "[]",
    "[[0,0],[1,1],[2,2],[0,0]]",
    "[[0,0],[1,0],[1,1],[0,1]]",
    "[[999,0],[1,0],[1,1],[999,0]]",
    '[["0",0],[1,0],[1,1],["0",0]]',
    '{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,0]],[[0,0],[1,0],[1,1],[0,0]]]}',
  ])
    assert.equal(parseRing(raw), null, raw)
})

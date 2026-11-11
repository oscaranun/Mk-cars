import assert from "node:assert/strict"
import test from "node:test"
import { resolveOfferAcceptance } from "../lib/admin/offer-acceptance.ts"

const slot = { start: "2026-11-16T14:40:00-03:00", duration: 60 }
const other = { start: "2026-11-17T10:00:00-03:00", duration: 90 }
const offer = { token: "a".repeat(48), version: 2, status: "enviada", slots: [slot] }

test("a single saved option can be accepted directly by the operator", () => {
  assert.deepEqual(resolveOfferAcceptance(offer, "", 2), { token: offer.token, version: 2, start: slot.start })
})
test("multiple options require selecting the one the client accepted", () => {
  const options = { ...offer, slots: [slot, other] }
  assert.ok(resolveOfferAcceptance(options, "", 2).error)
  assert.equal(resolveOfferAcceptance(options, other.start, 2).start, other.start)
  assert.equal(resolveOfferAcceptance(options, "2026-11-17T13:00:00Z", 2).start, other.start)
})
test("stale versions and altered slots cannot silently accept different conditions", () => {
  assert.ok(resolveOfferAcceptance(offer, slot.start, 1).error)
  assert.ok(resolveOfferAcceptance(offer, other.start, 2).error)
})
test("already accepted, cancelled or missing offers cannot be accepted again", () => {
  for (const value of [
    null,
    { ...offer, status: "aceptada" },
    { ...offer, status: "anulada" },
    { ...offer, slots: [] },
    { ...offer, slots: [{ start: "invalid", duration: 60 }] },
  ])
    assert.ok(resolveOfferAcceptance(value, "", 2).error)
})

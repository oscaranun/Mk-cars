import test from "node:test"
import assert from "node:assert/strict"
import { appointmentPrice } from "../lib/admin/appointment-price.ts"

test("the completed service price overrides the original quote in collections", () => {
  assert.equal(appointmentPrice({ agreed_price: 30000, services: [{ final_price: 35000 }] }), 35000)
})
test("adjusted prices survive completion defaults and zero remains a valid final price", () => {
  assert.equal(appointmentPrice({ agreed_price: 30000, adjusted_price: 35000, services: [] }), 35000)
  assert.equal(appointmentPrice({ agreed_price: 30000, adjusted_price: 35000, services: [{ final_price: 0 }] }), 0)
})
test("unadjusted quotes deduct the discount once and undefined prices stay undefined", () => {
  assert.equal(appointmentPrice({ agreed_price: 30000, discount: 5000 }), 25000)
  assert.equal(appointmentPrice({ agreed_price: null }), null)
})

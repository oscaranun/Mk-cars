import test from "node:test"
import assert from "node:assert/strict"
import { parseMoney } from "../lib/admin/money.ts"

test("preserves cents from numeric forms and Argentine input", () => {
  for (const [input, expected] of [
    ["1250.50", 1250.5],
    ["1234.5", 1234.5],
    ["1.250,50", 1250.5],
    ["1.250", 1250],
    ["1.250.000,01", 1250000.01],
    ["0", 0],
    ["0,01", 0.01],
    [1250.5, 1250.5],
  ])
    assert.equal(parseMoney(input), expected, input)
})
test("rejects ambiguous, negative, over-limit and non-finite amounts", () => {
  for (const input of [
    "",
    null,
    undefined,
    "-1",
    "1e4",
    "Infinity",
    "1.23.45",
    "1,2,3",
    "12.3456",
    "100000000.01",
    "1,250.50",
  ])
    assert.equal(parseMoney(input), null, String(input))
})

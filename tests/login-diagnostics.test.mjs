import assert from "node:assert/strict"
import test from "node:test"
import { loginFailureDiagnostic } from "../lib/supabase/login-diagnostics.ts"

const url = "https://abcdefghijklmnopqrst.supabase.co"
const jwt = ref => "eyJ.test-placeholder." + ref
const claimKey = ref => "eyJ." + Buffer.from(JSON.stringify({ ref })).toString("base64url") + ".synthetic-signature"

test("keeps useful status for API failures without an SDK code", () => {
  const result = loginFailureDiagnostic({ name: "AuthApiError", status: 401, message: "Invalid API key" }, url, claimKey("abcdefghijklmnopqrst"))
  assert.equal(result.reason, "invalid_api_key")
  assert.equal(result.status, 401)
  assert.equal(result.code, "unavailable")
  assert.equal(result.configuration.key_project_matches, true)
})

test("preserves known auth and transport codes", () => {
  assert.equal(loginFailureDiagnostic({ code: "invalid_credentials", status: 400 }).code, "invalid_credentials")
  const result = loginFailureDiagnostic({ name: "TypeError", message: "fetch failed", cause: { code: "ENOTFOUND" } })
  assert.equal(result.reason, "network_error")
  assert.equal(result.network_code, "ENOTFOUND")
})

test("never emits raw errors, credentials, JWT payloads, or malformed URLs", () => {
  const secret = "SENSITIVE-password-key-email-token"
  const result = loginFailureDiagnostic({ name: secret, code: secret, status: secret,
    message: secret, stack: secret, cause: { code: secret }, access_token: secret },
    "https://" + secret + "@example.com", jwt(secret))
  assert.equal(JSON.stringify(result).includes(secret), false)
  assert.equal(result.name, "unknown")
  assert.equal(result.status, null)
  assert.equal(result.configuration.project_ref, null)
})

test("reports format and project mismatch without returning the key", () => {
  const key = claimKey("different-project")
  const result = loginFailureDiagnostic({}, url, key)
  assert.equal(result.configuration.key_project_matches, false)
  assert.equal(JSON.stringify(result).includes(key), false)
  const quoted = loginFailureDiagnostic({}, url, '" eyJ.placeholder "')
  assert.equal(quoted.configuration.key_has_wrapping_quotes, true)
  assert.equal(quoted.configuration.key_has_whitespace, true)
  assert.equal(loginFailureDiagnostic({}, url, "sb_secret_placeholder").configuration.key_format, "server_secret_in_public_variable")
})

test("handles non-object thrown errors without logging their values", () => {
  for (const error of [null, undefined, "SENSITIVE", 500]) {
    assert.equal(loginFailureDiagnostic(error).name, "unknown")
  }
})

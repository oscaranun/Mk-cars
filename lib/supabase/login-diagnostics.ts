// Never log a raw Auth error: its message, cause or stack may contain credentials.
const AUTH_CODES = new Set([
  "invalid_credentials", "email_not_confirmed", "over_request_rate_limit",
  "over_email_send_rate_limit", "user_banned", "unexpected_failure",
  "bad_jwt", "session_not_found", "request_timeout", "validation_failed",
])
const ERROR_NAMES = new Set([
  "AuthApiError", "AuthRetryableFetchError", "AuthUnknownError", "AuthError",
  "TypeError", "Error", "AbortError", "TimeoutError",
])
const NETWORK_CODES = new Set([
  "ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT",
  "CERT_HAS_EXPIRED", "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
])

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : {}
}

export function loginFailureDiagnostic(error: unknown, url = "", key = "") {
  const detail = record(error)
  const cause = record(detail.cause)
  const message = typeof detail.message === "string" ? detail.message : ""
  const name = typeof detail.name === "string" && ERROR_NAMES.has(detail.name) ? detail.name : "unknown"
  const code = typeof detail.code === "string" && AUTH_CODES.has(detail.code) ? detail.code : "unavailable"
  const networkCode = [cause.code, detail.code].find(value => typeof value === "string" && NETWORK_CODES.has(value))
  const status = typeof detail.status === "number" && Number.isInteger(detail.status) &&
    detail.status >= 0 && detail.status <= 599 ? detail.status : null

  let projectRef: string | null = null
  let urlFormat = "invalid"
  try {
    const parsed = new URL(url)
    if (parsed.protocol === "https:" && !parsed.username && !parsed.password &&
        !parsed.search && !parsed.hash && !parsed.port && ["", "/"].includes(parsed.pathname)) {
      const match = /^([a-z0-9]{20})\.supabase\.co$/.exec(parsed.hostname)
      if (match) {
        projectRef = match[1]
        urlFormat = "supabase_project"
      }
    }
  } catch { /* Report the format only, never the malformed URL. */ }

  const keyFormat = key.startsWith("eyJ") ? "jwt" : key.startsWith("sb_publishable_") ?
    "publishable" : key.startsWith("sb_secret_") ? "server_secret_in_public_variable" : "unknown"
  let keyProjectMatches: boolean | null = null
  if (keyFormat === "jwt" && projectRef) {
    try {
      // This is an untrusted format check, not JWT authentication or verification.
      const claims = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8"))
      if (typeof claims.ref === "string") keyProjectMatches = claims.ref === projectRef
    } catch { /* No decoded JWT data is emitted. */ }
  }

  const reason = /invalid api key/i.test(message) ? "invalid_api_key" :
    networkCode || name === "AuthRetryableFetchError" || /fetch failed|network request failed/i.test(message) ? "network_error" :
    /unexpected token|not valid json/i.test(message) ? "invalid_response" : "auth_error"

  return {
    diagnostic_version: "login-v1",
    reason, name, status, code,
    network_code: typeof networkCode === "string" ? networkCode : null,
    configuration: {
      url_format: urlFormat,
      project_ref: projectRef,
      key_format: keyFormat,
      key_has_wrapping_quotes: /^["']|["']$/.test(key),
      key_has_whitespace: /\s/.test(key),
      key_project_matches: keyProjectMatches,
    },
  }
}

import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")
  const nextParam = request.nextUrl.searchParams.get("next")
  const next = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/admin/restablecer"

  if (code) {
    const supabase = await createClient()
    const { error } = (await supabase?.auth.exchangeCodeForSession(code)) ?? { error: null }
    if (error) {
      console.error("[auth] code exchange failed:", error.code)
      return NextResponse.redirect(new URL("/admin/restablecer?error=link", request.url))
    }
  }

  // Recovery tokens travel in the URL hash, which the browser keeps across this redirect.
  return NextResponse.redirect(new URL(next, request.url))
}

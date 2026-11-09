import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"

const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/recuperar", "/admin/restablecer"]

function nextWithPathname(request: NextRequest) {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-pathname", request.nextUrl.pathname)
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isAdminArea = pathname.startsWith("/admin") && !PUBLIC_ADMIN_PATHS.includes(pathname)

  if (!isSupabaseConfigured()) {
    if (isAdminArea) {
      const url = request.nextUrl.clone()
      url.pathname = "/admin/login"
      return NextResponse.redirect(url)
    }
    return nextWithPathname(request)
  }

  let supabaseResponse = nextWithPathname(request)

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookieOptions: { secure: process.env.NODE_ENV === "production", maxAge: 400 * 24 * 60 * 60 },
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = nextWithPathname(request)
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (isAdminArea && !user) {
    const url = request.nextUrl.clone()
    url.pathname = "/admin/login"
    return NextResponse.redirect(url)
  }

  if (pathname === "/admin/login" && user) {
    const url = request.nextUrl.clone()
    url.pathname = "/admin"
    const redirect = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
    return redirect
  }

  return supabaseResponse
}

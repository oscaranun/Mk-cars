"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

const MIN_GAP_MS = 30_000
const INTERVAL_MS = 5 * 60_000

const dayKey = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" })

/**
 * iOS/Android keep the PWA page in memory when it is reopened, so server-rendered
 * data (today's date, agenda) can stay stale. Refresh when the app comes back to
 * the foreground, periodically while visible, and as soon as the day changes.
 */
export function AutoRefresh() {
  const router = useRouter()
  const last = useRef({ at: Date.now(), day: dayKey() })

  useEffect(() => {
    const refresh = (force = false) => {
      if (document.visibilityState !== "visible") return
      const now = Date.now()
      const day = dayKey()
      if (!force && day === last.current.day && now - last.current.at < MIN_GAP_MS) return
      last.current = { at: now, day }
      router.refresh()
    }

    const onVisible = () => refresh()
    const onShow = (e: PageTransitionEvent) => refresh(e.persisted)
    const timer = window.setInterval(() => refresh(true), INTERVAL_MS)
    const dayCheck = window.setInterval(() => {
      if (dayKey() !== last.current.day) refresh(true)
    }, 60_000)

    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onVisible)
    window.addEventListener("pageshow", onShow)
    return () => {
      window.clearInterval(timer)
      window.clearInterval(dayCheck)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onVisible)
      window.removeEventListener("pageshow", onShow)
    }
  }, [router])

  return null
}

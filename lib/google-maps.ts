"use client"

/* Google Maps types are supplied by the browser SDK already used by the site. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GoogleWindow = Window & { google?: any; __mkMapsReady?: () => void; gm_authFailure?: () => void }
let ready: Promise<void> | null = null
let authFailed = false
const AUTH_FAILURE_EVENT = "mk:maps-auth-failure"

/* Google calls window.gm_authFailure when the key is rejected (e.g. domain not allowed). */
export function onGoogleMapsAuthFailure(callback: () => void) {
  if (typeof window === "undefined") return () => {}
  const w = window as GoogleWindow
  w.gm_authFailure ??= () => {
    authFailed = true
    console.error("[maps] Google rechazó la clave para", window.location.origin)
    window.dispatchEvent(new Event(AUTH_FAILURE_EVENT))
  }
  if (authFailed) callback()
  window.addEventListener(AUTH_FAILURE_EVENT, callback)
  return () => window.removeEventListener(AUTH_FAILURE_EVENT, callback)
}

export async function loadGoogleLibrary(name: "places" | "maps" | "marker") {
  const w = window as GoogleWindow
  if (!w.google?.maps?.importLibrary) {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!key) throw new Error("Google Maps no está configurado para este entorno.")
    ready ??= new Promise<void>((resolve, reject) => {
      w.__mkMapsReady = resolve
      const script = document.createElement("script")
      script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&language=es&region=AR&callback=__mkMapsReady`
      script.async = true
      script.onerror = () => {
        ready = null
        script.remove()
        reject(new Error("No se pudo cargar Google Maps."))
      }
      document.head.appendChild(script)
    })
    await ready
  }
  return w.google.maps.importLibrary(name)
}

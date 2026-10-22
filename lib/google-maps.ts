"use client"

/* Google Maps types are supplied by the browser SDK already used by the site. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GoogleWindow = Window & { google?: any; __mkMapsReady?: () => void }
let ready: Promise<void> | null = null

export async function loadGoogleLibrary(name: "places" | "maps") {
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

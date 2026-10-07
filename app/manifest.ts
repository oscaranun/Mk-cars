import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MK Cars — Lavado de autos a domicilio",
    short_name: "MK Cars",
    description: "Lavado de autos a domicilio en Gran Mendoza. Reservá por WhatsApp.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1f5eff",
    lang: "es-AR",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  }
}

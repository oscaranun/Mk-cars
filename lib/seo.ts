import { COVERAGE_ZONES, EMAIL, INSTAGRAM_URL, SERVICE_HOURS, WHATSAPP_NUMBER } from "@/lib/site"

export const SITE_URL = "https://www.mkcars.com.ar"
export const SITE_NAME = "MK Cars"

export const SEO_KEYWORDS = [
  "lavado de autos a domicilio Mendoza",
  "lavado a domicilio Mendoza",
  "lavadero móvil Mendoza",
  "lavado de autos Mendoza",
  "lavadero de autos a domicilio",
  "lavado de autos Godoy Cruz",
  "lavado de autos Guaymallén",
  "lavado de autos Las Heras",
  "lavado de autos Luján de Cuyo",
  "lavado de autos Maipú",
  "lavado de tapizados a domicilio Mendoza",
  "limpieza de motor Mendoza",
  "car wash Mendoza",
  "MK Cars",
]

export function localBusinessJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "AutoWash",
    "@id": `${SITE_URL}/#business`,
    name: "MK Cars — Lavado de autos a domicilio",
    alternateName: "MK Cars Mendoza",
    description:
      "Lavado premium de autos, SUVs y pick-ups a domicilio en Gran Mendoza. Vamos hasta tu casa o trabajo todos los días, incluso feriados.",
    url: SITE_URL,
    image: `${SITE_URL}/images/hero-light.png`,
    logo: `${SITE_URL}/icon.svg`,
    telephone: `+${WHATSAPP_NUMBER}`,
    email: EMAIL,
    priceRange: "$$",
    currenciesAccepted: "ARS",
    paymentAccepted: "Efectivo, Transferencia, Mercado Pago",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Mendoza",
      addressRegion: "Mendoza",
      addressCountry: "AR",
    },
    geo: { "@type": "GeoCoordinates", latitude: -32.8895, longitude: -68.8458 },
    areaServed: COVERAGE_ZONES.map((zone) => ({
      "@type": "City",
      name: `${zone}, Mendoza`,
    })),
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        opens: SERVICE_HOURS.open.padStart(5, "0"),
        closes: SERVICE_HOURS.close,
      },
    ],
    sameAs: [INSTAGRAM_URL],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Servicios de lavado a domicilio",
      itemListElement: [
        "Lavado exterior e interior a domicilio",
        "Lavado de tapizados a domicilio",
        "Limpieza de motor a domicilio",
      ].map((name) => ({
        "@type": "Offer",
        itemOffered: { "@type": "Service", name, areaServed: "Gran Mendoza" },
      })),
    },
  }
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: SITE_URL,
    name: SITE_NAME,
    inLanguage: "es-AR",
    publisher: { "@id": `${SITE_URL}/#business` },
  }
}

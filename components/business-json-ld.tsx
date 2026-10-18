import { COVERAGE_ZONES, EMAIL, INSTAGRAM_URL, SITE_URL, WHATSAPP_NUMBER } from "@/lib/site"

const SERVICES = [
  "Lavado exterior de autos a domicilio",
  "Aspirado interior y baúl",
  "Limpieza interior de tablero y paneles",
  "Limpieza de vidrios interiores y exteriores",
  "Limpieza de llantas y renovador de neumáticos",
  "Lavado de SUV y camionetas a domicilio",
]

const businessJsonLd = {
  "@context": "https://schema.org",
  "@type": "AutoWash",
  "@id": `${SITE_URL}/#business`,
  name: "MK Cars",
  alternateName: "MK Car Wash",
  description:
    "Lavado premium de autos a domicilio en Gran Mendoza. Servicio móvil: vamos hasta tu casa u oficina con o sin agua propia.",
  url: `${SITE_URL}/`,
  logo: `${SITE_URL}/images/mk-logo-hd2.png`,
  image: `${SITE_URL}/images/mk-van.webp`,
  telephone: `+${WHATSAPP_NUMBER}`,
  email: EMAIL,
  sameAs: [INSTAGRAM_URL],
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      opens: "09:00",
      closes: "18:00",
    },
  ],
  areaServed: [
    ...COVERAGE_ZONES.map((zone) => ({
      "@type": "City",
      name: zone === "Capital" ? "Ciudad de Mendoza" : zone,
      containedInPlace: { "@type": "State", name: "Mendoza" },
    })),
    { "@type": "Place", name: "Chacras de Coria, Luján de Cuyo, Mendoza" },
  ],
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Servicios de lavado a domicilio",
    itemListElement: SERVICES.map((name) => ({
      "@type": "Offer",
      itemOffered: { "@type": "Service", name, areaServed: "Gran Mendoza, Argentina" },
    })),
  },
}

export function BusinessJsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(businessJsonLd).replace(/</g, "\\u003c") }}
    />
  )
}

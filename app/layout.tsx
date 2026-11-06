import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { SEO_KEYWORDS, SITE_NAME, SITE_URL } from "@/lib/seo"

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })

const description =
  "Lavado de autos a domicilio en Mendoza: Capital, Godoy Cruz, Guaymallén, Las Heras, Luján de Cuyo y Maipú. Desde $25.000. Todos los días de 7 a 20 h, incluso feriados. Reservá por WhatsApp."

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Lavado de autos a domicilio en Mendoza | MK Cars",
    template: "%s | MK Cars Mendoza",
  },
  description,
  keywords: SEO_KEYWORDS,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "Automotive",
  alternates: { canonical: "/" },
  formatDetection: { telephone: true, email: true, address: false },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
  openGraph: {
    title: "Lavado de autos a domicilio en Mendoza | MK Cars",
    description,
    url: "/",
    siteName: SITE_NAME,
    locale: "es_AR",
    type: "website",
    images: [{ url: "/images/hero-light.png", alt: "MK Cars lavando un auto a domicilio en Mendoza" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lavado de autos a domicilio en Mendoza | MK Cars",
    description,
    images: ["/images/hero-light.png"],
  },
  other: {
    "geo.region": "AR-M",
    "geo.placename": "Mendoza",
    "geo.position": "-32.8895;-68.8458",
    ICBM: "-32.8895, -68.8458",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#061a33",
  viewportFit: "cover",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR" className={`${geistSans.variable} ${geistMono.variable} bg-background`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}

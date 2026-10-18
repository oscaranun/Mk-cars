import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { SITE_URL } from "@/lib/site"
import "./globals.css"

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })

const title = "MK Cars | Lavado de Autos a Domicilio en Mendoza"
const description =
  "Lavado premium de autos a domicilio en Gran Mendoza: exterior, aspirado, interior, vidrios y llantas. Capital, Godoy Cruz, Guaymallén, Las Heras, Luján y Maipú. Reservá online."
const ogImage = {
  url: "/images/og-reservar.png",
  width: 1200,
  height: 630,
  alt: "MK Cars — Lavado premium a domicilio en Gran Mendoza",
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title,
  description,
  applicationName: "MK Cars",
  keywords: [
    "lavado de autos a domicilio Mendoza",
    "lavadero de autos a domicilio Mendoza",
    "lavadero móvil Mendoza",
    "lavado premium de autos Mendoza",
    "car wash a domicilio Mendoza",
  ],
  robots: { index: true, follow: true },
  openGraph: {
    title,
    description,
    url: "/",
    siteName: "MK Cars",
    locale: "es_AR",
    type: "website",
    images: [ogImage],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [ogImage.url],
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

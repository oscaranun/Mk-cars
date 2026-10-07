import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })

export const metadata: Metadata = {
  title: "MK Cars — Lavado de autos a domicilio en Gran Mendoza",
  description:
    "Lavado premium a domicilio en Capital, Godoy Cruz, Guaymallén, Las Heras, Luján de Cuyo y Maipú. Desde $25.000. Lunes a sábado de 9:00 a 18:00. Reservá por WhatsApp.",
  keywords: ["lavado de autos a domicilio", "lavadero móvil Mendoza", "MK Cars", "Gran Mendoza", "car wash Mendoza"],
  openGraph: {
    title: "MK Cars — Tu auto impecable. Sin moverte de donde estás.",
    description: "Lavado profesional a domicilio en Gran Mendoza.",
    locale: "es_AR",
    type: "website",
    images: ["/images/hero-light.png"],
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

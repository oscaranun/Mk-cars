import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/seo"

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/reservar`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/promo`, lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/privacidad`, lastModified, changeFrequency: "yearly", priority: 0.2 },
  ]
}

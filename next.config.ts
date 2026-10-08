import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/mkbasedatos", destination: "/admin", permanent: false },
      { source: "/MKbasedatos", destination: "/admin", permanent: false },
      { source: "/MKBASEDATOS", destination: "/admin", permanent: false },
    ]
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
        ],
      },
    ]
  },
}

export default nextConfig

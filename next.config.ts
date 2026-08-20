import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Le client Prisma genere (lib/generated/prisma) et pg ne doivent pas etre
  // bundles par Turbopack cote serveur : ils chargent des binaires natifs.
  serverExternalPackages: ["@prisma/client", "pg"],
  eslint: {
    // Le lint tourne dans son propre script (npm run lint) : ne pas bloquer le build.
    ignoreDuringBuilds: true,
  },
}

export default nextConfig

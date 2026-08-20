import type { Metadata, Viewport } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: "BTP Pilote — pilotage des chantiers et de la rentabilite",
    template: "%s · BTP Pilote",
  },
  description:
    "Chiffrage, consultation des sous-traitants, budget, planning et suivi de chantier reunis dans un seul outil de pilotage.",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#131f2d",
}

export default function LayoutRacine({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  )
}

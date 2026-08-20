"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { can, type Role } from "@/lib/permissions"

const ONGLETS = [
  { libelle: "Synthese", suffixe: "", ressource: "projets" },
  { libelle: "Chiffrage", suffixe: "/chiffrage", ressource: "chiffrage" },
  { libelle: "Consultations", suffixe: "/consultations", ressource: "consultations" },
  { libelle: "Budget", suffixe: "/budget", ressource: "budget" },
  { libelle: "Planning", suffixe: "/planning", ressource: "planning" },
  { libelle: "Chantier", suffixe: "/chantier", ressource: "chantier" },
  { libelle: "Avenants", suffixe: "/avenants", ressource: "budget" },
  { libelle: "Situations", suffixe: "/situations", ressource: "situations" },
  { libelle: "Documents", suffixe: "/documents", ressource: "documents" },
  { libelle: "Rentabilite", suffixe: "/rentabilite", ressource: "rentabilite" },
] as const

export function OngletsProjet({ projectId, role }: { projectId: string; role: Role }) {
  const pathname = usePathname()
  const base = `/dashboard/projets/${projectId}`

  return (
    <nav className="sans-impression -mb-px flex gap-0.5 overflow-x-auto border-b border-ardoise-200 defilement-fin">
      {ONGLETS.filter((o) => can(role, o.ressource, "read")).map((onglet) => {
        const href = `${base}${onglet.suffixe}`
        const actif = onglet.suffixe === "" ? pathname === base : pathname.startsWith(href)
        return (
          <Link
            key={onglet.libelle}
            href={href}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors",
              actif
                ? "border-chantier-500 font-medium text-ardoise-900"
                : "border-transparent text-ardoise-500 hover:border-ardoise-300 hover:text-ardoise-800"
            )}
          >
            {onglet.libelle}
          </Link>
        )
      })}
    </nav>
  )
}

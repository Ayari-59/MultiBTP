"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  Bot,
  Building2,
  ClipboardList,
  FileSpreadsheet,
  FolderKanban,
  HardHat,
  LayoutDashboard,
  Library,
  Menu,
  Receipt,
  Users,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { can, type Role } from "@/lib/permissions"

type Entree = {
  libelle: string
  href: string
  icone: React.ComponentType<{ className?: string }>
  ressource: Parameters<typeof can>[1]
}

type Section = { titre: string; entrees: Entree[] }

const SECTIONS: Section[] = [
  {
    titre: "Pilotage",
    entrees: [
      { libelle: "Tableau de bord", href: "/dashboard", icone: LayoutDashboard, ressource: "projets" },
      { libelle: "Projets", href: "/dashboard/projets", icone: FolderKanban, ressource: "projets" },
      { libelle: "Rapports", href: "/dashboard/rapports", icone: FileSpreadsheet, ressource: "rapports" },
    ],
  },
  {
    titre: "Developpement",
    entrees: [
      { libelle: "Clients & pipeline", href: "/dashboard/crm", icone: Users, ressource: "crm" },
    ],
  },
  {
    titre: "Etudes & achats",
    entrees: [
      { libelle: "Bibliotheque de prix", href: "/dashboard/bibliotheque", icone: Library, ressource: "bibliotheque" },
      { libelle: "Consultations", href: "/dashboard/consultations", icone: ClipboardList, ressource: "consultations" },
      { libelle: "Sous-traitants", href: "/dashboard/sous-traitants", icone: HardHat, ressource: "sous_traitants" },
    ],
  },
  {
    titre: "Finance",
    entrees: [
      { libelle: "Factures & situations", href: "/dashboard/factures", icone: Receipt, ressource: "situations" },
    ],
  },
  {
    titre: "Outils",
    entrees: [
      { libelle: "Assistant metier", href: "/dashboard/assistant", icone: Bot, ressource: "assistant" },
      { libelle: "Parametres", href: "/dashboard/parametres", icone: Building2, ressource: "organisation" },
    ],
  },
]

function estActif(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard"
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function BarreLaterale({
  role,
  organisation,
}: {
  role: Role
  organisation: string
}) {
  const pathname = usePathname()
  const [ouvert, setOuvert] = useState(false)

  const contenu = (
    <nav className="flex h-full flex-col gap-5 overflow-y-auto px-3 py-4">
      {SECTIONS.map((section) => {
        const visibles = section.entrees.filter((e) => can(role, e.ressource, "read"))
        if (visibles.length === 0) return null
        return (
          <div key={section.titre}>
            <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-ardoise-500">
              {section.titre}
            </p>
            <ul className="space-y-0.5">
              {visibles.map((entree) => {
                const actif = estActif(pathname, entree.href)
                const Icone = entree.icone
                return (
                  <li key={entree.href}>
                    <Link
                      href={entree.href}
                      onClick={() => setOuvert(false)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                        actif
                          ? "bg-ardoise-800 font-medium text-white"
                          : "text-ardoise-200 hover:bg-ardoise-800/60 hover:text-white"
                      )}
                    >
                      <Icone className="h-4 w-4 shrink-0" />
                      <span className="truncate">{entree.libelle}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </nav>
  )

  return (
    <>
      {/* Barre mobile */}
      <div className="sans-impression flex items-center justify-between border-b border-ardoise-800 bg-ardoise-900 px-4 py-2.5 lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2 text-white">
          <Logo />
        </Link>
        <button
          type="button"
          onClick={() => setOuvert((o) => !o)}
          className="rounded-md p-1.5 text-ardoise-200 hover:bg-ardoise-800"
          aria-label="Ouvrir le menu"
        >
          {ouvert ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {ouvert && (
        <div className="sans-impression border-b border-ardoise-800 bg-ardoise-900 lg:hidden">{contenu}</div>
      )}

      {/* Barre desktop */}
      <aside className="sans-impression hidden w-60 shrink-0 flex-col border-r border-ardoise-800 bg-ardoise-900 lg:flex">
        <div className="flex items-center gap-2 border-b border-ardoise-800 px-4 py-3.5">
          <Logo />
        </div>
        <div className="min-h-0 flex-1">{contenu}</div>
        <div className="border-t border-ardoise-800 px-4 py-3">
          <p className="truncate text-xs font-medium text-ardoise-200">{organisation}</p>
          <p className="text-[11px] text-ardoise-500">BTP Pilote</p>
        </div>
      </aside>
    </>
  )
}

function Logo() {
  return (
    <span className="flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded bg-chantier-500 text-[13px] font-bold text-white">
        BP
      </span>
      <span className="text-sm font-semibold tracking-tight text-white">BTP Pilote</span>
    </span>
  )
}

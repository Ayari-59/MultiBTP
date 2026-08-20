import Link from "next/link"
import { redirect } from "next/navigation"
import { getOrganisation, requireSession } from "@/lib/session"
import { BarreSuperieure } from "@/components/app/barre-superieure"

export default async function LayoutPortail({ children }: { children: React.ReactNode }) {
  const utilisateur = await requireSession()
  if (utilisateur.role !== "SOUS_TRAITANT" && utilisateur.role !== "ADMIN") redirect("/dashboard")

  const organisation = await getOrganisation(utilisateur.organizationId)

  return (
    <div className="min-h-screen">
      <div className="border-b border-ardoise-800 bg-ardoise-900 px-4 py-3 lg:px-6">
        <Link href="/portail" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-chantier-500 text-[13px] font-bold text-white">
            BP
          </span>
          <span className="text-sm font-semibold tracking-tight text-white">
            Espace entreprise
          </span>
        </Link>
      </div>

      <BarreSuperieure
        nom={utilisateur.nom}
        email={utilisateur.email}
        role={utilisateur.role}
        organisation={organisation.nom}
      />

      <main className="mx-auto max-w-6xl px-4 py-5 lg:px-6">{children}</main>
    </div>
  )
}

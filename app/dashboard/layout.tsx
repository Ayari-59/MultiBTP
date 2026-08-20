import { redirect } from "next/navigation"
import { BarreLaterale } from "@/components/app/navigation"
import { BarreSuperieure } from "@/components/app/barre-superieure"
import { estInterne } from "@/lib/permissions"
import { getOrganisation, requireSession } from "@/lib/session"

export default async function LayoutInterne({ children }: { children: React.ReactNode }) {
  const utilisateur = await requireSession()
  if (!estInterne(utilisateur.role)) redirect("/")

  const organisation = await getOrganisation(utilisateur.organizationId)

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <BarreLaterale role={utilisateur.role} organisation={organisation.nom} />
      <div className="flex min-w-0 flex-1 flex-col">
        <BarreSuperieure
          nom={utilisateur.nom}
          email={utilisateur.email}
          role={utilisateur.role}
          organisation={organisation.nom}
        />
        <main className="min-w-0 flex-1 px-4 py-5 lg:px-6">{children}</main>
      </div>
    </div>
  )
}

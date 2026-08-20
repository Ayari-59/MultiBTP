import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, MapPin, User } from "lucide-react"
import { requireAccess } from "@/lib/session"
import { ficheProjet } from "@/lib/queries/projets"
import { OngletsProjet } from "@/components/app/onglets-projet"
import { StatutProjet } from "@/components/app/indicateurs"
import { Badge } from "@/components/ui/primitives"
import { LIBELLES_OPERATION } from "@/lib/metier/referentiel"
import { dateCourte, nombre } from "@/lib/utils"

export default async function LayoutProjet({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const utilisateur = await requireAccess("projets", "read")
  const projet = await ficheProjet(id, utilisateur.organizationId)
  if (!projet) notFound()

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/dashboard/projets"
          className="sans-impression inline-flex items-center gap-1.5 text-xs text-ardoise-500 hover:text-ardoise-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Projets
        </Link>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold text-ardoise-900">{projet.nom}</h1>
              <StatutProjet statut={projet.statut} />
              {projet.priorite !== "NORMALE" && (
                <Badge ton={projet.priorite === "CRITIQUE" ? "danger" : "alerte"}>
                  Priorite {projet.priorite.toLowerCase()}
                </Badge>
              )}
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ardoise-500">
              <span className="tabulaire font-medium text-ardoise-600">{projet.reference}</span>
              <span>{LIBELLES_OPERATION[projet.typeOperation] ?? projet.typeOperation}</span>
              {projet.surface && <span>{nombre(projet.surface)} m²</span>}
              {projet.ville && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {[projet.adresse, projet.codePostal, projet.ville].filter(Boolean).join(", ")}
                </span>
              )}
              {projet.client && (
                <span className="inline-flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {projet.client.nom}
                </span>
              )}
            </p>
          </div>

          <div className="shrink-0 text-right text-xs text-ardoise-500">
            <p>
              Debut : <span className="tabulaire">{dateCourte(projet.dateDebutPrevue)}</span>
            </p>
            <p>
              Fin prevue : <span className="tabulaire">{dateCourte(projet.dateFinPrevue)}</span>
            </p>
            {projet.responsable && <p>Responsable : {projet.responsable.nom}</p>}
          </div>
        </div>
      </div>

      <OngletsProjet projectId={projet.id} role={utilisateur.role} />

      <div className="pt-1">{children}</div>
    </div>
  )
}

import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requireAccess } from "@/lib/session"
import { nb } from "@/lib/utils"
import { AssistantCreation } from "./assistant"

export const metadata: Metadata = { title: "Nouveau projet" }

export default async function PageNouveauProjet() {
  const utilisateur = await requireAccess("projets", "create")

  const [contacts, organisation, prix] = await Promise.all([
    prisma.contact.findMany({
      where: {
        organizationId: utilisateur.organizationId,
        type: { in: ["CLIENT", "PROSPECT", "PROPRIETAIRE", "INVESTISSEUR", "MAITRE_OUVRAGE"] },
      },
      select: { id: true, nom: true, prenom: true, societe: true, ville: true },
      orderBy: { nom: "asc" },
    }),
    prisma.organization.findUniqueOrThrow({
      where: { id: utilisateur.organizationId },
      select: {
        margeCibleDefaut: true,
        tauxFraisChantier: true,
        tauxFraisGeneraux: true,
        tauxTva: true,
      },
    }),
    prisma.priceItem.findMany({
      where: { organizationId: utilisateur.organizationId, actif: true, code: { not: null } },
      select: { code: true, prixReference: true, coutReference: true },
    }),
  ])

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <Link
          href="/dashboard/projets"
          className="inline-flex items-center gap-1.5 text-xs text-ardoise-500 hover:text-ardoise-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Retour aux projets
        </Link>
        <h1 className="mt-2 text-lg font-semibold text-ardoise-900">Assistant de creation</h1>
        <p className="text-sm text-ardoise-500">
          Neuf etapes, puis l&apos;application genere l&apos;espace projet complet : lots, chiffrage,
          budget, consultations et planning.
        </p>
      </div>

      <AssistantCreation
        contacts={contacts.map((c) => ({
          id: c.id,
          libelle: c.societe || `${c.prenom ?? ""} ${c.nom}`.trim(),
          ville: c.ville,
        }))}
        defauts={{
          margeCible: nb(organisation.margeCibleDefaut, 18),
          tauxFraisChantier: nb(organisation.tauxFraisChantier, 4),
          tauxFraisGeneraux: nb(organisation.tauxFraisGeneraux, 8),
          tauxTva: nb(organisation.tauxTva, 20),
        }}
        prix={prix
          .filter((p) => p.code)
          .map((p) => ({
            code: p.code as string,
            prix: nb(p.prixReference),
            cout: nb(p.coutReference),
          }))}
      />
    </div>
  )
}

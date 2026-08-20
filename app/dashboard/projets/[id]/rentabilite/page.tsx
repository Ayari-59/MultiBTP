import { prisma } from "@/lib/prisma"
import { requireAccess } from "@/lib/session"
import { syntheseProjet } from "@/lib/queries/projets"
import { nb } from "@/lib/utils"
import { Simulateur, type AnalyseEnregistree } from "./simulateur"

export default async function PageRentabilite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const utilisateur = await requireAccess("rentabilite", "read")

  const [analyses, synthese] = await Promise.all([
    prisma.realEstateAnalysis.findMany({
      where: { projectId: id, project: { organizationId: utilisateur.organizationId } },
      orderBy: { createdAt: "asc" },
    }),
    syntheseProjet(id, utilisateur.organizationId),
  ])

  const scenarios: AnalyseEnregistree[] = analyses.map((a) => ({
    id: a.id,
    nom: a.nom,
    commentaire: a.commentaire,
    prixAcquisition: nb(a.prixAcquisition),
    fraisAcquisition: nb(a.fraisAcquisition),
    montantTravaux: nb(a.montantTravaux),
    fraisDivers: nb(a.fraisDivers),
    apport: nb(a.apport),
    montantEmprunt: nb(a.montantEmprunt),
    tauxCredit: nb(a.tauxCredit, 3.5),
    dureeCreditAnnees: a.dureeCreditAnnees,
    valeurApresTravaux: nb(a.valeurApresTravaux),
    fraisRevente: nb(a.fraisRevente),
    loyerMensuel: nb(a.loyerMensuel),
    chargesAnnuelles: nb(a.chargesAnnuelles),
    tauxImposition: nb(a.tauxImposition, 30),
  }))

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-ardoise-900">Conseil immobilier</h2>
        <p className="text-xs text-ardoise-500">
          Analyse economique de l&apos;operation : cout global, marge de revente, rendement locatif,
          cash-flow et arbitrage entre les deux sorties.
        </p>
      </div>

      <Simulateur
        projectId={id}
        travauxChiffres={synthese?.budget.prixVenteActualise ?? 0}
        analyses={scenarios}
      />
    </div>
  )
}

import type { Metadata } from "next"
import { FileSpreadsheet, FileText } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requireAccess } from "@/lib/session"
import { Carte, CorpsCarte, EnteteCarte } from "@/components/ui/primitives"
import { SelecteurRapport } from "./selecteur"

export const metadata: Metadata = { title: "Rapports" }

const RAPPORTS_GLOBAUX = [
  {
    type: "financier",
    titre: "Rapport financier",
    description:
      "Chiffre d'affaires previsionnel, budgets, engagements, atterrissage et marge de l'ensemble du portefeuille.",
  },
  {
    type: "sous-traitants",
    titre: "Rapport sous-traitants",
    description:
      "Panel d'entreprises, notation, volume confie, litiges et conformite administrative.",
  },
]

const RAPPORTS_PROJET = [
  {
    type: "devis",
    titre: "Devis client",
    description: "Chiffrage retenu mis en forme, lot par lot, avec totaux HT, TVA et TTC.",
  },
  {
    type: "marge",
    titre: "Rapport de marge",
    description:
      "Chaine budgetaire complete, ecarts par lot et impact des avenants sur la marge.",
  },
  {
    type: "chantier",
    titre: "Rapport de chantier",
    description:
      "Avancement des taches, incidents ouverts, reserves et derniers comptes rendus.",
  },
  {
    type: "reception",
    titre: "Proces-verbal de reception",
    description: "PV avec liste des entreprises, montants des marches et reserves emises.",
  },
]

const EXPORTS = [
  { type: "projets", titre: "Portefeuille de projets", projet: false },
  { type: "chiffrage", titre: "Chiffrage detaille", projet: true },
  { type: "budget", titre: "Controle budgetaire par lot", projet: true },
  { type: "factures", titre: "Factures et situations", projet: false },
]

export default async function PageRapports() {
  const utilisateur = await requireAccess("rapports", "read")

  const projets = await prisma.project.findMany({
    where: { organizationId: utilisateur.organizationId },
    select: { id: true, nom: true, reference: true },
    orderBy: { updatedAt: "desc" },
  })

  const listeProjets = projets.map((p) => ({ id: p.id, libelle: `${p.reference} — ${p.nom}` }))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-ardoise-900">Rapports et exports</h1>
        <p className="text-sm text-ardoise-500">
          Documents PDF prets a diffuser et exports tabulaires exploitables dans un tableur.
        </p>
      </div>

      <Carte>
        <EnteteCarte
          titre="Rapports globaux"
          description="Portent sur l'ensemble des operations de la societe"
        />
        <CorpsCarte className="grid gap-3 sm:grid-cols-2">
          {RAPPORTS_GLOBAUX.map((r) => (
            <a
              key={r.type}
              href={`/api/rapports?type=${r.type}&format=pdf`}
              target="_blank"
              rel="noreferrer"
              className="flex gap-3 rounded-md border border-ardoise-200 px-3 py-3 transition-colors hover:border-ardoise-300 hover:bg-ardoise-50"
            >
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-chantier-500" />
              <span>
                <span className="block text-sm font-medium text-ardoise-900">{r.titre}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-ardoise-500">
                  {r.description}
                </span>
              </span>
            </a>
          ))}
        </CorpsCarte>
      </Carte>

      <Carte>
        <EnteteCarte
          titre="Rapports par projet"
          description="Selectionnez un projet, puis ouvrez le document souhaite"
        />
        <CorpsCarte>
          <SelecteurRapport projets={listeProjets} rapports={RAPPORTS_PROJET} exports={EXPORTS} />
        </CorpsCarte>
      </Carte>

      <Carte>
        <EnteteCarte
          titre="Exports tabulaires"
          description="Fichiers CSV separes par point-virgule, ouverts directement par Excel"
        />
        <CorpsCarte className="grid gap-2 sm:grid-cols-2">
          {EXPORTS.filter((e) => !e.projet).map((e) => (
            <a
              key={e.type}
              href={`/api/rapports?type=${e.type}&format=csv`}
              className="flex items-center gap-2.5 rounded-md border border-ardoise-200 px-3 py-2.5 text-sm text-ardoise-800 transition-colors hover:bg-ardoise-50"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              {e.titre}
            </a>
          ))}
        </CorpsCarte>
      </Carte>
    </div>
  )
}

import type { Metadata } from "next"
import Link from "next/link"
import { requireAccess } from "@/lib/session"
import { listeConsultations } from "@/lib/queries/consultations"
import { Kpi, StatutBadge } from "@/components/app/indicateurs"
import {
  Carte,
  EnteteCarte,
  EnteteTableau,
  Tableau,
  Td,
  Th,
  Tr,
  Vide,
} from "@/components/ui/primitives"
import { dateCourte, euros } from "@/lib/utils"

export const metadata: Metadata = { title: "Consultations" }

export default async function PageConsultations({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string }>
}) {
  const utilisateur = await requireAccess("consultations", "read")
  const { statut } = await searchParams

  const consultations = await listeConsultations(utilisateur.organizationId, { statut })

  const enCours = consultations.filter((c) => c.statut === "ENVOYEE" || c.statut === "EN_ANALYSE")
  const sansReponse = enCours.filter((c) => c.nbOffres === 0)
  const enRetard = consultations.filter((c) => c.enRetard)
  const economie = consultations
    .filter((c) => c.budgetEstime !== null && c.meilleureOffre !== null)
    .reduce((s, c) => s + (c.budgetEstime! - c.meilleureOffre!), 0)

  const STATUTS = ["BROUILLON", "ENVOYEE", "EN_ANALYSE", "ATTRIBUEE", "INFRUCTUEUSE"]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-ardoise-900">Consultations</h1>
        <p className="text-sm text-ardoise-500">
          {consultations.length} consultation(s) tous projets confondus
        </p>
      </div>

      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        <Kpi compact libelle="En cours" valeur={enCours.length} />
        <Kpi
          compact
          libelle="Sans reponse"
          valeur={sansReponse.length}
          ton={sansReponse.length > 0 ? "attention" : "positif"}
        />
        <Kpi
          compact
          libelle="Hors delai"
          valeur={enRetard.length}
          precision="Date limite depassee"
          ton={enRetard.length > 0 ? "negatif" : "positif"}
        />
        <Kpi
          compact
          libelle="Economie sur budget"
          valeur={euros(economie)}
          precision="Meilleures offres vs budgets estimes"
          ton={economie >= 0 ? "positif" : "negatif"}
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Filtre actif={!statut} libelle="Toutes" href="?" />
        {STATUTS.map((s) => (
          <Filtre
            key={s}
            actif={statut === s}
            libelle={s.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase())}
            href={`?statut=${s}`}
          />
        ))}
      </div>

      <Carte>
        <EnteteCarte titre="Toutes les consultations" />
        {consultations.length === 0 ? (
          <Vide
            titre="Aucune consultation"
            description="Les consultations se creent depuis la fiche projet, onglet Consultations."
          />
        ) : (
          <Tableau>
            <EnteteTableau>
              <tr>
                <Th>Reference</Th>
                <Th>Projet</Th>
                <Th>Lot</Th>
                <Th>Statut</Th>
                <Th numerique>Budget</Th>
                <Th numerique>Consultees</Th>
                <Th numerique>Offres</Th>
                <Th numerique>Meilleure</Th>
                <Th numerique>Ecart</Th>
                <Th numerique>Reponse avant</Th>
              </tr>
            </EnteteTableau>
            <tbody>
              {consultations.map((c) => {
                const ecart =
                  c.budgetEstime !== null && c.meilleureOffre !== null
                    ? c.budgetEstime - c.meilleureOffre
                    : null
                return (
                  <Tr key={c.id}>
                    <Td>
                      <Link
                        href={`/dashboard/projets/${c.projetId}/consultations/${c.id}`}
                        className="text-xs font-medium tabulaire text-ardoise-700 hover:underline"
                      >
                        {c.reference}
                      </Link>
                    </Td>
                    <Td>
                      <Link
                        href={`/dashboard/projets/${c.projetId}`}
                        className="block max-w-40 truncate text-sm hover:underline"
                      >
                        {c.projetNom}
                      </Link>
                    </Td>
                    <Td className="max-w-40 truncate text-xs text-ardoise-600">
                      {c.lotCode} — {c.lotNom}
                    </Td>
                    <Td>
                      <span className="flex items-center gap-1.5">
                        <StatutBadge statut={c.statut} />
                        {c.enRetard && (
                          <span className="text-[10px] font-medium text-red-600">hors delai</span>
                        )}
                      </span>
                    </Td>
                    <Td numerique className="text-xs text-ardoise-600">
                      {c.budgetEstime !== null ? euros(c.budgetEstime) : "—"}
                    </Td>
                    <Td numerique className="text-xs text-ardoise-500">{c.nbInvites}</Td>
                    <Td numerique className="text-xs font-medium">{c.nbOffres}</Td>
                    <Td numerique className="text-sm">
                      {c.meilleureOffre !== null ? euros(c.meilleureOffre) : "—"}
                    </Td>
                    <Td numerique>
                      {ecart !== null ? (
                        <span
                          className={
                            ecart >= 0
                              ? "text-xs tabulaire text-emerald-600"
                              : "text-xs tabulaire text-red-600"
                          }
                        >
                          {ecart > 0 ? "+" : ""}
                          {euros(ecart)}
                        </span>
                      ) : (
                        <span className="text-xs text-ardoise-400">—</span>
                      )}
                    </Td>
                    <Td numerique className="text-xs text-ardoise-500">
                      {dateCourte(c.dateLimiteReponse)}
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
          </Tableau>
        )}
      </Carte>
    </div>
  )
}

function Filtre({ actif, libelle, href }: { actif: boolean; libelle: string; href: string }) {
  return (
    <Link
      href={href}
      className={
        actif
          ? "rounded-md bg-ardoise-800 px-2.5 py-1 text-xs font-medium text-white"
          : "rounded-md border border-ardoise-200 px-2.5 py-1 text-xs text-ardoise-600 hover:bg-ardoise-50"
      }
    >
      {libelle}
    </Link>
  )
}

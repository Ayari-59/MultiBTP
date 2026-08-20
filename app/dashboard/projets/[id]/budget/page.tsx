import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { requireAccess } from "@/lib/session"
import { syntheseProjet } from "@/lib/queries/projets"
import { calculerLignesBudget } from "@/lib/metier/budget"
import { can } from "@/lib/permissions"
import { Kpi, Montant, BarreAvancement } from "@/components/app/indicateurs"
import { GraphiqueLots } from "@/components/app/graphiques"
import {
  Carte,
  CorpsCarte,
  EnteteCarte,
  EnteteTableau,
  Jauge,
  Tableau,
  Td,
  Th,
  Tr,
  Vide,
} from "@/components/ui/primitives"
import { AnalyseMarge, BoutonSupprimerMouvement, DialogueMouvement } from "./formulaires"
import { dateCourte, euros, eurosCompact, libelleEnum, nb, pourcent } from "@/lib/utils"

export default async function PageBudget({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const utilisateur = await requireAccess("budget", "read")

  const synthese = await syntheseProjet(id, utilisateur.organizationId)
  if (!synthese) notFound()

  const [projet, lots, engagements, depenses] = await Promise.all([
    prisma.project.findFirstOrThrow({
      where: { id, organizationId: utilisateur.organizationId },
      select: { margeCible: true, nom: true },
    }),
    prisma.lot.findMany({
      where: { projectId: id },
      select: { id: true, code: true, nom: true },
      orderBy: { ordre: "asc" },
    }),
    prisma.commitment.findMany({
      where: { projectId: id },
      include: { lot: { select: { code: true } } },
      orderBy: { date: "desc" },
      take: 60,
    }),
    prisma.expense.findMany({
      where: { projectId: id },
      include: { lot: { select: { code: true } } },
      orderBy: { date: "desc" },
      take: 60,
    }),
  ])

  const { budget } = synthese
  const lignes = calculerLignesBudget(synthese.lignes)
  const margeCible = nb(projet.margeCible)
  const modifiable = can(utilisateur.role, "budget", "create")

  return (
    <div className="space-y-4">
      {/* ─── Chaine de controle ─────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi compact libelle="Budget initial" valeur={eurosCompact(budget.budgetInitial)} />
        <Kpi
          compact
          libelle="Budget actualise"
          valeur={eurosCompact(budget.budgetActualise)}
          precision={budget.avenantsCout !== 0 ? `${euros(budget.avenantsCout)} d'avenants` : "Sans avenant"}
        />
        <Kpi
          compact
          libelle="Engage"
          valeur={eurosCompact(budget.engage)}
          precision={`${pourcent(budget.tauxEngagement, 0)} du budget`}
        />
        <Kpi
          compact
          libelle="Realise"
          valeur={eurosCompact(budget.realise)}
          precision={`${pourcent(budget.avancementFinancier, 0)} de l'atterrissage`}
        />
        <Kpi
          compact
          libelle="Prevision finale"
          valeur={eurosCompact(budget.atterrissage)}
          precision={budget.enDerive ? "Derive constatee" : "Dans le budget"}
          ton={budget.enDerive ? "negatif" : "positif"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Carte className="lg:col-span-2">
          <EnteteCarte
            titre="Budget → engage → realise → atterrissage"
            action={
              modifiable ? (
                <div className="flex gap-2">
                  <DialogueMouvement projectId={id} lots={lots} type="ENGAGEMENT" />
                  <DialogueMouvement projectId={id} lots={lots} type="DEPENSE" />
                </div>
              ) : undefined
            }
          />
          <CorpsCarte className="space-y-3">
            <BarreAvancement
              libelle="Budget actualise"
              valeur={budget.budgetActualise}
              total={budget.budgetActualise}
            />
            <BarreAvancement
              libelle="Engage"
              valeur={budget.engage}
              total={budget.budgetActualise}
              ton="chantier"
            />
            <BarreAvancement
              libelle="Realise"
              valeur={budget.realise}
              total={budget.budgetActualise}
              ton="succes"
            />
            <BarreAvancement
              libelle="Reste a engager"
              valeur={budget.resteAEngager}
              total={budget.budgetActualise}
              ton="ardoise"
            />
          </CorpsCarte>
        </Carte>

        <Carte>
          <EnteteCarte titre="Marge" />
          <CorpsCarte className="space-y-3">
            <div>
              <p className="text-[11px] text-ardoise-500">Prix de vente actualise</p>
              <p className="text-lg font-semibold tabulaire text-ardoise-900">
                {euros(budget.prixVenteActualise)}
              </p>
              {budget.avenantsVente !== 0 && (
                <p className="text-[11px] text-ardoise-500">
                  dont {euros(budget.avenantsVente)} d&apos;avenants refactures
                </p>
              )}
            </div>

            <div className="border-t border-ardoise-100 pt-3">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-ardoise-600">Marge previsionnelle</span>
                <span
                  className={
                    budget.tauxMargePrevisionnelle < margeCible - 3
                      ? "text-lg font-semibold tabulaire text-red-600"
                      : "text-lg font-semibold tabulaire text-emerald-600"
                  }
                >
                  {pourcent(budget.tauxMargePrevisionnelle)}
                </span>
              </div>
              <p className="text-xs tabulaire text-ardoise-500">
                {euros(budget.margePrevisionnelle)} · cible {pourcent(margeCible)}
              </p>
              <Jauge
                valeur={margeCible > 0 ? (budget.tauxMargePrevisionnelle / margeCible) * 100 : 0}
                ton={budget.tauxMargePrevisionnelle < margeCible - 3 ? "danger" : "succes"}
                className="mt-2"
              />
            </div>

            <div className="space-y-1.5 border-t border-ardoise-100 pt-3 text-xs">
              <Ligne libelle="Marge a l'origine" valeur={pourcent(budget.tauxMargeInitiale)} />
              <Ligne
                libelle="Variation"
                valeur={`${budget.tauxMargePrevisionnelle - budget.tauxMargeInitiale > 0 ? "+" : ""}${(budget.tauxMargePrevisionnelle - budget.tauxMargeInitiale).toFixed(1)} pt`}
              />
              <Ligne libelle="Ecart budgetaire" valeur={euros(budget.ecart)} />
            </div>

            <div className="border-t border-ardoise-100 pt-3">
              <AnalyseMarge projectId={id} />
            </div>
          </CorpsCarte>
        </Carte>
      </div>

      {/* ─── Ecarts par lot ─────────────────────────────────────────────── */}
      <Carte>
        <EnteteCarte
          titre="Controle budgetaire par lot"
          description="Budget = cout direct du lot au chiffrage retenu. Trie par ecart croissant."
        />
        {lignes.length === 0 ? (
          <Vide titre="Aucun lot" description="Le chiffrage n'a pas encore ete construit." />
        ) : (
          <Tableau>
            <EnteteTableau>
              <tr>
                <Th>Lot</Th>
                <Th numerique>Budget</Th>
                <Th numerique>Engage</Th>
                <Th numerique>Realise</Th>
                <Th numerique>Reste a engager</Th>
                <Th numerique>Atterrissage</Th>
                <Th numerique>Ecart</Th>
                <Th>Consommation</Th>
              </tr>
            </EnteteTableau>
            <tbody>
              {lignes.map((l) => (
                <Tr key={l.lotId ?? l.code}>
                  <Td>
                    <span className="block text-sm text-ardoise-900">
                      {l.code} — {l.nom}
                    </span>
                  </Td>
                  <Td numerique className="text-sm text-ardoise-600">{euros(l.budget)}</Td>
                  <Td numerique className="text-sm">{euros(l.engage)}</Td>
                  <Td numerique className="text-sm text-ardoise-600">{euros(l.realise)}</Td>
                  <Td numerique className="text-xs text-ardoise-500">{euros(l.resteAEngager)}</Td>
                  <Td numerique className="text-sm">
                    <span className={l.enDepassement ? "font-medium text-red-600" : ""}>
                      {euros(l.atterrissage)}
                    </span>
                  </Td>
                  <Td numerique>
                    <Montant valeur={l.ecart} signe className="text-sm font-medium" />
                  </Td>
                  <Td>
                    <div className="w-24">
                      <Jauge
                        valeur={l.tauxConsommation}
                        ton={l.tauxConsommation > 100 ? "danger" : l.tauxConsommation > 90 ? "alerte" : "ardoise"}
                      />
                      <span className="mt-1 block text-[10px] tabulaire text-ardoise-500">
                        {pourcent(l.tauxConsommation, 0)}
                      </span>
                    </div>
                  </Td>
                </Tr>
              ))}
              <tr className="border-t-2 border-ardoise-200 bg-ardoise-50/60">
                <Td className="text-xs font-medium text-ardoise-700">
                  Total des lots (cout direct)
                </Td>
                <Td numerique className="text-sm font-semibold">
                  {euros(lignes.reduce((s, l) => s + l.budget, 0))}
                </Td>
                <Td numerique className="text-sm font-semibold">
                  {euros(lignes.reduce((s, l) => s + l.engage, 0))}
                </Td>
                <Td numerique className="text-sm font-semibold">
                  {euros(lignes.reduce((s, l) => s + l.realise, 0))}
                </Td>
                <Td colSpan={4} />
              </tr>
              <tr className="bg-ardoise-50/60">
                <Td className="text-xs text-ardoise-500">
                  Frais de chantier et frais generaux (non affectes aux lots)
                </Td>
                <Td numerique className="text-xs text-ardoise-600">
                  {euros(budget.budgetActualise - lignes.reduce((s, l) => s + l.budget, 0))}
                </Td>
                <Td colSpan={6} />
              </tr>
            </tbody>
          </Tableau>
        )}
        <CorpsCarte>
          <GraphiqueLots
            donnees={lignes.map((l) => ({
              code: l.code,
              budget: l.budget,
              engage: l.engage,
              realise: l.realise,
            }))}
          />
        </CorpsCarte>
      </Carte>

      {/* ─── Mouvements ─────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Carte>
          <EnteteCarte
            titre="Engagements"
            description={`${engagements.length} ligne(s) — marches signes et commandes fermes`}
          />
          {engagements.length === 0 ? (
            <Vide titre="Aucun engagement" />
          ) : (
            <Tableau>
              <EnteteTableau>
                <tr>
                  <Th>Libelle</Th>
                  <Th>Lot</Th>
                  <Th>Nature</Th>
                  <Th numerique>Montant</Th>
                  <Th numerique>Date</Th>
                  {modifiable && <Th />}
                </tr>
              </EnteteTableau>
              <tbody>
                {engagements.map((e) => (
                  <Tr key={e.id}>
                    <Td className="max-w-56 truncate text-xs">{e.libelle}</Td>
                    <Td className="text-xs text-ardoise-500">{e.lot?.code ?? "—"}</Td>
                    <Td className="text-xs text-ardoise-500">{libelleEnum(e.nature)}</Td>
                    <Td numerique className="text-sm">{euros(nb(e.montantHT))}</Td>
                    <Td numerique className="text-xs text-ardoise-500">{dateCourte(e.date)}</Td>
                    {modifiable && (
                      <Td>
                        <div className="flex justify-end">
                          <BoutonSupprimerMouvement type="ENGAGEMENT" id={e.id} />
                        </div>
                      </Td>
                    )}
                  </Tr>
                ))}
              </tbody>
            </Tableau>
          )}
        </Carte>

        <Carte>
          <EnteteCarte
            titre="Depenses realisees"
            description={`${depenses.length} ligne(s) — factures validees et depenses directes`}
          />
          {depenses.length === 0 ? (
            <Vide titre="Aucune depense" />
          ) : (
            <Tableau>
              <EnteteTableau>
                <tr>
                  <Th>Libelle</Th>
                  <Th>Lot</Th>
                  <Th>Fournisseur</Th>
                  <Th numerique>Montant</Th>
                  <Th numerique>Date</Th>
                  {modifiable && <Th />}
                </tr>
              </EnteteTableau>
              <tbody>
                {depenses.map((e) => (
                  <Tr key={e.id}>
                    <Td className="max-w-48 truncate text-xs">{e.libelle}</Td>
                    <Td className="text-xs text-ardoise-500">{e.lot?.code ?? "—"}</Td>
                    <Td className="max-w-32 truncate text-xs text-ardoise-500">
                      {e.fournisseur ?? "—"}
                    </Td>
                    <Td numerique className="text-sm">{euros(nb(e.montantHT))}</Td>
                    <Td numerique className="text-xs text-ardoise-500">{dateCourte(e.date)}</Td>
                    {modifiable && (
                      <Td>
                        <div className="flex justify-end">
                          <BoutonSupprimerMouvement type="DEPENSE" id={e.id} />
                        </div>
                      </Td>
                    )}
                  </Tr>
                ))}
              </tbody>
            </Tableau>
          )}
        </Carte>
      </div>
    </div>
  )
}

function Ligne({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-ardoise-500">{libelle}</span>
      <span className="tabulaire font-medium text-ardoise-800">{valeur}</span>
    </div>
  )
}

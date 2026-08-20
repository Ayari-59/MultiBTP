import Link from "next/link"
import { notFound } from "next/navigation"
import { Pencil, Sparkles } from "lucide-react"
import { requireAccess } from "@/lib/session"
import { chiffrageProjet, suggestionsPrix } from "@/lib/queries/chiffrage"
import { LIBELLES_CATEGORIE, LIBELLES_UNITE } from "@/lib/metier/referentiel"
import { LIBELLES_SCENARIO } from "@/lib/metier/chiffrage"
import { can } from "@/lib/permissions"
import { Badge, Bouton, Carte, CorpsCarte, EnteteCarte, Vide } from "@/components/ui/primitives"
import { GraphiqueVentilation } from "@/components/app/graphiques"
import { StatutBadge } from "@/components/app/indicateurs"
import {
  ActionsChiffrage,
  AjustementLot,
  BoutonModifierPoste,
  BoutonScenario,
  BoutonSuppression,
  DialogueLot,
  DialoguePoste,
} from "./formulaires"
import { euros, nombre, pourcent } from "@/lib/utils"

export default async function PageChiffrage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ v?: string }>
}) {
  const { id } = await params
  const { v } = await searchParams
  const utilisateur = await requireAccess("chiffrage", "read")

  const [chiffrage, suggestions] = await Promise.all([
    chiffrageProjet(id, utilisateur.organizationId, v),
    suggestionsPrix(utilisateur.organizationId),
  ])

  const modifiable = can(utilisateur.role, "chiffrage", "update")

  if (!chiffrage) {
    return (
      <Carte>
        <Vide
          titre="Aucun chiffrage sur ce projet"
          description="Creez un premier lot pour commencer a chiffrer, ou relancez l'assistant de creation pour generer une trame complete."
          action={
            modifiable ? <DialogueLot projectId={id} /> : undefined
          }
        />
      </Carte>
    )
  }

  const { resultat, params: economie } = chiffrage
  const sousLaCible = resultat.margeTaux < economie.margeCible - 0.5

  return (
    <div className="space-y-4">
      {/* ─── Scenarios ──────────────────────────────────────────────────── */}
      <Carte>
        <EnteteCarte
          titre="Scenarios de chiffrage"
          description="Un seul scenario est retenu : il alimente le budget, le prix de vente et les consultations."
          action={
            modifiable ? (
              <div className="flex flex-wrap gap-2">
                <BoutonScenario estimateId={chiffrage.estimateId} scenario="ECONOMIQUE" />
                <BoutonScenario estimateId={chiffrage.estimateId} scenario="PREMIUM" />
              </div>
            ) : undefined
          }
        />
        <CorpsCarte className="flex flex-wrap gap-2">
          {chiffrage.scenarios.map((s) => (
            <Link
              key={s.id}
              href={`/dashboard/projets/${id}/chiffrage?v=${s.id}`}
              className={
                s.id === chiffrage.estimateId
                  ? "rounded-md border border-ardoise-800 bg-ardoise-800 px-3 py-2 text-white"
                  : "rounded-md border border-ardoise-200 px-3 py-2 hover:bg-ardoise-50"
              }
            >
              <span className="flex items-center gap-2">
                <span className="text-sm font-medium">{s.nom}</span>
                {s.retenu && <Badge ton="succes">retenu</Badge>}
              </span>
              <span
                className={
                  s.id === chiffrage.estimateId
                    ? "mt-0.5 block text-xs tabulaire text-ardoise-300"
                    : "mt-0.5 block text-xs tabulaire text-ardoise-500"
                }
              >
                {LIBELLES_SCENARIO[s.scenario] ?? s.scenario} · v{s.version} · {euros(s.montantHT)}
              </span>
            </Link>
          ))}
        </CorpsCarte>
      </Carte>

      {chiffrage.genereParIa && (
        <div className="flex items-start gap-3 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
          <div className="text-xs text-violet-900">
            <p className="font-medium">Chiffrage genere automatiquement.</p>
            <p className="mt-0.5">
              {chiffrage.commentaire ??
                "Les quantites proviennent de ratios au m² et les prix de la bibliotheque. Verifiez chaque poste avant diffusion."}
            </p>
          </div>
        </div>
      )}

      {/* ─── Synthese economique ────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Carte className="lg:col-span-2">
          <EnteteCarte
            titre="Du cout de revient au prix de vente"
            description={`Marge cible ${pourcent(economie.margeCible)} · frais de chantier ${pourcent(economie.tauxFraisChantier)} · frais generaux ${pourcent(economie.tauxFraisGeneraux)}`}
            action={modifiable ? <ActionsChiffrage estimateId={chiffrage.estimateId} retenu={chiffrage.retenu} /> : undefined}
          />
          <CorpsCarte>
            <div className="space-y-1.5">
              <LigneCalcul libelle="Materiaux" valeur={resultat.coutMateriaux} />
              <LigneCalcul libelle="Main-d'oeuvre" valeur={resultat.coutMainOeuvre} />
              <LigneCalcul libelle="Sous-traitance" valeur={resultat.coutSousTraitance} />
              <LigneCalcul libelle="Materiel" valeur={resultat.coutMateriel} />
              <LigneCalcul libelle="Transport" valeur={resultat.coutTransport} />
              <LigneCalcul libelle="Cout direct" valeur={resultat.coutDirect} total />
              <LigneCalcul
                libelle={`Frais de chantier (${pourcent(economie.tauxFraisChantier, 0)})`}
                valeur={resultat.fraisChantier}
              />
              <LigneCalcul
                libelle={`Frais generaux (${pourcent(economie.tauxFraisGeneraux, 0)})`}
                valeur={resultat.fraisGeneraux}
              />
              <LigneCalcul libelle="Cout de revient" valeur={resultat.coutRevient} total />
              <LigneCalcul
                libelle="Marge"
                valeur={resultat.margeEuros}
                precision={pourcent(resultat.margeTaux)}
                ton={sousLaCible ? "negatif" : "positif"}
              />
              <LigneCalcul libelle="Montant du chiffrage HT" valeur={resultat.montantHT} fort />
              <LigneCalcul libelle={`TVA (${pourcent(economie.tauxTva, 0)})`} valeur={resultat.tva} />
              <LigneCalcul libelle="Montant TTC" valeur={resultat.montantTTC} total />
            </div>

            <div
              className={
                sousLaCible
                  ? "mt-4 rounded-md border border-chantier-200 bg-chantier-50 px-3 py-2.5 text-xs text-chantier-900"
                  : "mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-900"
              }
            >
              <p className="font-medium">
                {sousLaCible
                  ? `Le chiffrage degage ${pourcent(resultat.margeTaux)} de marge, sous la cible de ${pourcent(economie.margeCible)}.`
                  : `Le chiffrage tient la marge cible : ${pourcent(resultat.margeTaux)} contre ${pourcent(economie.margeCible)} vises.`}
              </p>
              <p className="mt-0.5">
                Prix de vente atteignant exactement la cible :{" "}
                <strong className="tabulaire">{euros(resultat.prixVenteCible)}</strong>
                {resultat.ecartCible !== 0 && (
                  <>
                    {" "}
                    (ecart de{" "}
                    <strong className="tabulaire">
                      {resultat.ecartCible > 0 ? "+" : ""}
                      {euros(resultat.ecartCible)}
                    </strong>
                    ).
                  </>
                )}
              </p>
            </div>
          </CorpsCarte>
        </Carte>

        <Carte>
          <EnteteCarte titre="Ventilation du cout" />
          <CorpsCarte>
            <GraphiqueVentilation
              donnees={[
                { nature: "Materiaux", montant: resultat.coutMateriaux },
                { nature: "Main-d'oeuvre", montant: resultat.coutMainOeuvre },
                { nature: "Sous-traitance", montant: resultat.coutSousTraitance },
                { nature: "Materiel", montant: resultat.coutMateriel },
                { nature: "Transport", montant: resultat.coutTransport },
                { nature: "Frais de chantier", montant: resultat.fraisChantier },
                { nature: "Frais generaux", montant: resultat.fraisGeneraux },
              ]}
            />
            <div className="mt-3 space-y-1.5 border-t border-ardoise-100 pt-3">
              {resultat.lots.slice(0, 6).map((l) => (
                <div key={l.lotId} className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate text-ardoise-600">
                    {l.code} — {l.nom}
                  </span>
                  <span className="shrink-0 tabulaire text-ardoise-800">{pourcent(l.part, 1)}</span>
                </div>
              ))}
            </div>
          </CorpsCarte>
        </Carte>
      </div>

      {/* ─── Lots et postes ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ardoise-900">
          {chiffrage.lots.length} lots · {resultat.nbPostes} postes
        </h2>
        {modifiable && <DialogueLot projectId={id} />}
      </div>

      {chiffrage.lots.map((lot) => {
        const totaux = resultat.lots.find((l) => l.lotId === lot.id)
        return (
          <Carte key={lot.id}>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ardoise-200/70 px-4 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-ardoise-900">
                    {lot.code} — {lot.nom}
                  </h3>
                  <StatutBadge statut={lot.statut} />
                  <Badge ton={lot.sousTraite ? "info" : "neutre"}>
                    {lot.sousTraite ? "Sous-traite" : "Interne"}
                  </Badge>
                  <Badge>{LIBELLES_CATEGORIE[lot.categorie] ?? lot.categorie}</Badge>
                </div>
                {lot.descriptif && (
                  <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ardoise-500">
                    {lot.descriptif}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <div className="text-right">
                  <p className="text-sm font-semibold tabulaire text-ardoise-900">
                    {euros(totaux?.montantHT ?? 0)}
                  </p>
                  <p className="text-[11px] tabulaire text-ardoise-500">
                    cout {euros(totaux?.coutDirect ?? 0)} · marge{" "}
                    {pourcent(totaux?.tauxMarge ?? 0)}
                  </p>
                </div>
                {modifiable && (
                  <>
                    <AjustementLot estimateId={chiffrage.estimateId} lotId={lot.id} />
                    <DialoguePoste
                      estimateId={chiffrage.estimateId}
                      lotId={lot.id}
                      lotNom={`${lot.code} — ${lot.nom}`}
                      categorie={lot.categorie}
                      suggestions={suggestions}
                      margeCible={economie.margeCible}
                    />
                    <DialogueLot
                      projectId={id}
                      lot={lot}
                      declencheur={
                        <button
                          type="button"
                          className="rounded p-1 text-ardoise-400 hover:bg-ardoise-100 hover:text-ardoise-700"
                          title="Modifier le lot"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      }
                    />
                    <BoutonSuppression
                      cible="lot"
                      id={lot.id}
                      confirmation={`Supprimer le lot ${lot.code} et tous ses postes ?`}
                    />
                  </>
                )}
              </div>
            </div>

            {lot.postes.length === 0 ? (
              <Vide titre="Aucun poste dans ce lot" />
            ) : (
              <div className="defilement-fin overflow-x-auto">
                <table className="w-full text-sm tabulaire">
                  <thead className="border-b border-ardoise-200 bg-ardoise-50/60 text-[11px] uppercase tracking-wide text-ardoise-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Poste</th>
                      <th className="px-3 py-2 text-right font-medium">Unite</th>
                      <th className="px-3 py-2 text-right font-medium">Quantite</th>
                      <th className="px-3 py-2 text-right font-medium">PU HT</th>
                      <th className="px-3 py-2 text-right font-medium">Total HT</th>
                      <th className="px-3 py-2 text-right font-medium">Cout</th>
                      <th className="px-3 py-2 text-right font-medium">Marge</th>
                      {modifiable && <th className="w-16 px-3 py-2" />}
                    </tr>
                  </thead>
                  <tbody>
                    {lot.postes.map((poste) => {
                      const marge = poste.totalHT - poste.coutDirect
                      const taux = poste.totalHT > 0 ? (marge / poste.totalHT) * 100 : 0
                      return (
                        <tr
                          key={poste.id}
                          className="border-b border-ardoise-100 last:border-0 hover:bg-ardoise-50/50"
                        >
                          <td className="px-3 py-1.5">
                            <span className="block text-sm text-ardoise-900">{poste.designation}</span>
                            {poste.description && (
                              <span className="block truncate text-[11px] text-ardoise-400">
                                {poste.description}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-right text-xs text-ardoise-500">
                            {LIBELLES_UNITE[poste.unite] ?? poste.unite}
                          </td>
                          <td className="px-3 py-1.5 text-right text-xs text-ardoise-700">
                            {nombre(poste.quantite, poste.quantite % 1 === 0 ? 0 : 2)}
                          </td>
                          <td className="px-3 py-1.5 text-right text-xs text-ardoise-700">
                            {euros(poste.prixUnitaire, 2)}
                          </td>
                          <td className="px-3 py-1.5 text-right text-sm font-medium text-ardoise-900">
                            {euros(poste.totalHT)}
                          </td>
                          <td className="px-3 py-1.5 text-right text-xs text-ardoise-500">
                            {euros(poste.coutDirect)}
                          </td>
                          <td
                            className={
                              taux < economie.margeCible - 3
                                ? "px-3 py-1.5 text-right text-xs font-medium text-chantier-600"
                                : "px-3 py-1.5 text-right text-xs font-medium text-emerald-600"
                            }
                          >
                            {pourcent(taux, 1)}
                          </td>
                          {modifiable && (
                            <td className="px-3 py-1.5">
                              <div className="flex justify-end gap-0.5">
                                <BoutonModifierPoste
                                  estimateId={chiffrage.estimateId}
                                  lotId={lot.id}
                                  lotNom={`${lot.code} — ${lot.nom}`}
                                  categorie={lot.categorie}
                                  poste={poste}
                                  suggestions={suggestions}
                                  margeCible={economie.margeCible}
                                />
                                <BoutonSuppression
                                  cible="poste"
                                  id={poste.id}
                                  confirmation={`Supprimer « ${poste.designation} » ?`}
                                />
                              </div>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Carte>
        )
      })}

      {chiffrage.lots.length === 0 && (
        <Carte>
          <Vide
            titre="Aucun lot"
            description="Ajoutez un premier lot pour commencer le chiffrage."
            action={modifiable ? <DialogueLot projectId={id} /> : undefined}
          />
        </Carte>
      )}
    </div>
  )
}

function LigneCalcul({
  libelle,
  valeur,
  precision,
  total,
  fort,
  ton,
}: {
  libelle: string
  valeur: number
  precision?: string
  total?: boolean
  fort?: boolean
  ton?: "positif" | "negatif"
}) {
  return (
    <div
      className={
        total || fort
          ? "flex items-baseline justify-between gap-3 border-t border-ardoise-200 pt-1.5"
          : "flex items-baseline justify-between gap-3"
      }
    >
      <span
        className={
          fort
            ? "text-sm font-semibold text-ardoise-900"
            : total
              ? "text-xs font-medium text-ardoise-800"
              : "text-xs text-ardoise-500"
        }
      >
        {libelle}
      </span>
      <span className="flex items-baseline gap-2">
        {precision && (
          <span
            className={
              ton === "negatif"
                ? "text-xs font-medium tabulaire text-red-600"
                : "text-xs font-medium tabulaire text-emerald-600"
            }
          >
            {precision}
          </span>
        )}
        <span
          className={
            fort
              ? "text-base font-semibold tabulaire text-ardoise-900"
              : total
                ? "text-sm font-semibold tabulaire text-ardoise-900"
                : "text-sm tabulaire text-ardoise-700"
          }
        >
          {euros(valeur)}
        </span>
      </span>
    </div>
  )
}

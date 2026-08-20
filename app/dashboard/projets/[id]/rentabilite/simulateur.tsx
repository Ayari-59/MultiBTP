"use client"

import { useActionState, useEffect, useMemo, useState, useTransition } from "react"
import { useFormStatus } from "react-dom"
import { Trash2 } from "lucide-react"
import {
  Bouton,
  Carte,
  Champ,
  CorpsCarte,
  EnteteCarte,
  Etiquette,
  ZoneTexte,
} from "@/components/ui/primitives"
import { analyserOperation, type EntreesOperation } from "@/lib/metier/immobilier"
import {
  enregistrerAnalyse,
  supprimerAnalyse,
  type EtatRentabilite,
} from "@/lib/actions/rentabilite"
import { cn, euros, pourcent } from "@/lib/utils"

export type AnalyseEnregistree = EntreesOperation & {
  id: string
  nom: string
  commentaire: string | null
}

const CHAMPS_COUT = [
  ["prixAcquisition", "Prix d'acquisition"],
  ["fraisAcquisition", "Frais d'acquisition (notaire, agence)"],
  ["montantTravaux", "Montant des travaux"],
  ["fraisDivers", "Frais divers (etudes, assurances)"],
] as const

const CHAMPS_FINANCEMENT = [
  ["apport", "Apport personnel"],
  ["montantEmprunt", "Montant emprunte"],
] as const

const CHAMPS_SORTIE = [
  ["valeurApresTravaux", "Valeur apres travaux"],
  ["fraisRevente", "Frais de revente"],
  ["loyerMensuel", "Loyer mensuel attendu"],
  ["chargesAnnuelles", "Charges annuelles"],
] as const

function BoutonEnvoi({ libelle }: { libelle: string }) {
  const { pending } = useFormStatus()
  return (
    <Bouton type="submit" disabled={pending}>
      {pending ? "Enregistrement..." : libelle}
    </Bouton>
  )
}

export function Simulateur({
  projectId,
  travauxChiffres,
  analyses,
}: {
  projectId: string
  travauxChiffres: number
  analyses: AnalyseEnregistree[]
}) {
  const [etat, action] = useActionState<EtatRentabilite, FormData>(enregistrerAnalyse, {})
  const [analyseId, setAnalyseId] = useState<string>(analyses[0]?.id ?? "")

  const courante = analyses.find((a) => a.id === analyseId)

  const [valeurs, setValeurs] = useState<EntreesOperation>(() => ({
    prixAcquisition: courante?.prixAcquisition ?? 0,
    fraisAcquisition: courante?.fraisAcquisition ?? 0,
    montantTravaux: courante?.montantTravaux ?? travauxChiffres,
    fraisDivers: courante?.fraisDivers ?? 0,
    apport: courante?.apport ?? 0,
    montantEmprunt: courante?.montantEmprunt ?? 0,
    tauxCredit: courante?.tauxCredit ?? 3.5,
    dureeCreditAnnees: courante?.dureeCreditAnnees ?? 20,
    valeurApresTravaux: courante?.valeurApresTravaux ?? 0,
    fraisRevente: courante?.fraisRevente ?? 0,
    loyerMensuel: courante?.loyerMensuel ?? 0,
    chargesAnnuelles: courante?.chargesAnnuelles ?? 0,
    tauxImposition: courante?.tauxImposition ?? 30,
  }))
  const [nom, setNom] = useState(courante?.nom ?? "Scenario de base")

  useEffect(() => {
    if (!courante) return
    setNom(courante.nom)
    setValeurs({
      prixAcquisition: courante.prixAcquisition,
      fraisAcquisition: courante.fraisAcquisition,
      montantTravaux: courante.montantTravaux,
      fraisDivers: courante.fraisDivers,
      apport: courante.apport,
      montantEmprunt: courante.montantEmprunt,
      tauxCredit: courante.tauxCredit,
      dureeCreditAnnees: courante.dureeCreditAnnees,
      valeurApresTravaux: courante.valeurApresTravaux,
      fraisRevente: courante.fraisRevente,
      loyerMensuel: courante.loyerMensuel,
      chargesAnnuelles: courante.chargesAnnuelles,
      tauxImposition: courante.tauxImposition,
    })
  }, [courante])

  const resultat = useMemo(() => analyserOperation(valeurs), [valeurs])

  function maj(cle: keyof EntreesOperation, valeur: string) {
    setValeurs((v) => ({ ...v, [cle]: Number(valeur) || 0 }))
  }

  return (
    <div className="space-y-4">
      {analyses.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <BoutonScenario actif={analyseId === ""} onClick={() => setAnalyseId("")}>
            + Nouveau scenario
          </BoutonScenario>
          {analyses.map((a) => (
            <span key={a.id} className="flex items-center gap-1">
              <BoutonScenario actif={analyseId === a.id} onClick={() => setAnalyseId(a.id)}>
                {a.nom}
              </BoutonScenario>
              <BoutonSupprimer analyseId={a.id} />
            </span>
          ))}
        </div>
      )}

      <form action={action} className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <input type="hidden" name="projectId" value={projectId} />
        {analyseId && <input type="hidden" name="analyseId" value={analyseId} />}
        {Object.entries(valeurs).map(([cle, valeur]) => (
          <input key={cle} type="hidden" name={cle} value={valeur} />
        ))}

        <div className="space-y-4">
          <Carte>
            <EnteteCarte titre="Cout de l'operation" />
            <CorpsCarte className="grid gap-3 sm:grid-cols-2">
              {CHAMPS_COUT.map(([cle, libelle]) => (
                <div key={cle}>
                  <Etiquette>{libelle} (€)</Etiquette>
                  <Champ
                    type="number"
                    step="100"
                    value={valeurs[cle]}
                    onChange={(e) => maj(cle, e.target.value)}
                  />
                  {cle === "montantTravaux" && travauxChiffres > 0 && (
                    <button
                      type="button"
                      onClick={() => maj("montantTravaux", String(travauxChiffres))}
                      className="mt-1 text-[10px] text-ardoise-500 underline hover:text-ardoise-800"
                    >
                      Reprendre le chiffrage du projet ({euros(travauxChiffres)})
                    </button>
                  )}
                </div>
              ))}
            </CorpsCarte>
          </Carte>

          <Carte>
            <EnteteCarte titre="Financement" />
            <CorpsCarte className="grid gap-3 sm:grid-cols-2">
              {CHAMPS_FINANCEMENT.map(([cle, libelle]) => (
                <div key={cle}>
                  <Etiquette>{libelle} (€)</Etiquette>
                  <Champ
                    type="number"
                    step="1000"
                    value={valeurs[cle]}
                    onChange={(e) => maj(cle, e.target.value)}
                  />
                </div>
              ))}
              <div>
                <Etiquette>Taux du credit (%)</Etiquette>
                <Champ
                  type="number"
                  step="0.05"
                  value={valeurs.tauxCredit}
                  onChange={(e) => maj("tauxCredit", e.target.value)}
                />
              </div>
              <div>
                <Etiquette>Duree (annees)</Etiquette>
                <Champ
                  type="number"
                  step="1"
                  value={valeurs.dureeCreditAnnees}
                  onChange={(e) => maj("dureeCreditAnnees", e.target.value)}
                />
              </div>
            </CorpsCarte>
          </Carte>

          <Carte>
            <EnteteCarte titre="Sortie : revente ou location" />
            <CorpsCarte className="grid gap-3 sm:grid-cols-2">
              {CHAMPS_SORTIE.map(([cle, libelle]) => (
                <div key={cle}>
                  <Etiquette>{libelle} (€)</Etiquette>
                  <Champ
                    type="number"
                    step="100"
                    value={valeurs[cle]}
                    onChange={(e) => maj(cle, e.target.value)}
                  />
                </div>
              ))}
              <div>
                <Etiquette>Taux d&apos;imposition (%)</Etiquette>
                <Champ
                  type="number"
                  step="1"
                  value={valeurs.tauxImposition}
                  onChange={(e) => maj("tauxImposition", e.target.value)}
                />
              </div>
            </CorpsCarte>
          </Carte>

          <Carte>
            <EnteteCarte titre="Enregistrer le scenario" />
            <CorpsCarte className="space-y-3">
              <div>
                <Etiquette>Nom du scenario</Etiquette>
                <Champ name="nom" value={nom} onChange={(e) => setNom(e.target.value)} />
              </div>
              <div>
                <Etiquette>Commentaire</Etiquette>
                <ZoneTexte name="commentaire" rows={2} defaultValue={courante?.commentaire ?? ""} />
              </div>

              {etat.erreur && (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {etat.erreur}
                </p>
              )}

              <BoutonEnvoi libelle={analyseId ? "Mettre a jour" : "Enregistrer le scenario"} />
            </CorpsCarte>
          </Carte>
        </div>

        {/* ─── Resultats ────────────────────────────────────────────────── */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:h-fit">
          <Carte>
            <EnteteCarte titre="Cout global" />
            <CorpsCarte className="space-y-1.5">
              <Ligne libelle="Acquisition et travaux" valeur={euros(resultat.coutTravauxEtAcquisition)} />
              <Ligne libelle="Frais financiers de portage" valeur={euros(resultat.fraisFinanciers)} />
              <Ligne libelle="Cout global" valeur={euros(resultat.coutGlobal)} fort />
              <Ligne libelle="Mensualite du credit" valeur={euros(resultat.mensualite)} />
              <Ligne libelle="Cout total du credit" valeur={euros(resultat.coutTotalCredit)} />
            </CorpsCarte>
          </Carte>

          <Carte
            className={
              resultat.scenarioRecommande === "REVENTE" ? "border-emerald-300" : undefined
            }
          >
            <EnteteCarte titre="Scenario revente" />
            <CorpsCarte className="space-y-1.5">
              <Ligne libelle="Valeur apres travaux" valeur={euros(valeurs.valeurApresTravaux)} />
              <Ligne
                libelle="Marge de revente"
                valeur={euros(resultat.margeRevente)}
                ton={resultat.margeRevente >= 0 ? "positif" : "negatif"}
                fort
              />
              <Ligne libelle="Taux de marge" valeur={pourcent(resultat.tauxMargeRevente)} />
              <Ligne libelle="Plus-value nette d'impot" valeur={euros(resultat.plusValueNette)} />
              <Ligne libelle="ROI sur apport" valeur={pourcent(resultat.roiRevente)} />
            </CorpsCarte>
          </Carte>

          <Carte
            className={
              resultat.scenarioRecommande === "LOCATION" ? "border-emerald-300" : undefined
            }
          >
            <EnteteCarte titre="Scenario location" />
            <CorpsCarte className="space-y-1.5">
              <Ligne libelle="Loyer annuel" valeur={euros(resultat.loyerAnnuel)} />
              <Ligne libelle="Rendement brut" valeur={pourcent(resultat.rendementBrut)} />
              <Ligne libelle="Rendement net" valeur={pourcent(resultat.rendementNet)} fort />
              <Ligne
                libelle="Cash-flow annuel"
                valeur={euros(resultat.cashFlowAnnuel)}
                ton={resultat.cashFlowAnnuel >= 0 ? "positif" : "negatif"}
              />
              <Ligne libelle="Cash-flow mensuel" valeur={euros(resultat.cashFlowMensuel)} />
              <Ligne libelle="Impot estime" valeur={euros(resultat.resultatFiscal)} />
              <Ligne
                libelle="Cash-flow net d'impot"
                valeur={euros(resultat.cashFlowNetImpot)}
                ton={resultat.cashFlowNetImpot >= 0 ? "positif" : "negatif"}
              />
              {resultat.retourSurApportAnnees !== null && (
                <Ligne
                  libelle="Retour sur apport"
                  valeur={`${resultat.retourSurApportAnnees} ans`}
                />
              )}
            </CorpsCarte>
          </Carte>

          <Carte
            className={
              resultat.scenarioRecommande === "AUCUN"
                ? "border-chantier-200 bg-chantier-50/60"
                : "border-emerald-200 bg-emerald-50/60"
            }
          >
            <CorpsCarte>
              <p className="text-[11px] font-medium uppercase tracking-wide text-ardoise-500">
                Arbitrage
              </p>
              <p className="mt-1 text-sm font-medium text-ardoise-900">
                {resultat.scenarioRecommande === "REVENTE"
                  ? "Revente apres travaux"
                  : resultat.scenarioRecommande === "LOCATION"
                    ? "Conservation et mise en location"
                    : "Operation a revoir"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ardoise-600">
                {resultat.commentaire}
              </p>
            </CorpsCarte>
          </Carte>
        </div>
      </form>
    </div>
  )
}

function Ligne({
  libelle,
  valeur,
  fort,
  ton,
}: {
  libelle: string
  valeur: string
  fort?: boolean
  ton?: "positif" | "negatif"
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-2",
        fort && "border-t border-ardoise-100 pt-1.5"
      )}
    >
      <span className={fort ? "text-xs font-medium text-ardoise-800" : "text-xs text-ardoise-500"}>
        {libelle}
      </span>
      <span
        className={cn(
          "tabulaire",
          fort ? "text-sm font-semibold" : "text-xs font-medium",
          ton === "positif"
            ? "text-emerald-600"
            : ton === "negatif"
              ? "text-red-600"
              : "text-ardoise-900"
        )}
      >
        {valeur}
      </span>
    </div>
  )
}

function BoutonScenario({
  actif,
  onClick,
  children,
}: {
  actif: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
        actif
          ? "bg-ardoise-800 text-white"
          : "border border-ardoise-200 text-ardoise-600 hover:bg-ardoise-50"
      )}
    >
      {children}
    </button>
  )
}

function BoutonSupprimer({ analyseId }: { analyseId: string }) {
  const [enCours, demarrer] = useTransition()
  return (
    <button
      type="button"
      title="Supprimer le scenario"
      disabled={enCours}
      onClick={() => {
        if (!window.confirm("Supprimer ce scenario ?")) return
        demarrer(() => void supprimerAnalyse(analyseId))
      }}
      className="rounded p-1 text-ardoise-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
    >
      <Trash2 className="h-3 w-3" />
    </button>
  )
}

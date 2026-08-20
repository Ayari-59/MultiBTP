"use client"

import { useActionState, useEffect, useMemo, useState, useTransition } from "react"
import { useFormStatus } from "react-dom"
import { Plus, Trash2 } from "lucide-react"
import { Bouton, Champ, Groupe, Liste, ZoneTexte } from "@/components/ui/primitives"
import { ContenuDialogue, DeclencheurDialogue, Dialogue } from "@/components/ui/dialogue"
import {
  changerStatutFacture,
  deposerSituation,
  enregistrerFacture,
  supprimerFacture,
  supprimerSituation,
  validerSituation,
  type EtatSituation,
} from "@/lib/actions/situations"
import { calculerSituation } from "@/lib/metier/budget"
import { euros } from "@/lib/utils"

export type MarchePourSituation = {
  id: string
  reference: string
  sousTraitant: string
  lot: string
  montantInitial: number
  montantActualise: number
  tauxRetenueGarantie: number
  cumulValide: number
  avancementPrecedent: number
}

function BoutonEnvoi({ libelle }: { libelle: string }) {
  const { pending } = useFormStatus()
  return (
    <Bouton type="submit" disabled={pending}>
      {pending ? "Enregistrement..." : libelle}
    </Bouton>
  )
}

export function DialogueSituation({ marches }: { marches: MarchePourSituation[] }) {
  const [ouvert, setOuvert] = useState(false)
  const [etat, action] = useActionState<EtatSituation, FormData>(deposerSituation, {})
  const [contractId, setContractId] = useState(marches[0]?.id ?? "")
  const [avancement, setAvancement] = useState("0")

  useEffect(() => {
    if (etat.ok) setOuvert(false)
  }, [etat.ok])

  const marche = marches.find((m) => m.id === contractId)

  const calcul = useMemo(() => {
    if (!marche) return null
    return calculerSituation({
      marcheInitial: marche.montantInitial,
      avenants: marche.montantActualise - marche.montantInitial,
      cumulPrecedent: marche.cumulValide,
      avancementCumule: Number(avancement) || 0,
      tauxRetenueGarantie: marche.tauxRetenueGarantie,
    })
  }, [marche, avancement])

  if (marches.length === 0) return null

  return (
    <Dialogue open={ouvert} onOpenChange={setOuvert}>
      <DeclencheurDialogue asChild>
        <Bouton variant="contour" taille="sm">
          <Plus className="h-3.5 w-3.5" /> Situation
        </Bouton>
      </DeclencheurDialogue>

      <ContenuDialogue
        titre="Nouvelle situation de travaux"
        description="Le montant se deduit de l'avancement cumule declare et des situations deja validees."
      >
        <form action={action} className="space-y-4">
          <Groupe label="Marche">
            <Liste name="contractId" value={contractId} onChange={(e) => setContractId(e.target.value)}>
              {marches.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.reference} — {m.sousTraitant} ({m.lot})
                </option>
              ))}
            </Liste>
          </Groupe>

          <div className="grid gap-3 sm:grid-cols-2">
            <Groupe label="Periode">
              <Champ
                name="periode"
                placeholder="Mars 2026"
                defaultValue={new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
                required
              />
            </Groupe>
            <Groupe
              label="Avancement cumule (%)"
              aide={marche ? `Deja valide : ${marche.avancementPrecedent} %` : undefined}
            >
              <Champ
                name="avancementCumule"
                type="number"
                step="0.5"
                min={marche?.avancementPrecedent ?? 0}
                max={100}
                value={avancement}
                onChange={(e) => setAvancement(e.target.value)}
                required
              />
            </Groupe>
          </div>

          {calcul && (
            <div className="space-y-1 rounded-md bg-ardoise-50 px-3 py-2.5 text-xs">
              <Ligne libelle="Marche actualise" valeur={euros(calcul.marcheActualise)} />
              <Ligne libelle="Deja facture" valeur={euros(calcul.cumulPrecedent)} />
              <Ligne libelle="Cumul a ce jour" valeur={euros(calcul.montantCumule)} />
              <Ligne libelle="Situation courante" valeur={euros(calcul.montantSituation)} fort />
              <Ligne
                libelle={`Retenue de garantie (${marche?.tauxRetenueGarantie ?? 5} %)`}
                valeur={`− ${euros(calcul.retenueGarantie)}`}
              />
              <Ligne libelle="Net a payer" valeur={euros(calcul.netAPayer)} fort />
              <Ligne libelle="Reste a facturer" valeur={euros(calcul.resteAFacturer)} />
            </div>
          )}

          <Groupe label="Observations">
            <ZoneTexte name="observations" rows={2} />
          </Groupe>

          {etat.erreur && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {etat.erreur}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Bouton type="button" variant="contour" onClick={() => setOuvert(false)}>
              Annuler
            </Bouton>
            <BoutonEnvoi libelle="Deposer la situation" />
          </div>
        </form>
      </ContenuDialogue>
    </Dialogue>
  )
}

function Ligne({ libelle, valeur, fort }: { libelle: string; valeur: string; fort?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-ardoise-500">{libelle}</span>
      <span
        className={
          fort
            ? "font-semibold tabulaire text-ardoise-900"
            : "tabulaire text-ardoise-700"
        }
      >
        {valeur}
      </span>
    </div>
  )
}

export function DecisionSituation({ situationId, statut }: { situationId: string; statut: string }) {
  const [enCours, demarrer] = useTransition()
  if (statut === "VALIDEE") return null

  return (
    <div className="flex gap-1">
      <Bouton
        variant="succes"
        taille="sm"
        className="h-7 px-2 text-xs"
        disabled={enCours}
        onClick={() => demarrer(() => void validerSituation(situationId, "VALIDEE"))}
      >
        Valider
      </Bouton>
      {statut !== "REJETEE" && (
        <Bouton
          variant="discret"
          taille="sm"
          className="h-7 px-2 text-xs"
          disabled={enCours}
          onClick={() => demarrer(() => void validerSituation(situationId, "REJETEE"))}
        >
          Rejeter
        </Bouton>
      )}
    </div>
  )
}

export function BoutonSupprimerSituation({ situationId }: { situationId: string }) {
  const [enCours, demarrer] = useTransition()
  const [erreur, setErreur] = useState<string | null>(null)

  return (
    <span className="flex items-center gap-1">
      {erreur && <span className="text-[10px] text-red-600">{erreur}</span>}
      <button
        type="button"
        title="Supprimer"
        disabled={enCours}
        onClick={() => {
          if (!window.confirm("Supprimer cette situation ?")) return
          demarrer(async () => {
            try {
              await supprimerSituation(situationId)
            } catch (e) {
              setErreur(e instanceof Error ? e.message : "Suppression impossible.")
            }
          })
        }}
        className="rounded p-1 text-ardoise-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </span>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  Factures
// ═══════════════════════════════════════════════════════════════════════════

export function DialogueFacture({
  projectId,
  marches,
}: {
  projectId: string
  marches: { id: string; reference: string; sousTraitant: string }[]
}) {
  const [ouvert, setOuvert] = useState(false)
  const [etat, action] = useActionState<EtatSituation, FormData>(enregistrerFacture, {})

  useEffect(() => {
    if (etat.ok) setOuvert(false)
  }, [etat.ok])

  return (
    <Dialogue open={ouvert} onOpenChange={setOuvert}>
      <DeclencheurDialogue asChild>
        <Bouton variant="contour" taille="sm">
          <Plus className="h-3.5 w-3.5" /> Facture
        </Bouton>
      </DeclencheurDialogue>

      <ContenuDialogue titre="Enregistrer une facture">
        <form action={action} className="space-y-4">
          <input type="hidden" name="projectId" value={projectId} />

          <div className="grid gap-3 sm:grid-cols-2">
            <Groupe label="Sens">
              <Liste name="sens" defaultValue="FOURNISSEUR">
                <option value="FOURNISSEUR">Facture fournisseur (a payer)</option>
                <option value="CLIENT">Facture client (a encaisser)</option>
              </Liste>
            </Groupe>
            <Groupe label="Marche rattache">
              <Liste name="contractId" defaultValue="">
                <option value="">— Aucun —</option>
                {marches.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.reference} — {m.sousTraitant}
                  </option>
                ))}
              </Liste>
            </Groupe>
            <Groupe label="Numero">
              <Champ name="numero" placeholder="F-2026-0147" required />
            </Groupe>
            <Groupe label="Emetteur">
              <Champ name="emetteur" required />
            </Groupe>
            <Groupe label="Montant HT (€)">
              <Champ name="montantHT" type="number" step="0.01" min="0" required />
            </Groupe>
            <Groupe label="TVA (%)">
              <Champ name="tauxTva" type="number" step="0.1" defaultValue={20} />
            </Groupe>
            <Groupe label="Date d'emission">
              <Champ name="dateEmission" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
            </Groupe>
            <Groupe label="Echeance">
              <Champ name="dateEcheance" type="date" />
            </Groupe>
          </div>

          {etat.erreur && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {etat.erreur}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Bouton type="button" variant="contour" onClick={() => setOuvert(false)}>
              Annuler
            </Bouton>
            <BoutonEnvoi libelle="Enregistrer" />
          </div>
        </form>
      </ContenuDialogue>
    </Dialogue>
  )
}

export function SelecteurStatutFacture({
  invoiceId,
  statut,
}: {
  invoiceId: string
  statut: string
}) {
  const [enCours, demarrer] = useTransition()
  return (
    <Liste
      value={statut}
      disabled={enCours}
      className="h-7 w-auto text-xs"
      onChange={(e) => {
        const v = e.target.value
        demarrer(() => void changerStatutFacture(invoiceId, v))
      }}
    >
      {[
        ["A_VALIDER", "A valider"],
        ["VALIDEE", "Validee"],
        ["PAYEE", "Payee"],
        ["LITIGE", "Litige"],
        ["ANNULEE", "Annulee"],
      ].map(([cle, libelle]) => (
        <option key={cle} value={cle}>
          {libelle}
        </option>
      ))}
    </Liste>
  )
}

export function BoutonSupprimerFacture({ invoiceId }: { invoiceId: string }) {
  const [enCours, demarrer] = useTransition()
  return (
    <button
      type="button"
      title="Supprimer"
      disabled={enCours}
      onClick={() => {
        if (!window.confirm("Supprimer cette facture ?")) return
        demarrer(() => void supprimerFacture(invoiceId))
      }}
      className="rounded p-1 text-ardoise-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  )
}

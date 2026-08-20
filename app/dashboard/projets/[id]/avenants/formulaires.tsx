"use client"

import { useActionState, useEffect, useState, useTransition } from "react"
import { useFormStatus } from "react-dom"
import { Plus, Trash2 } from "lucide-react"
import { Bouton, Champ, Groupe, Liste, ZoneTexte } from "@/components/ui/primitives"
import { ContenuDialogue, DeclencheurDialogue, Dialogue } from "@/components/ui/dialogue"
import {
  deciderAvenant,
  enregistrerAvenant,
  supprimerAvenant,
  type EtatBudget,
} from "@/lib/actions/budget"
import { euros } from "@/lib/utils"

const ORIGINES = [
  ["CLIENT", "Demande du client"],
  ["SOUS_TRAITANT", "Demande du sous-traitant"],
  ["ALEA_TECHNIQUE", "Alea technique"],
  ["REGLEMENTAIRE", "Contrainte reglementaire"],
  ["INTERNE", "Decision interne"],
] as const

function BoutonEnvoi({ libelle }: { libelle: string }) {
  const { pending } = useFormStatus()
  return (
    <Bouton type="submit" disabled={pending}>
      {pending ? "Enregistrement..." : libelle}
    </Bouton>
  )
}

export function DialogueAvenant({
  projectId,
  lots,
  marches,
}: {
  projectId: string
  lots: { id: string; code: string; nom: string }[]
  marches: { id: string; reference: string; sousTraitant: string; lotId: string }[]
}) {
  const [ouvert, setOuvert] = useState(false)
  const [etat, action] = useActionState<EtatBudget, FormData>(enregistrerAvenant, {})
  const [impactCout, setImpactCout] = useState("0")
  const [impactVente, setImpactVente] = useState("0")

  useEffect(() => {
    if (etat.ok) setOuvert(false)
  }, [etat.ok])

  const solde = (Number(impactVente) || 0) - (Number(impactCout) || 0)

  return (
    <Dialogue open={ouvert} onOpenChange={setOuvert}>
      <DeclencheurDialogue asChild>
        <Bouton variant="contour" taille="sm">
          <Plus className="h-3.5 w-3.5" /> Avenant
        </Bouton>
      </DeclencheurDialogue>

      <ContenuDialogue
        titre="Nouvel avenant"
        description="L'acceptation recalcule automatiquement le budget, la marge et la date de fin."
      >
        <form action={action} className="space-y-4">
          <input type="hidden" name="projectId" value={projectId} />

          <Groupe label="Motif">
            <Champ name="motif" placeholder="Ajout de deux salles d'eau au 3e etage" required />
          </Groupe>

          <div className="grid gap-3 sm:grid-cols-2">
            <Groupe label="Origine">
              <Liste name="origine" defaultValue="CLIENT">
                {ORIGINES.map(([cle, libelle]) => (
                  <option key={cle} value={cle}>
                    {libelle}
                  </option>
                ))}
              </Liste>
            </Groupe>
            <Groupe label="Lot concerne">
              <Liste name="lotId" defaultValue="">
                <option value="">— Aucun —</option>
                {lots.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code} — {l.nom}
                  </option>
                ))}
              </Liste>
            </Groupe>
            <Groupe label="Marche impacte" className="sm:col-span-2">
              <Liste name="contractId" defaultValue="">
                <option value="">— Aucun (cout direct du projet) —</option>
                {marches.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.reference} — {m.sousTraitant}
                  </option>
                ))}
              </Liste>
            </Groupe>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Groupe label="Impact cout (€)" aide="Positif = surcout">
              <Champ
                name="impactCout"
                type="number"
                step="0.01"
                value={impactCout}
                onChange={(e) => setImpactCout(e.target.value)}
              />
            </Groupe>
            <Groupe label="Impact vente (€)" aide="Refacture au client">
              <Champ
                name="impactVente"
                type="number"
                step="0.01"
                value={impactVente}
                onChange={(e) => setImpactVente(e.target.value)}
              />
            </Groupe>
            <Groupe label="Impact delai (jours)">
              <Champ name="impactDelaiJours" type="number" defaultValue={0} />
            </Groupe>
          </div>

          <div
            className={
              solde < 0
                ? "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
                : "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800"
            }
          >
            Solde de l&apos;avenant : <strong className="tabulaire">{euros(solde)}</strong>
            {solde < 0 && " — le surcout n'est pas integralement refacture, la marge baisse."}
          </div>

          <Groupe label="Description">
            <ZoneTexte name="description" rows={3} />
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
            <BoutonEnvoi libelle="Creer l'avenant" />
          </div>
        </form>
      </ContenuDialogue>
    </Dialogue>
  )
}

export function DecisionAvenant({
  avenantId,
  statut,
  impactCout,
  impactVente,
}: {
  avenantId: string
  statut: string
  impactCout: number
  impactVente: number
}) {
  const [enCours, demarrer] = useTransition()

  if (statut === "ACCEPTE" || statut === "REFUSE") return null

  return (
    <div className="flex gap-1">
      <Bouton
        variant="succes"
        taille="sm"
        className="h-7 px-2 text-xs"
        disabled={enCours}
        onClick={() => {
          if (
            !window.confirm(
              `Accepter cet avenant ? Le budget augmentera de ${euros(impactCout)} et le prix de vente de ${euros(impactVente)}.`
            )
          )
            return
          demarrer(() => void deciderAvenant(avenantId, "ACCEPTE"))
        }}
      >
        Accepter
      </Bouton>
      <Bouton
        variant="discret"
        taille="sm"
        className="h-7 px-2 text-xs"
        disabled={enCours}
        onClick={() => demarrer(() => void deciderAvenant(avenantId, "REFUSE"))}
      >
        Refuser
      </Bouton>
    </div>
  )
}

export function BoutonSupprimerAvenant({ avenantId }: { avenantId: string }) {
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
          if (!window.confirm("Supprimer cet avenant ?")) return
          demarrer(async () => {
            try {
              await supprimerAvenant(avenantId)
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

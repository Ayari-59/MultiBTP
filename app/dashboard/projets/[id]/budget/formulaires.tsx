"use client"

import { useActionState, useEffect, useState, useTransition } from "react"
import { useFormStatus } from "react-dom"
import { Plus, Sparkles, Trash2 } from "lucide-react"
import { Bouton, Champ, Groupe, Liste, ZoneTexte } from "@/components/ui/primitives"
import { ContenuDialogue, DeclencheurDialogue, Dialogue } from "@/components/ui/dialogue"
import {
  analyserMarge,
  enregistrerMouvement,
  supprimerMouvement,
  type EtatBudget,
} from "@/lib/actions/budget"

const NATURES = [
  ["SOUS_TRAITANCE", "Sous-traitance"],
  ["MATERIAUX", "Materiaux"],
  ["MAIN_OEUVRE", "Main-d'oeuvre"],
  ["MATERIEL", "Materiel / location"],
  ["TRANSPORT", "Transport"],
  ["FRAIS_CHANTIER", "Frais de chantier"],
  ["FRAIS_GENERAUX", "Frais generaux"],
  ["HONORAIRES", "Honoraires"],
  ["ASSURANCE", "Assurance"],
  ["AUTRE", "Autre"],
] as const

function BoutonEnvoi({ libelle }: { libelle: string }) {
  const { pending } = useFormStatus()
  return (
    <Bouton type="submit" disabled={pending}>
      {pending ? "Enregistrement..." : libelle}
    </Bouton>
  )
}

export function DialogueMouvement({
  projectId,
  lots,
  type,
}: {
  projectId: string
  lots: { id: string; code: string; nom: string }[]
  type: "ENGAGEMENT" | "DEPENSE"
}) {
  const [ouvert, setOuvert] = useState(false)
  const [etat, action] = useActionState<EtatBudget, FormData>(enregistrerMouvement, {})

  useEffect(() => {
    if (etat.ok) setOuvert(false)
  }, [etat.ok])

  const estEngagement = type === "ENGAGEMENT"

  return (
    <Dialogue open={ouvert} onOpenChange={setOuvert}>
      <DeclencheurDialogue asChild>
        <Bouton variant="contour" taille="sm">
          <Plus className="h-3.5 w-3.5" /> {estEngagement ? "Engagement" : "Depense"}
        </Bouton>
      </DeclencheurDialogue>

      <ContenuDialogue
        titre={estEngagement ? "Nouvel engagement" : "Nouvelle depense"}
        description={
          estEngagement
            ? "Commande ferme ou marche hors consultation. Le montant passe en cout engage."
            : "Depense effective. Le montant passe en cout realise."
        }
      >
        <form action={action} className="space-y-4">
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="type" value={type} />

          <Groupe label="Libelle">
            <Champ name="libelle" placeholder="Location echafaudage — mars" required />
          </Groupe>

          <div className="grid gap-3 sm:grid-cols-2">
            <Groupe label="Lot rattache">
              <Liste name="lotId" defaultValue="">
                <option value="">— Aucun (frais generaux du projet) —</option>
                {lots.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code} — {l.nom}
                  </option>
                ))}
              </Liste>
            </Groupe>
            <Groupe label="Nature de cout">
              <Liste name="nature" defaultValue="SOUS_TRAITANCE">
                {NATURES.map(([cle, libelle]) => (
                  <option key={cle} value={cle}>
                    {libelle}
                  </option>
                ))}
              </Liste>
            </Groupe>
            <Groupe label="Montant HT (€)">
              <Champ name="montantHT" type="number" step="0.01" min="0" required />
            </Groupe>
            <Groupe label="Date">
              <Champ name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
            </Groupe>
            <Groupe label="Reference">
              <Champ name="reference" placeholder="BC-2026-042" />
            </Groupe>
            {!estEngagement && (
              <Groupe label="Fournisseur">
                <Champ name="fournisseur" />
              </Groupe>
            )}
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

export function BoutonSupprimerMouvement({
  type,
  id,
}: {
  type: "ENGAGEMENT" | "DEPENSE"
  id: string
}) {
  const [enCours, demarrer] = useTransition()
  return (
    <button
      type="button"
      title="Supprimer"
      disabled={enCours}
      onClick={() => {
        if (!window.confirm("Supprimer cette ligne ?")) return
        demarrer(() => void supprimerMouvement(type, id))
      }}
      className="rounded p-1 text-ardoise-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  )
}

export function AnalyseMarge({ projectId }: { projectId: string }) {
  const [enCours, demarrer] = useTransition()
  const [texte, setTexte] = useState<string | null>(null)

  return (
    <div className="space-y-2">
      <Bouton
        variant="contour"
        taille="sm"
        disabled={enCours}
        onClick={() =>
          demarrer(async () => {
            setTexte(await analyserMarge(projectId))
          })
        }
      >
        <Sparkles className="h-3.5 w-3.5 text-violet-500" />
        {enCours ? "Analyse en cours..." : "Expliquer la marge"}
      </Bouton>

      {texte && (
        <div className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2.5">
          <p className="whitespace-pre-line text-xs leading-relaxed text-violet-900">{texte}</p>
        </div>
      )}
    </div>
  )
}

export function ZoneNote() {
  return <ZoneTexte rows={2} className="hidden" readOnly />
}

"use client"

import { useActionState, useEffect, useState, useTransition } from "react"
import { useFormStatus } from "react-dom"
import { Download, Pencil, Plus, Power, Trash2 } from "lucide-react"
import { Bouton, Champ, Groupe, Liste, ZoneTexte } from "@/components/ui/primitives"
import { ContenuDialogue, DeclencheurDialogue, Dialogue } from "@/components/ui/dialogue"
import {
  basculerActivation,
  enregistrerPrix,
  importerCatalogue,
  supprimerPrix,
  type EtatBibliotheque,
} from "@/lib/actions/bibliotheque"
import { LIBELLES_CATEGORIE, LIBELLES_UNITE } from "@/lib/metier/referentiel"
import { cn, euros } from "@/lib/utils"

const CATEGORIES = Object.keys(LIBELLES_CATEGORIE)
const UNITES = Object.keys(LIBELLES_UNITE)

export type PrixModifiable = {
  id: string
  code: string | null
  designation: string
  description: string | null
  categorie: string
  unite: string
  prixReference: number
  coutReference: number
  fournisseur: string | null
  localisation: string | null
}

function BoutonEnvoi({ libelle }: { libelle: string }) {
  const { pending } = useFormStatus()
  return (
    <Bouton type="submit" disabled={pending}>
      {pending ? "Enregistrement..." : libelle}
    </Bouton>
  )
}

export function DialoguePrix({
  prix,
  declencheur,
}: {
  prix?: PrixModifiable
  declencheur?: React.ReactNode
}) {
  const [ouvert, setOuvert] = useState(false)
  const [etat, action] = useActionState<EtatBibliotheque, FormData>(enregistrerPrix, {})
  const [prixVente, setPrixVente] = useState(String(prix?.prixReference ?? 0))
  const [cout, setCout] = useState(String(prix?.coutReference ?? 0))

  useEffect(() => {
    if (etat.ok) setOuvert(false)
  }, [etat.ok])

  const pv = Number(prixVente) || 0
  const cr = Number(cout) || 0
  const marge = pv > 0 ? ((pv - cr) / pv) * 100 : 0

  return (
    <Dialogue open={ouvert} onOpenChange={setOuvert}>
      <DeclencheurDialogue asChild>
        {declencheur ?? (
          <Bouton variant="chantier" taille="sm">
            <Plus className="h-3.5 w-3.5" /> Prix
          </Bouton>
        )}
      </DeclencheurDialogue>

      <ContenuDialogue
        titre={prix ? "Modifier le prix" : "Nouveau prix de reference"}
        description="Chaque enregistrement alimente l'historique et recalcule min / moyen / max."
      >
        <form action={action} className="space-y-4">
          {prix && <input type="hidden" name="priceItemId" value={prix.id} />}

          <div className="grid gap-3 sm:grid-cols-[110px_1fr]">
            <Groupe label="Code">
              <Champ name="code" defaultValue={prix?.code ?? ""} placeholder="ELE-010" />
            </Groupe>
            <Groupe label="Designation">
              <Champ name="designation" defaultValue={prix?.designation ?? ""} required />
            </Groupe>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Groupe label="Categorie">
              <Liste name="categorie" defaultValue={prix?.categorie ?? "AUTRE"}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {LIBELLES_CATEGORIE[c]}
                  </option>
                ))}
              </Liste>
            </Groupe>
            <Groupe label="Unite">
              <Liste name="unite" defaultValue={prix?.unite ?? "U"}>
                {UNITES.map((u) => (
                  <option key={u} value={u}>
                    {LIBELLES_UNITE[u]}
                  </option>
                ))}
              </Liste>
            </Groupe>
            <Groupe label="Prix de vente unitaire (€)">
              <Champ
                name="prixReference"
                type="number"
                step="0.01"
                min="0"
                value={prixVente}
                onChange={(e) => setPrixVente(e.target.value)}
                required
              />
            </Groupe>
            <Groupe label="Cout de revient unitaire (€)">
              <Champ
                name="coutReference"
                type="number"
                step="0.01"
                min="0"
                value={cout}
                onChange={(e) => setCout(e.target.value)}
              />
            </Groupe>
            <Groupe label="Fournisseur / sous-traitant">
              <Champ name="fournisseur" defaultValue={prix?.fournisseur ?? ""} />
            </Groupe>
            <Groupe label="Localisation">
              <Champ name="localisation" defaultValue={prix?.localisation ?? ""} placeholder="Lille" />
            </Groupe>
          </div>

          <div
            className={cn(
              "rounded-md px-3 py-2 text-xs",
              marge < 10 ? "bg-chantier-50 text-chantier-900" : "bg-emerald-50 text-emerald-900"
            )}
          >
            Marge unitaire : <strong className="tabulaire">{euros(pv - cr, 2)}</strong> soit{" "}
            <strong className="tabulaire">{marge.toFixed(1)} %</strong> du prix de vente.
          </div>

          <Groupe label="Description">
            <ZoneTexte name="description" rows={2} defaultValue={prix?.description ?? ""} />
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
            <BoutonEnvoi libelle={prix ? "Enregistrer" : "Ajouter"} />
          </div>
        </form>
      </ContenuDialogue>
    </Dialogue>
  )
}

export function BoutonModifierPrix({ prix }: { prix: PrixModifiable }) {
  return (
    <DialoguePrix
      prix={prix}
      declencheur={
        <button
          type="button"
          className="rounded p-1 text-ardoise-400 hover:bg-ardoise-100 hover:text-ardoise-700"
          title="Modifier"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      }
    />
  )
}

export function BasculeActivation({ priceItemId, actif }: { priceItemId: string; actif: boolean }) {
  const [enCours, demarrer] = useTransition()
  return (
    <button
      type="button"
      disabled={enCours}
      title={actif ? "Desactiver" : "Reactiver"}
      onClick={() => demarrer(() => void basculerActivation(priceItemId))}
      className={cn(
        "rounded p-1 hover:bg-ardoise-100 disabled:opacity-40",
        actif ? "text-emerald-600" : "text-ardoise-300"
      )}
    >
      <Power className="h-3.5 w-3.5" />
    </button>
  )
}

export function BoutonSupprimerPrix({ priceItemId }: { priceItemId: string }) {
  const [enCours, demarrer] = useTransition()
  return (
    <button
      type="button"
      title="Supprimer"
      disabled={enCours}
      onClick={() => {
        if (!window.confirm("Supprimer ce prix et son historique ?")) return
        demarrer(() => void supprimerPrix(priceItemId))
      }}
      className="rounded p-1 text-ardoise-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  )
}

export function BoutonImportCatalogue() {
  const [enCours, demarrer] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  return (
    <div className="flex items-center gap-2">
      {message && <span className="text-xs text-emerald-600">{message}</span>}
      <Bouton
        variant="contour"
        taille="sm"
        disabled={enCours}
        onClick={() =>
          demarrer(async () => {
            const n = await importerCatalogue()
            setMessage(n > 0 ? `${n} prix importes.` : "Catalogue deja importe.")
          })
        }
      >
        <Download className="h-3.5 w-3.5" />
        {enCours ? "Import..." : "Importer le catalogue"}
      </Bouton>
    </div>
  )
}

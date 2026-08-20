"use client"

import { useActionState, useEffect, useState, useTransition } from "react"
import { useFormStatus } from "react-dom"
import { Eye, EyeOff, Trash2, Upload } from "lucide-react"
import { Bouton, Champ, Groupe, Liste } from "@/components/ui/primitives"
import { ContenuDialogue, DeclencheurDialogue, Dialogue } from "@/components/ui/dialogue"
import {
  basculerVisibilite,
  supprimerDocument,
  televerserDocuments,
  type EtatDocument,
} from "@/lib/actions/documents"
import { cn, libelleEnum } from "@/lib/utils"

function BoutonEnvoi() {
  const { pending } = useFormStatus()
  return (
    <Bouton type="submit" disabled={pending}>
      {pending ? "Televersement..." : "Televerser"}
    </Bouton>
  )
}

export function DialogueDocuments({
  projectId,
  categories,
}: {
  projectId: string
  categories: string[]
}) {
  const [ouvert, setOuvert] = useState(false)
  const [etat, action] = useActionState<EtatDocument, FormData>(televerserDocuments, {})

  useEffect(() => {
    if (etat.ok) setOuvert(false)
  }, [etat.ok])

  return (
    <Dialogue open={ouvert} onOpenChange={setOuvert}>
      <DeclencheurDialogue asChild>
        <Bouton variant="contour" taille="sm">
          <Upload className="h-3.5 w-3.5" /> Televerser
        </Bouton>
      </DeclencheurDialogue>

      <ContenuDialogue
        titre="Televerser des documents"
        description="Deposer un fichier deja present dans la meme categorie cree une nouvelle version."
      >
        <form action={action} className="space-y-4">
          <input type="hidden" name="projectId" value={projectId} />

          <Groupe label="Categorie">
            <Liste name="categorie" defaultValue="PLANS">
              {categories.map((c) => (
                <option key={c} value={c}>
                  {libelleEnum(c)}
                </option>
              ))}
            </Liste>
          </Groupe>

          <Groupe label="Description">
            <Champ name="description" placeholder="Plan de niveau R+2, indice C" />
          </Groupe>

          <Groupe label="Fichiers" aide="PDF, images, plans, tableurs. 25 Mo maximum par fichier.">
            <input
              type="file"
              name="fichiers"
              multiple
              required
              className="w-full text-xs text-ardoise-600 file:mr-3 file:rounded file:border-0 file:bg-ardoise-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ardoise-700"
            />
          </Groupe>

          <div className="space-y-2 rounded-md bg-ardoise-50 px-3 py-2.5">
            <label className="flex items-center gap-2 text-xs text-ardoise-700">
              <input type="checkbox" name="visibleClient" className="h-4 w-4 accent-ardoise-800" />
              Visible par le client dans son espace
            </label>
            <label className="flex items-center gap-2 text-xs text-ardoise-700">
              <input
                type="checkbox"
                name="visibleSousTraitant"
                className="h-4 w-4 accent-ardoise-800"
              />
              Joint aux consultations et visible par les sous-traitants
            </label>
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
            <BoutonEnvoi />
          </div>
        </form>
      </ContenuDialogue>
    </Dialogue>
  )
}

export function BasculeVisibilite({
  documentId,
  cible,
  actif,
}: {
  documentId: string
  cible: "client" | "sousTraitant"
  actif: boolean
}) {
  const [enCours, demarrer] = useTransition()
  const Icone = actif ? Eye : EyeOff

  return (
    <button
      type="button"
      disabled={enCours}
      title={
        cible === "client"
          ? actif
            ? "Masquer au client"
            : "Rendre visible au client"
          : actif
            ? "Masquer aux sous-traitants"
            : "Rendre visible aux sous-traitants"
      }
      onClick={() => demarrer(() => void basculerVisibilite(documentId, cible))}
      className={cn(
        "rounded p-1 hover:bg-ardoise-100 disabled:opacity-40",
        actif ? "text-ardoise-700" : "text-ardoise-300"
      )}
    >
      <Icone className="h-3.5 w-3.5" />
      <span className="sr-only">{cible}</span>
    </button>
  )
}

export function BoutonSupprimerDocument({ documentId }: { documentId: string }) {
  const [enCours, demarrer] = useTransition()
  return (
    <button
      type="button"
      title="Supprimer"
      disabled={enCours}
      onClick={() => {
        if (!window.confirm("Supprimer ce document ?")) return
        demarrer(() => void supprimerDocument(documentId))
      }}
      className="rounded p-1 text-ardoise-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  )
}

"use client"

import { useActionState, useEffect, useState, useTransition } from "react"
import { useFormStatus } from "react-dom"
import { Pencil, Plus, Sparkles, Trash2 } from "lucide-react"
import { Bouton, Champ, Groupe, Liste, ZoneTexte } from "@/components/ui/primitives"
import { ContenuDialogue, DeclencheurDialogue, Dialogue } from "@/components/ui/dialogue"
import {
  analyserRisquesPlanning,
  enregistrerTache,
  majAvancementTache,
  supprimerTache,
  type EtatPlanning,
} from "@/lib/actions/planning"

function BoutonEnvoi({ libelle }: { libelle: string }) {
  const { pending } = useFormStatus()
  return (
    <Bouton type="submit" disabled={pending}>
      {pending ? "Enregistrement..." : libelle}
    </Bouton>
  )
}

export function DialogueTache({
  projectId,
  lots,
  sousTraitants,
  taches,
  tache,
  declencheur,
}: {
  projectId: string
  lots: { id: string; code: string; nom: string }[]
  sousTraitants: { id: string; raisonSociale: string }[]
  taches: { id: string; nom: string }[]
  tache?: {
    id: string
    nom: string
    lotId: string | null
    subcontractorId: string | null
    dateDebut: string
    dateFin: string
    responsable: string | null
    commentaire: string | null
  }
  declencheur?: React.ReactNode
}) {
  const [ouvert, setOuvert] = useState(false)
  const [etat, action] = useActionState<EtatPlanning, FormData>(enregistrerTache, {})

  useEffect(() => {
    if (etat.ok) setOuvert(false)
  }, [etat.ok])

  return (
    <Dialogue open={ouvert} onOpenChange={setOuvert}>
      <DeclencheurDialogue asChild>
        {declencheur ?? (
          <Bouton variant="contour" taille="sm">
            <Plus className="h-3.5 w-3.5" /> Tache
          </Bouton>
        )}
      </DeclencheurDialogue>

      <ContenuDialogue titre={tache ? "Modifier la tache" : "Nouvelle tache"}>
        <form action={action} className="space-y-4">
          <input type="hidden" name="projectId" value={projectId} />
          {tache && <input type="hidden" name="tacheId" value={tache.id} />}

          <Groupe label="Intitule">
            <Champ name="nom" defaultValue={tache?.nom ?? ""} placeholder="Electricite — passage des gaines" />
          </Groupe>

          <div className="grid gap-3 sm:grid-cols-2">
            <Groupe label="Lot">
              <Liste name="lotId" defaultValue={tache?.lotId ?? ""}>
                <option value="">— Aucun —</option>
                {lots.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code} — {l.nom}
                  </option>
                ))}
              </Liste>
            </Groupe>
            <Groupe label="Entreprise">
              <Liste name="subcontractorId" defaultValue={tache?.subcontractorId ?? ""}>
                <option value="">— Non attribue —</option>
                {sousTraitants.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.raisonSociale}
                  </option>
                ))}
              </Liste>
            </Groupe>
            <Groupe label="Debut">
              <Champ name="dateDebut" type="date" defaultValue={tache?.dateDebut.slice(0, 10) ?? ""} required />
            </Groupe>
            <Groupe label="Fin">
              <Champ name="dateFin" type="date" defaultValue={tache?.dateFin.slice(0, 10) ?? ""} required />
            </Groupe>
            <Groupe label="Responsable">
              <Champ name="responsable" defaultValue={tache?.responsable ?? ""} />
            </Groupe>
            <Groupe label="Apres la tache" aide="Cree une dependance fin → debut">
              <Liste name="predecesseurId" defaultValue="">
                <option value="">— Aucune —</option>
                {taches
                  .filter((t) => t.id !== tache?.id)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nom}
                    </option>
                  ))}
              </Liste>
            </Groupe>
          </div>

          <Groupe label="Commentaire">
            <ZoneTexte name="commentaire" rows={2} defaultValue={tache?.commentaire ?? ""} />
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
            <BoutonEnvoi libelle={tache ? "Enregistrer" : "Ajouter la tache"} />
          </div>
        </form>
      </ContenuDialogue>
    </Dialogue>
  )
}

export function BoutonModifierTache(props: Omit<Parameters<typeof DialogueTache>[0], "declencheur">) {
  return (
    <DialogueTache
      {...props}
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

export function CurseurAvancement({
  tacheId,
  avancement,
  desactive,
}: {
  tacheId: string
  avancement: number
  desactive?: boolean
}) {
  const [valeur, setValeur] = useState(avancement)
  const [enCours, demarrer] = useTransition()

  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={valeur}
        disabled={desactive || enCours}
        onChange={(e) => setValeur(Number(e.target.value))}
        onMouseUp={() => demarrer(() => void majAvancementTache(tacheId, valeur))}
        onTouchEnd={() => demarrer(() => void majAvancementTache(tacheId, valeur))}
        onKeyUp={() => demarrer(() => void majAvancementTache(tacheId, valeur))}
        className="h-1.5 w-24 accent-chantier-500 disabled:opacity-40"
      />
      <span className="w-9 text-right text-[11px] tabulaire text-ardoise-600">{valeur} %</span>
    </div>
  )
}

export function BoutonSupprimerTache({ tacheId }: { tacheId: string }) {
  const [enCours, demarrer] = useTransition()
  return (
    <button
      type="button"
      title="Supprimer"
      disabled={enCours}
      onClick={() => {
        if (!window.confirm("Supprimer cette tache ?")) return
        demarrer(() => void supprimerTache(tacheId))
      }}
      className="rounded p-1 text-ardoise-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  )
}

export function AnalyseRisques({ projectId }: { projectId: string }) {
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
            setTexte(await analyserRisquesPlanning(projectId))
          })
        }
      >
        <Sparkles className="h-3.5 w-3.5 text-violet-500" />
        {enCours ? "Analyse..." : "Analyser les risques de retard"}
      </Bouton>

      {texte && (
        <div className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2.5">
          <p className="whitespace-pre-line text-xs leading-relaxed text-violet-900">{texte}</p>
        </div>
      )}
    </div>
  )
}

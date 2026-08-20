"use client"

import { useActionState, useEffect, useState, useTransition } from "react"
import { useFormStatus } from "react-dom"
import { Camera, ClipboardList, Plus, TriangleAlert, Trash2 } from "lucide-react"
import { Bouton, Champ, Groupe, Liste, ZoneTexte } from "@/components/ui/primitives"
import { ContenuDialogue, DeclencheurDialogue, Dialogue } from "@/components/ui/dialogue"
import {
  changerStatutIncident,
  enregistrerIncident,
  enregistrerRapport,
  enregistrerReserve,
  leverReserve,
  supprimerPhoto,
  televerserPhotos,
  type EtatChantier,
} from "@/lib/actions/chantier"

type Lot = { id: string; code: string; nom: string }

function BoutonEnvoi({ libelle }: { libelle: string }) {
  const { pending } = useFormStatus()
  return (
    <Bouton type="submit" disabled={pending}>
      {pending ? "Enregistrement..." : libelle}
    </Bouton>
  )
}

export function DialogueRapport({ projectId }: { projectId: string }) {
  const [ouvert, setOuvert] = useState(false)
  const [etat, action] = useActionState<EtatChantier, FormData>(enregistrerRapport, {})

  useEffect(() => {
    if (etat.ok) setOuvert(false)
  }, [etat.ok])

  return (
    <Dialogue open={ouvert} onOpenChange={setOuvert}>
      <DeclencheurDialogue asChild>
        <Bouton variant="chantier" taille="sm">
          <ClipboardList className="h-3.5 w-3.5" /> Compte rendu
        </Bouton>
      </DeclencheurDialogue>

      <ContenuDialogue titre="Compte rendu de chantier" description="Saisie rapide depuis le terrain.">
        <form action={action} className="space-y-4">
          <input type="hidden" name="projectId" value={projectId} />

          <div className="grid gap-3 sm:grid-cols-3">
            <Groupe label="Date">
              <Champ name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
            </Groupe>
            <Groupe label="Meteo">
              <Liste name="meteo" defaultValue="Degage">
                {["Degage", "Nuageux", "Pluie", "Vent fort", "Gel", "Canicule"].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Liste>
            </Groupe>
            <Groupe label="Effectif sur site">
              <Champ name="effectif" type="number" min={0} />
            </Groupe>
          </div>

          <Groupe label="Travaux realises">
            <ZoneTexte name="travauxRealises" rows={3} placeholder="Pose des cloisons niveau 2, tirage des gaines..." />
          </Groupe>
          <Groupe label="Observations">
            <ZoneTexte name="observations" rows={2} />
          </Groupe>
          <Groupe label="Decisions prises">
            <ZoneTexte name="decisions" rows={2} />
          </Groupe>
          <Groupe label="Photos" aide="JPEG, PNG ou WebP, 25 Mo maximum par fichier.">
            <input
              type="file"
              name="photos"
              multiple
              accept="image/*"
              capture="environment"
              className="w-full text-xs text-ardoise-600 file:mr-3 file:rounded file:border-0 file:bg-ardoise-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ardoise-700"
            />
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
            <BoutonEnvoi libelle="Enregistrer le compte rendu" />
          </div>
        </form>
      </ContenuDialogue>
    </Dialogue>
  )
}

export function DialoguePhotos({ projectId, lots }: { projectId: string; lots: Lot[] }) {
  const [ouvert, setOuvert] = useState(false)
  const [etat, action] = useActionState<EtatChantier, FormData>(televerserPhotos, {})

  useEffect(() => {
    if (etat.ok) setOuvert(false)
  }, [etat.ok])

  return (
    <Dialogue open={ouvert} onOpenChange={setOuvert}>
      <DeclencheurDialogue asChild>
        <Bouton variant="contour" taille="sm">
          <Camera className="h-3.5 w-3.5" /> Photos
        </Bouton>
      </DeclencheurDialogue>

      <ContenuDialogue
        titre="Ajouter des photos"
        description="Chaque photo est rattachee au projet, au lot et a une localisation."
      >
        <form action={action} className="space-y-4">
          <input type="hidden" name="projectId" value={projectId} />

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

          <div className="grid gap-3 sm:grid-cols-2">
            <Groupe label="Legende">
              <Champ name="legende" placeholder="Pose des gaines" />
            </Groupe>
            <Groupe label="Localisation">
              <Champ name="localisation" placeholder="Batiment A, 2e etage" />
            </Groupe>
          </div>

          <Groupe label="Fichiers">
            <input
              type="file"
              name="photos"
              multiple
              accept="image/*"
              capture="environment"
              required
              className="w-full text-xs text-ardoise-600 file:mr-3 file:rounded file:border-0 file:bg-ardoise-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ardoise-700"
            />
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
            <BoutonEnvoi libelle="Televerser" />
          </div>
        </form>
      </ContenuDialogue>
    </Dialogue>
  )
}

export function DialogueIncident({ projectId, lots }: { projectId: string; lots: Lot[] }) {
  const [ouvert, setOuvert] = useState(false)
  const [etat, action] = useActionState<EtatChantier, FormData>(enregistrerIncident, {})

  useEffect(() => {
    if (etat.ok) setOuvert(false)
  }, [etat.ok])

  return (
    <Dialogue open={ouvert} onOpenChange={setOuvert}>
      <DeclencheurDialogue asChild>
        <Bouton variant="contour" taille="sm">
          <TriangleAlert className="h-3.5 w-3.5" /> Incident
        </Bouton>
      </DeclencheurDialogue>

      <ContenuDialogue titre="Declarer un incident">
        <form action={action} className="space-y-4">
          <input type="hidden" name="projectId" value={projectId} />

          <Groupe label="Titre">
            <Champ name="titre" placeholder="Reseau enterre non repertorie" required />
          </Groupe>

          <div className="grid gap-3 sm:grid-cols-2">
            <Groupe label="Lot">
              <Liste name="lotId" defaultValue="">
                <option value="">— Aucun —</option>
                {lots.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code} — {l.nom}
                  </option>
                ))}
              </Liste>
            </Groupe>
            <Groupe label="Gravite">
              <Liste name="gravite" defaultValue="MODERE">
                {[
                  ["MINEUR", "Mineur"],
                  ["MODERE", "Modere"],
                  ["MAJEUR", "Majeur"],
                  ["CRITIQUE", "Critique"],
                ].map(([cle, libelle]) => (
                  <option key={cle} value={cle}>
                    {libelle}
                  </option>
                ))}
              </Liste>
            </Groupe>
            <Groupe label="Impact cout (€)">
              <Champ name="impactCout" type="number" step="1" defaultValue={0} />
            </Groupe>
            <Groupe label="Impact delai (jours)">
              <Champ name="impactDelaiJours" type="number" defaultValue={0} />
            </Groupe>
          </div>

          <Groupe label="Description">
            <ZoneTexte name="description" rows={3} />
          </Groupe>
          <Groupe label="Action corrective">
            <ZoneTexte name="actionCorrective" rows={2} />
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
            <BoutonEnvoi libelle="Declarer" />
          </div>
        </form>
      </ContenuDialogue>
    </Dialogue>
  )
}

export function DialogueReserve({ projectId, lots }: { projectId: string; lots: Lot[] }) {
  const [ouvert, setOuvert] = useState(false)
  const [etat, action] = useActionState<EtatChantier, FormData>(enregistrerReserve, {})

  useEffect(() => {
    if (etat.ok) setOuvert(false)
  }, [etat.ok])

  return (
    <Dialogue open={ouvert} onOpenChange={setOuvert}>
      <DeclencheurDialogue asChild>
        <Bouton variant="contour" taille="sm">
          <Plus className="h-3.5 w-3.5" /> Reserve
        </Bouton>
      </DeclencheurDialogue>

      <ContenuDialogue titre="Emettre une reserve">
        <form action={action} className="space-y-4">
          <input type="hidden" name="projectId" value={projectId} />

          <Groupe label="Libelle">
            <Champ name="libelle" placeholder="Joint de carrelage non fini — salle d'eau lot 3" required />
          </Groupe>

          <div className="grid gap-3 sm:grid-cols-3">
            <Groupe label="Lot">
              <Liste name="lotId" defaultValue="">
                <option value="">— Aucun —</option>
                {lots.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code} — {l.nom}
                  </option>
                ))}
              </Liste>
            </Groupe>
            <Groupe label="Localisation">
              <Champ name="localisation" placeholder="Appartement 204" />
            </Groupe>
            <Groupe label="Date limite de levee">
              <Champ name="dateLimite" type="date" />
            </Groupe>
          </div>

          <Groupe label="Commentaire">
            <ZoneTexte name="commentaire" rows={2} />
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
            <BoutonEnvoi libelle="Emettre" />
          </div>
        </form>
      </ContenuDialogue>
    </Dialogue>
  )
}

export function SelecteurIncident({ incidentId, statut }: { incidentId: string; statut: string }) {
  const [enCours, demarrer] = useTransition()
  return (
    <Liste
      value={statut}
      disabled={enCours}
      className="h-7 w-auto text-xs"
      onChange={(e) => {
        const v = e.target.value
        demarrer(() => void changerStatutIncident(incidentId, v))
      }}
    >
      {[
        ["OUVERT", "Ouvert"],
        ["EN_TRAITEMENT", "En traitement"],
        ["RESOLU", "Resolu"],
        ["CLOS", "Clos"],
      ].map(([cle, libelle]) => (
        <option key={cle} value={cle}>
          {libelle}
        </option>
      ))}
    </Liste>
  )
}

export function BoutonLeverReserve({ reserveId, statut }: { reserveId: string; statut: string }) {
  const [enCours, demarrer] = useTransition()
  if (statut === "LEVEE") return null

  return (
    <Bouton
      variant="succes"
      taille="sm"
      className="h-7 px-2 text-xs"
      disabled={enCours}
      onClick={() => demarrer(() => void leverReserve(reserveId, "LEVEE"))}
    >
      Lever
    </Bouton>
  )
}

export function BoutonSupprimerPhoto({ photoId }: { photoId: string }) {
  const [enCours, demarrer] = useTransition()
  return (
    <button
      type="button"
      title="Supprimer"
      disabled={enCours}
      onClick={() => {
        if (!window.confirm("Supprimer cette photo ?")) return
        demarrer(() => void supprimerPhoto(photoId))
      }}
      className="rounded bg-white/90 p-1 text-ardoise-500 hover:text-red-600 disabled:opacity-40"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  )
}

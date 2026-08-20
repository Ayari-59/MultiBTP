"use client"

import { useActionState, useEffect, useState, useTransition } from "react"
import { useFormStatus } from "react-dom"
import { Pencil, Plus, Power, Trash2, Upload } from "lucide-react"
import { Bouton, Champ, Etiquette, Groupe, Liste, ZoneTexte } from "@/components/ui/primitives"
import { ContenuDialogue, DeclencheurDialogue, Dialogue } from "@/components/ui/dialogue"
import {
  basculerActivationSousTraitant,
  enregistrerSousTraitant,
  supprimerPiece,
  supprimerSousTraitant,
  televerserPieces,
  type EtatSousTraitant,
} from "@/lib/actions/sous-traitants"
import { LIBELLES_CATEGORIE } from "@/lib/metier/referentiel"
import { cn } from "@/lib/utils"

const CATEGORIES = Object.keys(LIBELLES_CATEGORIE)

const TYPES_PIECE = [
  ["KBIS", "Extrait Kbis"],
  ["ASSURANCE_RC", "Assurance responsabilite civile"],
  ["ASSURANCE_DECENNALE", "Assurance decennale"],
  ["ATTESTATION_VIGILANCE", "Attestation de vigilance URSSAF"],
  ["ATTESTATION_FISCALE", "Attestation fiscale"],
  ["RIB", "RIB"],
  ["QUALIFICATION", "Qualification / certification"],
  ["REFERENCE", "Reference de chantier"],
  ["AUTRE", "Autre"],
] as const

export type SousTraitantModifiable = {
  id: string
  raisonSociale: string
  siret: string | null
  formeJuridique: string | null
  contactNom: string | null
  email: string | null
  telephone: string | null
  adresse: string | null
  codePostal: string | null
  ville: string | null
  zoneGeo: string | null
  effectif: number | null
  caAnnuel: number | null
  noteQualite: number
  noteDelai: number
  noteRelation: number
  nbLitiges: number
  notes: string | null
  specialites: string[]
  assuranceRcValide: boolean
  assuranceDecennaleValide: boolean
  attestationVigilanceValide: boolean
  dateValiditeDocuments: string | null
}

function BoutonEnvoi({ libelle }: { libelle: string }) {
  const { pending } = useFormStatus()
  return (
    <Bouton type="submit" disabled={pending}>
      {pending ? "Enregistrement..." : libelle}
    </Bouton>
  )
}

export function DialogueSousTraitant({
  sousTraitant,
  declencheur,
}: {
  sousTraitant?: SousTraitantModifiable
  declencheur?: React.ReactNode
}) {
  const [ouvert, setOuvert] = useState(false)
  const [etat, action] = useActionState<EtatSousTraitant, FormData>(enregistrerSousTraitant, {})
  const [specialites, setSpecialites] = useState<string[]>(sousTraitant?.specialites ?? [])

  useEffect(() => {
    if (etat.ok) setOuvert(false)
  }, [etat.ok])

  return (
    <Dialogue open={ouvert} onOpenChange={setOuvert}>
      <DeclencheurDialogue asChild>
        {declencheur ?? (
          <Bouton variant="chantier" taille="sm">
            <Plus className="h-3.5 w-3.5" /> Entreprise
          </Bouton>
        )}
      </DeclencheurDialogue>

      <ContenuDialogue
        large
        titre={sousTraitant ? "Modifier l'entreprise" : "Nouvelle entreprise"}
        description="Les specialites et la notation alimentent le classement du comparateur d'offres."
      >
        <form action={action} className="space-y-4">
          {sousTraitant && <input type="hidden" name="subcontractorId" value={sousTraitant.id} />}
          {specialites.map((s) => (
            <input key={s} type="hidden" name="specialites" value={s} />
          ))}

          <div className="grid gap-3 sm:grid-cols-2">
            <Groupe label="Raison sociale" className="sm:col-span-2">
              <Champ name="raisonSociale" defaultValue={sousTraitant?.raisonSociale ?? ""} required />
            </Groupe>
            <Groupe label="SIRET">
              <Champ name="siret" defaultValue={sousTraitant?.siret ?? ""} />
            </Groupe>
            <Groupe label="Forme juridique">
              <Champ name="formeJuridique" defaultValue={sousTraitant?.formeJuridique ?? ""} placeholder="SARL, SAS..." />
            </Groupe>
            <Groupe label="Interlocuteur">
              <Champ name="contactNom" defaultValue={sousTraitant?.contactNom ?? ""} />
            </Groupe>
            <Groupe label="E-mail">
              <Champ name="email" type="email" defaultValue={sousTraitant?.email ?? ""} />
            </Groupe>
            <Groupe label="Telephone">
              <Champ name="telephone" defaultValue={sousTraitant?.telephone ?? ""} />
            </Groupe>
            <Groupe label="Zone d'intervention">
              <Champ name="zoneGeo" defaultValue={sousTraitant?.zoneGeo ?? ""} placeholder="Hauts-de-France" />
            </Groupe>
            <Groupe label="Adresse" className="sm:col-span-2">
              <Champ name="adresse" defaultValue={sousTraitant?.adresse ?? ""} />
            </Groupe>
            <Groupe label="Code postal">
              <Champ name="codePostal" defaultValue={sousTraitant?.codePostal ?? ""} />
            </Groupe>
            <Groupe label="Ville">
              <Champ name="ville" defaultValue={sousTraitant?.ville ?? ""} />
            </Groupe>
            <Groupe label="Effectif">
              <Champ name="effectif" type="number" defaultValue={sousTraitant?.effectif ?? ""} />
            </Groupe>
            <Groupe label="Chiffre d'affaires annuel (€)">
              <Champ name="caAnnuel" type="number" step="1000" defaultValue={sousTraitant?.caAnnuel ?? ""} />
            </Groupe>
          </div>

          <div>
            <Etiquette>Specialites ({specialites.length} selectionnee(s))</Etiquette>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => {
                const actif = specialites.includes(c)
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() =>
                      setSpecialites((prev) =>
                        prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
                      )
                    }
                    className={cn(
                      "rounded-md px-2 py-1 text-[11px] transition-colors",
                      actif
                        ? "bg-ardoise-800 text-white"
                        : "border border-ardoise-200 text-ardoise-600 hover:bg-ardoise-50"
                    )}
                  >
                    {LIBELLES_CATEGORIE[c]}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <Groupe label="Note qualite / 5">
              <Champ
                name="noteQualite"
                type="number"
                step="0.5"
                min={0}
                max={5}
                defaultValue={sousTraitant?.noteQualite ?? 3}
              />
            </Groupe>
            <Groupe label="Note delai / 5">
              <Champ
                name="noteDelai"
                type="number"
                step="0.5"
                min={0}
                max={5}
                defaultValue={sousTraitant?.noteDelai ?? 3}
              />
            </Groupe>
            <Groupe label="Note relation / 5">
              <Champ
                name="noteRelation"
                type="number"
                step="0.5"
                min={0}
                max={5}
                defaultValue={sousTraitant?.noteRelation ?? 3}
              />
            </Groupe>
            <Groupe label="Litiges">
              <Champ name="nbLitiges" type="number" min={0} defaultValue={sousTraitant?.nbLitiges ?? 0} />
            </Groupe>
          </div>

          <div className="space-y-2 rounded-md bg-ardoise-50 px-3 py-2.5">
            <p className="text-[11px] font-medium text-ardoise-600">
              Conformite administrative (bloquante pour la signature d&apos;un marche)
            </p>
            {(
              [
                ["assuranceRcValide", "Assurance responsabilite civile a jour"],
                ["assuranceDecennaleValide", "Assurance decennale a jour"],
                ["attestationVigilanceValide", "Attestation de vigilance URSSAF a jour"],
              ] as const
            ).map(([cle, libelle]) => (
              <label key={cle} className="flex items-center gap-2 text-xs text-ardoise-700">
                <input
                  type="checkbox"
                  name={cle}
                  defaultChecked={sousTraitant?.[cle] ?? false}
                  className="h-4 w-4 accent-ardoise-800"
                />
                {libelle}
              </label>
            ))}
            <div>
              <Etiquette>Validite des documents</Etiquette>
              <Champ
                name="dateValiditeDocuments"
                type="date"
                defaultValue={sousTraitant?.dateValiditeDocuments?.slice(0, 10) ?? ""}
                className="w-48"
              />
            </div>
          </div>

          <Groupe label="Notes">
            <ZoneTexte name="notes" rows={2} defaultValue={sousTraitant?.notes ?? ""} />
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
            <BoutonEnvoi libelle={sousTraitant ? "Enregistrer" : "Ajouter l'entreprise"} />
          </div>
        </form>
      </ContenuDialogue>
    </Dialogue>
  )
}

export function BoutonModifierSousTraitant({
  sousTraitant,
}: {
  sousTraitant: SousTraitantModifiable
}) {
  return (
    <DialogueSousTraitant
      sousTraitant={sousTraitant}
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

export function BasculeActivationSt({ id, actif }: { id: string; actif: boolean }) {
  const [enCours, demarrer] = useTransition()
  return (
    <button
      type="button"
      disabled={enCours}
      title={actif ? "Desactiver" : "Reactiver"}
      onClick={() => demarrer(() => void basculerActivationSousTraitant(id))}
      className={cn(
        "rounded p-1 hover:bg-ardoise-100 disabled:opacity-40",
        actif ? "text-emerald-600" : "text-ardoise-300"
      )}
    >
      <Power className="h-3.5 w-3.5" />
    </button>
  )
}

export function BoutonSupprimerSt({ id }: { id: string }) {
  const [enCours, demarrer] = useTransition()
  const [erreur, setErreur] = useState<string | null>(null)

  return (
    <span className="flex items-center gap-1">
      {erreur && <span className="max-w-40 text-[10px] text-red-600">{erreur}</span>}
      <button
        type="button"
        title="Supprimer"
        disabled={enCours}
        onClick={() => {
          if (!window.confirm("Supprimer cette entreprise ?")) return
          demarrer(async () => {
            try {
              await supprimerSousTraitant(id)
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

export function DialoguePieces({ subcontractorId }: { subcontractorId: string }) {
  const [ouvert, setOuvert] = useState(false)
  const [etat, action] = useActionState<EtatSousTraitant, FormData>(televerserPieces, {})

  useEffect(() => {
    if (etat.ok) setOuvert(false)
  }, [etat.ok])

  return (
    <Dialogue open={ouvert} onOpenChange={setOuvert}>
      <DeclencheurDialogue asChild>
        <Bouton variant="contour" taille="sm">
          <Upload className="h-3.5 w-3.5" /> Piece administrative
        </Bouton>
      </DeclencheurDialogue>

      <ContenuDialogue
        titre="Deposer une piece"
        description="Le depot d'une assurance ou d'une attestation met a jour la conformite de l'entreprise."
      >
        <form action={action} className="space-y-4">
          <input type="hidden" name="subcontractorId" value={subcontractorId} />

          <Groupe label="Type de piece">
            <Liste name="type" defaultValue="ASSURANCE_DECENNALE">
              {TYPES_PIECE.map(([cle, libelle]) => (
                <option key={cle} value={cle}>
                  {libelle}
                </option>
              ))}
            </Liste>
          </Groupe>

          <Groupe label="Date d'expiration">
            <Champ name="dateExpiration" type="date" />
          </Groupe>

          <Groupe label="Fichiers">
            <input
              type="file"
              name="fichiers"
              multiple
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
            <BoutonEnvoi libelle="Deposer" />
          </div>
        </form>
      </ContenuDialogue>
    </Dialogue>
  )
}

export function BoutonSupprimerPiece({ documentId }: { documentId: string }) {
  const [enCours, demarrer] = useTransition()
  return (
    <button
      type="button"
      title="Supprimer"
      disabled={enCours}
      onClick={() => {
        if (!window.confirm("Supprimer cette piece ?")) return
        demarrer(() => void supprimerPiece(documentId))
      }}
      className="rounded p-1 text-ardoise-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  )
}

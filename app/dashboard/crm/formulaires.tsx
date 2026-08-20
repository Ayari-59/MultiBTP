"use client"

import { useActionState, useEffect, useState, useTransition } from "react"
import { useFormStatus } from "react-dom"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { Bouton, Champ, Groupe, Liste, ZoneTexte } from "@/components/ui/primitives"
import { ContenuDialogue, DeclencheurDialogue, Dialogue } from "@/components/ui/dialogue"
import {
  changerEtapeAffaire,
  enregistrerAffaire,
  enregistrerContact,
  enregistrerInteraction,
  supprimerAffaire,
  supprimerContact,
  type EtatCrm,
} from "@/lib/actions/crm"
import { LIBELLES_STAGE } from "@/lib/metier/referentiel"

const TYPES_CONTACT = [
  ["PROSPECT", "Prospect"],
  ["CLIENT", "Client"],
  ["PROPRIETAIRE", "Proprietaire"],
  ["INVESTISSEUR", "Investisseur"],
  ["MAITRE_OUVRAGE", "Maitre d'ouvrage"],
  ["ARCHITECTE", "Architecte"],
  ["PARTENAIRE", "Partenaire"],
] as const

export type ContactModifiable = {
  id: string
  type: string
  nom: string
  prenom: string | null
  societe: string | null
  siret: string | null
  email: string | null
  telephone: string | null
  adresse: string | null
  codePostal: string | null
  ville: string | null
  origine: string | null
  notes: string | null
}

function BoutonEnvoi({ libelle }: { libelle: string }) {
  const { pending } = useFormStatus()
  return (
    <Bouton type="submit" disabled={pending}>
      {pending ? "Enregistrement..." : libelle}
    </Bouton>
  )
}

export function DialogueContact({
  contact,
  declencheur,
}: {
  contact?: ContactModifiable
  declencheur?: React.ReactNode
}) {
  const [ouvert, setOuvert] = useState(false)
  const [etat, action] = useActionState<EtatCrm, FormData>(enregistrerContact, {})

  useEffect(() => {
    if (etat.ok) setOuvert(false)
  }, [etat.ok])

  return (
    <Dialogue open={ouvert} onOpenChange={setOuvert}>
      <DeclencheurDialogue asChild>
        {declencheur ?? (
          <Bouton variant="chantier" taille="sm">
            <Plus className="h-3.5 w-3.5" /> Contact
          </Bouton>
        )}
      </DeclencheurDialogue>

      <ContenuDialogue large titre={contact ? "Modifier le contact" : "Nouveau contact"}>
        <form action={action} className="space-y-4">
          {contact && <input type="hidden" name="contactId" value={contact.id} />}

          <div className="grid gap-3 sm:grid-cols-2">
            <Groupe label="Type">
              <Liste name="type" defaultValue={contact?.type ?? "PROSPECT"}>
                {TYPES_CONTACT.map(([cle, libelle]) => (
                  <option key={cle} value={cle}>
                    {libelle}
                  </option>
                ))}
              </Liste>
            </Groupe>
            <Groupe label="Origine">
              <Champ name="origine" defaultValue={contact?.origine ?? ""} placeholder="Recommandation, salon, site web" />
            </Groupe>
            <Groupe label="Nom">
              <Champ name="nom" defaultValue={contact?.nom ?? ""} required />
            </Groupe>
            <Groupe label="Prenom">
              <Champ name="prenom" defaultValue={contact?.prenom ?? ""} />
            </Groupe>
            <Groupe label="Societe">
              <Champ name="societe" defaultValue={contact?.societe ?? ""} />
            </Groupe>
            <Groupe label="SIRET">
              <Champ name="siret" defaultValue={contact?.siret ?? ""} />
            </Groupe>
            <Groupe label="E-mail">
              <Champ name="email" type="email" defaultValue={contact?.email ?? ""} />
            </Groupe>
            <Groupe label="Telephone">
              <Champ name="telephone" defaultValue={contact?.telephone ?? ""} />
            </Groupe>
            <Groupe label="Adresse" className="sm:col-span-2">
              <Champ name="adresse" defaultValue={contact?.adresse ?? ""} />
            </Groupe>
            <Groupe label="Code postal">
              <Champ name="codePostal" defaultValue={contact?.codePostal ?? ""} />
            </Groupe>
            <Groupe label="Ville">
              <Champ name="ville" defaultValue={contact?.ville ?? ""} />
            </Groupe>
          </div>

          <Groupe label="Notes">
            <ZoneTexte name="notes" rows={3} defaultValue={contact?.notes ?? ""} />
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
            <BoutonEnvoi libelle={contact ? "Enregistrer" : "Creer le contact"} />
          </div>
        </form>
      </ContenuDialogue>
    </Dialogue>
  )
}

export function BoutonModifierContact({ contact }: { contact: ContactModifiable }) {
  return (
    <DialogueContact
      contact={contact}
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

export function BoutonSupprimerContact({ contactId }: { contactId: string }) {
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
          if (!window.confirm("Supprimer ce contact ?")) return
          demarrer(async () => {
            try {
              await supprimerContact(contactId)
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
//  Affaires
// ═══════════════════════════════════════════════════════════════════════════

export function DialogueAffaire({
  contacts,
  contactId,
}: {
  contacts: { id: string; libelle: string }[]
  contactId?: string
}) {
  const [ouvert, setOuvert] = useState(false)
  const [etat, action] = useActionState<EtatCrm, FormData>(enregistrerAffaire, {})

  useEffect(() => {
    if (etat.ok) setOuvert(false)
  }, [etat.ok])

  return (
    <Dialogue open={ouvert} onOpenChange={setOuvert}>
      <DeclencheurDialogue asChild>
        <Bouton variant="contour" taille="sm">
          <Plus className="h-3.5 w-3.5" /> Affaire
        </Bouton>
      </DeclencheurDialogue>

      <ContenuDialogue titre="Nouvelle affaire">
        <form action={action} className="space-y-4">
          <Groupe label="Contact">
            <Liste name="contactId" defaultValue={contactId ?? contacts[0]?.id}>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.libelle}
                </option>
              ))}
            </Liste>
          </Groupe>

          <Groupe label="Intitule">
            <Champ name="titre" placeholder="Renovation immeuble Republique" required />
          </Groupe>

          <div className="grid gap-3 sm:grid-cols-2">
            <Groupe label="Etape">
              <Liste name="stage" defaultValue="NOUVEAU">
                {Object.entries(LIBELLES_STAGE).map(([cle, libelle]) => (
                  <option key={cle} value={cle}>
                    {libelle}
                  </option>
                ))}
              </Liste>
            </Groupe>
            <Groupe label="Montant estime (€ HT)">
              <Champ name="montantEstime" type="number" step="1000" />
            </Groupe>
            <Groupe label="Probabilite (%)">
              <Champ name="probabilite" type="number" min={0} max={100} defaultValue={20} />
            </Groupe>
            <Groupe label="Cloture prevue">
              <Champ name="dateCloturePrevue" type="date" />
            </Groupe>
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
            <BoutonEnvoi libelle="Creer l'affaire" />
          </div>
        </form>
      </ContenuDialogue>
    </Dialogue>
  )
}

export function SelecteurEtape({ dealId, stage }: { dealId: string; stage: string }) {
  const [enCours, demarrer] = useTransition()
  return (
    <Liste
      value={stage}
      disabled={enCours}
      className="h-7 w-auto text-xs"
      onChange={(e) => {
        const v = e.target.value
        demarrer(() => void changerEtapeAffaire(dealId, v))
      }}
    >
      {Object.entries(LIBELLES_STAGE).map(([cle, libelle]) => (
        <option key={cle} value={cle}>
          {libelle}
        </option>
      ))}
    </Liste>
  )
}

export function BoutonSupprimerAffaire({ dealId }: { dealId: string }) {
  const [enCours, demarrer] = useTransition()
  return (
    <button
      type="button"
      title="Supprimer"
      disabled={enCours}
      onClick={() => {
        if (!window.confirm("Supprimer cette affaire ?")) return
        demarrer(() => void supprimerAffaire(dealId))
      }}
      className="rounded p-1 text-ardoise-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  Historique
// ═══════════════════════════════════════════════════════════════════════════

export function FormulaireInteraction({ contactId }: { contactId: string }) {
  const [etat, action] = useActionState<EtatCrm, FormData>(enregistrerInteraction, {})

  return (
    <form action={action} className="space-y-3 border-t border-ardoise-100 p-4">
      <input type="hidden" name="contactId" value={contactId} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Groupe label="Canal">
          <Liste name="canal" defaultValue="Telephone">
            {["Telephone", "E-mail", "Visite", "Reunion", "Courrier", "Visio"].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Liste>
        </Groupe>
        <Groupe label="Date">
          <Champ name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
        </Groupe>
        <Groupe label="Objet">
          <Champ name="objet" placeholder="Point d'avancement" required />
        </Groupe>
      </div>

      <Groupe label="Compte rendu">
        <ZoneTexte name="compteRendu" rows={2} />
      </Groupe>

      {etat.erreur && <p className="text-xs text-red-600">{etat.erreur}</p>}

      <BoutonEnvoi libelle="Ajouter a l'historique" />
    </form>
  )
}

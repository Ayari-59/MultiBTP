"use client"

import { useActionState, useEffect, useState, useTransition } from "react"
import { useFormStatus } from "react-dom"
import { Check, Pencil, Plus, Power, Trash2 } from "lucide-react"
import { Bouton, Champ, CorpsCarte, Groupe, Liste } from "@/components/ui/primitives"
import { ContenuDialogue, DeclencheurDialogue, Dialogue } from "@/components/ui/dialogue"
import {
  basculerActivationUtilisateur,
  enregistrerUtilisateur,
  modifierOrganisation,
  supprimerUtilisateur,
  type EtatOrganisation,
} from "@/lib/actions/organisation"
import { LIBELLES_ROLES, type Role } from "@/lib/permissions"
import { cn } from "@/lib/utils"

export type OrganisationModifiable = {
  nom: string
  prefixe: string
  siret: string | null
  adresse: string | null
  codePostal: string | null
  ville: string | null
  telephone: string | null
  email: string | null
  siteWeb: string | null
  tauxTva: number
  tauxFraisChantier: number
  tauxFraisGeneraux: number
  margeCibleDefaut: number
  tauxRetenueGarantie: number
  seuilAlerteDerive: number
}

function BoutonEnvoi({ libelle }: { libelle: string }) {
  const { pending } = useFormStatus()
  return (
    <Bouton type="submit" disabled={pending}>
      {pending ? "Enregistrement..." : libelle}
    </Bouton>
  )
}

export function FormulaireOrganisation({
  organisation,
}: {
  organisation: OrganisationModifiable
}) {
  const [etat, action] = useActionState<EtatOrganisation, FormData>(modifierOrganisation, {})

  return (
    <form action={action}>
      <CorpsCarte className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Groupe label="Raison sociale">
            <Champ name="nom" defaultValue={organisation.nom} required />
          </Groupe>
          <Groupe label="Prefixe des references" aide="BTP donne BTP-2026-014">
            <Champ name="prefixe" defaultValue={organisation.prefixe} maxLength={6} required />
          </Groupe>
          <Groupe label="SIRET">
            <Champ name="siret" defaultValue={organisation.siret ?? ""} />
          </Groupe>
          <Groupe label="Telephone">
            <Champ name="telephone" defaultValue={organisation.telephone ?? ""} />
          </Groupe>
          <Groupe label="Adresse" className="sm:col-span-2">
            <Champ name="adresse" defaultValue={organisation.adresse ?? ""} />
          </Groupe>
          <Groupe label="Code postal">
            <Champ name="codePostal" defaultValue={organisation.codePostal ?? ""} />
          </Groupe>
          <Groupe label="Ville">
            <Champ name="ville" defaultValue={organisation.ville ?? ""} />
          </Groupe>
          <Groupe label="E-mail">
            <Champ name="email" type="email" defaultValue={organisation.email ?? ""} />
          </Groupe>
          <Groupe label="Site web">
            <Champ name="siteWeb" defaultValue={organisation.siteWeb ?? ""} />
          </Groupe>
        </div>

        <div className="rounded-md bg-ardoise-50 p-3">
          <p className="mb-2 text-xs font-medium text-ardoise-700">
            Parametres economiques par defaut
          </p>
          <p className="mb-3 text-[11px] text-ardoise-500">
            Appliques a chaque nouveau projet, puis modifiables projet par projet.
          </p>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Groupe label="Marge cible (%)">
              <Champ
                name="margeCibleDefaut"
                type="number"
                step="0.5"
                defaultValue={organisation.margeCibleDefaut}
              />
            </Groupe>
            <Groupe label="Frais chantier (%)">
              <Champ
                name="tauxFraisChantier"
                type="number"
                step="0.5"
                defaultValue={organisation.tauxFraisChantier}
              />
            </Groupe>
            <Groupe label="Frais generaux (%)">
              <Champ
                name="tauxFraisGeneraux"
                type="number"
                step="0.5"
                defaultValue={organisation.tauxFraisGeneraux}
              />
            </Groupe>
            <Groupe label="TVA (%)">
              <Champ name="tauxTva" type="number" step="0.5" defaultValue={organisation.tauxTva} />
            </Groupe>
            <Groupe label="Retenue garantie (%)">
              <Champ
                name="tauxRetenueGarantie"
                type="number"
                step="0.5"
                defaultValue={organisation.tauxRetenueGarantie}
              />
            </Groupe>
            <Groupe label="Seuil d'alerte derive (%)" aide="Tolerance avant alerte budgetaire">
              <Champ
                name="seuilAlerteDerive"
                type="number"
                step="0.5"
                defaultValue={organisation.seuilAlerteDerive}
              />
            </Groupe>
          </div>
        </div>

        {etat.erreur && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {etat.erreur}
          </p>
        )}
        {etat.ok && (
          <p className="flex items-center gap-1.5 text-xs text-emerald-600">
            <Check className="h-3.5 w-3.5" /> Parametres enregistres.
          </p>
        )}

        <BoutonEnvoi libelle="Enregistrer" />
      </CorpsCarte>
    </form>
  )
}

export type UtilisateurModifiable = {
  id: string
  email: string
  name: string
  role: string
  fonction: string | null
  telephone: string | null
  subcontractorId: string | null
  contactId: string | null
}

export function DialogueUtilisateur({
  utilisateur,
  sousTraitants,
  contacts,
  declencheur,
}: {
  utilisateur?: UtilisateurModifiable
  sousTraitants: { id: string; raisonSociale: string }[]
  contacts: { id: string; libelle: string }[]
  declencheur?: React.ReactNode
}) {
  const [ouvert, setOuvert] = useState(false)
  const [etat, action] = useActionState<EtatOrganisation, FormData>(enregistrerUtilisateur, {})
  const [role, setRole] = useState(utilisateur?.role ?? "CONDUCTEUR")

  useEffect(() => {
    if (etat.ok) setOuvert(false)
  }, [etat.ok])

  return (
    <Dialogue open={ouvert} onOpenChange={setOuvert}>
      <DeclencheurDialogue asChild>
        {declencheur ?? (
          <Bouton variant="chantier" taille="sm">
            <Plus className="h-3.5 w-3.5" /> Utilisateur
          </Bouton>
        )}
      </DeclencheurDialogue>

      <ContenuDialogue titre={utilisateur ? "Modifier l'utilisateur" : "Nouvel utilisateur"}>
        <form action={action} className="space-y-4">
          {utilisateur && <input type="hidden" name="userId" value={utilisateur.id} />}

          <div className="grid gap-3 sm:grid-cols-2">
            <Groupe label="Nom complet">
              <Champ name="name" defaultValue={utilisateur?.name ?? ""} required />
            </Groupe>
            <Groupe label="Adresse e-mail">
              <Champ name="email" type="email" defaultValue={utilisateur?.email ?? ""} required />
            </Groupe>
            <Groupe label="Role">
              <Liste name="role" value={role} onChange={(e) => setRole(e.target.value)}>
                {(Object.keys(LIBELLES_ROLES) as Role[]).map((r) => (
                  <option key={r} value={r}>
                    {LIBELLES_ROLES[r]}
                  </option>
                ))}
              </Liste>
            </Groupe>
            <Groupe label="Fonction">
              <Champ name="fonction" defaultValue={utilisateur?.fonction ?? ""} />
            </Groupe>
            <Groupe label="Telephone">
              <Champ name="telephone" defaultValue={utilisateur?.telephone ?? ""} />
            </Groupe>
            <Groupe
              label={utilisateur ? "Nouveau mot de passe" : "Mot de passe"}
              aide={utilisateur ? "Laisser vide pour ne pas le changer" : "8 caracteres minimum"}
            >
              <Champ name="motDePasse" type="password" minLength={8} />
            </Groupe>
          </div>

          {role === "SOUS_TRAITANT" && (
            <Groupe label="Entreprise rattachee" aide="Le compte n'accedera qu'a ses consultations et marches.">
              <Liste name="subcontractorId" defaultValue={utilisateur?.subcontractorId ?? ""}>
                <option value="">— Selectionner —</option>
                {sousTraitants.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.raisonSociale}
                  </option>
                ))}
              </Liste>
            </Groupe>
          )}

          {role === "CLIENT" && (
            <Groupe label="Contact rattache" aide="Le compte n'accedera qu'a ses propres projets.">
              <Liste name="contactId" defaultValue={utilisateur?.contactId ?? ""}>
                <option value="">— Selectionner —</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.libelle}
                  </option>
                ))}
              </Liste>
            </Groupe>
          )}

          {etat.erreur && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {etat.erreur}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Bouton type="button" variant="contour" onClick={() => setOuvert(false)}>
              Annuler
            </Bouton>
            <BoutonEnvoi libelle={utilisateur ? "Enregistrer" : "Creer le compte"} />
          </div>
        </form>
      </ContenuDialogue>
    </Dialogue>
  )
}

export function BoutonModifierUtilisateur(
  props: Omit<Parameters<typeof DialogueUtilisateur>[0], "declencheur">
) {
  return (
    <DialogueUtilisateur
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

export function ActionsUtilisateur({ userId, actif }: { userId: string; actif: boolean }) {
  const [enCours, demarrer] = useTransition()
  const [erreur, setErreur] = useState<string | null>(null)

  return (
    <span className="flex items-center justify-end gap-0.5">
      {erreur && <span className="max-w-36 text-[10px] text-red-600">{erreur}</span>}
      <button
        type="button"
        disabled={enCours}
        title={actif ? "Desactiver" : "Reactiver"}
        onClick={() =>
          demarrer(async () => {
            try {
              await basculerActivationUtilisateur(userId)
            } catch (e) {
              setErreur(e instanceof Error ? e.message : "Action impossible.")
            }
          })
        }
        className={cn(
          "rounded p-1 hover:bg-ardoise-100 disabled:opacity-40",
          actif ? "text-emerald-600" : "text-ardoise-300"
        )}
      >
        <Power className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        disabled={enCours}
        title="Supprimer"
        onClick={() => {
          if (!window.confirm("Supprimer ce compte ?")) return
          demarrer(async () => {
            try {
              await supprimerUtilisateur(userId)
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

"use client"

import { useActionState, useEffect, useState, useTransition } from "react"
import { useFormStatus } from "react-dom"
import { Plus, Send, Sparkles, Trash2 } from "lucide-react"
import {
  Bouton,
  Champ,
  Etiquette,
  Groupe,
  Liste,
  ZoneTexte,
} from "@/components/ui/primitives"
import { ContenuDialogue, DeclencheurDialogue, Dialogue } from "@/components/ui/dialogue"
import {
  analyserOffre,
  ecarterOffre,
  enregistrerConsultation,
  enregistrerOffre,
  envoyerConsultation,
  preparerConsultationsManquantes,
  repondreQuestion,
  retenirOffre,
  supprimerConsultation,
  supprimerOffre,
  type EtatConsultation,
} from "@/lib/actions/consultations"
import type { SousTraitantSuggere } from "@/lib/queries/consultations"
import { cn, euros } from "@/lib/utils"

function BoutonEnvoi({ libelle }: { libelle: string }) {
  const { pending } = useFormStatus()
  return (
    <Bouton type="submit" disabled={pending}>
      {pending ? "Enregistrement..." : libelle}
    </Bouton>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  Creation / edition d'une consultation
// ═══════════════════════════════════════════════════════════════════════════

export function DialogueConsultation({
  projectId,
  lots,
  consultation,
  declencheur,
}: {
  projectId: string
  lots: { id: string; code: string; nom: string }[]
  consultation?: {
    id: string
    lotId: string
    objet: string
    descriptif: string | null
    budgetEstime: number | null
    delaiSouhaiteJours: number | null
    dateLimiteReponse: string | null
    dateDebutSouhaitee: string | null
  }
  declencheur?: React.ReactNode
}) {
  const [ouvert, setOuvert] = useState(false)
  const [etat, action] = useActionState<EtatConsultation, FormData>(enregistrerConsultation, {})

  useEffect(() => {
    if (etat.ok) setOuvert(false)
  }, [etat.ok])

  return (
    <Dialogue open={ouvert} onOpenChange={setOuvert}>
      <DeclencheurDialogue asChild>
        {declencheur ?? (
          <Bouton variant="contour" taille="sm">
            <Plus className="h-3.5 w-3.5" /> Consultation
          </Bouton>
        )}
      </DeclencheurDialogue>

      <ContenuDialogue
        titre={consultation ? "Modifier la consultation" : "Nouvelle consultation"}
        description="Le descriptif et les quantites du lot sont joints automatiquement."
      >
        <form action={action} className="space-y-4">
          <input type="hidden" name="projectId" value={projectId} />
          {consultation && <input type="hidden" name="consultationId" value={consultation.id} />}

          <Groupe label="Lot concerne">
            <Liste name="lotId" defaultValue={consultation?.lotId ?? lots[0]?.id} disabled={!!consultation}>
              {lots.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code} — {l.nom}
                </option>
              ))}
            </Liste>
            {consultation && <input type="hidden" name="lotId" value={consultation.lotId} />}
          </Groupe>

          <Groupe label="Objet">
            <Champ name="objet" defaultValue={consultation?.objet ?? ""} placeholder="Electricite — Immeuble Republique" />
          </Groupe>

          <Groupe label="Descriptif des prestations">
            <ZoneTexte name="descriptif" rows={4} defaultValue={consultation?.descriptif ?? ""} />
          </Groupe>

          <div className="grid gap-3 sm:grid-cols-2">
            <Groupe label="Budget estime (€ HT)" aide="Sert de base de comparaison, non communique">
              <Champ
                name="budgetEstime"
                type="number"
                step="1"
                defaultValue={consultation?.budgetEstime ?? ""}
              />
            </Groupe>
            <Groupe label="Delai d'execution souhaite (jours)">
              <Champ
                name="delaiSouhaiteJours"
                type="number"
                defaultValue={consultation?.delaiSouhaiteJours ?? ""}
              />
            </Groupe>
            <Groupe label="Date limite de reponse">
              <Champ
                name="dateLimiteReponse"
                type="date"
                defaultValue={consultation?.dateLimiteReponse?.slice(0, 10) ?? ""}
              />
            </Groupe>
            <Groupe label="Demarrage souhaite">
              <Champ
                name="dateDebutSouhaitee"
                type="date"
                defaultValue={consultation?.dateDebutSouhaitee?.slice(0, 10) ?? ""}
              />
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
            <BoutonEnvoi libelle={consultation ? "Enregistrer" : "Creer la consultation"} />
          </div>
        </form>
      </ContenuDialogue>
    </Dialogue>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  Envoi aux entreprises
// ═══════════════════════════════════════════════════════════════════════════

export function DialogueEnvoi({
  consultationId,
  suggeres,
  dejaInvites,
  delaiDefaut,
}: {
  consultationId: string
  suggeres: SousTraitantSuggere[]
  dejaInvites: string[]
  delaiDefaut: number
}) {
  const [ouvert, setOuvert] = useState(false)
  const [selection, setSelection] = useState<string[]>(dejaInvites)
  const [delai, setDelai] = useState(String(delaiDefaut))
  const [enCours, demarrer] = useTransition()
  const [erreur, setErreur] = useState<string | null>(null)

  return (
    <Dialogue open={ouvert} onOpenChange={setOuvert}>
      <DeclencheurDialogue asChild>
        <Bouton variant="chantier" taille="sm">
          <Send className="h-3.5 w-3.5" /> Consulter des entreprises
        </Bouton>
      </DeclencheurDialogue>

      <ContenuDialogue
        large
        titre="Envoyer la consultation"
        description="Les entreprises sont classees par specialite, proximite et notation."
      >
        <div className="space-y-4">
          <Groupe label="Delai de reponse accorde (jours)">
            <Champ
              type="number"
              min={1}
              value={delai}
              onChange={(e) => setDelai(e.target.value)}
              className="w-32"
            />
          </Groupe>

          <div>
            <Etiquette>Entreprises a consulter ({selection.length} selectionnee(s))</Etiquette>
            <ul className="max-h-80 space-y-1 overflow-y-auto defilement-fin">
              {suggeres.map((s) => {
                const coche = selection.includes(s.id)
                return (
                  <li key={s.id}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2",
                        coche ? "border-ardoise-300 bg-ardoise-50" : "border-ardoise-200"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={coche}
                        onChange={() =>
                          setSelection((prev) =>
                            prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id]
                          )
                        }
                        className="h-4 w-4 accent-ardoise-800"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ardoise-900">
                          {s.raisonSociale}
                        </span>
                        <span className="block truncate text-[11px] text-ardoise-500">
                          {[
                            s.specialiste ? "Specialiste du lot" : null,
                            s.proche ? "Zone locale" : null,
                            s.ville,
                            `${s.nbMarches} marche(s)`,
                            s.nbLitiges > 0 ? `${s.nbLitiges} litige(s)` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-xs font-medium tabulaire text-ardoise-700">
                          {s.notation.toFixed(1)}/5
                        </span>
                        {!s.documentsAJour && (
                          <span className="block text-[10px] font-medium text-red-600">
                            documents a jour manquants
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>

          {erreur && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {erreur}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Bouton type="button" variant="contour" onClick={() => setOuvert(false)}>
              Annuler
            </Bouton>
            <Bouton
              variant="chantier"
              disabled={enCours || selection.length === 0}
              onClick={() =>
                demarrer(async () => {
                  try {
                    await envoyerConsultation(consultationId, selection, Number(delai) || 15)
                    setOuvert(false)
                  } catch (e) {
                    setErreur(e instanceof Error ? e.message : "Envoi impossible.")
                  }
                })
              }
            >
              {enCours ? "Envoi..." : `Envoyer a ${selection.length} entreprise(s)`}
            </Bouton>
          </div>
        </div>
      </ContenuDialogue>
    </Dialogue>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  Saisie d'une offre recue
// ═══════════════════════════════════════════════════════════════════════════

export function DialogueOffre({
  consultationId,
  entreprises,
  offre,
  declencheur,
}: {
  consultationId: string
  entreprises: { id: string; raisonSociale: string }[]
  offre?: {
    id: string
    subcontractorId: string
    reference: string | null
    montantHT: number
    delaiJours: number | null
    conditionsPaiement: string | null
    exclusions: string | null
    garanties: string | null
    observations: string | null
  }
  declencheur?: React.ReactNode
}) {
  const [ouvert, setOuvert] = useState(false)
  const [etat, action] = useActionState<EtatConsultation, FormData>(enregistrerOffre, {})

  useEffect(() => {
    if (etat.ok) setOuvert(false)
  }, [etat.ok])

  return (
    <Dialogue open={ouvert} onOpenChange={setOuvert}>
      <DeclencheurDialogue asChild>
        {declencheur ?? (
          <Bouton variant="contour" taille="sm">
            <Plus className="h-3.5 w-3.5" /> Saisir une offre
          </Bouton>
        )}
      </DeclencheurDialogue>

      <ContenuDialogue
        titre={offre ? "Modifier l'offre" : "Enregistrer une offre recue"}
        description="Saisie interne d'un devis recu par e-mail ou courrier."
      >
        <form action={action} className="space-y-4">
          <input type="hidden" name="consultationId" value={consultationId} />
          {offre && <input type="hidden" name="offerId" value={offre.id} />}

          <Groupe label="Entreprise">
            <Liste
              name="subcontractorId"
              defaultValue={offre?.subcontractorId ?? entreprises[0]?.id}
              disabled={!!offre}
            >
              {entreprises.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.raisonSociale}
                </option>
              ))}
            </Liste>
            {offre && <input type="hidden" name="subcontractorId" value={offre.subcontractorId} />}
          </Groupe>

          <div className="grid gap-3 sm:grid-cols-2">
            <Groupe label="Reference du devis">
              <Champ name="reference" defaultValue={offre?.reference ?? ""} placeholder="DEV-2026-118" />
            </Groupe>
            <Groupe label="Montant HT (€)">
              <Champ
                name="montantHT"
                type="number"
                step="0.01"
                min="0"
                defaultValue={offre?.montantHT ?? ""}
                required
              />
            </Groupe>
            <Groupe label="Delai d'execution (jours)">
              <Champ name="delaiJours" type="number" defaultValue={offre?.delaiJours ?? ""} />
            </Groupe>
            <Groupe label="Validite de l'offre (jours)">
              <Champ name="validiteJours" type="number" defaultValue={90} />
            </Groupe>
          </div>

          <Groupe label="Conditions de paiement">
            <Champ
              name="conditionsPaiement"
              defaultValue={offre?.conditionsPaiement ?? ""}
              placeholder="30 % a la commande, solde a 45 jours"
            />
          </Groupe>

          <Groupe label="Exclusions declarees" aide="Elles sont signalees dans le comparateur.">
            <ZoneTexte name="exclusions" rows={2} defaultValue={offre?.exclusions ?? ""} />
          </Groupe>

          <div className="grid gap-3 sm:grid-cols-2">
            <Groupe label="Garanties">
              <Champ name="garanties" defaultValue={offre?.garanties ?? ""} placeholder="Decennale, parfait achevement" />
            </Groupe>
            <Groupe label="Observations">
              <Champ name="observations" defaultValue={offre?.observations ?? ""} />
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
            <BoutonEnvoi libelle={offre ? "Enregistrer" : "Enregistrer l'offre"} />
          </div>
        </form>
      </ContenuDialogue>
    </Dialogue>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  Actions sur les offres
// ═══════════════════════════════════════════════════════════════════════════

export function ActionsOffre({
  offerId,
  statut,
  montant,
  sousTraitant,
  attribue,
}: {
  offerId: string
  statut: string
  montant: number
  sousTraitant: string
  attribue: boolean
}) {
  const [enCours, demarrer] = useTransition()
  const [erreur, setErreur] = useState<string | null>(null)

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {erreur && <span className="text-[10px] text-red-600">{erreur}</span>}

      <button
        type="button"
        title="Analyser le devis"
        disabled={enCours}
        onClick={() => demarrer(() => void analyserOffre(offerId))}
        className="rounded p-1 text-violet-500 hover:bg-violet-50 disabled:opacity-40"
      >
        <Sparkles className="h-3.5 w-3.5" />
      </button>

      {!attribue && statut !== "RETENUE" && (
        <>
          <Bouton
            variant="succes"
            taille="sm"
            className="h-7 px-2 text-xs"
            disabled={enCours}
            onClick={() => {
              if (
                !window.confirm(
                  `Retenir l'offre de ${sousTraitant} pour ${euros(montant)} ? Un marche sera cree et le montant passera en cout engage.`
                )
              )
                return
              demarrer(async () => {
                try {
                  await retenirOffre(offerId)
                } catch (e) {
                  setErreur(e instanceof Error ? e.message : "Attribution impossible.")
                }
              })
            }}
          >
            Retenir
          </Bouton>

          {statut !== "ECARTEE" && (
            <Bouton
              variant="discret"
              taille="sm"
              className="h-7 px-2 text-xs"
              disabled={enCours}
              onClick={() => demarrer(() => void ecarterOffre(offerId))}
            >
              Ecarter
            </Bouton>
          )}
        </>
      )}

      {!attribue && (
        <button
          type="button"
          title="Supprimer l'offre"
          disabled={enCours}
          onClick={() => {
            if (!window.confirm(`Supprimer l'offre de ${sousTraitant} ?`)) return
            demarrer(() => void supprimerOffre(offerId))
          }}
          className="rounded p-1 text-ardoise-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

export function BoutonPreparerConsultations({ projectId }: { projectId: string }) {
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
            const n = await preparerConsultationsManquantes(projectId)
            setMessage(n > 0 ? `${n} consultation(s) preparee(s).` : "Tous les lots sont deja consultes.")
          })
        }
      >
        Preparer les lots manquants
      </Bouton>
    </div>
  )
}

export function BoutonSupprimerConsultation({ consultationId }: { consultationId: string }) {
  const [enCours, demarrer] = useTransition()
  return (
    <button
      type="button"
      title="Supprimer"
      disabled={enCours}
      onClick={() => {
        if (!window.confirm("Supprimer cette consultation et les offres associees ?")) return
        demarrer(() => void supprimerConsultation(consultationId))
      }}
      className="rounded p-1 text-ardoise-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  )
}

export function ReponseQuestion({ questionId }: { questionId: string }) {
  const [enCours, demarrer] = useTransition()
  const [texte, setTexte] = useState("")

  return (
    <div className="mt-2 flex items-start gap-2">
      <ZoneTexte
        rows={2}
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        placeholder="Reponse communiquee a toutes les entreprises consultees..."
        className="text-xs"
      />
      <Bouton
        taille="sm"
        disabled={enCours || texte.trim().length < 2}
        onClick={() =>
          demarrer(async () => {
            await repondreQuestion(questionId, texte)
            setTexte("")
          })
        }
      >
        Repondre
      </Bouton>
    </div>
  )
}

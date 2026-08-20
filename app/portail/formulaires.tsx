"use client"

import { useActionState, useEffect, useState, useTransition } from "react"
import { useFormStatus } from "react-dom"
import { HelpCircle, Send } from "lucide-react"
import { Bouton, Champ, Groupe, ZoneTexte } from "@/components/ui/primitives"
import { ContenuDialogue, DeclencheurDialogue, Dialogue } from "@/components/ui/dialogue"
import {
  deposerDevis,
  poserQuestionConsultation,
  repondreInvitation,
  type EtatPortail,
} from "@/lib/actions/portail"
import { deposerSituation, type EtatSituation } from "@/lib/actions/situations"
import { calculerSituation } from "@/lib/metier/budget"
import { euros } from "@/lib/utils"

function BoutonEnvoi({ libelle }: { libelle: string }) {
  const { pending } = useFormStatus()
  return (
    <Bouton type="submit" disabled={pending}>
      {pending ? "Envoi..." : libelle}
    </Bouton>
  )
}

export function DialogueDevis({
  consultationId,
  objet,
}: {
  consultationId: string
  objet: string
}) {
  const [ouvert, setOuvert] = useState(false)
  const [etat, action] = useActionState<EtatPortail, FormData>(deposerDevis, {})

  useEffect(() => {
    if (etat.ok) setOuvert(false)
  }, [etat.ok])

  return (
    <Dialogue open={ouvert} onOpenChange={setOuvert}>
      <DeclencheurDialogue asChild>
        <Bouton variant="chantier" taille="sm">
          <Send className="h-3.5 w-3.5" /> Deposer mon devis
        </Bouton>
      </DeclencheurDialogue>

      <ContenuDialogue titre="Deposer un devis" description={objet}>
        <form action={action} className="space-y-4">
          <input type="hidden" name="consultationId" value={consultationId} />

          <div className="grid gap-3 sm:grid-cols-2">
            <Groupe label="Reference de votre devis">
              <Champ name="reference" placeholder="DEV-2026-118" />
            </Groupe>
            <Groupe label="Montant total HT (€)">
              <Champ name="montantHT" type="number" step="0.01" min="0" required />
            </Groupe>
            <Groupe label="Delai d'execution (jours)">
              <Champ name="delaiJours" type="number" min={1} />
            </Groupe>
            <Groupe label="Conditions de paiement">
              <Champ name="conditionsPaiement" placeholder="30 % a la commande, solde a 45 jours" />
            </Groupe>
          </div>

          <Groupe
            label="Prestations exclues"
            aide="Toute exclusion non declaree ici sera consideree comme incluse."
          >
            <ZoneTexte name="exclusions" rows={2} />
          </Groupe>

          <div className="grid gap-3 sm:grid-cols-2">
            <Groupe label="Garanties">
              <Champ name="garanties" placeholder="Decennale, parfait achevement" />
            </Groupe>
            <Groupe label="Observations">
              <Champ name="observations" />
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
            <BoutonEnvoi libelle="Deposer le devis" />
          </div>
        </form>
      </ContenuDialogue>
    </Dialogue>
  )
}

export function DialogueQuestion({ consultationId }: { consultationId: string }) {
  const [ouvert, setOuvert] = useState(false)
  const [etat, action] = useActionState<EtatPortail, FormData>(poserQuestionConsultation, {})

  useEffect(() => {
    if (etat.ok) setOuvert(false)
  }, [etat.ok])

  return (
    <Dialogue open={ouvert} onOpenChange={setOuvert}>
      <DeclencheurDialogue asChild>
        <Bouton variant="contour" taille="sm">
          <HelpCircle className="h-3.5 w-3.5" /> Poser une question
        </Bouton>
      </DeclencheurDialogue>

      <ContenuDialogue
        titre="Poser une question"
        description="La reponse est communiquee a toutes les entreprises consultees."
      >
        <form action={action} className="space-y-4">
          <input type="hidden" name="consultationId" value={consultationId} />
          <Groupe label="Votre question">
            <ZoneTexte name="question" rows={4} required />
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
            <BoutonEnvoi libelle="Envoyer" />
          </div>
        </form>
      </ContenuDialogue>
    </Dialogue>
  )
}

export function ReponseInvitation({
  consultationId,
  statut,
}: {
  consultationId: string
  statut: string
}) {
  const [enCours, demarrer] = useTransition()
  if (statut === "REPONDU" || statut === "REFUSE") return null

  return (
    <div className="flex gap-1">
      {statut !== "ACCEPTE" && (
        <Bouton
          variant="contour"
          taille="sm"
          className="h-7 px-2 text-xs"
          disabled={enCours}
          onClick={() => demarrer(() => void repondreInvitation(consultationId, "ACCEPTE"))}
        >
          Je reponds
        </Bouton>
      )}
      <Bouton
        variant="discret"
        taille="sm"
        className="h-7 px-2 text-xs"
        disabled={enCours}
        onClick={() => {
          const motif = window.prompt("Motif du refus (optionnel) :") ?? undefined
          demarrer(() => void repondreInvitation(consultationId, "REFUSE", motif))
        }}
      >
        Decliner
      </Bouton>
    </div>
  )
}

export type MarchePortail = {
  id: string
  reference: string
  lot: string
  projet: string
  montantInitial: number
  montantActualise: number
  tauxRetenueGarantie: number
  cumulValide: number
  avancementPrecedent: number
}

export function DialogueSituationPortail({ marches }: { marches: MarchePortail[] }) {
  const [ouvert, setOuvert] = useState(false)
  const [etat, action] = useActionState<EtatSituation, FormData>(deposerSituation, {})
  const [contractId, setContractId] = useState(marches[0]?.id ?? "")
  const [avancement, setAvancement] = useState("0")

  useEffect(() => {
    if (etat.ok) setOuvert(false)
  }, [etat.ok])

  const marche = marches.find((m) => m.id === contractId)
  const calcul = marche
    ? calculerSituation({
        marcheInitial: marche.montantInitial,
        avenants: marche.montantActualise - marche.montantInitial,
        cumulPrecedent: marche.cumulValide,
        avancementCumule: Number(avancement) || 0,
        tauxRetenueGarantie: marche.tauxRetenueGarantie,
      })
    : null

  if (marches.length === 0) return null

  return (
    <Dialogue open={ouvert} onOpenChange={setOuvert}>
      <DeclencheurDialogue asChild>
        <Bouton variant="chantier" taille="sm">
          <Send className="h-3.5 w-3.5" /> Deposer une situation
        </Bouton>
      </DeclencheurDialogue>

      <ContenuDialogue
        titre="Situation de travaux"
        description="Declarez votre avancement cumule : le montant se calcule automatiquement."
      >
        <form action={action} className="space-y-4">
          <Groupe label="Marche">
            <select
              name="contractId"
              value={contractId}
              onChange={(e) => setContractId(e.target.value)}
              className="h-9 w-full rounded-md border border-ardoise-200 bg-white px-2 text-sm"
            >
              {marches.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.reference} — {m.lot} ({m.projet})
                </option>
              ))}
            </select>
          </Groupe>

          <div className="grid gap-3 sm:grid-cols-2">
            <Groupe label="Periode">
              <Champ
                name="periode"
                defaultValue={new Date().toLocaleDateString("fr-FR", {
                  month: "long",
                  year: "numeric",
                })}
                required
              />
            </Groupe>
            <Groupe
              label="Avancement cumule (%)"
              aide={marche ? `Deja valide : ${marche.avancementPrecedent} %` : undefined}
            >
              <Champ
                name="avancementCumule"
                type="number"
                step="0.5"
                min={marche?.avancementPrecedent ?? 0}
                max={100}
                value={avancement}
                onChange={(e) => setAvancement(e.target.value)}
                required
              />
            </Groupe>
          </div>

          {calcul && (
            <div className="space-y-1 rounded-md bg-ardoise-50 px-3 py-2.5 text-xs">
              <Ligne libelle="Marche actualise" valeur={euros(calcul.marcheActualise)} />
              <Ligne libelle="Deja facture" valeur={euros(calcul.cumulPrecedent)} />
              <Ligne libelle="Montant de la situation" valeur={euros(calcul.montantSituation)} fort />
              <Ligne libelle="Retenue de garantie" valeur={`− ${euros(calcul.retenueGarantie)}`} />
              <Ligne libelle="Net a payer" valeur={euros(calcul.netAPayer)} fort />
            </div>
          )}

          <Groupe label="Observations">
            <ZoneTexte name="observations" rows={2} />
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

function Ligne({ libelle, valeur, fort }: { libelle: string; valeur: string; fort?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-ardoise-500">{libelle}</span>
      <span className={fort ? "font-semibold tabulaire text-ardoise-900" : "tabulaire text-ardoise-700"}>
        {valeur}
      </span>
    </div>
  )
}

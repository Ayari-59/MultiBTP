import { euros, joursEntre } from "@/lib/utils"

/**
 * Moteur d'alertes du tableau de bord.
 *
 * Les alertes sont recalculees a chaque affichage a partir de l'etat courant
 * de la base : pas de table d'alertes a maintenir synchronisee, donc pas de
 * risque d'alerte fantome apres correction d'une donnee.
 */

export type NiveauAlerte = "INFO" | "ALERTE" | "CRITIQUE"

export type TypeAlerte =
  | "MARGE_INSUFFISANTE"
  | "DEPASSEMENT_BUDGET"
  | "RETARD"
  | "DEVIS_MANQUANT"
  | "DOCUMENT_MANQUANT"
  | "FACTURE_EN_ATTENTE"
  | "SITUATION_A_VALIDER"
  | "ECHEANCE_PROCHE"
  | "CONSULTATION_SANS_REPONSE"
  | "INCIDENT_OUVERT"
  | "RESERVE_NON_LEVEE"

export type Alerte = {
  id: string
  type: TypeAlerte
  niveau: NiveauAlerte
  titre: string
  message: string
  lien: string
  projetId?: string
  projetRef?: string
}

export const LIBELLES_ALERTE: Record<TypeAlerte, string> = {
  MARGE_INSUFFISANTE: "Marge insuffisante",
  DEPASSEMENT_BUDGET: "Depassement budgetaire",
  RETARD: "Retard",
  DEVIS_MANQUANT: "Devis manquant",
  DOCUMENT_MANQUANT: "Document manquant",
  FACTURE_EN_ATTENTE: "Facture en attente",
  SITUATION_A_VALIDER: "Situation a valider",
  ECHEANCE_PROCHE: "Echeance proche",
  CONSULTATION_SANS_REPONSE: "Consultation sans reponse",
  INCIDENT_OUVERT: "Incident ouvert",
  RESERVE_NON_LEVEE: "Reserve non levee",
}

const RANG: Record<NiveauAlerte, number> = { CRITIQUE: 0, ALERTE: 1, INFO: 2 }

export type ProjetPourAlertes = {
  id: string
  reference: string
  nom: string
  statut: string
  margeCible: number
  tauxMargePrevisionnelle: number
  budgetActualise: number
  atterrissage: number
  dateFinPrevue: Date | null
  nbTachesEnRetard: number
  retardJours: number
  /** Lots en consultation dont aucune offre n'est arrivee */
  consultationsSansOffre: number
  consultationsEnRetard: number
  /** Lots attribues sans marche signe */
  lotsSansMarche: number
  sousTraitantsDocumentsInvalides: number
  facturesAValider: number
  situationsAValider: number
  incidentsCritiques: number
  reservesEnRetard: number
}

export function genererAlertes(
  projets: ProjetPourAlertes[],
  aujourdhui: Date = new Date()
): Alerte[] {
  const alertes: Alerte[] = []

  for (const p of projets) {
    const base = `/dashboard/projets/${p.id}`
    const ctx = { projetId: p.id, projetRef: p.reference }

    // ─── Economique ───────────────────────────────────────────────────────
    if (p.budgetActualise > 0 && p.tauxMargePrevisionnelle < p.margeCible - 3) {
      const critique = p.tauxMargePrevisionnelle < p.margeCible / 2
      alertes.push({
        ...ctx,
        id: `${p.id}-marge`,
        type: "MARGE_INSUFFISANTE",
        niveau: critique ? "CRITIQUE" : "ALERTE",
        titre: `Marge sous la cible — ${p.nom}`,
        message: `Marge previsionnelle de ${p.tauxMargePrevisionnelle.toFixed(1)} % pour une cible de ${p.margeCible.toFixed(1)} %.`,
        lien: `${base}/budget`,
      })
    }

    if (p.budgetActualise > 0 && p.atterrissage > p.budgetActualise * 1.02) {
      const derive = p.atterrissage - p.budgetActualise
      alertes.push({
        ...ctx,
        id: `${p.id}-budget`,
        type: "DEPASSEMENT_BUDGET",
        niveau: derive > p.budgetActualise * 0.1 ? "CRITIQUE" : "ALERTE",
        titre: `Depassement budgetaire — ${p.nom}`,
        message: `Atterrissage estime a ${euros(p.atterrissage)} pour un budget de ${euros(p.budgetActualise)} (+${euros(derive)}).`,
        lien: `${base}/budget`,
      })
    }

    // ─── Delais ───────────────────────────────────────────────────────────
    if (p.nbTachesEnRetard > 0) {
      alertes.push({
        ...ctx,
        id: `${p.id}-retard`,
        type: "RETARD",
        niveau: p.retardJours > 15 ? "CRITIQUE" : "ALERTE",
        titre: `${p.nbTachesEnRetard} tache(s) en retard — ${p.nom}`,
        message: `Retard maximum constate : ${p.retardJours} jour(s).`,
        lien: `${base}/planning`,
      })
    }

    if (p.dateFinPrevue && p.statut === "EN_COURS") {
      const jours = joursEntre(aujourdhui, p.dateFinPrevue)
      if (jours >= 0 && jours <= 21) {
        alertes.push({
          ...ctx,
          id: `${p.id}-echeance`,
          type: "ECHEANCE_PROCHE",
          niveau: jours <= 7 ? "ALERTE" : "INFO",
          titre: `Reception dans ${jours} jour(s) — ${p.nom}`,
          message: "Preparer la reception : levee des reserves, PV, DOE.",
          lien: base,
        })
      }
    }

    // ─── Consultations et marches ─────────────────────────────────────────
    if (p.consultationsSansOffre > 0) {
      alertes.push({
        ...ctx,
        id: `${p.id}-devis`,
        type: "DEVIS_MANQUANT",
        niveau: p.consultationsEnRetard > 0 ? "ALERTE" : "INFO",
        titre: `${p.consultationsSansOffre} consultation(s) sans devis — ${p.nom}`,
        message:
          p.consultationsEnRetard > 0
            ? `${p.consultationsEnRetard} consultation(s) ont depasse la date limite de reponse.`
            : "Relancer les entreprises consultees.",
        lien: `${base}/consultations`,
      })
    }

    if (p.lotsSansMarche > 0) {
      alertes.push({
        ...ctx,
        id: `${p.id}-marche`,
        type: "DOCUMENT_MANQUANT",
        niveau: "ALERTE",
        titre: `${p.lotsSansMarche} lot(s) attribue(s) sans marche signe — ${p.nom}`,
        message: "Le cout n'est pas engage tant que le marche n'est pas contractualise.",
        lien: `${base}/consultations`,
      })
    }

    if (p.sousTraitantsDocumentsInvalides > 0) {
      alertes.push({
        ...ctx,
        id: `${p.id}-docs`,
        type: "DOCUMENT_MANQUANT",
        niveau: "CRITIQUE",
        titre: `${p.sousTraitantsDocumentsInvalides} sous-traitant(s) non a jour — ${p.nom}`,
        message: "Assurance decennale ou attestation de vigilance manquante : risque juridique.",
        lien: "/dashboard/sous-traitants",
      })
    }

    // ─── Comptabilite ─────────────────────────────────────────────────────
    if (p.facturesAValider > 0) {
      alertes.push({
        ...ctx,
        id: `${p.id}-factures`,
        type: "FACTURE_EN_ATTENTE",
        niveau: "INFO",
        titre: `${p.facturesAValider} facture(s) a valider — ${p.nom}`,
        message: "Les factures non validees ne sont pas comptees dans le cout realise.",
        lien: `${base}/situations`,
      })
    }

    if (p.situationsAValider > 0) {
      alertes.push({
        ...ctx,
        id: `${p.id}-situations`,
        type: "SITUATION_A_VALIDER",
        niveau: "INFO",
        titre: `${p.situationsAValider} situation(s) a traiter — ${p.nom}`,
        message: "Verifier l'avancement declare avant validation.",
        lien: `${base}/situations`,
      })
    }

    // ─── Chantier ─────────────────────────────────────────────────────────
    if (p.incidentsCritiques > 0) {
      alertes.push({
        ...ctx,
        id: `${p.id}-incidents`,
        type: "INCIDENT_OUVERT",
        niveau: "CRITIQUE",
        titre: `${p.incidentsCritiques} incident(s) majeur(s) ouvert(s) — ${p.nom}`,
        message: "Impact potentiel sur le cout et le delai.",
        lien: `${base}/chantier`,
      })
    }

    if (p.reservesEnRetard > 0) {
      alertes.push({
        ...ctx,
        id: `${p.id}-reserves`,
        type: "RESERVE_NON_LEVEE",
        niveau: "ALERTE",
        titre: `${p.reservesEnRetard} reserve(s) hors delai — ${p.nom}`,
        message: "La levee des reserves conditionne la reception et le solde des marches.",
        lien: `${base}/chantier`,
      })
    }
  }

  return alertes.sort((a, b) => RANG[a.niveau] - RANG[b.niveau])
}

export function couleurNiveau(niveau: NiveauAlerte): string {
  if (niveau === "CRITIQUE") return "border-red-200 bg-red-50 text-red-900"
  if (niveau === "ALERTE") return "border-amber-200 bg-amber-50 text-amber-900"
  return "border-sky-200 bg-sky-50 text-sky-900"
}

export function pastilleNiveau(niveau: NiveauAlerte): string {
  if (niveau === "CRITIQUE") return "bg-red-500"
  if (niveau === "ALERTE") return "bg-amber-500"
  return "bg-sky-500"
}

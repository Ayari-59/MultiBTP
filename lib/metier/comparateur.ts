import { arrondi, borner, ratio } from "@/lib/utils"

/**
 * Comparateur d'offres (regle R6).
 *
 * Le score combine cinq criteres ponderes. Les poids sont exposes pour pouvoir
 * etre ajustes par organisation sans toucher a la formule.
 */

export const POIDS = {
  prix: 40,
  delai: 20,
  qualite: 20,
  fiabilite: 10,
  historique: 10,
} as const

export type OffreAComparer = {
  id: string
  subcontractorId: string
  sousTraitant: string
  montantHT: number
  delaiJours: number | null
  notation: number
  noteQualite: number
  noteDelai: number
  nbMarches: number
  nbLitiges: number
  assuranceRcValide: boolean
  assuranceDecennaleValide: boolean
  attestationVigilanceValide: boolean
  exclusions: string | null
  garanties: string | null
  conditionsPaiement: string | null
  statut: string
  /** Nombre de postes du descriptif effectivement chiffres */
  nbLignes: number
}

export type OffreEvaluee = OffreAComparer & {
  scorePrix: number
  scoreDelai: number
  scoreQualite: number
  scoreFiabilite: number
  scoreHistorique: number
  score: number
  rang: number
  /** Ecart au budget estime, en % (positif = plus cher que prevu) */
  ecartBudget: number | null
  /** Ecart a la moyenne des autres offres, en % */
  ecartMoyenne: number
  moinsDisante: boolean
  /** Devis dont le prix s'ecarte anormalement du marche */
  alertePrixBas: boolean
  alertePrixHaut: boolean
  signaux: string[]
}

export type ResultatComparaison = {
  offres: OffreEvaluee[]
  recommandee: OffreEvaluee | null
  moinsDisante: OffreEvaluee | null
  montantMin: number
  montantMax: number
  montantMoyen: number
  ecartMinMax: number
  budgetEstime: number | null
  /** Economie realisee par rapport au budget si l'offre recommandee est retenue */
  economie: number | null
}

function scoreFiabilite(o: OffreAComparer): number {
  let score = 0
  if (o.assuranceRcValide) score += 35
  if (o.assuranceDecennaleValide) score += 40
  if (o.attestationVigilanceValide) score += 25
  return score
}

function scoreHistorique(o: OffreAComparer): number {
  // Un partenaire eprouve marque des points ; chaque litige en retire.
  const experience = borner(o.nbMarches * 12, 0, 70)
  const litiges = borner(o.nbLitiges * 20, 0, 60)
  return borner(30 + experience - litiges, 0, 100)
}

export function comparerOffres(
  offres: OffreAComparer[],
  budgetEstime: number | null
): ResultatComparaison {
  const retenues = offres.filter((o) => o.statut !== "ECARTEE")
  const base = retenues.length > 0 ? retenues : offres

  if (base.length === 0) {
    return {
      offres: [],
      recommandee: null,
      moinsDisante: null,
      montantMin: 0,
      montantMax: 0,
      montantMoyen: 0,
      ecartMinMax: 0,
      budgetEstime,
      economie: null,
    }
  }

  const montants = base.map((o) => o.montantHT).filter((m) => m > 0)
  const montantMin = montants.length ? Math.min(...montants) : 0
  const montantMax = montants.length ? Math.max(...montants) : 0
  const montantMoyen = montants.length
    ? arrondi(montants.reduce((s, m) => s + m, 0) / montants.length)
    : 0

  const delais = base.map((o) => o.delaiJours ?? 0).filter((d) => d > 0)
  const delaiMin = delais.length ? Math.min(...delais) : 0

  const nbLignesMax = Math.max(...base.map((o) => o.nbLignes), 0)

  const evaluees: OffreEvaluee[] = base.map((o) => {
    const scorePrix = o.montantHT > 0 && montantMin > 0 ? borner((montantMin / o.montantHT) * 100, 0, 100) : 0
    const scoreDelai =
      o.delaiJours && o.delaiJours > 0 && delaiMin > 0
        ? borner((delaiMin / o.delaiJours) * 100, 0, 100)
        : 60 // delai non communique : note neutre plutot que penalisante
    const scoreQualite = borner(((o.noteQualite || o.notation) / 5) * 100, 0, 100)
    const fiabilite = scoreFiabilite(o)
    const historique = scoreHistorique(o)

    const score = arrondi(
      (scorePrix * POIDS.prix +
        scoreDelai * POIDS.delai +
        scoreQualite * POIDS.qualite +
        fiabilite * POIDS.fiabilite +
        historique * POIDS.historique) /
        100,
      2
    )

    // Moyenne des autres offres : detecte le devis hors marche.
    const autres = base.filter((a) => a.id !== o.id && a.montantHT > 0).map((a) => a.montantHT)
    const moyenneAutres = autres.length ? autres.reduce((s, m) => s + m, 0) / autres.length : 0
    const ecartMoyenne = moyenneAutres
      ? arrondi(((o.montantHT - moyenneAutres) / moyenneAutres) * 100, 2)
      : 0

    const signaux: string[] = []
    if (!o.assuranceDecennaleValide) signaux.push("Assurance decennale non validee")
    if (!o.attestationVigilanceValide) signaux.push("Attestation de vigilance manquante")
    if (o.nbLitiges > 0) signaux.push(`${o.nbLitiges} litige(s) au compteur`)
    if (o.exclusions && o.exclusions.trim().length > 0) signaux.push("Exclusions declarees au devis")
    if (nbLignesMax > 0 && o.nbLignes > 0 && o.nbLignes < nbLignesMax)
      signaux.push(`${nbLignesMax - o.nbLignes} poste(s) non chiffre(s) par rapport a l'offre la plus complete`)
    if (!o.delaiJours) signaux.push("Delai d'execution non precise")

    const alertePrixBas = autres.length > 0 && ecartMoyenne < -25
    const alertePrixHaut = autres.length > 0 && ecartMoyenne > 25
    if (alertePrixBas) signaux.push("Prix anormalement bas : risque d'oubli ou de travaux non prevus")
    if (alertePrixHaut) signaux.push("Prix anormalement eleve par rapport aux autres offres")

    return {
      ...o,
      scorePrix: arrondi(scorePrix, 1),
      scoreDelai: arrondi(scoreDelai, 1),
      scoreQualite: arrondi(scoreQualite, 1),
      scoreFiabilite: arrondi(fiabilite, 1),
      scoreHistorique: arrondi(historique, 1),
      score,
      rang: 0,
      ecartBudget: budgetEstime ? arrondi(ratio(o.montantHT - budgetEstime, budgetEstime) * 100, 2) : null,
      ecartMoyenne,
      moinsDisante: o.montantHT === montantMin && montantMin > 0,
      alertePrixBas,
      alertePrixHaut,
      signaux,
    }
  })

  evaluees.sort((a, b) => b.score - a.score)
  evaluees.forEach((o, i) => (o.rang = i + 1))

  const recommandee = evaluees[0] ?? null
  const moinsDisante = evaluees.find((o) => o.moinsDisante) ?? null

  return {
    offres: evaluees,
    recommandee,
    moinsDisante,
    montantMin,
    montantMax,
    montantMoyen,
    ecartMinMax: montantMin > 0 ? arrondi(((montantMax - montantMin) / montantMin) * 100, 2) : 0,
    budgetEstime,
    economie: budgetEstime && recommandee ? arrondi(budgetEstime - recommandee.montantHT) : null,
  }
}

/** Phrase de recommandation affichee au-dessus du tableau comparatif. */
export function phraseRecommandation(r: ResultatComparaison): string {
  if (!r.recommandee) return "Aucune offre a comparer pour le moment."

  const o = r.recommandee
  const morceaux: string[] = [
    `Sous-traitant recommande : ${o.sousTraitant} (score ${o.score.toFixed(1)}/100).`,
  ]

  if (o.moinsDisante) {
    morceaux.push("C'est egalement l'offre la moins-disante.")
  } else if (r.moinsDisante) {
    const surcout = o.montantHT - r.moinsDisante.montantHT
    morceaux.push(
      `Elle n'est pas la moins chere (+${surcout.toLocaleString("fr-FR", {
        maximumFractionDigits: 0,
      })} € par rapport a ${r.moinsDisante.sousTraitant}) mais offre le meilleur compromis cout / delai / fiabilite.`
    )
  }

  if (r.economie !== null && r.economie > 0) {
    morceaux.push(
      `Retenir cette offre degage ${r.economie.toLocaleString("fr-FR", {
        maximumFractionDigits: 0,
      })} € d'economie sur le budget estime.`
    )
  } else if (r.economie !== null && r.economie < 0) {
    morceaux.push(
      `Attention : ${Math.abs(r.economie).toLocaleString("fr-FR", {
        maximumFractionDigits: 0,
      })} € au-dessus du budget estime.`
    )
  }

  return morceaux.join(" ")
}

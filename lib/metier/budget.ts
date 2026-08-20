import { arrondi, ratio } from "@/lib/utils"

/**
 * Controle de gestion d'un projet.
 *
 * Chaine de lecture imposee par le cahier des charges :
 *   Budget -> Engage -> Realise -> Prevision finale (atterrissage)
 *
 * Definitions retenues :
 *  - **engage**   : marches signes et commandes fermes (l'argent est promis)
 *  - **realise**  : depenses effectives et factures validees (l'argent est parti)
 *  - **atterrissage** : engage + ce qu'il reste a engager pour finir le projet
 */

export type LigneBudget = {
  lotId: string | null
  code: string
  nom: string
  /** Budget issu du chiffrage retenu */
  budget: number
  engage: number
  realise: number
}

export type SyntheseBudget = {
  budgetInitial: number
  /** budgetInitial + avenants acceptes cote cout */
  budgetActualise: number
  avenantsCout: number
  avenantsVente: number

  engage: number
  realise: number
  resteAEngager: number
  /** Cout final estime */
  atterrissage: number

  prixVente: number
  prixVenteActualise: number

  margePrevisionnelle: number
  tauxMargePrevisionnelle: number
  margeInitiale: number
  tauxMargeInitiale: number

  /** budgetActualise - atterrissage : negatif = derive */
  ecart: number
  tauxEcart: number

  /** realise / atterrissage */
  avancementFinancier: number
  /** Taux de consommation du budget par les engagements */
  tauxEngagement: number

  enDerive: boolean
}

export type LigneBudgetCalculee = LigneBudget & {
  resteAEngager: number
  atterrissage: number
  ecart: number
  tauxConsommation: number
  enDepassement: boolean
}

export type EntreesBudget = {
  budgetInitial: number
  prixVente: number
  avenantsCout: number
  avenantsVente: number
  engage: number
  realise: number
  /** Seuil de tolerance avant alerte de derive, en % (defaut 2) */
  seuilDerive?: number
}

export function calculerBudget(e: EntreesBudget): SyntheseBudget {
  const seuil = e.seuilDerive ?? 2

  const budgetActualise = arrondi(e.budgetInitial + e.avenantsCout)
  const prixVenteActualise = arrondi(e.prixVente + e.avenantsVente)

  const engage = arrondi(e.engage)
  const realise = arrondi(e.realise)

  // Ce qui n'est pas encore engage reste a engager, dans la limite du budget.
  // Si les engagements depassent deja le budget, le reste a engager tombe a 0
  // et l'atterrissage suit les engagements : une derive deja consommee n'est
  // jamais masquee. Le realise sert de plancher (on ne peut pas atterrir en
  // dessous de ce qui a deja ete depense).
  const resteAEngager = arrondi(Math.max(0, budgetActualise - engage))
  const atterrissage = arrondi(Math.max(engage + resteAEngager, realise))

  const margePrevisionnelle = arrondi(prixVenteActualise - atterrissage)
  const margeInitiale = arrondi(e.prixVente - e.budgetInitial)

  const ecart = arrondi(budgetActualise - atterrissage)

  return {
    budgetInitial: arrondi(e.budgetInitial),
    budgetActualise,
    avenantsCout: arrondi(e.avenantsCout),
    avenantsVente: arrondi(e.avenantsVente),
    engage,
    realise,
    resteAEngager,
    atterrissage,
    prixVente: arrondi(e.prixVente),
    prixVenteActualise,
    margePrevisionnelle,
    tauxMargePrevisionnelle: arrondi(ratio(margePrevisionnelle, prixVenteActualise) * 100, 2),
    margeInitiale,
    tauxMargeInitiale: arrondi(ratio(margeInitiale, e.prixVente) * 100, 2),
    ecart,
    tauxEcart: arrondi(ratio(ecart, budgetActualise) * 100, 2),
    avancementFinancier: arrondi(ratio(realise, atterrissage) * 100, 2),
    tauxEngagement: arrondi(ratio(engage, budgetActualise) * 100, 2),
    enDerive: atterrissage > budgetActualise * (1 + seuil / 100),
  }
}

export function calculerLignesBudget(lignes: LigneBudget[]): LigneBudgetCalculee[] {
  return lignes
    .map((l) => {
      const resteAEngager = arrondi(Math.max(0, l.budget - l.engage))
      const atterrissage = arrondi(l.engage + resteAEngager)
      const ecart = arrondi(l.budget - atterrissage)
      return {
        ...l,
        budget: arrondi(l.budget),
        engage: arrondi(l.engage),
        realise: arrondi(l.realise),
        resteAEngager,
        atterrissage,
        ecart,
        tauxConsommation: arrondi(ratio(l.engage, l.budget) * 100, 2),
        enDepassement: l.engage > l.budget,
      }
    })
    .sort((a, b) => a.ecart - b.ecart)
}

/**
 * Avancement physique du projet : moyenne des avancements de taches ponderee
 * par le budget du lot auquel elles se rattachent (regle R5). Une tache sans
 * lot compte pour un poids unitaire.
 */
export function avancementPhysique(
  taches: { lotId: string | null; avancement: number }[],
  budgetParLot: Map<string, number>
): number {
  if (taches.length === 0) return 0
  let numerateur = 0
  let denominateur = 0
  for (const t of taches) {
    const poids = (t.lotId ? budgetParLot.get(t.lotId) : undefined) ?? 1
    numerateur += t.avancement * poids
    denominateur += poids
  }
  return arrondi(ratio(numerateur, denominateur), 2)
}

/**
 * Calcul d'une situation de travaux (regle R7).
 */
export type EntreesSituation = {
  marcheInitial: number
  avenants: number
  cumulPrecedent: number
  avancementCumule: number
  tauxRetenueGarantie: number
}

export type ResultatSituation = {
  marcheActualise: number
  cumulPrecedent: number
  montantCumule: number
  montantSituation: number
  retenueGarantie: number
  netAPayer: number
  resteAFacturer: number
}

export function calculerSituation(e: EntreesSituation): ResultatSituation {
  const marcheActualise = arrondi(e.marcheInitial + e.avenants)
  const montantCumule = arrondi(marcheActualise * (e.avancementCumule / 100))
  const montantSituation = arrondi(montantCumule - e.cumulPrecedent)
  const retenueGarantie = arrondi(Math.max(0, montantSituation) * (e.tauxRetenueGarantie / 100))

  return {
    marcheActualise,
    cumulPrecedent: arrondi(e.cumulPrecedent),
    montantCumule,
    montantSituation,
    retenueGarantie,
    netAPayer: arrondi(montantSituation - retenueGarantie),
    resteAFacturer: arrondi(marcheActualise - montantCumule),
  }
}

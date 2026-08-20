import { arrondi, ratio } from "@/lib/utils"

/**
 * Moteur de chiffrage.
 *
 * Le chiffrage produit deux montants distincts, volontairement separes :
 *  - le **montant du chiffrage** = somme des postes (quantite x prix unitaire),
 *    c'est ce que l'on propose au client ;
 *  - le **prix de vente cible** = cout de revient ramene a la marge cible.
 * L'ecart entre les deux est l'indicateur d'arbitrage du chargé d'etudes :
 * il dit si le chiffrage tient la marge visee.
 */

export type PosteChiffrage = {
  id: string
  lotId: string
  designation: string
  unite: string
  quantite: number
  prixUnitaire: number
  coutMateriaux: number
  coutMainOeuvre: number
  coutSousTraitance: number
  coutMateriel: number
  coutTransport: number
}

export type LotChiffrage = {
  id: string
  code: string
  nom: string
  categorie: string
  sousTraite: boolean
}

export type ParametresEconomiques = {
  /** Marge cible en % du prix de vente (usage BTP) */
  margeCible: number
  /** Frais de chantier en % du cout direct */
  tauxFraisChantier: number
  /** Frais generaux en % du cout direct majore des frais de chantier */
  tauxFraisGeneraux: number
  tauxTva: number
}

export type TotauxPoste = {
  totalHT: number
  coutDirect: number
  marge: number
  tauxMarge: number
}

export type TotauxLot = {
  lotId: string
  code: string
  nom: string
  categorie: string
  sousTraite: boolean
  nbPostes: number
  montantHT: number
  coutDirect: number
  marge: number
  tauxMarge: number
  /** Part du lot dans le montant total du chiffrage (%) */
  part: number
}

export type ResultatChiffrage = {
  nbLots: number
  nbPostes: number

  // Ventilation du cout de revient
  coutMateriaux: number
  coutMainOeuvre: number
  coutSousTraitance: number
  coutMateriel: number
  coutTransport: number
  coutDirect: number
  fraisChantier: number
  fraisGeneraux: number
  coutRevient: number

  /** Somme des postes : prix de vente propose */
  montantHT: number
  margeEuros: number
  margeTaux: number

  /** Prix de vente qui atteindrait exactement la marge cible */
  prixVenteCible: number
  /** montantHT - prixVenteCible : negatif = chiffrage sous la cible */
  ecartCible: number

  tva: number
  montantTTC: number

  lots: TotauxLot[]
}

/** Coefficient applique aux prix de reference selon le scenario retenu. */
export const COEFFICIENTS_SCENARIO: Record<string, number> = {
  ECONOMIQUE: 0.85,
  STANDARD: 1,
  PREMIUM: 1.25,
}

export const LIBELLES_SCENARIO: Record<string, string> = {
  ECONOMIQUE: "Economique",
  STANDARD: "Standard",
  PREMIUM: "Premium",
}

/**
 * Cout de revient direct d'un poste.
 * Si la ventilation n'a pas ete saisie, on retombe sur une estimation deduite
 * du prix unitaire et de la marge cible, pour ne jamais renvoyer un cout nul
 * qui ferait apparaitre une marge de 100 %.
 */
export function coutDirectPoste(poste: PosteChiffrage, margeCible: number): number {
  const unitaire =
    poste.coutMateriaux +
    poste.coutMainOeuvre +
    poste.coutSousTraitance +
    poste.coutMateriel +
    poste.coutTransport

  if (unitaire > 0) return arrondi(poste.quantite * unitaire)

  const coefficient = 1 - Math.min(Math.max(margeCible, 0), 90) / 100
  return arrondi(poste.quantite * poste.prixUnitaire * coefficient)
}

export function totauxPoste(poste: PosteChiffrage, margeCible: number): TotauxPoste {
  const totalHT = arrondi(poste.quantite * poste.prixUnitaire)
  const coutDirect = coutDirectPoste(poste, margeCible)
  const marge = arrondi(totalHT - coutDirect)
  return { totalHT, coutDirect, marge, tauxMarge: arrondi(ratio(marge, totalHT) * 100, 2) }
}

/**
 * Calcul complet d'un chiffrage.
 *
 * Enchainement (regle R2) :
 *   coutDirect    = somme des couts directs des postes
 *   fraisChantier = coutDirect x tauxFraisChantier
 *   fraisGeneraux = (coutDirect + fraisChantier) x tauxFraisGeneraux
 *   coutRevient   = coutDirect + fraisChantier + fraisGeneraux
 *   prixCible     = coutRevient / (1 - margeCible)
 */
export function calculerChiffrage(
  lots: LotChiffrage[],
  postes: PosteChiffrage[],
  params: ParametresEconomiques
): ResultatChiffrage {
  const { margeCible, tauxFraisChantier, tauxFraisGeneraux, tauxTva } = params

  let coutMateriaux = 0
  let coutMainOeuvre = 0
  let coutSousTraitance = 0
  let coutMateriel = 0
  let coutTransport = 0
  let coutDirect = 0
  let montantHT = 0

  for (const poste of postes) {
    coutMateriaux += poste.quantite * poste.coutMateriaux
    coutMainOeuvre += poste.quantite * poste.coutMainOeuvre
    coutSousTraitance += poste.quantite * poste.coutSousTraitance
    coutMateriel += poste.quantite * poste.coutMateriel
    coutTransport += poste.quantite * poste.coutTransport
    coutDirect += coutDirectPoste(poste, margeCible)
    montantHT += poste.quantite * poste.prixUnitaire
  }

  coutDirect = arrondi(coutDirect)
  montantHT = arrondi(montantHT)

  const fraisChantier = arrondi(coutDirect * (tauxFraisChantier / 100))
  const fraisGeneraux = arrondi((coutDirect + fraisChantier) * (tauxFraisGeneraux / 100))
  const coutRevient = arrondi(coutDirect + fraisChantier + fraisGeneraux)

  const diviseur = 1 - Math.min(Math.max(margeCible, 0), 90) / 100
  const prixVenteCible = arrondi(diviseur > 0 ? coutRevient / diviseur : coutRevient)

  const margeEuros = arrondi(montantHT - coutRevient)
  const margeTaux = arrondi(ratio(margeEuros, montantHT) * 100, 2)

  const tva = arrondi(montantHT * (tauxTva / 100))

  const lotsCalcules: TotauxLot[] = lots
    .map((lot) => {
      const postesLot = postes.filter((p) => p.lotId === lot.id)
      const montantLot = arrondi(postesLot.reduce((s, p) => s + p.quantite * p.prixUnitaire, 0))
      const coutLot = arrondi(
        postesLot.reduce((s, p) => s + coutDirectPoste(p, margeCible), 0)
      )
      const margeLot = arrondi(montantLot - coutLot)
      return {
        lotId: lot.id,
        code: lot.code,
        nom: lot.nom,
        categorie: lot.categorie,
        sousTraite: lot.sousTraite,
        nbPostes: postesLot.length,
        montantHT: montantLot,
        coutDirect: coutLot,
        marge: margeLot,
        tauxMarge: arrondi(ratio(margeLot, montantLot) * 100, 2),
        part: arrondi(ratio(montantLot, montantHT) * 100, 2),
      }
    })
    .sort((a, b) => b.montantHT - a.montantHT)

  return {
    nbLots: lots.length,
    nbPostes: postes.length,
    coutMateriaux: arrondi(coutMateriaux),
    coutMainOeuvre: arrondi(coutMainOeuvre),
    coutSousTraitance: arrondi(coutSousTraitance),
    coutMateriel: arrondi(coutMateriel),
    coutTransport: arrondi(coutTransport),
    coutDirect,
    fraisChantier,
    fraisGeneraux,
    coutRevient,
    montantHT,
    margeEuros,
    margeTaux,
    prixVenteCible,
    ecartCible: arrondi(montantHT - prixVenteCible),
    tva,
    montantTTC: arrondi(montantHT + tva),
    lots: lotsCalcules,
  }
}

/**
 * Prix de vente unitaire deduit d'un cout direct unitaire.
 *
 * Le cout direct ne suffit pas : les frais de chantier puis les frais generaux
 * s'ajoutent par-dessus avant que la marge ne se calcule (regle R2). Appliquer
 * la marge au seul cout direct produirait un chiffrage systematiquement sous la
 * cible — l'erreur classique du chiffrage au coefficient.
 *
 *   coutRevientUnitaire = coutDirect × (1 + fraisChantier) × (1 + fraisGeneraux)
 *   prixUnitaire        = coutRevientUnitaire / (1 − margeCible)
 *
 * Somme sur tous les postes, cela redonne exactement
 * `montantHT = coutRevient / (1 − margeCible)`, donc une marge egale a la cible.
 */
export function prixDepuisCout(coutUnitaire: number, params: ParametresEconomiques): number {
  const coutRevientUnitaire =
    coutUnitaire *
    (1 + params.tauxFraisChantier / 100) *
    (1 + params.tauxFraisGeneraux / 100)

  const diviseur = 1 - Math.min(Math.max(params.margeCible, 0), 90) / 100
  return arrondi(diviseur > 0 ? coutRevientUnitaire / diviseur : coutRevientUnitaire)
}

/** Ventilation par defaut d'un cout direct selon la nature du lot. */
export function ventilerCout(
  coutUnitaire: number,
  sousTraite: boolean
): Pick<
  PosteChiffrage,
  "coutMateriaux" | "coutMainOeuvre" | "coutSousTraitance" | "coutMateriel" | "coutTransport"
> {
  if (sousTraite) {
    return {
      coutMateriaux: 0,
      coutMainOeuvre: 0,
      coutSousTraitance: arrondi(coutUnitaire),
      coutMateriel: 0,
      coutTransport: 0,
    }
  }
  return {
    coutMateriaux: arrondi(coutUnitaire * 0.45),
    coutMainOeuvre: arrondi(coutUnitaire * 0.4),
    coutSousTraitance: 0,
    coutMateriel: arrondi(coutUnitaire * 0.1),
    coutTransport: arrondi(coutUnitaire * 0.05),
  }
}

import { ajouterJoursOuvres, arrondi, joursEntre } from "@/lib/utils"
import {
  CATALOGUE_PAR_CODE,
  DUREES_LOT,
  TRAMES,
  type LotTrame,
  type PosteReference,
} from "./referentiel"
import { calculerChiffrage, prixDepuisCout, ventilerCout, type ParametresEconomiques } from "./chiffrage"

/**
 * Generateur « Lancer le projet ».
 *
 * A partir du type d'operation et de la surface, il produit une proposition
 * complete : lots, postes, quantites au ratio, prix issus de la bibliotheque,
 * budget, marge cible, lots a sous-traiter et planning previsionnel.
 * Rien n'est enregistre : la proposition est soumise a validation.
 */

export type PostePropose = {
  code: string
  designation: string
  categorie: string
  unite: string
  quantite: number
  prixUnitaire: number
  coutUnitaire: number
  coutMateriaux: number
  coutMainOeuvre: number
  coutSousTraitance: number
  coutMateriel: number
  coutTransport: number
  totalHT: number
  /** true si le prix vient de la bibliotheque de l'organisation */
  prixHistorique: boolean
}

export type LotPropose = {
  code: string
  nom: string
  categorie: string
  sousTraite: boolean
  descriptif: string
  postes: PostePropose[]
  montantHT: number
  coutDirect: number
  dureeJours: number
}

export type TachePropose = {
  lotCode: string
  nom: string
  dateDebut: Date
  dateFin: Date
  dureeJours: number
  ordre: number
  /** Code du lot precedent : cree une dependance debut -> debut */
  precedentCode: string | null
  /** Nombre de jours entre le debut du lot precedent et celui-ci */
  decalageDebutJours: number
}

export type PropositionProjet = {
  lots: LotPropose[]
  taches: TachePropose[]
  montantHT: number
  coutDirect: number
  coutRevient: number
  margeEuros: number
  margeTaux: number
  prixVenteCible: number
  budget: number
  dureeTotaleJours: number
  dateFinPrevue: Date
  lotsASousTraiter: string[]
  ratioAuM2: number
}

/** Prix connus de l'organisation, indexes par code de poste. */
export type PrixOrganisation = Map<string, { prix: number; cout: number }>

function quantite(surface: number, poste: { ratio: number; minimum?: number; entier?: boolean }): number {
  let q = surface * poste.ratio
  if (poste.minimum !== undefined) q = Math.max(q, poste.minimum)
  if (poste.entier) q = Math.max(poste.minimum ?? 1, Math.ceil(q))
  return arrondi(q, 3)
}

function construireLot(
  trame: LotTrame,
  surface: number,
  prixOrg: PrixOrganisation,
  params: ParametresEconomiques
): LotPropose {
  const postes: PostePropose[] = []

  for (const posteTrame of trame.postes) {
    const ref: PosteReference | undefined = CATALOGUE_PAR_CODE.get(posteTrame.code)
    if (!ref) continue

    const q = quantite(surface, posteTrame)
    if (q <= 0) continue

    // La bibliotheque fournit le **cout** (constate sur vos chantiers), jamais
    // le prix de vente : celui-ci se deduit toujours de la marge cible du
    // projet, frais compris. Le chiffrage genere tient donc la marge des le
    // depart, quel que soit le prix catalogue du poste.
    const connu = prixOrg.get(posteTrame.code)
    const coutUnitaire = connu?.cout ?? ref.cout
    const prixUnitaire = prixDepuisCout(coutUnitaire, params)

    postes.push({
      code: ref.code,
      designation: ref.designation,
      categorie: ref.categorie,
      unite: ref.unite,
      quantite: q,
      prixUnitaire,
      coutUnitaire,
      ...ventilerCout(coutUnitaire, trame.sousTraite),
      totalHT: arrondi(q * prixUnitaire),
      prixHistorique: connu !== undefined,
    })
  }

  const montantHT = arrondi(postes.reduce((s, p) => s + p.totalHT, 0))
  const coutDirect = arrondi(postes.reduce((s, p) => s + p.quantite * p.coutUnitaire, 0))

  // Duree : la reference vaut pour 100 m². Elle ne croit pas lineairement avec
  // la surface — sur un chantier plus grand on met plus d'equipes en parallele.
  // L'exposant 0,6 traduit ce rendement d'echelle : 1 200 m² demandent environ
  // 4,4 fois la duree de 100 m², et non 12 fois.
  const base = DUREES_LOT[trame.categorie] ?? 5
  const facteurEchelle = Math.pow(Math.max(surface, 1) / 100, 0.6)
  const dureeJours = Math.max(3, Math.round(base * facteurEchelle))

  return {
    code: trame.code,
    nom: trame.nom,
    categorie: trame.categorie,
    sousTraite: trame.sousTraite,
    descriptif: trame.descriptif,
    postes,
    montantHT,
    coutDirect,
    dureeJours,
  }
}

/**
 * Planning previsionnel : les lots s'enchainent dans l'ordre de la trame, avec
 * un recouvrement de 30 % entre lots consecutifs (les corps d'etat ne
 * travaillent jamais strictement l'un apres l'autre sur un chantier reel).
 *
 * Le lien genere est donc **debut -> debut avec decalage**, et non fin -> debut :
 * un enchainement fin -> debut serait viole par le recouvrement lui-meme et
 * ferait remonter un conflit sur chaque tache, noyant les vrais conflits.
 */
function construirePlanning(lots: LotPropose[], dateDebut: Date): TachePropose[] {
  const taches: TachePropose[] = []
  let curseur = new Date(dateDebut)
  let precedentCode: string | null = null
  let debutPrecedent: Date | null = null

  lots.forEach((lot, index) => {
    const debut = new Date(curseur)
    const fin = ajouterJoursOuvres(debut, lot.dureeJours)

    taches.push({
      lotCode: lot.code,
      nom: lot.nom,
      dateDebut: debut,
      dateFin: fin,
      dureeJours: lot.dureeJours,
      ordre: index,
      precedentCode,
      decalageDebutJours: debutPrecedent ? joursEntre(debutPrecedent, debut) : 0,
    })

    precedentCode = lot.code
    debutPrecedent = debut
    const recouvrement = Math.floor(lot.dureeJours * 0.3)
    curseur = ajouterJoursOuvres(debut, Math.max(1, lot.dureeJours - recouvrement))
  })

  return taches
}

export function genererProjet(options: {
  typeOperation: string
  surface: number
  params: ParametresEconomiques
  prixOrganisation?: PrixOrganisation
  dateDebut?: Date
  /** Codes de lots a exclure de la proposition */
  lotsExclus?: string[]
}): PropositionProjet {
  const surface = Math.max(1, options.surface)
  const prixOrg = options.prixOrganisation ?? new Map()
  const dateDebut = options.dateDebut ?? new Date()
  const exclus = new Set(options.lotsExclus ?? [])

  const trames = (TRAMES[options.typeOperation] ?? TRAMES.RENOVATION_LOURDE).filter(
    (t) => !exclus.has(t.code)
  )

  const lots = trames
    .map((t) => construireLot(t, surface, prixOrg, options.params))
    .filter((l) => l.postes.length > 0)

  const taches = construirePlanning(lots, dateDebut)

  // On reutilise le moteur de chiffrage pour ne pas dupliquer la formule.
  const chiffrage = calculerChiffrage(
    lots.map((l) => ({
      id: l.code,
      code: l.code,
      nom: l.nom,
      categorie: l.categorie,
      sousTraite: l.sousTraite,
    })),
    lots.flatMap((l) =>
      l.postes.map((p, i) => ({
        id: `${l.code}-${i}`,
        lotId: l.code,
        designation: p.designation,
        unite: p.unite,
        quantite: p.quantite,
        prixUnitaire: p.prixUnitaire,
        coutMateriaux: p.coutMateriaux,
        coutMainOeuvre: p.coutMainOeuvre,
        coutSousTraitance: p.coutSousTraitance,
        coutMateriel: p.coutMateriel,
        coutTransport: p.coutTransport,
      }))
    ),
    options.params
  )

  const dateFinPrevue = taches.length
    ? new Date(Math.max(...taches.map((t) => t.dateFin.getTime())))
    : dateDebut

  return {
    lots,
    taches,
    montantHT: chiffrage.montantHT,
    coutDirect: chiffrage.coutDirect,
    coutRevient: chiffrage.coutRevient,
    margeEuros: chiffrage.margeEuros,
    margeTaux: chiffrage.margeTaux,
    prixVenteCible: chiffrage.prixVenteCible,
    budget: chiffrage.coutRevient,
    dureeTotaleJours: Math.round(
      (dateFinPrevue.getTime() - dateDebut.getTime()) / 86_400_000
    ),
    dateFinPrevue,
    lotsASousTraiter: lots.filter((l) => l.sousTraite).map((l) => l.code),
    ratioAuM2: arrondi(chiffrage.montantHT / surface, 2),
  }
}

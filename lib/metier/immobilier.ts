import { arrondi, ratio } from "@/lib/utils"

/**
 * Conseil immobilier : analyse economique d'une operation (regle R9).
 * Deux scenarios de sortie sont calcules en parallele : revente et location.
 */

export type EntreesOperation = {
  prixAcquisition: number
  fraisAcquisition: number
  montantTravaux: number
  fraisDivers: number

  apport: number
  montantEmprunt: number
  tauxCredit: number
  dureeCreditAnnees: number

  valeurApresTravaux: number
  fraisRevente: number
  loyerMensuel: number
  chargesAnnuelles: number
  tauxImposition: number
}

export type ResultatOperation = {
  coutTravauxEtAcquisition: number
  fraisFinanciers: number
  coutGlobal: number

  mensualite: number
  annuite: number
  coutTotalCredit: number

  // Scenario revente
  margeRevente: number
  tauxMargeRevente: number
  roiRevente: number
  plusValueNette: number

  // Scenario location
  loyerAnnuel: number
  rendementBrut: number
  rendementNet: number
  cashFlowAnnuel: number
  cashFlowMensuel: number
  resultatFiscal: number
  cashFlowNetImpot: number

  /** Nombre d'annees pour recuperer l'apport via le cash-flow */
  retourSurApportAnnees: number | null
  scenarioRecommande: "REVENTE" | "LOCATION" | "AUCUN"
  commentaire: string
}

/** Mensualite d'un pret amortissable a taux fixe. */
export function mensualiteCredit(capital: number, tauxAnnuel: number, annees: number): number {
  if (capital <= 0 || annees <= 0) return 0
  const n = annees * 12
  const i = tauxAnnuel / 100 / 12
  if (i === 0) return arrondi(capital / n)
  return arrondi((capital * i) / (1 - Math.pow(1 + i, -n)))
}

export function analyserOperation(e: EntreesOperation): ResultatOperation {
  const coutTravauxEtAcquisition = arrondi(
    e.prixAcquisition + e.fraisAcquisition + e.montantTravaux + e.fraisDivers
  )

  const mensualite = mensualiteCredit(e.montantEmprunt, e.tauxCredit, e.dureeCreditAnnees)
  const annuite = arrondi(mensualite * 12)
  const coutTotalCredit = arrondi(mensualite * e.dureeCreditAnnees * 12 - e.montantEmprunt)

  // Frais financiers imputes a l'operation : interets sur la duree de portage
  // (18 mois par defaut pour une operation de renovation-revente).
  const dureePortageMois = 18
  const fraisFinanciers = arrondi(
    e.montantEmprunt * (e.tauxCredit / 100) * (dureePortageMois / 12)
  )

  const coutGlobal = arrondi(coutTravauxEtAcquisition + fraisFinanciers)

  // ─── Scenario revente ───────────────────────────────────────────────────
  const margeRevente = arrondi(e.valeurApresTravaux - coutGlobal - e.fraisRevente)
  const tauxMargeRevente = arrondi(ratio(margeRevente, e.valeurApresTravaux) * 100, 2)
  const plusValueNette = arrondi(margeRevente * (1 - e.tauxImposition / 100))
  const roiRevente = arrondi(ratio(margeRevente, e.apport > 0 ? e.apport : coutGlobal) * 100, 2)

  // ─── Scenario location ──────────────────────────────────────────────────
  const loyerAnnuel = arrondi(e.loyerMensuel * 12)
  const rendementBrut = arrondi(ratio(loyerAnnuel, coutGlobal) * 100, 2)
  const revenuNet = arrondi(loyerAnnuel - e.chargesAnnuelles)
  const rendementNet = arrondi(ratio(revenuNet, coutGlobal) * 100, 2)
  const cashFlowAnnuel = arrondi(revenuNet - annuite)
  const resultatFiscal = arrondi(Math.max(0, revenuNet) * (e.tauxImposition / 100))
  const cashFlowNetImpot = arrondi(cashFlowAnnuel - resultatFiscal)

  const retourSurApportAnnees =
    cashFlowNetImpot > 0 && e.apport > 0 ? arrondi(e.apport / cashFlowNetImpot, 1) : null

  // ─── Arbitrage ──────────────────────────────────────────────────────────
  let scenarioRecommande: ResultatOperation["scenarioRecommande"] = "AUCUN"
  let commentaire =
    "Les donnees saisies ne permettent pas encore de departager les deux scenarios."

  const reventePertinente = e.valeurApresTravaux > 0
  const locationPertinente = loyerAnnuel > 0

  if (reventePertinente && !locationPertinente) {
    scenarioRecommande = margeRevente > 0 ? "REVENTE" : "AUCUN"
    commentaire =
      margeRevente > 0
        ? `La revente degage ${fmt(margeRevente)} € de marge, soit ${tauxMargeRevente} % du prix de vente.`
        : `L'operation est deficitaire de ${fmt(Math.abs(margeRevente))} € a la revente : revoir le prix d'acquisition ou le montant des travaux.`
  } else if (locationPertinente && !reventePertinente) {
    scenarioRecommande = cashFlowNetImpot >= 0 ? "LOCATION" : "AUCUN"
    commentaire = `Rendement net de ${rendementNet} % pour un cash-flow de ${fmt(cashFlowNetImpot)} € par an apres impot.`
  } else if (reventePertinente && locationPertinente) {
    // On compare la marge immediate de revente au cumul de cash-flow sur la
    // duree du credit, augmente de la plus-value latente.
    const gainLocationHorizon = arrondi(cashFlowNetImpot * Math.min(e.dureeCreditAnnees, 10))
    if (margeRevente >= gainLocationHorizon) {
      scenarioRecommande = margeRevente > 0 ? "REVENTE" : "AUCUN"
      commentaire = `La revente rapporte ${fmt(margeRevente)} € immediatement, contre ${fmt(gainLocationHorizon)} € de cash-flow cumule sur 10 ans en location.`
    } else {
      scenarioRecommande = "LOCATION"
      commentaire = `La location rapporte ${fmt(gainLocationHorizon)} € sur 10 ans (rendement net ${rendementNet} %), contre ${fmt(margeRevente)} € de marge immediate a la revente.`
    }
  }

  return {
    coutTravauxEtAcquisition,
    fraisFinanciers,
    coutGlobal,
    mensualite,
    annuite,
    coutTotalCredit,
    margeRevente,
    tauxMargeRevente,
    roiRevente,
    plusValueNette,
    loyerAnnuel,
    rendementBrut,
    rendementNet,
    cashFlowAnnuel,
    cashFlowMensuel: arrondi(cashFlowAnnuel / 12),
    resultatFiscal,
    cashFlowNetImpot,
    retourSurApportAnnees,
    scenarioRecommande,
    commentaire,
  }
}

function fmt(v: number): string {
  return v.toLocaleString("fr-FR", { maximumFractionDigits: 0 })
}

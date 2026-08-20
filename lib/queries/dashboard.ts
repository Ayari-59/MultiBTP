// Module serveur uniquement : ne jamais importer depuis un composant client.
import { prisma } from "@/lib/prisma"
import { arrondi, nb, ratio } from "@/lib/utils"
import { genererAlertes, type Alerte } from "@/lib/metier/alertes"
import { donneesAlertes, listeProjets, type ProjetListe } from "./projets"

export type KpiDirigeant = {
  projetsActifs: number
  projetsEtude: number
  projetsEnCours: number
  projetsTermines: number

  caPrevisionnel: number
  coutsEngages: number
  coutsRealises: number
  budgetTotal: number
  atterrissageTotal: number

  margePrevisionnelle: number
  tauxMargePrevisionnelle: number
  margeCibleMoyenne: number
  ecartBudgetaire: number

  projetsEnRetard: number
  projetsEnDerive: number

  avenantsEnCours: number
  avenantsMontant: number
  facturesAValider: number
  facturesMontant: number
  situationsATraiter: number
  consultationsEnAttente: number
  offresRecues: number
  sousTraitantsActifs: number
  incidentsOuverts: number
  reservesOuvertes: number

  pipelineMontant: number
  pipelineNbAffaires: number
}

export type DonneesDashboard = {
  kpi: KpiDirigeant
  alertes: Alerte[]
  projets: ProjetListe[]
  repartitionStatuts: { statut: string; nombre: number; montant: number }[]
  evolutionMensuelle: { mois: string; engage: number; realise: number }[]
  topLotsDerive: { projet: string; projetId: string; lot: string; ecart: number }[]
}

const STATUTS_ACTIFS = ["ETUDE", "CHIFFRAGE", "CONSULTATION", "PREPARATION", "EN_COURS", "RECEPTION"]

export async function donneesDashboard(organizationId: string): Promise<DonneesDashboard> {
  const [projets, pourAlertes] = await Promise.all([
    listeProjets(organizationId),
    donneesAlertes(organizationId),
  ])

  const actifs = projets.filter((p) => STATUTS_ACTIFS.includes(p.statut))

  const [
    avenants,
    factures,
    situations,
    consultations,
    offres,
    sousTraitants,
    incidents,
    reserves,
    pipeline,
    fluxEngages,
    fluxRealises,
  ] = await Promise.all([
    prisma.changeOrder.aggregate({
      where: { project: { organizationId }, statut: { in: ["DEMANDE", "CHIFFRE"] } },
      _count: { _all: true },
      _sum: { impactCout: true },
    }),
    prisma.invoice.aggregate({
      where: { project: { organizationId }, statut: "A_VALIDER" },
      _count: { _all: true },
      _sum: { montantHT: true },
    }),
    prisma.situation.count({
      where: { project: { organizationId }, statut: { in: ["DEPOSEE", "EN_VERIFICATION"] } },
    }),
    prisma.consultation.count({
      where: { organizationId, statut: { in: ["ENVOYEE", "EN_ANALYSE"] } },
    }),
    prisma.offer.count({ where: { organizationId, statut: { in: ["RECUE", "EN_ANALYSE"] } } }),
    prisma.subcontractor.count({ where: { organizationId, actif: true } }),
    prisma.incident.count({
      where: { project: { organizationId }, statut: { in: ["OUVERT", "EN_TRAITEMENT"] } },
    }),
    prisma.reservation.count({ where: { project: { organizationId }, statut: "OUVERTE" } }),
    prisma.deal.aggregate({
      where: { organizationId, stage: { notIn: ["GAGNE", "PERDU"] } },
      _count: { _all: true },
      _sum: { montantEstime: true },
    }),
    prisma.commitment.findMany({
      where: { project: { organizationId }, statut: { not: "ANNULE" } },
      select: { date: true, montantHT: true },
    }),
    prisma.expense.findMany({
      where: { project: { organizationId } },
      select: { date: true, montantHT: true },
    }),
  ])

  const caPrevisionnel = arrondi(actifs.reduce((s, p) => s + p.montantHT, 0))
  const budgetTotal = arrondi(actifs.reduce((s, p) => s + p.budget, 0))
  const coutsEngages = arrondi(actifs.reduce((s, p) => s + p.engage, 0))
  const coutsRealises = arrondi(actifs.reduce((s, p) => s + p.realise, 0))
  const atterrissageTotal = arrondi(actifs.reduce((s, p) => s + p.atterrissage, 0))
  const margePrevisionnelle = arrondi(caPrevisionnel - atterrissageTotal)

  const margeCibleMoyenne = actifs.length
    ? arrondi(actifs.reduce((s, p) => s + p.margeCible, 0) / actifs.length, 2)
    : 0

  const kpi: KpiDirigeant = {
    projetsActifs: actifs.length,
    projetsEtude: projets.filter((p) => p.statut === "ETUDE" || p.statut === "CHIFFRAGE").length,
    projetsEnCours: projets.filter((p) => p.statut === "EN_COURS").length,
    projetsTermines: projets.filter((p) => p.statut === "TERMINE" || p.statut === "ARCHIVE").length,

    caPrevisionnel,
    coutsEngages,
    coutsRealises,
    budgetTotal,
    atterrissageTotal,

    margePrevisionnelle,
    tauxMargePrevisionnelle: arrondi(ratio(margePrevisionnelle, caPrevisionnel) * 100, 2),
    margeCibleMoyenne,
    ecartBudgetaire: arrondi(budgetTotal - atterrissageTotal),

    projetsEnRetard: pourAlertes.filter((p) => p.nbTachesEnRetard > 0).length,
    projetsEnDerive: actifs.filter((p) => p.enDerive).length,

    avenantsEnCours: avenants._count._all,
    avenantsMontant: nb(avenants._sum.impactCout),
    facturesAValider: factures._count._all,
    facturesMontant: nb(factures._sum.montantHT),
    situationsATraiter: situations,
    consultationsEnAttente: consultations,
    offresRecues: offres,
    sousTraitantsActifs: sousTraitants,
    incidentsOuverts: incidents,
    reservesOuvertes: reserves,

    pipelineMontant: nb(pipeline._sum.montantEstime),
    pipelineNbAffaires: pipeline._count._all,
  }

  // ─── Repartition par statut ───────────────────────────────────────────────
  const parStatut = new Map<string, { nombre: number; montant: number }>()
  for (const p of projets) {
    const courant = parStatut.get(p.statut) ?? { nombre: 0, montant: 0 }
    parStatut.set(p.statut, { nombre: courant.nombre + 1, montant: courant.montant + p.montantHT })
  }

  // ─── Flux mensuels sur 12 mois ────────────────────────────────────────────
  const evolutionMensuelle = fluxMensuels(fluxEngages, fluxRealises)

  // ─── Lots les plus en derive, tous projets confondus ──────────────────────
  const topLotsDerive = await lotsEnDerive(organizationId)

  return {
    kpi,
    alertes: genererAlertes(pourAlertes),
    projets,
    repartitionStatuts: [...parStatut.entries()].map(([statut, v]) => ({
      statut,
      nombre: v.nombre,
      montant: arrondi(v.montant),
    })),
    evolutionMensuelle,
    topLotsDerive,
  }
}

function fluxMensuels(
  engages: { date: Date; montantHT: unknown }[],
  realises: { date: Date; montantHT: unknown }[]
): { mois: string; engage: number; realise: number }[] {
  const mois: { cle: string; mois: string; engage: number; realise: number }[] = []
  const maintenant = new Date()

  for (let i = 11; i >= 0; i--) {
    const d = new Date(maintenant.getFullYear(), maintenant.getMonth() - i, 1)
    mois.push({
      cle: `${d.getFullYear()}-${d.getMonth()}`,
      mois: d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
      engage: 0,
      realise: 0,
    })
  }

  const index = new Map(mois.map((m, i) => [m.cle, i]))

  for (const e of engages) {
    const i = index.get(`${e.date.getFullYear()}-${e.date.getMonth()}`)
    if (i !== undefined) mois[i].engage += nb(e.montantHT)
  }
  for (const e of realises) {
    const i = index.get(`${e.date.getFullYear()}-${e.date.getMonth()}`)
    if (i !== undefined) mois[i].realise += nb(e.montantHT)
  }

  return mois.map((m) => ({ mois: m.mois, engage: arrondi(m.engage), realise: arrondi(m.realise) }))
}

async function lotsEnDerive(organizationId: string) {
  const lots = await prisma.lot.findMany({
    where: { project: { organizationId, statut: { in: STATUTS_ACTIFS as never[] } } },
    select: {
      id: true,
      code: true,
      nom: true,
      project: { select: { id: true, nom: true } },
      contracts: { select: { montantActualise: true } },
      commitments: { where: { statut: { not: "ANNULE" } }, select: { montantHT: true } },
      items: {
        select: {
          quantite: true,
          coutMateriaux: true,
          coutMainOeuvre: true,
          coutSousTraitance: true,
          coutMateriel: true,
          coutTransport: true,
        },
      },
    },
  })

  return lots
    .map((l) => {
      const budget = l.items.reduce(
        (s, i) =>
          s +
          nb(i.quantite) *
            (nb(i.coutMateriaux) +
              nb(i.coutMainOeuvre) +
              nb(i.coutSousTraitance) +
              nb(i.coutMateriel) +
              nb(i.coutTransport)),
        0
      )
      const engage = l.commitments.reduce((s, c) => s + nb(c.montantHT), 0)
      return {
        projet: l.project.nom,
        projetId: l.project.id,
        lot: `${l.code} — ${l.nom}`,
        ecart: arrondi(budget - engage),
      }
    })
    .filter((l) => l.ecart < 0)
    .sort((a, b) => a.ecart - b.ecart)
    .slice(0, 6)
}

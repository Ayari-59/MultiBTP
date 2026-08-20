// Module serveur uniquement : ne jamais importer depuis un composant client.
import { prisma } from "@/lib/prisma"
import { nb, arrondi, ratio } from "@/lib/utils"
import { calculerBudget, type SyntheseBudget, type LigneBudget } from "@/lib/metier/budget"
import { calculerChiffrage, type ResultatChiffrage } from "@/lib/metier/chiffrage"
import type { ProjetPourAlertes } from "@/lib/metier/alertes"

/**
 * Couche de lecture. Elle convertit les Decimal Prisma en nombres simples :
 * les composants client ne recoivent jamais d'objet non serialisable, et le
 * calcul metier travaille sur des primitives.
 */

export type ProjetListe = {
  id: string
  reference: string
  nom: string
  statut: string
  priorite: string
  typeOperation: string
  ville: string | null
  surface: number | null
  client: string | null
  responsable: string | null
  dateDebutPrevue: string | null
  dateFinPrevue: string | null
  avancementPhysique: number
  montantHT: number
  budget: number
  engage: number
  realise: number
  atterrissage: number
  margeTaux: number
  margeCible: number
  enDerive: boolean
  nbLots: number
}

const STATUTS_ACTIFS = ["ETUDE", "CHIFFRAGE", "CONSULTATION", "PREPARATION", "EN_COURS", "RECEPTION"]

/** Agregats economiques bruts d'un projet, avant mise en forme. */
async function agregatsProjets(projectIds: string[]) {
  if (projectIds.length === 0) {
    return {
      engagements: new Map<string, number>(),
      depenses: new Map<string, number>(),
      avenantsCout: new Map<string, number>(),
      avenantsVente: new Map<string, number>(),
    }
  }

  const [engagements, depenses, avenants] = await Promise.all([
    prisma.commitment.groupBy({
      by: ["projectId"],
      where: { projectId: { in: projectIds }, statut: { not: "ANNULE" } },
      _sum: { montantHT: true },
    }),
    prisma.expense.groupBy({
      by: ["projectId"],
      where: { projectId: { in: projectIds } },
      _sum: { montantHT: true },
    }),
    prisma.changeOrder.groupBy({
      by: ["projectId"],
      where: { projectId: { in: projectIds }, statut: "ACCEPTE" },
      _sum: { impactCout: true, impactVente: true },
    }),
  ])

  return {
    engagements: new Map(engagements.map((e) => [e.projectId, nb(e._sum.montantHT)])),
    depenses: new Map(depenses.map((e) => [e.projectId, nb(e._sum.montantHT)])),
    avenantsCout: new Map(avenants.map((e) => [e.projectId, nb(e._sum.impactCout)])),
    avenantsVente: new Map(avenants.map((e) => [e.projectId, nb(e._sum.impactVente)])),
  }
}

/**
 * Montant de vente et budget de cout issus du chiffrage retenu de chaque projet.
 * Un projet sans chiffrage retenu retombe sur son chiffrage le plus recent.
 */
async function economieDesChiffrages(projectIds: string[]) {
  const resultat = new Map<string, { montantHT: number; coutRevient: number }>()
  if (projectIds.length === 0) return resultat

  const estimates = await prisma.estimate.findMany({
    where: { projectId: { in: projectIds } },
    orderBy: [{ retenu: "desc" }, { updatedAt: "desc" }],
    include: {
      project: {
        select: { margeCible: true, tauxFraisChantier: true, tauxFraisGeneraux: true, tauxTva: true },
      },
      items: {
        include: { lot: { select: { id: true, code: true, nom: true, categorie: true, sousTraite: true } } },
      },
    },
  })

  for (const estimate of estimates) {
    if (resultat.has(estimate.projectId)) continue // le premier est le retenu

    const lots = [...new Map(estimate.items.map((i) => [i.lot.id, i.lot])).values()]
    const chiffrage = calculerChiffrage(
      lots.map((l) => ({
        id: l.id,
        code: l.code,
        nom: l.nom,
        categorie: l.categorie,
        sousTraite: l.sousTraite,
      })),
      estimate.items.map((i) => ({
        id: i.id,
        lotId: i.lotId,
        designation: i.designation,
        unite: i.unite,
        quantite: nb(i.quantite),
        prixUnitaire: nb(i.prixUnitaire),
        coutMateriaux: nb(i.coutMateriaux),
        coutMainOeuvre: nb(i.coutMainOeuvre),
        coutSousTraitance: nb(i.coutSousTraitance),
        coutMateriel: nb(i.coutMateriel),
        coutTransport: nb(i.coutTransport),
      })),
      {
        margeCible: nb(estimate.project.margeCible),
        tauxFraisChantier: nb(estimate.project.tauxFraisChantier),
        tauxFraisGeneraux: nb(estimate.project.tauxFraisGeneraux),
        tauxTva: nb(estimate.project.tauxTva),
      }
    )

    resultat.set(estimate.projectId, {
      montantHT: chiffrage.montantHT,
      coutRevient: chiffrage.coutRevient,
    })
  }

  return resultat
}

export async function listeProjets(
  organizationId: string,
  filtres?: { statut?: string; recherche?: string; actifs?: boolean }
): Promise<ProjetListe[]> {
  const projets = await prisma.project.findMany({
    where: {
      organizationId,
      ...(filtres?.statut ? { statut: filtres.statut as never } : {}),
      ...(filtres?.actifs ? { statut: { in: STATUTS_ACTIFS as never[] } } : {}),
      ...(filtres?.recherche
        ? {
            OR: [
              { nom: { contains: filtres.recherche, mode: "insensitive" as const } },
              { reference: { contains: filtres.recherche, mode: "insensitive" as const } },
              { ville: { contains: filtres.recherche, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    include: {
      contact: { select: { nom: true, prenom: true, societe: true } },
      responsable: { select: { name: true } },
      _count: { select: { lots: true } },
    },
    orderBy: [{ statut: "asc" }, { updatedAt: "desc" }],
  })

  const ids = projets.map((p) => p.id)
  const [agregats, chiffrages] = await Promise.all([agregatsProjets(ids), economieDesChiffrages(ids)])

  return projets.map((p) => {
    const chiffrage = chiffrages.get(p.id)
    const budget = calculerBudget({
      budgetInitial: nb(p.budgetInitial, chiffrage?.coutRevient ?? 0),
      prixVente: nb(p.prixVenteHT, chiffrage?.montantHT ?? 0),
      avenantsCout: agregats.avenantsCout.get(p.id) ?? 0,
      avenantsVente: agregats.avenantsVente.get(p.id) ?? 0,
      engage: agregats.engagements.get(p.id) ?? 0,
      realise: agregats.depenses.get(p.id) ?? 0,
    })

    return {
      id: p.id,
      reference: p.reference,
      nom: p.nom,
      statut: p.statut,
      priorite: p.priorite,
      typeOperation: p.typeOperation,
      ville: p.ville,
      surface: p.surface ? nb(p.surface) : null,
      client: p.contact
        ? p.contact.societe || `${p.contact.prenom ?? ""} ${p.contact.nom}`.trim()
        : null,
      responsable: p.responsable?.name ?? null,
      dateDebutPrevue: p.dateDebutPrevue?.toISOString() ?? null,
      dateFinPrevue: p.dateFinPrevue?.toISOString() ?? null,
      avancementPhysique: nb(p.avancementPhysique),
      montantHT: budget.prixVenteActualise,
      budget: budget.budgetActualise,
      engage: budget.engage,
      realise: budget.realise,
      atterrissage: budget.atterrissage,
      margeTaux: budget.tauxMargePrevisionnelle,
      margeCible: nb(p.margeCible),
      enDerive: budget.enDerive,
      nbLots: p._count.lots,
    }
  })
}

// ═══════════════════════════════════════════════════════════════════════════
//  FICHE PROJET
// ═══════════════════════════════════════════════════════════════════════════

export type FicheProjet = {
  id: string
  reference: string
  nom: string
  statut: string
  priorite: string
  typeOperation: string
  adresse: string | null
  codePostal: string | null
  ville: string | null
  surface: number | null
  description: string | null
  contraintes: string | null
  dateDebutPrevue: string | null
  dateFinPrevue: string | null
  dateDebutReelle: string | null
  dateFinReelle: string | null
  dateReception: string | null
  margeCible: number
  tauxFraisChantier: number
  tauxFraisGeneraux: number
  tauxTva: number
  avancementPhysique: number
  client: { id: string; nom: string; email: string | null; telephone: string | null } | null
  bien: { id: string; nom: string; type: string; adresse: string; ville: string } | null
  responsable: { id: string; nom: string } | null
  compteurs: {
    lots: number
    consultations: number
    marches: number
    documents: number
    incidents: number
    reserves: number
    taches: number
    avenants: number
    situations: number
  }
}

export async function ficheProjet(
  projectId: string,
  organizationId: string
): Promise<FicheProjet | null> {
  const p = await prisma.project.findFirst({
    where: { id: projectId, organizationId },
    include: {
      contact: true,
      property: true,
      responsable: { select: { id: true, name: true } },
      _count: {
        select: {
          lots: true,
          consultations: true,
          contracts: true,
          documents: true,
          incidents: true,
          reservations: true,
          tasks: true,
          changeOrders: true,
          situations: true,
        },
      },
    },
  })
  if (!p) return null

  return {
    id: p.id,
    reference: p.reference,
    nom: p.nom,
    statut: p.statut,
    priorite: p.priorite,
    typeOperation: p.typeOperation,
    adresse: p.adresse,
    codePostal: p.codePostal,
    ville: p.ville,
    surface: p.surface ? nb(p.surface) : null,
    description: p.description,
    contraintes: p.contraintes,
    dateDebutPrevue: p.dateDebutPrevue?.toISOString() ?? null,
    dateFinPrevue: p.dateFinPrevue?.toISOString() ?? null,
    dateDebutReelle: p.dateDebutReelle?.toISOString() ?? null,
    dateFinReelle: p.dateFinReelle?.toISOString() ?? null,
    dateReception: p.dateReception?.toISOString() ?? null,
    margeCible: nb(p.margeCible),
    tauxFraisChantier: nb(p.tauxFraisChantier),
    tauxFraisGeneraux: nb(p.tauxFraisGeneraux),
    tauxTva: nb(p.tauxTva),
    avancementPhysique: nb(p.avancementPhysique),
    client: p.contact
      ? {
          id: p.contact.id,
          nom: p.contact.societe || `${p.contact.prenom ?? ""} ${p.contact.nom}`.trim(),
          email: p.contact.email,
          telephone: p.contact.telephone,
        }
      : null,
    bien: p.property
      ? {
          id: p.property.id,
          nom: p.property.nom,
          type: p.property.type,
          adresse: p.property.adresse,
          ville: p.property.ville,
        }
      : null,
    responsable: p.responsable ? { id: p.responsable.id, nom: p.responsable.name } : null,
    compteurs: {
      lots: p._count.lots,
      consultations: p._count.consultations,
      marches: p._count.contracts,
      documents: p._count.documents,
      incidents: p._count.incidents,
      reserves: p._count.reservations,
      taches: p._count.tasks,
      avenants: p._count.changeOrders,
      situations: p._count.situations,
    },
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  SYNTHESE ECONOMIQUE
// ═══════════════════════════════════════════════════════════════════════════

export type SyntheseProjet = {
  budget: SyntheseBudget
  lignes: LigneBudget[]
  chiffrage: ResultatChiffrage | null
  avancementPhysique: number
  nbTachesEnRetard: number
  retardJours: number
}

export async function syntheseProjet(
  projectId: string,
  organizationId: string
): Promise<SyntheseProjet | null> {
  const projet = await prisma.project.findFirst({
    where: { id: projectId, organizationId },
    select: {
      id: true,
      margeCible: true,
      tauxFraisChantier: true,
      tauxFraisGeneraux: true,
      tauxTva: true,
      prixVenteHT: true,
      budgetInitial: true,
      avancementPhysique: true,
      organization: { select: { seuilAlerteDerive: true } },
    },
  })
  if (!projet) return null

  const params = {
    margeCible: nb(projet.margeCible),
    tauxFraisChantier: nb(projet.tauxFraisChantier),
    tauxFraisGeneraux: nb(projet.tauxFraisGeneraux),
    tauxTva: nb(projet.tauxTva),
  }

  const [estimate, lots, engagements, depenses, avenants, taches] = await Promise.all([
    prisma.estimate.findFirst({
      where: { projectId },
      orderBy: [{ retenu: "desc" }, { updatedAt: "desc" }],
      include: { items: true },
    }),
    prisma.lot.findMany({
      where: { projectId },
      select: { id: true, code: true, nom: true, categorie: true, sousTraite: true },
      orderBy: { ordre: "asc" },
    }),
    prisma.commitment.groupBy({
      by: ["lotId"],
      where: { projectId, statut: { not: "ANNULE" } },
      _sum: { montantHT: true },
    }),
    prisma.expense.groupBy({
      by: ["lotId"],
      where: { projectId },
      _sum: { montantHT: true },
    }),
    prisma.changeOrder.aggregate({
      where: { projectId, statut: "ACCEPTE" },
      _sum: { impactCout: true, impactVente: true },
    }),
    prisma.task.findMany({
      where: { projectId },
      select: { lotId: true, avancement: true, dateFin: true, statut: true },
    }),
  ])

  const chiffrage = estimate
    ? calculerChiffrage(
        lots.map((l) => ({
          id: l.id,
          code: l.code,
          nom: l.nom,
          categorie: l.categorie,
          sousTraite: l.sousTraite,
        })),
        estimate.items.map((i) => ({
          id: i.id,
          lotId: i.lotId,
          designation: i.designation,
          unite: i.unite,
          quantite: nb(i.quantite),
          prixUnitaire: nb(i.prixUnitaire),
          coutMateriaux: nb(i.coutMateriaux),
          coutMainOeuvre: nb(i.coutMainOeuvre),
          coutSousTraitance: nb(i.coutSousTraitance),
          coutMateriel: nb(i.coutMateriel),
          coutTransport: nb(i.coutTransport),
        })),
        params
      )
    : null

  const engageParLot = new Map(engagements.map((e) => [e.lotId ?? "—", nb(e._sum.montantHT)]))
  const realiseParLot = new Map(depenses.map((e) => [e.lotId ?? "—", nb(e._sum.montantHT)]))

  // Budget par lot : le chiffrage donne le montant de vente du lot, on le
  // ramene au cout de revient au prorata du cout de revient global.
  const facteurCout = chiffrage && chiffrage.montantHT > 0
    ? chiffrage.coutRevient / chiffrage.montantHT
    : 1

  const lignes: LigneBudget[] = lots.map((l) => {
    const lotChiffre = chiffrage?.lots.find((c) => c.lotId === l.id)
    return {
      lotId: l.id,
      code: l.code,
      nom: l.nom,
      budget: arrondi((lotChiffre?.montantHT ?? 0) * facteurCout),
      engage: engageParLot.get(l.id) ?? 0,
      realise: realiseParLot.get(l.id) ?? 0,
    }
  })

  const engageTotal = engagements.reduce((s, e) => s + nb(e._sum.montantHT), 0)
  const realiseTotal = depenses.reduce((s, e) => s + nb(e._sum.montantHT), 0)

  const budget = calculerBudget({
    budgetInitial: nb(projet.budgetInitial, chiffrage?.coutRevient ?? 0),
    prixVente: nb(projet.prixVenteHT, chiffrage?.montantHT ?? 0),
    avenantsCout: nb(avenants._sum.impactCout),
    avenantsVente: nb(avenants._sum.impactVente),
    engage: engageTotal,
    realise: realiseTotal,
    seuilDerive: nb(projet.organization.seuilAlerteDerive, 2),
  })

  const maintenant = new Date()
  const enRetard = taches.filter(
    (t) => t.statut !== "TERMINE" && nb(t.avancement) < 100 && t.dateFin < maintenant
  )

  const budgetParLot = new Map(lignes.map((l) => [l.lotId!, l.budget]))
  const avancement = taches.length
    ? arrondi(
        ratio(
          taches.reduce((s, t) => s + nb(t.avancement) * ((t.lotId ? budgetParLot.get(t.lotId) : 1) || 1), 0),
          taches.reduce((s, t) => s + ((t.lotId ? budgetParLot.get(t.lotId) : 1) || 1), 0)
        ),
        2
      )
    : nb(projet.avancementPhysique)

  return {
    budget,
    lignes,
    chiffrage,
    avancementPhysique: avancement,
    nbTachesEnRetard: enRetard.length,
    retardJours: enRetard.length
      ? Math.max(
          ...enRetard.map((t) => Math.round((maintenant.getTime() - t.dateFin.getTime()) / 86_400_000))
        )
      : 0,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  DONNEES DU MOTEUR D'ALERTES
// ═══════════════════════════════════════════════════════════════════════════

export async function donneesAlertes(organizationId: string): Promise<ProjetPourAlertes[]> {
  const projets = await prisma.project.findMany({
    where: { organizationId, statut: { in: STATUTS_ACTIFS as never[] } },
    select: {
      id: true,
      reference: true,
      nom: true,
      statut: true,
      margeCible: true,
      dateFinPrevue: true,
    },
  })
  if (projets.length === 0) return []

  const ids = projets.map((p) => p.id)
  const maintenant = new Date()

  const [
    syntheses,
    taches,
    consultations,
    lotsAttribues,
    marches,
    facturesAValider,
    situationsAValider,
    incidents,
    reserves,
  ] = await Promise.all([
    Promise.all(ids.map((id) => syntheseProjet(id, organizationId))),
    prisma.task.findMany({
      where: { projectId: { in: ids }, statut: { not: "TERMINE" }, dateFin: { lt: maintenant } },
      select: { projectId: true, dateFin: true, avancement: true },
    }),
    prisma.consultation.findMany({
      where: { projectId: { in: ids }, statut: { in: ["ENVOYEE", "EN_ANALYSE"] } },
      select: {
        projectId: true,
        dateLimiteReponse: true,
        _count: { select: { offers: true } },
      },
    }),
    prisma.lot.findMany({
      where: { projectId: { in: ids }, statut: "ATTRIBUE" },
      select: { id: true, projectId: true },
    }),
    prisma.contract.findMany({
      where: { projectId: { in: ids } },
      select: { lotId: true, subcontractorId: true, projectId: true },
    }),
    prisma.invoice.groupBy({
      by: ["projectId"],
      where: { projectId: { in: ids }, statut: "A_VALIDER" },
      _count: { _all: true },
    }),
    prisma.situation.groupBy({
      by: ["projectId"],
      where: { projectId: { in: ids }, statut: { in: ["DEPOSEE", "EN_VERIFICATION"] } },
      _count: { _all: true },
    }),
    prisma.incident.groupBy({
      by: ["projectId"],
      where: {
        projectId: { in: ids },
        statut: { in: ["OUVERT", "EN_TRAITEMENT"] },
        gravite: { in: ["MAJEUR", "CRITIQUE"] },
      },
      _count: { _all: true },
    }),
    prisma.reservation.findMany({
      where: { projectId: { in: ids }, statut: "OUVERTE" },
      select: { projectId: true, dateLimite: true },
    }),
  ])

  // Sous-traitants sous marche dont les documents obligatoires ne sont pas a jour.
  const idsSousTraitants = [...new Set(marches.map((m) => m.subcontractorId))]
  const stNonAJour = idsSousTraitants.length
    ? await prisma.subcontractor.findMany({
        where: {
          id: { in: idsSousTraitants },
          OR: [{ assuranceDecennaleValide: false }, { attestationVigilanceValide: false }],
        },
        select: { id: true },
      })
    : []
  const setNonAJour = new Set(stNonAJour.map((s) => s.id))

  const lotsAvecMarche = new Set(marches.map((m) => m.lotId))

  return projets.map((p, index) => {
    const synthese = syntheses[index]
    const tachesRetard = taches.filter((t) => t.projectId === p.id)
    const consultationsProjet = consultations.filter((c) => c.projectId === p.id)
    const reservesProjet = reserves.filter(
      (r) => r.projectId === p.id && r.dateLimite && r.dateLimite < maintenant
    )

    return {
      id: p.id,
      reference: p.reference,
      nom: p.nom,
      statut: p.statut,
      margeCible: nb(p.margeCible),
      tauxMargePrevisionnelle: synthese?.budget.tauxMargePrevisionnelle ?? 0,
      budgetActualise: synthese?.budget.budgetActualise ?? 0,
      atterrissage: synthese?.budget.atterrissage ?? 0,
      dateFinPrevue: p.dateFinPrevue,
      nbTachesEnRetard: tachesRetard.length,
      retardJours: tachesRetard.length
        ? Math.max(
            ...tachesRetard.map((t) =>
              Math.round((maintenant.getTime() - t.dateFin.getTime()) / 86_400_000)
            )
          )
        : 0,
      consultationsSansOffre: consultationsProjet.filter((c) => c._count.offers === 0).length,
      consultationsEnRetard: consultationsProjet.filter(
        (c) => c._count.offers === 0 && c.dateLimiteReponse && c.dateLimiteReponse < maintenant
      ).length,
      lotsSansMarche: lotsAttribues.filter((l) => l.projectId === p.id && !lotsAvecMarche.has(l.id))
        .length,
      sousTraitantsDocumentsInvalides: new Set(
        marches.filter((m) => m.projectId === p.id && setNonAJour.has(m.subcontractorId)).map((m) => m.subcontractorId)
      ).size,
      facturesAValider: facturesAValider.find((f) => f.projectId === p.id)?._count._all ?? 0,
      situationsAValider: situationsAValider.find((s) => s.projectId === p.id)?._count._all ?? 0,
      incidentsCritiques: incidents.find((i) => i.projectId === p.id)?._count._all ?? 0,
      reservesEnRetard: reservesProjet.length,
    }
  })
}

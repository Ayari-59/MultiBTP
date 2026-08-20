// Module serveur uniquement : ne jamais importer depuis un composant client.
import { prisma } from "@/lib/prisma"
import { nb } from "@/lib/utils"
import { comparerOffres, type ResultatComparaison } from "@/lib/metier/comparateur"

export type ConsultationListe = {
  id: string
  reference: string
  objet: string
  statut: string
  projetId: string
  projetNom: string
  projetReference: string
  lotCode: string
  lotNom: string
  budgetEstime: number | null
  delaiSouhaiteJours: number | null
  dateEnvoi: string | null
  dateLimiteReponse: string | null
  nbInvites: number
  nbOffres: number
  meilleureOffre: number | null
  enRetard: boolean
}

export async function listeConsultations(
  organizationId: string,
  filtres?: { projectId?: string; statut?: string }
): Promise<ConsultationListe[]> {
  const consultations = await prisma.consultation.findMany({
    where: {
      organizationId,
      ...(filtres?.projectId ? { projectId: filtres.projectId } : {}),
      ...(filtres?.statut ? { statut: filtres.statut as never } : {}),
    },
    include: {
      project: { select: { id: true, nom: true, reference: true } },
      lot: { select: { code: true, nom: true } },
      offers: { select: { montantHT: true } },
      _count: { select: { invites: true } },
    },
    orderBy: [{ statut: "asc" }, { createdAt: "desc" }],
  })

  const maintenant = new Date()

  return consultations.map((c) => {
    const montants = c.offers.map((o) => nb(o.montantHT)).filter((m) => m > 0)
    return {
      id: c.id,
      reference: c.reference,
      objet: c.objet,
      statut: c.statut,
      projetId: c.project.id,
      projetNom: c.project.nom,
      projetReference: c.project.reference,
      lotCode: c.lot.code,
      lotNom: c.lot.nom,
      budgetEstime: c.budgetEstime ? nb(c.budgetEstime) : null,
      delaiSouhaiteJours: c.delaiSouhaiteJours,
      dateEnvoi: c.dateEnvoi?.toISOString() ?? null,
      dateLimiteReponse: c.dateLimiteReponse?.toISOString() ?? null,
      nbInvites: c._count.invites,
      nbOffres: c.offers.length,
      meilleureOffre: montants.length ? Math.min(...montants) : null,
      enRetard:
        c.offers.length === 0 &&
        c.dateLimiteReponse !== null &&
        c.dateLimiteReponse < maintenant &&
        c.statut === "ENVOYEE",
    }
  })
}

export type ConsultationDetail = {
  id: string
  reference: string
  objet: string
  statut: string
  descriptif: string | null
  budgetEstime: number | null
  delaiSouhaiteJours: number | null
  dateEnvoi: string | null
  dateLimiteReponse: string | null
  dateDebutSouhaitee: string | null
  projet: { id: string; nom: string; reference: string; ville: string | null; surface: number | null }
  lot: {
    id: string
    code: string
    nom: string
    categorie: string
    descriptif: string | null
    postes: { designation: string; unite: string; quantite: number }[]
  }
  invites: {
    id: string
    subcontractorId: string
    raisonSociale: string
    email: string | null
    statut: string
    dateEnvoi: string
    dateReponse: string | null
    aRepondu: boolean
  }[]
  questions: {
    id: string
    auteur: string
    question: string
    reponse: string | null
    dateQuestion: string
  }[]
  comparaison: ResultatComparaison
  offreRetenue: { id: string; sousTraitant: string } | null
  marcheExistant: { id: string; reference: string } | null
}

export async function consultationDetail(
  consultationId: string,
  organizationId: string
): Promise<ConsultationDetail | null> {
  const c = await prisma.consultation.findFirst({
    where: { id: consultationId, organizationId },
    include: {
      project: { select: { id: true, nom: true, reference: true, ville: true, surface: true } },
      lot: {
        include: {
          items: {
            select: { designation: true, unite: true, quantite: true, estimate: { select: { retenu: true } } },
            orderBy: { ordre: "asc" },
          },
        },
      },
      invites: {
        include: {
          subcontractor: { select: { id: true, raisonSociale: true, email: true } },
        },
        orderBy: { dateEnvoi: "asc" },
      },
      questions: { orderBy: { dateQuestion: "desc" } },
      offers: {
        include: {
          subcontractor: true,
          _count: { select: { lignes: true } },
        },
      },
    },
  })
  if (!c) return null

  const marche = await prisma.contract.findFirst({
    where: { lotId: c.lotId, projectId: c.projectId },
    select: { id: true, reference: true },
  })

  const offresAComparer = c.offers.map((o) => ({
    id: o.id,
    subcontractorId: o.subcontractorId,
    sousTraitant: o.subcontractor.raisonSociale,
    montantHT: nb(o.montantHT),
    delaiJours: o.delaiJours,
    notation: nb(o.subcontractor.notation, 3),
    noteQualite: nb(o.subcontractor.noteQualite, 3),
    noteDelai: nb(o.subcontractor.noteDelai, 3),
    nbMarches: o.subcontractor.nbMarches,
    nbLitiges: o.subcontractor.nbLitiges,
    assuranceRcValide: o.subcontractor.assuranceRcValide,
    assuranceDecennaleValide: o.subcontractor.assuranceDecennaleValide,
    attestationVigilanceValide: o.subcontractor.attestationVigilanceValide,
    exclusions: o.exclusions,
    garanties: o.garanties,
    conditionsPaiement: o.conditionsPaiement,
    statut: o.statut,
    nbLignes: o._count.lignes,
  }))

  const retenue = c.offers.find((o) => o.statut === "RETENUE")

  // Les quantites du descriptif viennent du chiffrage retenu.
  const postes = c.lot.items
    .filter((i) => i.estimate.retenu)
    .map((i) => ({ designation: i.designation, unite: i.unite, quantite: nb(i.quantite) }))

  return {
    id: c.id,
    reference: c.reference,
    objet: c.objet,
    statut: c.statut,
    descriptif: c.descriptif,
    budgetEstime: c.budgetEstime ? nb(c.budgetEstime) : null,
    delaiSouhaiteJours: c.delaiSouhaiteJours,
    dateEnvoi: c.dateEnvoi?.toISOString() ?? null,
    dateLimiteReponse: c.dateLimiteReponse?.toISOString() ?? null,
    dateDebutSouhaitee: c.dateDebutSouhaitee?.toISOString() ?? null,
    projet: {
      id: c.project.id,
      nom: c.project.nom,
      reference: c.project.reference,
      ville: c.project.ville,
      surface: c.project.surface ? nb(c.project.surface) : null,
    },
    lot: {
      id: c.lot.id,
      code: c.lot.code,
      nom: c.lot.nom,
      categorie: c.lot.categorie,
      descriptif: c.lot.descriptif,
      postes: postes.length > 0 ? postes : c.lot.items.map((i) => ({
        designation: i.designation,
        unite: i.unite,
        quantite: nb(i.quantite),
      })),
    },
    invites: c.invites.map((i) => ({
      id: i.id,
      subcontractorId: i.subcontractorId,
      raisonSociale: i.subcontractor.raisonSociale,
      email: i.subcontractor.email,
      statut: i.statut,
      dateEnvoi: i.dateEnvoi.toISOString(),
      dateReponse: i.dateReponse?.toISOString() ?? null,
      aRepondu: c.offers.some((o) => o.subcontractorId === i.subcontractorId),
    })),
    questions: c.questions.map((q) => ({
      id: q.id,
      auteur: q.auteur,
      question: q.question,
      reponse: q.reponse,
      dateQuestion: q.dateQuestion.toISOString(),
    })),
    comparaison: comparerOffres(offresAComparer, c.budgetEstime ? nb(c.budgetEstime) : null),
    offreRetenue: retenue
      ? { id: retenue.id, sousTraitant: retenue.subcontractor.raisonSociale }
      : null,
    marcheExistant: marche,
  }
}

/** Entreprises pertinentes pour un lot : specialite, zone, documents a jour. */
export async function sousTraitantsSuggeres(
  organizationId: string,
  categorie: string,
  ville: string | null
) {
  const tous = await prisma.subcontractor.findMany({
    where: { organizationId, actif: true },
    select: {
      id: true,
      raisonSociale: true,
      email: true,
      ville: true,
      zoneGeo: true,
      specialites: true,
      notation: true,
      nbMarches: true,
      nbLitiges: true,
      assuranceDecennaleValide: true,
      attestationVigilanceValide: true,
    },
    orderBy: { notation: "desc" },
  })

  return tous
    .map((s) => {
      const specialiste = s.specialites.includes(categorie as never)
      const proche = ville !== null && (s.ville === ville || (s.zoneGeo ?? "").includes(ville))
      return {
        id: s.id,
        raisonSociale: s.raisonSociale,
        email: s.email,
        ville: s.ville,
        notation: nb(s.notation, 3),
        nbMarches: s.nbMarches,
        nbLitiges: s.nbLitiges,
        documentsAJour: s.assuranceDecennaleValide && s.attestationVigilanceValide,
        specialiste,
        proche,
        // Tri : specialite d'abord, proximite ensuite, puis notation.
        pertinence: (specialiste ? 100 : 0) + (proche ? 30 : 0) + nb(s.notation, 3) * 4,
      }
    })
    .sort((a, b) => b.pertinence - a.pertinence)
}

export type SousTraitantSuggere = Awaited<ReturnType<typeof sousTraitantsSuggeres>>[number]

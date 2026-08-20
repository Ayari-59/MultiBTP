"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireAccess } from "@/lib/session"
import { prochaineReferenceConsultation, prochaineReferenceContrat } from "@/lib/references"
import { analyserDevis } from "@/lib/ia/analyses"
import { ajouterJours, arrondi, nb } from "@/lib/utils"

export type EtatConsultation = { erreur?: string; ok?: boolean }

async function verifierConsultation(consultationId: string, organizationId: string) {
  const consultation = await prisma.consultation.findFirst({
    where: { id: consultationId, organizationId },
    select: { id: true, projectId: true, lotId: true, reference: true },
  })
  if (!consultation) throw new Error("Consultation introuvable.")
  return consultation
}

// ═══════════════════════════════════════════════════════════════════════════
//  Creation et parametrage
// ═══════════════════════════════════════════════════════════════════════════

const schemaConsultation = z.object({
  projectId: z.string().min(1),
  lotId: z.string().min(1),
  consultationId: z.string().optional(),
  objet: z.string().min(3, "Objet obligatoire."),
  descriptif: z.string().optional(),
  budgetEstime: z.string().optional(),
  delaiSouhaiteJours: z.string().optional(),
  dateLimiteReponse: z.string().optional(),
  dateDebutSouhaitee: z.string().optional(),
})

export async function enregistrerConsultation(
  _etat: EtatConsultation,
  donnees: FormData
): Promise<EtatConsultation> {
  const utilisateur = await requireAccess("consultations", "update")
  const parsed = schemaConsultation.safeParse(Object.fromEntries(donnees.entries()))
  if (!parsed.success) {
    return { erreur: parsed.error.issues[0]?.message ?? "Formulaire invalide." }
  }

  const d = parsed.data
  const projet = await prisma.project.findFirst({
    where: { id: d.projectId, organizationId: utilisateur.organizationId },
    select: { id: true, reference: true },
  })
  if (!projet) return { erreur: "Projet introuvable." }

  const commun = {
    objet: d.objet,
    descriptif: d.descriptif || null,
    budgetEstime: d.budgetEstime ? Number(d.budgetEstime) : null,
    delaiSouhaiteJours: d.delaiSouhaiteJours ? Number(d.delaiSouhaiteJours) : null,
    dateLimiteReponse: d.dateLimiteReponse ? new Date(d.dateLimiteReponse) : null,
    dateDebutSouhaitee: d.dateDebutSouhaitee ? new Date(d.dateDebutSouhaitee) : null,
  }

  if (d.consultationId) {
    await verifierConsultation(d.consultationId, utilisateur.organizationId)
    await prisma.consultation.update({ where: { id: d.consultationId }, data: commun })
  } else {
    const lot = await prisma.lot.findFirst({
      where: { id: d.lotId, projectId: d.projectId },
      select: { code: true },
    })
    if (!lot) return { erreur: "Lot introuvable." }

    await prisma.consultation.create({
      data: {
        ...commun,
        organizationId: utilisateur.organizationId,
        projectId: d.projectId,
        lotId: d.lotId,
        reference: await prochaineReferenceConsultation(
          utilisateur.organizationId,
          projet.reference,
          lot.code
        ),
      },
    })
  }

  revalidatePath(`/dashboard/projets/${d.projectId}/consultations`)
  revalidatePath("/dashboard/consultations")
  return { ok: true }
}

/**
 * Envoi de la consultation aux entreprises retenues. Le statut du lot passe en
 * consultation : le tableau de bord sait alors qu'un devis est attendu.
 */
export async function envoyerConsultation(
  consultationId: string,
  sousTraitantIds: string[],
  delaiReponseJours: number
): Promise<void> {
  const utilisateur = await requireAccess("consultations", "update")
  const consultation = await verifierConsultation(consultationId, utilisateur.organizationId)

  if (sousTraitantIds.length === 0) {
    throw new Error("Selectionnez au moins une entreprise a consulter.")
  }

  const valides = await prisma.subcontractor.findMany({
    where: { id: { in: sousTraitantIds }, organizationId: utilisateur.organizationId },
    select: { id: true },
  })

  await prisma.$transaction(async (tx) => {
    for (const st of valides) {
      await tx.consultationInvite.upsert({
        where: {
          consultationId_subcontractorId: {
            consultationId,
            subcontractorId: st.id,
          },
        },
        create: { consultationId, subcontractorId: st.id },
        update: {},
      })
    }

    await tx.consultation.update({
      where: { id: consultationId },
      data: {
        statut: "ENVOYEE",
        dateEnvoi: new Date(),
        dateLimiteReponse: ajouterJours(new Date(), delaiReponseJours),
      },
    })

    await tx.lot.update({ where: { id: consultation.lotId }, data: { statut: "EN_CONSULTATION" } })
  })

  revalidatePath(`/dashboard/projets/${consultation.projectId}/consultations/${consultationId}`)
  revalidatePath("/dashboard/consultations")
}

export async function supprimerConsultation(consultationId: string): Promise<void> {
  const utilisateur = await requireAccess("consultations", "delete")
  const consultation = await verifierConsultation(consultationId, utilisateur.organizationId)

  await prisma.consultation.delete({ where: { id: consultationId } })
  revalidatePath(`/dashboard/projets/${consultation.projectId}/consultations`)
}

// ═══════════════════════════════════════════════════════════════════════════
//  Offres
// ═══════════════════════════════════════════════════════════════════════════

const schemaOffre = z.object({
  consultationId: z.string().min(1),
  offerId: z.string().optional(),
  subcontractorId: z.string().min(1, "Selectionnez une entreprise."),
  reference: z.string().optional(),
  montantHT: z.coerce.number().positive("Le montant doit etre superieur a zero."),
  delaiJours: z.string().optional(),
  validiteJours: z.string().optional(),
  conditionsPaiement: z.string().optional(),
  exclusions: z.string().optional(),
  garanties: z.string().optional(),
  observations: z.string().optional(),
})

export async function enregistrerOffre(
  _etat: EtatConsultation,
  donnees: FormData
): Promise<EtatConsultation> {
  const utilisateur = await requireAccess("offres", "create")
  const parsed = schemaOffre.safeParse(Object.fromEntries(donnees.entries()))
  if (!parsed.success) {
    return { erreur: parsed.error.issues[0]?.message ?? "Formulaire invalide." }
  }

  const d = parsed.data
  const consultation = await verifierConsultation(d.consultationId, utilisateur.organizationId)

  const commun = {
    reference: d.reference || null,
    montantHT: d.montantHT,
    delaiJours: d.delaiJours ? Number(d.delaiJours) : null,
    validiteJours: d.validiteJours ? Number(d.validiteJours) : 90,
    conditionsPaiement: d.conditionsPaiement || null,
    exclusions: d.exclusions || null,
    garanties: d.garanties || null,
    observations: d.observations || null,
  }

  try {
    if (d.offerId) {
      await prisma.offer.update({ where: { id: d.offerId }, data: commun })
    } else {
      await prisma.offer.create({
        data: {
          ...commun,
          organizationId: utilisateur.organizationId,
          consultationId: d.consultationId,
          subcontractorId: d.subcontractorId,
        },
      })
      await prisma.consultationInvite.updateMany({
        where: { consultationId: d.consultationId, subcontractorId: d.subcontractorId },
        data: { statut: "REPONDU", dateReponse: new Date() },
      })
    }
  } catch {
    return { erreur: "Cette entreprise a deja depose une offre sur cette consultation." }
  }

  await prisma.consultation.update({
    where: { id: d.consultationId },
    data: { statut: "EN_ANALYSE" },
  })

  revalidatePath(`/dashboard/projets/${consultation.projectId}/consultations/${d.consultationId}`)
  return { ok: true }
}

export async function supprimerOffre(offerId: string): Promise<void> {
  const utilisateur = await requireAccess("offres", "delete")
  const offre = await prisma.offer.findFirst({
    where: { id: offerId, organizationId: utilisateur.organizationId },
    select: { id: true, consultation: { select: { id: true, projectId: true } } },
  })
  if (!offre) throw new Error("Offre introuvable.")

  await prisma.offer.delete({ where: { id: offerId } })
  revalidatePath(
    `/dashboard/projets/${offre.consultation.projectId}/consultations/${offre.consultation.id}`
  )
}

/** Analyse IA d'un devis : ecarts au descriptif, exclusions, prix hors marche. */
export async function analyserOffre(offerId: string): Promise<void> {
  const utilisateur = await requireAccess("offres", "update")
  const offre = await prisma.offer.findFirst({
    where: { id: offerId, organizationId: utilisateur.organizationId },
    select: { id: true, consultationId: true, consultation: { select: { projectId: true } } },
  })
  if (!offre) throw new Error("Offre introuvable.")

  const analyse = await analyserDevis(offerId, utilisateur.organizationId)
  await prisma.offer.update({ where: { id: offerId }, data: { analyseIa: analyse } })

  revalidatePath(
    `/dashboard/projets/${offre.consultation.projectId}/consultations/${offre.consultationId}`
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  Attribution : offre -> marche -> engagement budgetaire
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Retient une offre et la transforme en marche. C'est ce passage qui fait
 * basculer le montant du « previsionnel » vers le « cout engage ».
 */
export async function retenirOffre(offerId: string): Promise<void> {
  const utilisateur = await requireAccess("marches", "create")

  const offre = await prisma.offer.findFirst({
    where: { id: offerId, organizationId: utilisateur.organizationId },
    include: {
      consultation: {
        include: {
          project: { select: { id: true, reference: true, nom: true } },
          lot: { select: { id: true, code: true, nom: true } },
        },
      },
      subcontractor: { select: { id: true, raisonSociale: true } },
    },
  })
  if (!offre) throw new Error("Offre introuvable.")

  const { consultation } = offre
  const montant = nb(offre.montantHT)

  const referenceMarche = await prochaineReferenceContrat(
    utilisateur.organizationId,
    consultation.project.reference,
    consultation.lot.code
  )

  const organisation = await prisma.organization.findUniqueOrThrow({
    where: { id: utilisateur.organizationId },
    select: { tauxRetenueGarantie: true },
  })

  await prisma.$transaction(async (tx) => {
    // Une seule offre retenue par consultation.
    await tx.offer.updateMany({
      where: { consultationId: consultation.id, id: { not: offerId } },
      data: { statut: "ECARTEE" },
    })
    await tx.offer.update({ where: { id: offerId }, data: { statut: "RETENUE" } })

    const dateDebut = consultation.dateDebutSouhaitee ?? new Date()
    const marche = await tx.contract.create({
      data: {
        organizationId: utilisateur.organizationId,
        projectId: consultation.projectId,
        lotId: consultation.lotId,
        subcontractorId: offre.subcontractorId,
        offerId,
        reference: referenceMarche,
        objet: `${consultation.lot.code} — ${consultation.lot.nom} · ${consultation.project.nom}`,
        statut: "SIGNE",
        montantInitial: montant,
        montantActualise: montant,
        tauxRetenueGarantie: organisation.tauxRetenueGarantie,
        dateSignature: new Date(),
        dateDebut,
        delaiJours: offre.delaiJours,
        dateFin: offre.delaiJours ? ajouterJours(dateDebut, offre.delaiJours) : null,
        conditions: offre.conditionsPaiement,
      },
    })

    // L'engagement budgetaire nait de la signature du marche.
    await tx.commitment.create({
      data: {
        projectId: consultation.projectId,
        lotId: consultation.lotId,
        contractId: marche.id,
        libelle: `Marche ${referenceMarche} — ${offre.subcontractor.raisonSociale}`,
        nature: "SOUS_TRAITANCE",
        montantHT: montant,
        statut: "ENGAGE",
        reference: referenceMarche,
      },
    })

    await tx.consultation.update({ where: { id: consultation.id }, data: { statut: "ATTRIBUEE" } })
    await tx.lot.update({ where: { id: consultation.lotId }, data: { statut: "ATTRIBUE" } })

    // L'historique du sous-traitant sert au score des futures consultations.
    await tx.subcontractor.update({
      where: { id: offre.subcontractorId },
      data: { nbMarches: { increment: 1 } },
    })

    // Le prix pratique alimente la bibliotheque via l'historique.
    await tx.auditLog.create({
      data: {
        organizationId: utilisateur.organizationId,
        userId: utilisateur.id,
        action: "ATTRIBUTION_MARCHE",
        entite: "Contract",
        entiteId: marche.id,
        details: `${offre.subcontractor.raisonSociale} — ${montant} € HT sur le lot ${consultation.lot.code}.`,
      },
    })
  })

  revalidatePath(`/dashboard/projets/${consultation.projectId}`)
  revalidatePath(`/dashboard/projets/${consultation.projectId}/consultations/${consultation.id}`)
  revalidatePath(`/dashboard/projets/${consultation.projectId}/budget`)
  revalidatePath("/dashboard")
}

export async function ecarterOffre(offerId: string): Promise<void> {
  const utilisateur = await requireAccess("offres", "update")
  const offre = await prisma.offer.findFirst({
    where: { id: offerId, organizationId: utilisateur.organizationId },
    select: { id: true, consultationId: true, consultation: { select: { projectId: true } } },
  })
  if (!offre) throw new Error("Offre introuvable.")

  await prisma.offer.update({ where: { id: offerId }, data: { statut: "ECARTEE" } })
  revalidatePath(
    `/dashboard/projets/${offre.consultation.projectId}/consultations/${offre.consultationId}`
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  Questions / reponses
// ═══════════════════════════════════════════════════════════════════════════

export async function repondreQuestion(questionId: string, reponse: string): Promise<void> {
  const utilisateur = await requireAccess("consultations", "update")
  const question = await prisma.consultationQuestion.findFirst({
    where: { id: questionId, consultation: { organizationId: utilisateur.organizationId } },
    select: { id: true, consultationId: true, consultation: { select: { projectId: true } } },
  })
  if (!question) throw new Error("Question introuvable.")

  await prisma.consultationQuestion.update({
    where: { id: questionId },
    data: { reponse, dateReponse: new Date() },
  })

  revalidatePath(
    `/dashboard/projets/${question.consultation.projectId}/consultations/${question.consultationId}`
  )
}

/** Cree une consultation pour chaque lot sous-traite encore non consulte. */
export async function preparerConsultationsManquantes(projectId: string): Promise<number> {
  const utilisateur = await requireAccess("consultations", "create")
  const projet = await prisma.project.findFirst({
    where: { id: projectId, organizationId: utilisateur.organizationId },
    select: { id: true, reference: true, nom: true },
  })
  if (!projet) throw new Error("Projet introuvable.")

  const lots = await prisma.lot.findMany({
    where: { projectId, sousTraite: true, consultations: { none: {} } },
    include: {
      items: {
        where: { estimate: { retenu: true } },
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

  for (const lot of lots) {
    const budget = arrondi(
      lot.items.reduce(
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
    )

    await prisma.consultation.create({
      data: {
        organizationId: utilisateur.organizationId,
        projectId,
        lotId: lot.id,
        reference: await prochaineReferenceConsultation(
          utilisateur.organizationId,
          projet.reference,
          lot.code
        ),
        objet: `${lot.nom} — ${projet.nom}`,
        descriptif: lot.descriptif,
        budgetEstime: budget > 0 ? budget : null,
      },
    })
  }

  revalidatePath(`/dashboard/projets/${projectId}/consultations`)
  return lots.length
}

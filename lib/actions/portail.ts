"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/session"

export type EtatPortail = { erreur?: string; ok?: boolean }

/** Identifie l'entreprise rattachee au compte connecte. */
async function entrepriseDuCompte() {
  const utilisateur = await requireSession()
  if (utilisateur.role !== "SOUS_TRAITANT" || !utilisateur.subcontractorId) {
    throw new Error("Ce compte n'est rattache a aucune entreprise.")
  }
  return { utilisateur, subcontractorId: utilisateur.subcontractorId }
}

const schemaOffre = z.object({
  consultationId: z.string().min(1),
  montantHT: z.coerce.number().positive("Le montant doit etre superieur a zero."),
  delaiJours: z.string().optional(),
  reference: z.string().optional(),
  conditionsPaiement: z.string().optional(),
  exclusions: z.string().optional(),
  garanties: z.string().optional(),
  observations: z.string().optional(),
})

/** Depot d'un devis par l'entreprise consultee. */
export async function deposerDevis(_etat: EtatPortail, donnees: FormData): Promise<EtatPortail> {
  const { utilisateur, subcontractorId } = await entrepriseDuCompte()
  const parsed = schemaOffre.safeParse(Object.fromEntries(donnees.entries()))
  if (!parsed.success) {
    return { erreur: parsed.error.issues[0]?.message ?? "Formulaire invalide." }
  }

  const d = parsed.data

  // L'entreprise ne peut repondre qu'a une consultation a laquelle elle est invitee.
  const invitation = await prisma.consultationInvite.findFirst({
    where: {
      consultationId: d.consultationId,
      subcontractorId,
      consultation: { organizationId: utilisateur.organizationId, statut: { in: ["ENVOYEE", "EN_ANALYSE"] } },
    },
    select: { id: true },
  })
  if (!invitation) return { erreur: "Cette consultation ne vous est pas ouverte." }

  try {
    await prisma.$transaction([
      prisma.offer.create({
        data: {
          organizationId: utilisateur.organizationId,
          consultationId: d.consultationId,
          subcontractorId,
          reference: d.reference || null,
          montantHT: d.montantHT,
          delaiJours: d.delaiJours ? Number(d.delaiJours) : null,
          conditionsPaiement: d.conditionsPaiement || null,
          exclusions: d.exclusions || null,
          garanties: d.garanties || null,
          observations: d.observations || null,
        },
      }),
      prisma.consultationInvite.update({
        where: { id: invitation.id },
        data: { statut: "REPONDU", dateReponse: new Date() },
      }),
      prisma.consultation.update({
        where: { id: d.consultationId },
        data: { statut: "EN_ANALYSE" },
      }),
    ])
  } catch {
    return { erreur: "Vous avez deja depose une offre pour cette consultation." }
  }

  revalidatePath("/portail")
  return { ok: true }
}

export async function repondreInvitation(
  consultationId: string,
  statut: "ACCEPTE" | "REFUSE",
  motif?: string
): Promise<void> {
  const { subcontractorId } = await entrepriseDuCompte()

  await prisma.consultationInvite.updateMany({
    where: { consultationId, subcontractorId },
    data: {
      statut,
      dateVue: new Date(),
      motifRefus: statut === "REFUSE" ? (motif ?? "Non precise") : null,
    },
  })

  revalidatePath("/portail")
}

export async function poserQuestionConsultation(
  _etat: EtatPortail,
  donnees: FormData
): Promise<EtatPortail> {
  const { utilisateur, subcontractorId } = await entrepriseDuCompte()

  const consultationId = String(donnees.get("consultationId") ?? "")
  const question = String(donnees.get("question") ?? "").trim()
  if (question.length < 5) return { erreur: "Formulez votre question." }

  const invitation = await prisma.consultationInvite.findFirst({
    where: { consultationId, subcontractorId },
    select: { id: true, subcontractor: { select: { raisonSociale: true } } },
  })
  if (!invitation) return { erreur: "Cette consultation ne vous est pas ouverte." }

  await prisma.consultationQuestion.create({
    data: {
      consultationId,
      auteur: invitation.subcontractor.raisonSociale,
      question,
    },
  })

  await prisma.notification.create({
    data: {
      organizationId: utilisateur.organizationId,
      niveau: "INFO",
      type: "QUESTION_CONSULTATION",
      titre: `Question de ${invitation.subcontractor.raisonSociale}`,
      message: question,
    },
  })

  revalidatePath("/portail")
  return { ok: true }
}

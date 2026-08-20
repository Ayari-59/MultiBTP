"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireAccess } from "@/lib/session"
import { repondreAssistant } from "@/lib/ia/assistant"
import { fournisseurIa } from "@/lib/ia/provider"

export type EtatAssistant = {
  reponse?: string
  question?: string
  erreur?: string
  fournisseur?: string
}

export async function poserQuestion(
  _etat: EtatAssistant,
  donnees: FormData
): Promise<EtatAssistant> {
  const utilisateur = await requireAccess("assistant", "create")

  const question = String(donnees.get("question") ?? "").trim()
  const projectId = String(donnees.get("projectId") ?? "") || undefined

  if (question.length < 3) return { erreur: "Posez une question." }

  if (projectId) {
    const projet = await prisma.project.findFirst({
      where: { id: projectId, organizationId: utilisateur.organizationId },
      select: { id: true },
    })
    if (!projet) return { erreur: "Projet introuvable." }
  }

  const reponse = await repondreAssistant(question, {
    organizationId: utilisateur.organizationId,
    projectId,
  })

  // L'echange est conserve : il constitue la memoire de l'assistant projet.
  const conversation = await prisma.aiConversation.findFirst({
    where: {
      organizationId: utilisateur.organizationId,
      userId: utilisateur.id,
      projectId: projectId ?? null,
    },
    orderBy: { updatedAt: "desc" },
  })

  const conversationId =
    conversation?.id ??
    (
      await prisma.aiConversation.create({
        data: {
          organizationId: utilisateur.organizationId,
          userId: utilisateur.id,
          projectId: projectId ?? null,
          titre: question.slice(0, 60),
        },
      })
    ).id

  await prisma.$transaction([
    prisma.aiMessage.create({
      data: { conversationId, role: "user", contenu: question },
    }),
    prisma.aiMessage.create({
      data: {
        conversationId,
        role: "assistant",
        contenu: reponse,
        fournisseur: fournisseurIa().nom,
      },
    }),
    prisma.aiConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    }),
  ])

  revalidatePath("/dashboard/assistant")
  return { reponse, question, fournisseur: fournisseurIa().nom }
}

export async function effacerHistorique(): Promise<void> {
  const utilisateur = await requireAccess("assistant", "delete")
  await prisma.aiConversation.deleteMany({
    where: { organizationId: utilisateur.organizationId, userId: utilisateur.id },
  })
  revalidatePath("/dashboard/assistant")
}

"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireAccess } from "@/lib/session"
import { risquesPlanning } from "@/lib/ia/analyses"
import { joursEntre } from "@/lib/utils"

export type EtatPlanning = { erreur?: string; ok?: boolean }

const schemaTache = z.object({
  projectId: z.string().min(1),
  tacheId: z.string().optional(),
  lotId: z.string().optional(),
  subcontractorId: z.string().optional(),
  nom: z.string().min(2, "Intitule obligatoire."),
  dateDebut: z.string().min(1, "Date de debut obligatoire."),
  dateFin: z.string().min(1, "Date de fin obligatoire."),
  responsable: z.string().optional(),
  commentaire: z.string().optional(),
  predecesseurId: z.string().optional(),
})

export async function enregistrerTache(
  _etat: EtatPlanning,
  donnees: FormData
): Promise<EtatPlanning> {
  const utilisateur = await requireAccess("planning", "update")
  const parsed = schemaTache.safeParse(Object.fromEntries(donnees.entries()))
  if (!parsed.success) {
    return { erreur: parsed.error.issues[0]?.message ?? "Formulaire invalide." }
  }

  const d = parsed.data
  const projet = await prisma.project.findFirst({
    where: { id: d.projectId, organizationId: utilisateur.organizationId },
    select: { id: true },
  })
  if (!projet) return { erreur: "Projet introuvable." }

  const dateDebut = new Date(d.dateDebut)
  const dateFin = new Date(d.dateFin)
  if (dateFin < dateDebut) return { erreur: "La date de fin precede la date de debut." }

  const commun = {
    lotId: d.lotId && d.lotId !== "" ? d.lotId : null,
    subcontractorId: d.subcontractorId && d.subcontractorId !== "" ? d.subcontractorId : null,
    nom: d.nom,
    dateDebut,
    dateFin,
    dureeJours: Math.max(0, joursEntre(dateDebut, dateFin)),
    responsable: d.responsable || null,
    commentaire: d.commentaire || null,
  }

  let tacheId = d.tacheId
  if (tacheId) {
    await prisma.task.update({ where: { id: tacheId }, data: commun })
  } else {
    const dernier = await prisma.task.findFirst({
      where: { projectId: d.projectId },
      orderBy: { ordre: "desc" },
      select: { ordre: true },
    })
    const creee = await prisma.task.create({
      data: { ...commun, projectId: d.projectId, ordre: (dernier?.ordre ?? -1) + 1 },
    })
    tacheId = creee.id
  }

  if (d.predecesseurId && d.predecesseurId !== "" && d.predecesseurId !== tacheId) {
    await prisma.taskDependency.upsert({
      where: {
        predecesseurId_successeurId: {
          predecesseurId: d.predecesseurId,
          successeurId: tacheId,
        },
      },
      create: { predecesseurId: d.predecesseurId, successeurId: tacheId, type: "FIN_DEBUT" },
      update: {},
    })
  }

  revalidatePath(`/dashboard/projets/${d.projectId}/planning`)
  return { ok: true }
}

export async function majAvancementTache(tacheId: string, avancement: number): Promise<void> {
  const utilisateur = await requireAccess("planning", "update")
  const tache = await prisma.task.findFirst({
    where: { id: tacheId, project: { organizationId: utilisateur.organizationId } },
    select: { id: true, projectId: true },
  })
  if (!tache) throw new Error("Tache introuvable.")

  const valeur = Math.min(100, Math.max(0, avancement))

  await prisma.task.update({
    where: { id: tacheId },
    data: {
      avancement: valeur,
      statut: valeur >= 100 ? "TERMINE" : valeur > 0 ? "EN_COURS" : "A_FAIRE",
      ...(valeur >= 100 ? { dateFinReelle: new Date() } : { dateFinReelle: null }),
    },
  })

  // L'avancement physique du projet est la moyenne des taches, ponderee par
  // le budget du lot (calcul complet dans syntheseProjet) : on stocke ici une
  // valeur simple qui sert d'affichage rapide en liste.
  const taches = await prisma.task.findMany({
    where: { projectId: tache.projectId },
    select: { avancement: true },
  })
  const moyenne =
    taches.reduce((s, t) => s + Number(t.avancement), 0) / Math.max(1, taches.length)

  await prisma.project.update({
    where: { id: tache.projectId },
    data: { avancementPhysique: Math.round(moyenne * 100) / 100 },
  })

  revalidatePath(`/dashboard/projets/${tache.projectId}/planning`)
  revalidatePath(`/dashboard/projets/${tache.projectId}`)
}

export async function supprimerTache(tacheId: string): Promise<void> {
  const utilisateur = await requireAccess("planning", "delete")
  const tache = await prisma.task.findFirst({
    where: { id: tacheId, project: { organizationId: utilisateur.organizationId } },
    select: { id: true, projectId: true },
  })
  if (!tache) throw new Error("Tache introuvable.")

  await prisma.task.delete({ where: { id: tacheId } })
  revalidatePath(`/dashboard/projets/${tache.projectId}/planning`)
}

export async function analyserRisquesPlanning(projectId: string): Promise<string> {
  const utilisateur = await requireAccess("planning", "read")
  return risquesPlanning(projectId, utilisateur.organizationId)
}

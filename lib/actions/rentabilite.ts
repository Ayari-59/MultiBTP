"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireAccess } from "@/lib/session"

export type EtatRentabilite = { erreur?: string; ok?: boolean }

const schema = z.object({
  projectId: z.string().min(1),
  analyseId: z.string().optional(),
  nom: z.string().min(2, "Nom du scenario obligatoire."),
  prixAcquisition: z.coerce.number().min(0).default(0),
  fraisAcquisition: z.coerce.number().min(0).default(0),
  montantTravaux: z.coerce.number().min(0).default(0),
  fraisDivers: z.coerce.number().min(0).default(0),
  apport: z.coerce.number().min(0).default(0),
  montantEmprunt: z.coerce.number().min(0).default(0),
  tauxCredit: z.coerce.number().min(0).max(25).default(3.5),
  dureeCreditAnnees: z.coerce.number().int().min(1).max(40).default(20),
  valeurApresTravaux: z.coerce.number().min(0).default(0),
  fraisRevente: z.coerce.number().min(0).default(0),
  loyerMensuel: z.coerce.number().min(0).default(0),
  chargesAnnuelles: z.coerce.number().min(0).default(0),
  tauxImposition: z.coerce.number().min(0).max(70).default(30),
  commentaire: z.string().optional(),
})

export async function enregistrerAnalyse(
  _etat: EtatRentabilite,
  donnees: FormData
): Promise<EtatRentabilite> {
  const utilisateur = await requireAccess("rentabilite", "create")
  const parsed = schema.safeParse(Object.fromEntries(donnees.entries()))
  if (!parsed.success) {
    return { erreur: parsed.error.issues[0]?.message ?? "Formulaire invalide." }
  }

  const { projectId, analyseId, commentaire, ...valeurs } = parsed.data

  const projet = await prisma.project.findFirst({
    where: { id: projectId, organizationId: utilisateur.organizationId },
    select: { id: true },
  })
  if (!projet) return { erreur: "Projet introuvable." }

  const donneesAnalyse = { ...valeurs, commentaire: commentaire || null }

  if (analyseId) {
    await prisma.realEstateAnalysis.update({ where: { id: analyseId }, data: donneesAnalyse })
  } else {
    await prisma.realEstateAnalysis.create({ data: { ...donneesAnalyse, projectId } })
  }

  revalidatePath(`/dashboard/projets/${projectId}/rentabilite`)
  return { ok: true }
}

export async function supprimerAnalyse(analyseId: string): Promise<void> {
  const utilisateur = await requireAccess("rentabilite", "delete")
  const analyse = await prisma.realEstateAnalysis.findFirst({
    where: { id: analyseId, project: { organizationId: utilisateur.organizationId } },
    select: { id: true, projectId: true },
  })
  if (!analyse) throw new Error("Analyse introuvable.")

  await prisma.realEstateAnalysis.delete({ where: { id: analyseId } })
  revalidatePath(`/dashboard/projets/${analyse.projectId}/rentabilite`)
}

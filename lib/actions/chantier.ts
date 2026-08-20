"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireAccess } from "@/lib/session"
import { enregistrerFichier } from "@/lib/storage"

export type EtatChantier = { erreur?: string; ok?: boolean }

async function verifierProjet(projectId: string, organizationId: string) {
  const projet = await prisma.project.findFirst({
    where: { id: projectId, organizationId },
    select: { id: true },
  })
  if (!projet) throw new Error("Projet introuvable.")
  return projet
}

// ═══════════════════════════════════════════════════════════════════════════
//  Rapport de chantier
// ═══════════════════════════════════════════════════════════════════════════

const schemaRapport = z.object({
  projectId: z.string().min(1),
  date: z.string().optional(),
  meteo: z.string().optional(),
  effectif: z.string().optional(),
  travauxRealises: z.string().optional(),
  observations: z.string().optional(),
  decisions: z.string().optional(),
})

export async function enregistrerRapport(
  _etat: EtatChantier,
  donnees: FormData
): Promise<EtatChantier> {
  const utilisateur = await requireAccess("chantier", "create")
  const parsed = schemaRapport.safeParse(Object.fromEntries(donnees.entries()))
  if (!parsed.success) return { erreur: "Formulaire invalide." }

  const d = parsed.data
  await verifierProjet(d.projectId, utilisateur.organizationId)

  const rapport = await prisma.siteReport.create({
    data: {
      projectId: d.projectId,
      auteurId: utilisateur.id,
      date: d.date ? new Date(d.date) : new Date(),
      meteo: d.meteo || null,
      effectif: d.effectif ? Number(d.effectif) : null,
      travauxRealises: d.travauxRealises || null,
      observations: d.observations || null,
      decisions: d.decisions || null,
    },
  })

  // Photos jointes au rapport
  const photos = donnees.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0)
  for (const photo of photos) {
    try {
      const fichier = await enregistrerFichier(photo, utilisateur.organizationId, "photos")
      await prisma.sitePhoto.create({
        data: {
          projectId: d.projectId,
          siteReportId: rapport.id,
          url: fichier.url,
          legende: fichier.nom,
        },
      })
    } catch (erreur) {
      console.warn("[chantier] photo non enregistree", erreur)
    }
  }

  revalidatePath(`/dashboard/projets/${d.projectId}/chantier`)
  return { ok: true }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Photos
// ═══════════════════════════════════════════════════════════════════════════

export async function televerserPhotos(
  _etat: EtatChantier,
  donnees: FormData
): Promise<EtatChantier> {
  const utilisateur = await requireAccess("chantier", "create")
  const projectId = String(donnees.get("projectId") ?? "")
  const lotId = String(donnees.get("lotId") ?? "")
  const legende = String(donnees.get("legende") ?? "")
  const localisation = String(donnees.get("localisation") ?? "")

  await verifierProjet(projectId, utilisateur.organizationId)

  const photos = donnees.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0)
  if (photos.length === 0) return { erreur: "Selectionnez au moins une photo." }

  for (const photo of photos) {
    try {
      const fichier = await enregistrerFichier(photo, utilisateur.organizationId, "photos")
      await prisma.sitePhoto.create({
        data: {
          projectId,
          lotId: lotId || null,
          url: fichier.url,
          legende: legende || fichier.nom,
          localisation: localisation || null,
        },
      })
    } catch (erreur) {
      return { erreur: erreur instanceof Error ? erreur.message : "Televersement impossible." }
    }
  }

  revalidatePath(`/dashboard/projets/${projectId}/chantier`)
  return { ok: true }
}

export async function supprimerPhoto(photoId: string): Promise<void> {
  const utilisateur = await requireAccess("chantier", "delete")
  const photo = await prisma.sitePhoto.findFirst({
    where: { id: photoId, project: { organizationId: utilisateur.organizationId } },
    select: { id: true, projectId: true },
  })
  if (!photo) throw new Error("Photo introuvable.")

  await prisma.sitePhoto.delete({ where: { id: photoId } })
  revalidatePath(`/dashboard/projets/${photo.projectId}/chantier`)
}

// ═══════════════════════════════════════════════════════════════════════════
//  Incidents
// ═══════════════════════════════════════════════════════════════════════════

const schemaIncident = z.object({
  projectId: z.string().min(1),
  incidentId: z.string().optional(),
  lotId: z.string().optional(),
  titre: z.string().min(3, "Titre obligatoire."),
  gravite: z.string().min(1),
  description: z.string().optional(),
  actionCorrective: z.string().optional(),
  impactCout: z.coerce.number().default(0),
  impactDelaiJours: z.coerce.number().int().default(0),
})

export async function enregistrerIncident(
  _etat: EtatChantier,
  donnees: FormData
): Promise<EtatChantier> {
  const utilisateur = await requireAccess("chantier", "create")
  const parsed = schemaIncident.safeParse(Object.fromEntries(donnees.entries()))
  if (!parsed.success) {
    return { erreur: parsed.error.issues[0]?.message ?? "Formulaire invalide." }
  }

  const d = parsed.data
  await verifierProjet(d.projectId, utilisateur.organizationId)

  const commun = {
    lotId: d.lotId && d.lotId !== "" ? d.lotId : null,
    titre: d.titre,
    gravite: d.gravite as never,
    description: d.description || null,
    actionCorrective: d.actionCorrective || null,
    impactCout: d.impactCout,
    impactDelaiJours: d.impactDelaiJours,
  }

  if (d.incidentId) {
    await prisma.incident.update({ where: { id: d.incidentId }, data: commun })
  } else {
    await prisma.incident.create({ data: { ...commun, projectId: d.projectId } })
  }

  revalidatePath(`/dashboard/projets/${d.projectId}/chantier`)
  revalidatePath("/dashboard")
  return { ok: true }
}

export async function changerStatutIncident(incidentId: string, statut: string): Promise<void> {
  const utilisateur = await requireAccess("chantier", "update")
  const incident = await prisma.incident.findFirst({
    where: { id: incidentId, project: { organizationId: utilisateur.organizationId } },
    select: { id: true, projectId: true },
  })
  if (!incident) throw new Error("Incident introuvable.")

  await prisma.incident.update({
    where: { id: incidentId },
    data: {
      statut: statut as never,
      ...(statut === "RESOLU" || statut === "CLOS" ? { dateCloture: new Date() } : {}),
    },
  })

  revalidatePath(`/dashboard/projets/${incident.projectId}/chantier`)
}

// ═══════════════════════════════════════════════════════════════════════════
//  Reserves
// ═══════════════════════════════════════════════════════════════════════════

const schemaReserve = z.object({
  projectId: z.string().min(1),
  lotId: z.string().optional(),
  libelle: z.string().min(3, "Libelle obligatoire."),
  localisation: z.string().optional(),
  dateLimite: z.string().optional(),
  commentaire: z.string().optional(),
})

export async function enregistrerReserve(
  _etat: EtatChantier,
  donnees: FormData
): Promise<EtatChantier> {
  const utilisateur = await requireAccess("chantier", "create")
  const parsed = schemaReserve.safeParse(Object.fromEntries(donnees.entries()))
  if (!parsed.success) {
    return { erreur: parsed.error.issues[0]?.message ?? "Formulaire invalide." }
  }

  const d = parsed.data
  await verifierProjet(d.projectId, utilisateur.organizationId)

  await prisma.reservation.create({
    data: {
      projectId: d.projectId,
      lotId: d.lotId && d.lotId !== "" ? d.lotId : null,
      libelle: d.libelle,
      localisation: d.localisation || null,
      dateLimite: d.dateLimite ? new Date(d.dateLimite) : null,
      commentaire: d.commentaire || null,
    },
  })

  revalidatePath(`/dashboard/projets/${d.projectId}/chantier`)
  return { ok: true }
}

export async function leverReserve(reserveId: string, statut: string): Promise<void> {
  const utilisateur = await requireAccess("chantier", "update")
  const reserve = await prisma.reservation.findFirst({
    where: { id: reserveId, project: { organizationId: utilisateur.organizationId } },
    select: { id: true, projectId: true },
  })
  if (!reserve) throw new Error("Reserve introuvable.")

  await prisma.reservation.update({
    where: { id: reserveId },
    data: {
      statut: statut as never,
      ...(statut === "LEVEE" ? { dateLevee: new Date() } : { dateLevee: null }),
    },
  })

  revalidatePath(`/dashboard/projets/${reserve.projectId}/chantier`)
}

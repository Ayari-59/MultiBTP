"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireAccess } from "@/lib/session"
import { enregistrerFichier, supprimerFichier } from "@/lib/storage"

export type EtatDocument = { erreur?: string; ok?: boolean }

/**
 * Versement de documents dans la GED du projet.
 * Le versionnage est implicite : deposer un fichier portant le meme nom dans
 * la meme categorie incremente la version et conserve les precedentes.
 */
export async function televerserDocuments(
  _etat: EtatDocument,
  donnees: FormData
): Promise<EtatDocument> {
  const utilisateur = await requireAccess("documents", "create")

  const projectId = String(donnees.get("projectId") ?? "") || null
  const categorie = String(donnees.get("categorie") ?? "AUTRE")
  const description = String(donnees.get("description") ?? "")
  const visibleClient = donnees.get("visibleClient") === "on"
  const visibleSousTraitant = donnees.get("visibleSousTraitant") === "on"

  if (projectId) {
    const projet = await prisma.project.findFirst({
      where: { id: projectId, organizationId: utilisateur.organizationId },
      select: { id: true },
    })
    if (!projet) return { erreur: "Projet introuvable." }
  }

  const fichiers = donnees
    .getAll("fichiers")
    .filter((f): f is File => f instanceof File && f.size > 0)
  if (fichiers.length === 0) return { erreur: "Selectionnez au moins un fichier." }

  for (const fichier of fichiers) {
    try {
      const enregistre = await enregistrerFichier(
        fichier,
        utilisateur.organizationId,
        `documents/${categorie.toLowerCase()}`
      )

      const precedent = await prisma.document.findFirst({
        where: {
          organizationId: utilisateur.organizationId,
          projectId,
          categorie: categorie as never,
          nom: enregistre.nom,
        },
        orderBy: { version: "desc" },
        select: { version: true },
      })

      await prisma.document.create({
        data: {
          organizationId: utilisateur.organizationId,
          projectId,
          categorie: categorie as never,
          nom: enregistre.nom,
          description: description || null,
          url: enregistre.url,
          mimeType: enregistre.mimeType,
          taille: enregistre.taille,
          version: (precedent?.version ?? 0) + 1,
          visibleClient,
          visibleSousTraitant,
          auteur: utilisateur.nom,
        },
      })
    } catch (erreur) {
      return { erreur: erreur instanceof Error ? erreur.message : "Televersement impossible." }
    }
  }

  if (projectId) revalidatePath(`/dashboard/projets/${projectId}/documents`)
  return { ok: true }
}

export async function supprimerDocument(documentId: string): Promise<void> {
  const utilisateur = await requireAccess("documents", "delete")
  const document = await prisma.document.findFirst({
    where: { id: documentId, organizationId: utilisateur.organizationId },
    select: { id: true, projectId: true, url: true },
  })
  if (!document) throw new Error("Document introuvable.")

  await prisma.document.delete({ where: { id: documentId } })

  // Le fichier physique n'est efface que si aucune autre fiche ne le reference.
  const encoreUtilise = await prisma.document.count({ where: { url: document.url } })
  if (encoreUtilise === 0) {
    await supprimerFichier(document.url.replace("/api/fichiers/", ""))
  }

  if (document.projectId) revalidatePath(`/dashboard/projets/${document.projectId}/documents`)
}

export async function basculerVisibilite(
  documentId: string,
  cible: "client" | "sousTraitant"
): Promise<void> {
  const utilisateur = await requireAccess("documents", "update")
  const document = await prisma.document.findFirst({
    where: { id: documentId, organizationId: utilisateur.organizationId },
    select: { id: true, projectId: true, visibleClient: true, visibleSousTraitant: true },
  })
  if (!document) throw new Error("Document introuvable.")

  await prisma.document.update({
    where: { id: documentId },
    data:
      cible === "client"
        ? { visibleClient: !document.visibleClient }
        : { visibleSousTraitant: !document.visibleSousTraitant },
  })

  if (document.projectId) revalidatePath(`/dashboard/projets/${document.projectId}/documents`)
}

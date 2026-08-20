"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireAccess } from "@/lib/session"
import { enregistrerFichier } from "@/lib/storage"
import { arrondi } from "@/lib/utils"

export type EtatSousTraitant = { erreur?: string; ok?: boolean }

const schema = z.object({
  subcontractorId: z.string().optional(),
  raisonSociale: z.string().min(2, "Raison sociale obligatoire."),
  siret: z.string().optional(),
  formeJuridique: z.string().optional(),
  contactNom: z.string().optional(),
  email: z.string().optional(),
  telephone: z.string().optional(),
  adresse: z.string().optional(),
  codePostal: z.string().optional(),
  ville: z.string().optional(),
  zoneGeo: z.string().optional(),
  effectif: z.string().optional(),
  caAnnuel: z.string().optional(),
  noteQualite: z.coerce.number().min(0).max(5).default(3),
  noteDelai: z.coerce.number().min(0).max(5).default(3),
  noteRelation: z.coerce.number().min(0).max(5).default(3),
  nbLitiges: z.coerce.number().int().min(0).default(0),
  notes: z.string().optional(),
})

export async function enregistrerSousTraitant(
  _etat: EtatSousTraitant,
  donnees: FormData
): Promise<EtatSousTraitant> {
  const utilisateur = await requireAccess("sous_traitants", "update")
  const parsed = schema.safeParse(Object.fromEntries(donnees.entries()))
  if (!parsed.success) {
    return { erreur: parsed.error.issues[0]?.message ?? "Formulaire invalide." }
  }

  const { subcontractorId, ...d } = parsed.data
  const specialites = donnees.getAll("specialites").map(String)

  // La notation globale est la moyenne des trois notes de detail : un seul
  // chiffre a comparer dans le comparateur d'offres.
  const notation = arrondi((d.noteQualite + d.noteDelai + d.noteRelation) / 3, 2)

  const valeurs = {
    raisonSociale: d.raisonSociale,
    siret: d.siret || null,
    formeJuridique: d.formeJuridique || null,
    contactNom: d.contactNom || null,
    email: d.email || null,
    telephone: d.telephone || null,
    adresse: d.adresse || null,
    codePostal: d.codePostal || null,
    ville: d.ville || null,
    zoneGeo: d.zoneGeo || null,
    effectif: d.effectif ? Number(d.effectif) : null,
    caAnnuel: d.caAnnuel ? Number(d.caAnnuel) : null,
    noteQualite: d.noteQualite,
    noteDelai: d.noteDelai,
    noteRelation: d.noteRelation,
    notation,
    nbLitiges: d.nbLitiges,
    notes: d.notes || null,
    specialites: specialites as never[],
    assuranceRcValide: donnees.get("assuranceRcValide") === "on",
    assuranceDecennaleValide: donnees.get("assuranceDecennaleValide") === "on",
    attestationVigilanceValide: donnees.get("attestationVigilanceValide") === "on",
    dateValiditeDocuments: donnees.get("dateValiditeDocuments")
      ? new Date(String(donnees.get("dateValiditeDocuments")))
      : null,
  }

  if (subcontractorId) {
    const existe = await prisma.subcontractor.findFirst({
      where: { id: subcontractorId, organizationId: utilisateur.organizationId },
      select: { id: true },
    })
    if (!existe) return { erreur: "Entreprise introuvable." }
    await prisma.subcontractor.update({ where: { id: subcontractorId }, data: valeurs })
  } else {
    await prisma.subcontractor.create({
      data: { ...valeurs, organizationId: utilisateur.organizationId },
    })
  }

  revalidatePath("/dashboard/sous-traitants")
  if (subcontractorId) revalidatePath(`/dashboard/sous-traitants/${subcontractorId}`)
  return { ok: true }
}

export async function basculerActivationSousTraitant(subcontractorId: string): Promise<void> {
  const utilisateur = await requireAccess("sous_traitants", "update")
  const st = await prisma.subcontractor.findFirst({
    where: { id: subcontractorId, organizationId: utilisateur.organizationId },
    select: { id: true, actif: true },
  })
  if (!st) throw new Error("Entreprise introuvable.")

  await prisma.subcontractor.update({ where: { id: subcontractorId }, data: { actif: !st.actif } })
  revalidatePath("/dashboard/sous-traitants")
}

export async function supprimerSousTraitant(subcontractorId: string): Promise<void> {
  const utilisateur = await requireAccess("sous_traitants", "delete")
  const st = await prisma.subcontractor.findFirst({
    where: { id: subcontractorId, organizationId: utilisateur.organizationId },
    select: { id: true, _count: { select: { contracts: true } } },
  })
  if (!st) throw new Error("Entreprise introuvable.")
  if (st._count.contracts > 0) {
    throw new Error("Cette entreprise a des marches : desactivez-la plutot que de la supprimer.")
  }

  await prisma.subcontractor.delete({ where: { id: subcontractorId } })
  revalidatePath("/dashboard/sous-traitants")
}

/** Depot d'une piece administrative (Kbis, assurance, attestation). */
export async function televerserPieces(
  _etat: EtatSousTraitant,
  donnees: FormData
): Promise<EtatSousTraitant> {
  const utilisateur = await requireAccess("sous_traitants", "update")
  const subcontractorId = String(donnees.get("subcontractorId") ?? "")
  const type = String(donnees.get("type") ?? "AUTRE")
  const dateExpiration = String(donnees.get("dateExpiration") ?? "")

  const st = await prisma.subcontractor.findFirst({
    where: { id: subcontractorId, organizationId: utilisateur.organizationId },
    select: { id: true },
  })
  if (!st) return { erreur: "Entreprise introuvable." }

  const fichiers = donnees
    .getAll("fichiers")
    .filter((f): f is File => f instanceof File && f.size > 0)
  if (fichiers.length === 0) return { erreur: "Selectionnez au moins un fichier." }

  for (const fichier of fichiers) {
    try {
      const enregistre = await enregistrerFichier(
        fichier,
        utilisateur.organizationId,
        "sous-traitants"
      )
      await prisma.subcontractorDocument.create({
        data: {
          subcontractorId,
          type: type as never,
          nom: enregistre.nom,
          url: enregistre.url,
          dateEmission: new Date(),
          dateExpiration: dateExpiration ? new Date(dateExpiration) : null,
        },
      })
    } catch (erreur) {
      return { erreur: erreur instanceof Error ? erreur.message : "Televersement impossible." }
    }
  }

  // Le depot d'une piece valide automatiquement l'indicateur correspondant.
  const misesAJour: Record<string, Record<string, boolean>> = {
    ASSURANCE_RC: { assuranceRcValide: true },
    ASSURANCE_DECENNALE: { assuranceDecennaleValide: true },
    ATTESTATION_VIGILANCE: { attestationVigilanceValide: true },
  }
  if (misesAJour[type]) {
    await prisma.subcontractor.update({
      where: { id: subcontractorId },
      data: {
        ...misesAJour[type],
        ...(dateExpiration ? { dateValiditeDocuments: new Date(dateExpiration) } : {}),
      },
    })
  }

  revalidatePath(`/dashboard/sous-traitants/${subcontractorId}`)
  return { ok: true }
}

export async function supprimerPiece(documentId: string): Promise<void> {
  const utilisateur = await requireAccess("sous_traitants", "update")
  const piece = await prisma.subcontractorDocument.findFirst({
    where: {
      id: documentId,
      subcontractor: { organizationId: utilisateur.organizationId },
    },
    select: { id: true, subcontractorId: true },
  })
  if (!piece) throw new Error("Piece introuvable.")

  await prisma.subcontractorDocument.delete({ where: { id: documentId } })
  revalidatePath(`/dashboard/sous-traitants/${piece.subcontractorId}`)
}

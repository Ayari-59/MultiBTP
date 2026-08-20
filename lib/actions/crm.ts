"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireAccess } from "@/lib/session"

export type EtatCrm = { erreur?: string; ok?: boolean }

const schemaContact = z.object({
  contactId: z.string().optional(),
  type: z.string().min(1),
  nom: z.string().min(2, "Nom obligatoire."),
  prenom: z.string().optional(),
  societe: z.string().optional(),
  siret: z.string().optional(),
  email: z.string().optional(),
  telephone: z.string().optional(),
  adresse: z.string().optional(),
  codePostal: z.string().optional(),
  ville: z.string().optional(),
  origine: z.string().optional(),
  notes: z.string().optional(),
})

export async function enregistrerContact(_etat: EtatCrm, donnees: FormData): Promise<EtatCrm> {
  const utilisateur = await requireAccess("crm", "update")
  const parsed = schemaContact.safeParse(Object.fromEntries(donnees.entries()))
  if (!parsed.success) {
    return { erreur: parsed.error.issues[0]?.message ?? "Formulaire invalide." }
  }

  const { contactId, ...d } = parsed.data
  const valeurs = {
    type: d.type as never,
    nom: d.nom,
    prenom: d.prenom || null,
    societe: d.societe || null,
    siret: d.siret || null,
    email: d.email || null,
    telephone: d.telephone || null,
    adresse: d.adresse || null,
    codePostal: d.codePostal || null,
    ville: d.ville || null,
    origine: d.origine || null,
    notes: d.notes || null,
  }

  if (contactId) {
    const existe = await prisma.contact.findFirst({
      where: { id: contactId, organizationId: utilisateur.organizationId },
      select: { id: true },
    })
    if (!existe) return { erreur: "Contact introuvable." }
    await prisma.contact.update({ where: { id: contactId }, data: valeurs })
  } else {
    await prisma.contact.create({
      data: { ...valeurs, organizationId: utilisateur.organizationId },
    })
  }

  revalidatePath("/dashboard/crm")
  return { ok: true }
}

export async function supprimerContact(contactId: string): Promise<void> {
  const utilisateur = await requireAccess("crm", "delete")
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, organizationId: utilisateur.organizationId },
    select: { id: true, _count: { select: { projects: true } } },
  })
  if (!contact) throw new Error("Contact introuvable.")
  if (contact._count.projects > 0) {
    throw new Error("Ce contact est rattache a des projets : archivez-le plutot que de le supprimer.")
  }

  await prisma.contact.delete({ where: { id: contactId } })
  revalidatePath("/dashboard/crm")
}

// ═══════════════════════════════════════════════════════════════════════════
//  Pipeline commercial
// ═══════════════════════════════════════════════════════════════════════════

const schemaAffaire = z.object({
  dealId: z.string().optional(),
  contactId: z.string().min(1, "Selectionnez un contact."),
  titre: z.string().min(3, "Intitule obligatoire."),
  stage: z.string().min(1),
  montantEstime: z.string().optional(),
  probabilite: z.coerce.number().min(0).max(100).default(20),
  dateCloturePrevue: z.string().optional(),
  description: z.string().optional(),
  motifPerte: z.string().optional(),
})

export async function enregistrerAffaire(_etat: EtatCrm, donnees: FormData): Promise<EtatCrm> {
  const utilisateur = await requireAccess("crm", "update")
  const parsed = schemaAffaire.safeParse(Object.fromEntries(donnees.entries()))
  if (!parsed.success) {
    return { erreur: parsed.error.issues[0]?.message ?? "Formulaire invalide." }
  }

  const { dealId, ...d } = parsed.data
  const contact = await prisma.contact.findFirst({
    where: { id: d.contactId, organizationId: utilisateur.organizationId },
    select: { id: true },
  })
  if (!contact) return { erreur: "Contact introuvable." }

  const valeurs = {
    contactId: d.contactId,
    titre: d.titre,
    stage: d.stage as never,
    montantEstime: d.montantEstime ? Number(d.montantEstime) : null,
    probabilite: d.probabilite,
    dateCloturePrevue: d.dateCloturePrevue ? new Date(d.dateCloturePrevue) : null,
    description: d.description || null,
    motifPerte: d.motifPerte || null,
  }

  if (dealId) {
    await prisma.deal.update({ where: { id: dealId }, data: valeurs })
  } else {
    await prisma.deal.create({
      data: { ...valeurs, organizationId: utilisateur.organizationId },
    })
  }

  revalidatePath("/dashboard/crm")
  return { ok: true }
}

/** Deplacement d'une affaire dans le pipeline. */
export async function changerEtapeAffaire(dealId: string, stage: string): Promise<void> {
  const utilisateur = await requireAccess("crm", "update")
  const affaire = await prisma.deal.findFirst({
    where: { id: dealId, organizationId: utilisateur.organizationId },
    select: { id: true, contactId: true },
  })
  if (!affaire) throw new Error("Affaire introuvable.")

  // Une affaire gagnee transforme le prospect en client.
  await prisma.$transaction(async (tx) => {
    await tx.deal.update({
      where: { id: dealId },
      data: {
        stage: stage as never,
        probabilite: stage === "GAGNE" ? 100 : stage === "PERDU" ? 0 : undefined,
      },
    })
    if (stage === "GAGNE") {
      await tx.contact.updateMany({
        where: { id: affaire.contactId, type: "PROSPECT" },
        data: { type: "CLIENT" },
      })
    }
  })

  revalidatePath("/dashboard/crm")
  revalidatePath("/dashboard")
}

export async function supprimerAffaire(dealId: string): Promise<void> {
  const utilisateur = await requireAccess("crm", "delete")
  const affaire = await prisma.deal.findFirst({
    where: { id: dealId, organizationId: utilisateur.organizationId },
    select: { id: true },
  })
  if (!affaire) throw new Error("Affaire introuvable.")

  await prisma.deal.delete({ where: { id: dealId } })
  revalidatePath("/dashboard/crm")
}

// ═══════════════════════════════════════════════════════════════════════════
//  Historique des echanges
// ═══════════════════════════════════════════════════════════════════════════

export async function enregistrerInteraction(_etat: EtatCrm, donnees: FormData): Promise<EtatCrm> {
  const utilisateur = await requireAccess("crm", "update")

  const contactId = String(donnees.get("contactId") ?? "")
  const objet = String(donnees.get("objet") ?? "")
  if (objet.trim().length < 2) return { erreur: "Objet obligatoire." }

  const contact = await prisma.contact.findFirst({
    where: { id: contactId, organizationId: utilisateur.organizationId },
    select: { id: true },
  })
  if (!contact) return { erreur: "Contact introuvable." }

  await prisma.interaction.create({
    data: {
      contactId,
      canal: String(donnees.get("canal") ?? "Telephone"),
      objet,
      compteRendu: String(donnees.get("compteRendu") ?? "") || null,
      auteur: utilisateur.nom,
      date: donnees.get("date") ? new Date(String(donnees.get("date"))) : new Date(),
    },
  })

  revalidatePath(`/dashboard/crm/${contactId}`)
  return { ok: true }
}

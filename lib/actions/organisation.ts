"use server"

import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireAccess } from "@/lib/session"

export type EtatOrganisation = { erreur?: string; ok?: boolean }

const schemaOrg = z.object({
  nom: z.string().min(2, "Nom obligatoire."),
  prefixe: z.string().min(1).max(6),
  siret: z.string().optional(),
  adresse: z.string().optional(),
  codePostal: z.string().optional(),
  ville: z.string().optional(),
  telephone: z.string().optional(),
  email: z.string().optional(),
  siteWeb: z.string().optional(),
  tauxTva: z.coerce.number().min(0).max(30),
  tauxFraisChantier: z.coerce.number().min(0).max(50),
  tauxFraisGeneraux: z.coerce.number().min(0).max(50),
  margeCibleDefaut: z.coerce.number().min(0).max(80),
  tauxRetenueGarantie: z.coerce.number().min(0).max(20),
  seuilAlerteDerive: z.coerce.number().min(0).max(50),
})

export async function modifierOrganisation(
  _etat: EtatOrganisation,
  donnees: FormData
): Promise<EtatOrganisation> {
  const utilisateur = await requireAccess("organisation", "update")
  const parsed = schemaOrg.safeParse(Object.fromEntries(donnees.entries()))
  if (!parsed.success) {
    return { erreur: parsed.error.issues[0]?.message ?? "Formulaire invalide." }
  }

  const d = parsed.data
  await prisma.organization.update({
    where: { id: utilisateur.organizationId },
    data: {
      nom: d.nom,
      prefixe: d.prefixe.toUpperCase(),
      siret: d.siret || null,
      adresse: d.adresse || null,
      codePostal: d.codePostal || null,
      ville: d.ville || null,
      telephone: d.telephone || null,
      email: d.email || null,
      siteWeb: d.siteWeb || null,
      tauxTva: d.tauxTva,
      tauxFraisChantier: d.tauxFraisChantier,
      tauxFraisGeneraux: d.tauxFraisGeneraux,
      margeCibleDefaut: d.margeCibleDefaut,
      tauxRetenueGarantie: d.tauxRetenueGarantie,
      seuilAlerteDerive: d.seuilAlerteDerive,
    },
  })

  revalidatePath("/dashboard/parametres")
  return { ok: true }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Utilisateurs
// ═══════════════════════════════════════════════════════════════════════════

const schemaUtilisateur = z.object({
  userId: z.string().optional(),
  email: z.string().email("Adresse e-mail invalide."),
  name: z.string().min(2, "Nom obligatoire."),
  role: z.string().min(1),
  fonction: z.string().optional(),
  telephone: z.string().optional(),
  motDePasse: z.string().optional(),
  subcontractorId: z.string().optional(),
  contactId: z.string().optional(),
})

export async function enregistrerUtilisateur(
  _etat: EtatOrganisation,
  donnees: FormData
): Promise<EtatOrganisation> {
  const utilisateur = await requireAccess("utilisateurs", "create")
  const parsed = schemaUtilisateur.safeParse(Object.fromEntries(donnees.entries()))
  if (!parsed.success) {
    return { erreur: parsed.error.issues[0]?.message ?? "Formulaire invalide." }
  }

  const d = parsed.data
  const email = d.email.toLowerCase().trim()

  const valeurs = {
    email,
    name: d.name,
    role: d.role as never,
    fonction: d.fonction || null,
    telephone: d.telephone || null,
    subcontractorId: d.role === "SOUS_TRAITANT" ? d.subcontractorId || null : null,
    contactId: d.role === "CLIENT" ? d.contactId || null : null,
  }

  try {
    if (d.userId) {
      const existe = await prisma.user.findFirst({
        where: { id: d.userId, organizationId: utilisateur.organizationId },
        select: { id: true },
      })
      if (!existe) return { erreur: "Utilisateur introuvable." }

      await prisma.user.update({
        where: { id: d.userId },
        data: {
          ...valeurs,
          ...(d.motDePasse && d.motDePasse.length >= 8
            ? { password: await bcrypt.hash(d.motDePasse, 10) }
            : {}),
        },
      })
    } else {
      if (!d.motDePasse || d.motDePasse.length < 8) {
        return { erreur: "Le mot de passe doit faire au moins 8 caracteres." }
      }

      const organisation = await prisma.organization.findUniqueOrThrow({
        where: { id: utilisateur.organizationId },
        select: { quotaUsers: true, plan: true },
      })
      const nbUtilisateurs = await prisma.user.count({
        where: { organizationId: utilisateur.organizationId },
      })
      if (nbUtilisateurs >= organisation.quotaUsers) {
        return {
          erreur: `Quota atteint : votre abonnement ${organisation.plan} autorise ${organisation.quotaUsers} utilisateurs.`,
        }
      }

      await prisma.user.create({
        data: {
          ...valeurs,
          organizationId: utilisateur.organizationId,
          password: await bcrypt.hash(d.motDePasse, 10),
        },
      })
    }
  } catch {
    return { erreur: "Cette adresse e-mail est deja utilisee." }
  }

  revalidatePath("/dashboard/parametres")
  return { ok: true }
}

export async function basculerActivationUtilisateur(userId: string): Promise<void> {
  const utilisateur = await requireAccess("utilisateurs", "update")
  if (userId === utilisateur.id) throw new Error("Impossible de desactiver son propre compte.")

  const cible = await prisma.user.findFirst({
    where: { id: userId, organizationId: utilisateur.organizationId },
    select: { id: true, actif: true },
  })
  if (!cible) throw new Error("Utilisateur introuvable.")

  await prisma.user.update({ where: { id: userId }, data: { actif: !cible.actif } })
  revalidatePath("/dashboard/parametres")
}

export async function supprimerUtilisateur(userId: string): Promise<void> {
  const utilisateur = await requireAccess("utilisateurs", "delete")
  if (userId === utilisateur.id) throw new Error("Impossible de supprimer son propre compte.")

  const cible = await prisma.user.findFirst({
    where: { id: userId, organizationId: utilisateur.organizationId },
    select: { id: true },
  })
  if (!cible) throw new Error("Utilisateur introuvable.")

  await prisma.user.delete({ where: { id: userId } })
  revalidatePath("/dashboard/parametres")
}

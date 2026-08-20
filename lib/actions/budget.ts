"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireAccess } from "@/lib/session"
import { prochaineReferenceAvenant } from "@/lib/references"
import { expliquerMarge } from "@/lib/ia/analyses"
import { arrondi, nb } from "@/lib/utils"

export type EtatBudget = { erreur?: string; ok?: boolean }

async function verifierProjet(projectId: string, organizationId: string) {
  const projet = await prisma.project.findFirst({
    where: { id: projectId, organizationId },
    select: { id: true, reference: true },
  })
  if (!projet) throw new Error("Projet introuvable.")
  return projet
}

// ═══════════════════════════════════════════════════════════════════════════
//  Engagements et depenses
// ═══════════════════════════════════════════════════════════════════════════

const schemaMouvement = z.object({
  projectId: z.string().min(1),
  lotId: z.string().optional(),
  type: z.enum(["ENGAGEMENT", "DEPENSE"]),
  libelle: z.string().min(2, "Libelle obligatoire."),
  nature: z.string().min(1),
  montantHT: z.coerce.number().positive("Montant obligatoire."),
  date: z.string().optional(),
  reference: z.string().optional(),
  fournisseur: z.string().optional(),
})

export async function enregistrerMouvement(
  _etat: EtatBudget,
  donnees: FormData
): Promise<EtatBudget> {
  const utilisateur = await requireAccess("budget", "create")
  const parsed = schemaMouvement.safeParse(Object.fromEntries(donnees.entries()))
  if (!parsed.success) {
    return { erreur: parsed.error.issues[0]?.message ?? "Formulaire invalide." }
  }

  const d = parsed.data
  await verifierProjet(d.projectId, utilisateur.organizationId)

  const commun = {
    projectId: d.projectId,
    lotId: d.lotId && d.lotId !== "" ? d.lotId : null,
    libelle: d.libelle,
    nature: d.nature as never,
    montantHT: d.montantHT,
    date: d.date ? new Date(d.date) : new Date(),
    reference: d.reference || null,
  }

  if (d.type === "ENGAGEMENT") {
    await prisma.commitment.create({ data: { ...commun, statut: "ENGAGE" } })
  } else {
    await prisma.expense.create({ data: { ...commun, fournisseur: d.fournisseur || null } })
  }

  revalidatePath(`/dashboard/projets/${d.projectId}/budget`)
  revalidatePath(`/dashboard/projets/${d.projectId}`)
  revalidatePath("/dashboard")
  return { ok: true }
}

export async function supprimerMouvement(
  type: "ENGAGEMENT" | "DEPENSE",
  mouvementId: string
): Promise<void> {
  const utilisateur = await requireAccess("budget", "delete")

  if (type === "ENGAGEMENT") {
    const m = await prisma.commitment.findFirst({
      where: { id: mouvementId, project: { organizationId: utilisateur.organizationId } },
      select: { id: true, projectId: true },
    })
    if (!m) throw new Error("Engagement introuvable.")
    await prisma.commitment.delete({ where: { id: mouvementId } })
    revalidatePath(`/dashboard/projets/${m.projectId}/budget`)
  } else {
    const m = await prisma.expense.findFirst({
      where: { id: mouvementId, project: { organizationId: utilisateur.organizationId } },
      select: { id: true, projectId: true },
    })
    if (!m) throw new Error("Depense introuvable.")
    await prisma.expense.delete({ where: { id: mouvementId } })
    revalidatePath(`/dashboard/projets/${m.projectId}/budget`)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Avenants
// ═══════════════════════════════════════════════════════════════════════════

const schemaAvenant = z.object({
  projectId: z.string().min(1),
  avenantId: z.string().optional(),
  lotId: z.string().optional(),
  contractId: z.string().optional(),
  motif: z.string().min(3, "Motif obligatoire."),
  origine: z.string().min(1),
  impactCout: z.coerce.number().default(0),
  impactVente: z.coerce.number().default(0),
  impactDelaiJours: z.coerce.number().int().default(0),
  description: z.string().optional(),
})

export async function enregistrerAvenant(
  _etat: EtatBudget,
  donnees: FormData
): Promise<EtatBudget> {
  const utilisateur = await requireAccess("budget", "create")
  const parsed = schemaAvenant.safeParse(Object.fromEntries(donnees.entries()))
  if (!parsed.success) {
    return { erreur: parsed.error.issues[0]?.message ?? "Formulaire invalide." }
  }

  const d = parsed.data
  const projet = await verifierProjet(d.projectId, utilisateur.organizationId)

  const commun = {
    lotId: d.lotId && d.lotId !== "" ? d.lotId : null,
    contractId: d.contractId && d.contractId !== "" ? d.contractId : null,
    motif: d.motif,
    origine: d.origine as never,
    impactCout: d.impactCout,
    impactVente: d.impactVente,
    impactDelaiJours: d.impactDelaiJours,
    description: d.description || null,
  }

  if (d.avenantId) {
    await prisma.changeOrder.update({ where: { id: d.avenantId }, data: commun })
  } else {
    await prisma.changeOrder.create({
      data: {
        ...commun,
        projectId: d.projectId,
        reference: await prochaineReferenceAvenant(d.projectId, projet.reference),
        statut: "CHIFFRE",
      },
    })
  }

  revalidatePath(`/dashboard/projets/${d.projectId}/avenants`)
  return { ok: true }
}

/**
 * Decision sur un avenant. L'acceptation repercute immediatement l'impact sur
 * le marche du sous-traitant, le planning et le budget du projet.
 */
export async function deciderAvenant(avenantId: string, statut: "ACCEPTE" | "REFUSE"): Promise<void> {
  const utilisateur = await requireAccess("budget", "update")
  const avenant = await prisma.changeOrder.findFirst({
    where: { id: avenantId, project: { organizationId: utilisateur.organizationId } },
    include: {
      project: { select: { id: true, dateFinPrevue: true } },
      contract: { select: { id: true, montantActualise: true, dateFin: true } },
    },
  })
  if (!avenant) throw new Error("Avenant introuvable.")

  await prisma.$transaction(async (tx) => {
    await tx.changeOrder.update({
      where: { id: avenantId },
      data: { statut, dateDecision: new Date() },
    })

    if (statut !== "ACCEPTE") return

    // Marche du sous-traitant : le montant actualise integre l'avenant.
    if (avenant.contract) {
      const nouveauMontant = arrondi(nb(avenant.contract.montantActualise) + nb(avenant.impactCout))
      await tx.contract.update({
        where: { id: avenant.contract.id },
        data: {
          montantActualise: nouveauMontant,
          ...(avenant.impactDelaiJours !== 0 && avenant.contract.dateFin
            ? {
                dateFin: new Date(
                  avenant.contract.dateFin.getTime() + avenant.impactDelaiJours * 86_400_000
                ),
              }
            : {}),
        },
      })

      // Le surcout devient un engagement supplementaire.
      if (nb(avenant.impactCout) !== 0) {
        await tx.commitment.create({
          data: {
            projectId: avenant.projectId,
            lotId: avenant.lotId,
            contractId: avenant.contract.id,
            libelle: `Avenant ${avenant.reference} — ${avenant.motif}`,
            nature: "SOUS_TRAITANCE",
            montantHT: nb(avenant.impactCout),
            statut: "ENGAGE",
            reference: avenant.reference,
          },
        })
      }
    } else if (nb(avenant.impactCout) !== 0) {
      await tx.commitment.create({
        data: {
          projectId: avenant.projectId,
          lotId: avenant.lotId,
          libelle: `Avenant ${avenant.reference} — ${avenant.motif}`,
          nature: "AUTRE",
          montantHT: nb(avenant.impactCout),
          statut: "ENGAGE",
          reference: avenant.reference,
        },
      })
    }

    // Report de la date de fin du projet.
    if (avenant.impactDelaiJours !== 0 && avenant.project.dateFinPrevue) {
      await tx.project.update({
        where: { id: avenant.projectId },
        data: {
          dateFinPrevue: new Date(
            avenant.project.dateFinPrevue.getTime() + avenant.impactDelaiJours * 86_400_000
          ),
        },
      })
    }
  })

  revalidatePath(`/dashboard/projets/${avenant.projectId}/avenants`)
  revalidatePath(`/dashboard/projets/${avenant.projectId}/budget`)
  revalidatePath(`/dashboard/projets/${avenant.projectId}`)
  revalidatePath("/dashboard")
}

export async function supprimerAvenant(avenantId: string): Promise<void> {
  const utilisateur = await requireAccess("budget", "delete")
  const avenant = await prisma.changeOrder.findFirst({
    where: { id: avenantId, project: { organizationId: utilisateur.organizationId } },
    select: { id: true, projectId: true, statut: true },
  })
  if (!avenant) throw new Error("Avenant introuvable.")
  if (avenant.statut === "ACCEPTE") {
    throw new Error("Un avenant accepte ne peut pas etre supprime : passez-le en refuse.")
  }

  await prisma.changeOrder.delete({ where: { id: avenantId } })
  revalidatePath(`/dashboard/projets/${avenant.projectId}/avenants`)
}

// ═══════════════════════════════════════════════════════════════════════════
//  Analyse IA de la marge
// ═══════════════════════════════════════════════════════════════════════════

export async function analyserMarge(projectId: string): Promise<string> {
  const utilisateur = await requireAccess("budget", "read")
  return expliquerMarge(projectId, utilisateur.organizationId)
}

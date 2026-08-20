"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireAccess } from "@/lib/session"
import { calculerSituation } from "@/lib/metier/budget"
import { prochainNumeroSituation } from "@/lib/references"
import { arrondi, nb } from "@/lib/utils"

export type EtatSituation = { erreur?: string; ok?: boolean }

// ═══════════════════════════════════════════════════════════════════════════
//  Situations de travaux
// ═══════════════════════════════════════════════════════════════════════════

const schemaSituation = z.object({
  contractId: z.string().min(1),
  periode: z.string().min(3, "Periode obligatoire."),
  avancementCumule: z.coerce.number().min(0).max(100),
  observations: z.string().optional(),
})

export async function deposerSituation(
  _etat: EtatSituation,
  donnees: FormData
): Promise<EtatSituation> {
  const utilisateur = await requireAccess("situations", "create")
  const parsed = schemaSituation.safeParse(Object.fromEntries(donnees.entries()))
  if (!parsed.success) {
    return { erreur: parsed.error.issues[0]?.message ?? "Formulaire invalide." }
  }

  const d = parsed.data
  const marche = await prisma.contract.findFirst({
    where: {
      id: d.contractId,
      organizationId: utilisateur.organizationId,
      // Un sous-traitant ne depose que sur ses propres marches.
      ...(utilisateur.role === "SOUS_TRAITANT"
        ? { subcontractorId: utilisateur.subcontractorId ?? "—" }
        : {}),
    },
    select: {
      id: true,
      projectId: true,
      montantInitial: true,
      montantActualise: true,
      tauxRetenueGarantie: true,
    },
  })
  if (!marche) return { erreur: "Marche introuvable." }

  const precedentes = await prisma.situation.findMany({
    where: { contractId: d.contractId, statut: "VALIDEE" },
    select: { montantHT: true, avancementCumule: true },
  })

  const cumulPrecedent = precedentes.reduce((s, p) => s + nb(p.montantHT), 0)
  const avancementPrecedent = Math.max(0, ...precedentes.map((p) => nb(p.avancementCumule)), 0)

  if (d.avancementCumule < avancementPrecedent) {
    return {
      erreur: `L'avancement cumule ne peut pas etre inferieur a celui de la situation precedente (${avancementPrecedent} %).`,
    }
  }

  const calcul = calculerSituation({
    marcheInitial: nb(marche.montantInitial),
    avenants: nb(marche.montantActualise) - nb(marche.montantInitial),
    cumulPrecedent,
    avancementCumule: d.avancementCumule,
    tauxRetenueGarantie: nb(marche.tauxRetenueGarantie, 5),
  })

  if (calcul.montantSituation <= 0) {
    return { erreur: "Le montant de la situation est nul ou negatif : verifiez l'avancement declare." }
  }

  await prisma.situation.create({
    data: {
      projectId: marche.projectId,
      contractId: d.contractId,
      numero: await prochainNumeroSituation(d.contractId),
      periode: d.periode,
      avancementCumule: d.avancementCumule,
      cumulPrecedent: calcul.cumulPrecedent,
      montantHT: calcul.montantSituation,
      retenueGarantie: calcul.retenueGarantie,
      netAPayer: calcul.netAPayer,
      observations: d.observations || null,
    },
  })

  revalidatePath(`/dashboard/projets/${marche.projectId}/situations`)
  revalidatePath("/dashboard/factures")
  revalidatePath("/portail")
  return { ok: true }
}

/**
 * Validation d'une situation : elle genere la facture fournisseur
 * correspondante, qui alimentera le cout realise une fois validee.
 */
export async function validerSituation(situationId: string, statut: "VALIDEE" | "REJETEE"): Promise<void> {
  const utilisateur = await requireAccess("situations", "update")
  const situation = await prisma.situation.findFirst({
    where: { id: situationId, project: { organizationId: utilisateur.organizationId } },
    include: {
      contract: {
        select: { reference: true, subcontractor: { select: { raisonSociale: true } } },
      },
      project: { select: { id: true, tauxTva: true } },
    },
  })
  if (!situation) throw new Error("Situation introuvable.")

  await prisma.$transaction(async (tx) => {
    await tx.situation.update({
      where: { id: situationId },
      data: { statut, dateValidation: statut === "VALIDEE" ? new Date() : null },
    })

    if (statut !== "VALIDEE") return

    const dejaFacturee = await tx.invoice.findFirst({ where: { situationId } })
    if (dejaFacturee) return

    const montantHT = nb(situation.netAPayer)
    const tauxTva = nb(situation.project.tauxTva, 20)

    await tx.invoice.create({
      data: {
        projectId: situation.projectId,
        contractId: situation.contractId,
        situationId,
        sens: "FOURNISSEUR",
        numero: `${situation.contract.reference}-S${String(situation.numero).padStart(2, "0")}`,
        emetteur: situation.contract.subcontractor.raisonSociale,
        montantHT,
        tauxTva,
        montantTTC: arrondi(montantHT * (1 + tauxTva / 100)),
      },
    })
  })

  revalidatePath(`/dashboard/projets/${situation.projectId}/situations`)
  revalidatePath("/dashboard/factures")
}

export async function supprimerSituation(situationId: string): Promise<void> {
  const utilisateur = await requireAccess("situations", "delete")
  const situation = await prisma.situation.findFirst({
    where: { id: situationId, project: { organizationId: utilisateur.organizationId } },
    select: { id: true, projectId: true, statut: true },
  })
  if (!situation) throw new Error("Situation introuvable.")
  if (situation.statut === "VALIDEE") {
    throw new Error("Une situation validee ne peut pas etre supprimee.")
  }

  await prisma.situation.delete({ where: { id: situationId } })
  revalidatePath(`/dashboard/projets/${situation.projectId}/situations`)
}

// ═══════════════════════════════════════════════════════════════════════════
//  Factures
// ═══════════════════════════════════════════════════════════════════════════

const schemaFacture = z.object({
  projectId: z.string().min(1),
  contractId: z.string().optional(),
  sens: z.enum(["FOURNISSEUR", "CLIENT"]),
  numero: z.string().min(1, "Numero obligatoire."),
  emetteur: z.string().min(2, "Emetteur obligatoire."),
  montantHT: z.coerce.number().positive("Montant obligatoire."),
  tauxTva: z.coerce.number().min(0).max(30).default(20),
  dateEmission: z.string().optional(),
  dateEcheance: z.string().optional(),
})

export async function enregistrerFacture(
  _etat: EtatSituation,
  donnees: FormData
): Promise<EtatSituation> {
  const utilisateur = await requireAccess("situations", "create")
  const parsed = schemaFacture.safeParse(Object.fromEntries(donnees.entries()))
  if (!parsed.success) {
    return { erreur: parsed.error.issues[0]?.message ?? "Formulaire invalide." }
  }

  const d = parsed.data
  const projet = await prisma.project.findFirst({
    where: { id: d.projectId, organizationId: utilisateur.organizationId },
    select: { id: true },
  })
  if (!projet) return { erreur: "Projet introuvable." }

  await prisma.invoice.create({
    data: {
      projectId: d.projectId,
      contractId: d.contractId && d.contractId !== "" ? d.contractId : null,
      sens: d.sens,
      numero: d.numero,
      emetteur: d.emetteur,
      montantHT: d.montantHT,
      tauxTva: d.tauxTva,
      montantTTC: arrondi(d.montantHT * (1 + d.tauxTva / 100)),
      dateEmission: d.dateEmission ? new Date(d.dateEmission) : new Date(),
      dateEcheance: d.dateEcheance ? new Date(d.dateEcheance) : null,
    },
  })

  revalidatePath(`/dashboard/projets/${d.projectId}/situations`)
  revalidatePath("/dashboard/factures")
  return { ok: true }
}

/**
 * Changement de statut d'une facture. La validation d'une facture fournisseur
 * cree la depense correspondante : c'est le moment ou le cout devient realise.
 */
export async function changerStatutFacture(invoiceId: string, statut: string): Promise<void> {
  const utilisateur = await requireAccess("situations", "update")
  const facture = await prisma.invoice.findFirst({
    where: { id: invoiceId, project: { organizationId: utilisateur.organizationId } },
    include: {
      contract: { select: { lotId: true } },
      expenses: { select: { id: true } },
    },
  })
  if (!facture) throw new Error("Facture introuvable.")

  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        statut: statut as never,
        ...(statut === "PAYEE" ? { datePaiement: new Date() } : {}),
      },
    })

    const doitCreerDepense =
      (statut === "VALIDEE" || statut === "PAYEE") &&
      facture.sens === "FOURNISSEUR" &&
      facture.expenses.length === 0

    if (doitCreerDepense) {
      await tx.expense.create({
        data: {
          projectId: facture.projectId,
          lotId: facture.contract?.lotId ?? null,
          invoiceId,
          libelle: `Facture ${facture.numero} — ${facture.emetteur}`,
          nature: "SOUS_TRAITANCE",
          montantHT: facture.montantHT,
          date: facture.dateEmission,
          fournisseur: facture.emetteur,
          reference: facture.numero,
        },
      })
    }

    // Annulation ou litige : la depense est retiree du cout realise.
    if ((statut === "ANNULEE" || statut === "LITIGE") && facture.expenses.length > 0) {
      await tx.expense.deleteMany({ where: { invoiceId } })
    }
  })

  revalidatePath(`/dashboard/projets/${facture.projectId}/situations`)
  revalidatePath(`/dashboard/projets/${facture.projectId}/budget`)
  revalidatePath("/dashboard/factures")
  revalidatePath("/dashboard")
}

export async function supprimerFacture(invoiceId: string): Promise<void> {
  const utilisateur = await requireAccess("situations", "delete")
  const facture = await prisma.invoice.findFirst({
    where: { id: invoiceId, project: { organizationId: utilisateur.organizationId } },
    select: { id: true, projectId: true },
  })
  if (!facture) throw new Error("Facture introuvable.")

  await prisma.invoice.delete({ where: { id: invoiceId } })
  revalidatePath(`/dashboard/projets/${facture.projectId}/situations`)
  revalidatePath("/dashboard/factures")
}

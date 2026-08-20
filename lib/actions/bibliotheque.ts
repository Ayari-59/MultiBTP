"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireAccess } from "@/lib/session"
import { CATALOGUE_PRIX } from "@/lib/metier/referentiel"
import { arrondi, nb } from "@/lib/utils"

export type EtatBibliotheque = { erreur?: string; ok?: boolean }

const schema = z.object({
  priceItemId: z.string().optional(),
  code: z.string().optional(),
  designation: z.string().min(3, "Designation obligatoire."),
  description: z.string().optional(),
  categorie: z.string().min(1),
  unite: z.string().min(1),
  prixReference: z.coerce.number().min(0),
  coutReference: z.coerce.number().min(0).default(0),
  fournisseur: z.string().optional(),
  localisation: z.string().optional(),
})

export async function enregistrerPrix(
  _etat: EtatBibliotheque,
  donnees: FormData
): Promise<EtatBibliotheque> {
  const utilisateur = await requireAccess("bibliotheque", "update")
  const parsed = schema.safeParse(Object.fromEntries(donnees.entries()))
  if (!parsed.success) {
    return { erreur: parsed.error.issues[0]?.message ?? "Formulaire invalide." }
  }

  const { priceItemId, ...d } = parsed.data
  const valeurs = {
    code: d.code || null,
    designation: d.designation,
    description: d.description || null,
    categorie: d.categorie as never,
    unite: d.unite as never,
    prixReference: d.prixReference,
    coutReference: d.coutReference,
    fournisseur: d.fournisseur || null,
    localisation: d.localisation || null,
  }

  if (priceItemId) {
    const existe = await prisma.priceItem.findFirst({
      where: { id: priceItemId, organizationId: utilisateur.organizationId },
      select: { id: true },
    })
    if (!existe) return { erreur: "Prix introuvable." }

    await prisma.$transaction([
      prisma.priceItem.update({ where: { id: priceItemId }, data: valeurs }),
      prisma.priceHistory.create({
        data: {
          priceItemId,
          prix: d.prixReference,
          source: "Saisie manuelle",
          fournisseur: d.fournisseur || null,
          localisation: d.localisation || null,
        },
      }),
    ])
    await recalculerStatistiques(priceItemId)
  } else {
    const cree = await prisma.priceItem.create({
      data: {
        ...valeurs,
        organizationId: utilisateur.organizationId,
        prixMin: d.prixReference,
        prixMax: d.prixReference,
        prixMoyen: d.prixReference,
      },
    })
    await prisma.priceHistory.create({
      data: {
        priceItemId: cree.id,
        prix: d.prixReference,
        source: "Saisie manuelle",
        fournisseur: d.fournisseur || null,
        localisation: d.localisation || null,
      },
    })
  }

  revalidatePath("/dashboard/bibliotheque")
  return { ok: true }
}

async function recalculerStatistiques(priceItemId: string): Promise<void> {
  const historique = await prisma.priceHistory.findMany({
    where: { priceItemId },
    select: { prix: true },
  })
  const valeurs = historique.map((h) => nb(h.prix)).filter((v) => v > 0)
  if (valeurs.length === 0) return

  await prisma.priceItem.update({
    where: { id: priceItemId },
    data: {
      prixMin: Math.min(...valeurs),
      prixMax: Math.max(...valeurs),
      prixMoyen: arrondi(valeurs.reduce((s, v) => s + v, 0) / valeurs.length),
      dateReference: new Date(),
    },
  })
}

export async function basculerActivation(priceItemId: string): Promise<void> {
  const utilisateur = await requireAccess("bibliotheque", "update")
  const item = await prisma.priceItem.findFirst({
    where: { id: priceItemId, organizationId: utilisateur.organizationId },
    select: { id: true, actif: true },
  })
  if (!item) throw new Error("Prix introuvable.")

  await prisma.priceItem.update({ where: { id: priceItemId }, data: { actif: !item.actif } })
  revalidatePath("/dashboard/bibliotheque")
}

export async function supprimerPrix(priceItemId: string): Promise<void> {
  const utilisateur = await requireAccess("bibliotheque", "delete")
  const item = await prisma.priceItem.findFirst({
    where: { id: priceItemId, organizationId: utilisateur.organizationId },
    select: { id: true },
  })
  if (!item) throw new Error("Prix introuvable.")

  await prisma.priceItem.delete({ where: { id: priceItemId } })
  revalidatePath("/dashboard/bibliotheque")
}

/**
 * Amorcage de la bibliotheque a partir du catalogue de reference livre avec
 * l'application. Les postes deja presents ne sont pas dupliques.
 */
export async function importerCatalogue(): Promise<number> {
  const utilisateur = await requireAccess("bibliotheque", "create")

  const existants = await prisma.priceItem.findMany({
    where: { organizationId: utilisateur.organizationId },
    select: { code: true, designation: true },
  })
  const codes = new Set(existants.map((e) => e.code).filter(Boolean))
  const designations = new Set(existants.map((e) => e.designation))

  const aCreer = CATALOGUE_PRIX.filter(
    (p) => !codes.has(p.code) && !designations.has(p.designation)
  )

  for (const poste of aCreer) {
    const cree = await prisma.priceItem.create({
      data: {
        organizationId: utilisateur.organizationId,
        code: poste.code,
        designation: poste.designation,
        categorie: poste.categorie as never,
        unite: poste.unite as never,
        prixReference: poste.prix,
        coutReference: poste.cout,
        prixMin: poste.prix,
        prixMax: poste.prix,
        prixMoyen: poste.prix,
        fournisseur: poste.fournisseur ?? null,
      },
    })
    await prisma.priceHistory.create({
      data: { priceItemId: cree.id, prix: poste.prix, source: "Catalogue de reference" },
    })
  }

  revalidatePath("/dashboard/bibliotheque")
  return aCreer.length
}

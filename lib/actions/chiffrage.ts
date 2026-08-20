"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireAccess } from "@/lib/session"
import { COEFFICIENTS_SCENARIO, ventilerCout } from "@/lib/metier/chiffrage"
import { arrondi, nb } from "@/lib/utils"

/** Verifie que le chiffrage appartient bien a l'organisation de l'utilisateur. */
async function verifierEstimate(estimateId: string, organizationId: string) {
  const estimate = await prisma.estimate.findFirst({
    where: { id: estimateId, project: { organizationId } },
    select: { id: true, projectId: true },
  })
  if (!estimate) throw new Error("Chiffrage introuvable.")
  return estimate
}

async function verifierProjet(projectId: string, organizationId: string) {
  const projet = await prisma.project.findFirst({
    where: { id: projectId, organizationId },
    select: { id: true, margeCible: true },
  })
  if (!projet) throw new Error("Projet introuvable.")
  return projet
}

// ═══════════════════════════════════════════════════════════════════════════
//  Postes
// ═══════════════════════════════════════════════════════════════════════════

const schemaPoste = z.object({
  estimateId: z.string().min(1),
  lotId: z.string().min(1),
  posteId: z.string().optional(),
  priceItemId: z.string().optional(),
  designation: z.string().min(2, "Designation obligatoire."),
  description: z.string().optional(),
  unite: z.string().min(1),
  quantite: z.coerce.number().min(0),
  prixUnitaire: z.coerce.number().min(0),
  coutMateriaux: z.coerce.number().min(0).default(0),
  coutMainOeuvre: z.coerce.number().min(0).default(0),
  coutSousTraitance: z.coerce.number().min(0).default(0),
  coutMateriel: z.coerce.number().min(0).default(0),
  coutTransport: z.coerce.number().min(0).default(0),
})

export type EtatFormulaire = { erreur?: string; ok?: boolean }

export async function enregistrerPoste(
  _etat: EtatFormulaire,
  donnees: FormData
): Promise<EtatFormulaire> {
  const utilisateur = await requireAccess("chiffrage", "update")
  const parsed = schemaPoste.safeParse(Object.fromEntries(donnees.entries()))
  if (!parsed.success) {
    return { erreur: parsed.error.issues[0]?.message ?? "Formulaire invalide." }
  }

  const d = parsed.data
  const estimate = await verifierEstimate(d.estimateId, utilisateur.organizationId)

  const commun = {
    designation: d.designation,
    description: d.description || null,
    unite: d.unite as never,
    quantite: d.quantite,
    prixUnitaire: d.prixUnitaire,
    coutMateriaux: d.coutMateriaux,
    coutMainOeuvre: d.coutMainOeuvre,
    coutSousTraitance: d.coutSousTraitance,
    coutMateriel: d.coutMateriel,
    coutTransport: d.coutTransport,
    priceItemId: d.priceItemId || null,
  }

  if (d.posteId) {
    await prisma.estimateItem.update({
      where: { id: d.posteId },
      data: commun,
    })
  } else {
    const dernier = await prisma.estimateItem.findFirst({
      where: { estimateId: d.estimateId, lotId: d.lotId },
      orderBy: { ordre: "desc" },
      select: { ordre: true },
    })
    await prisma.estimateItem.create({
      data: {
        ...commun,
        estimateId: d.estimateId,
        lotId: d.lotId,
        ordre: (dernier?.ordre ?? -1) + 1,
      },
    })
  }

  revalidatePath(`/dashboard/projets/${estimate.projectId}/chiffrage`)
  return { ok: true }
}

export async function supprimerPoste(posteId: string): Promise<void> {
  const utilisateur = await requireAccess("chiffrage", "delete")
  const poste = await prisma.estimateItem.findFirst({
    where: { id: posteId, estimate: { project: { organizationId: utilisateur.organizationId } } },
    select: { id: true, estimate: { select: { projectId: true } } },
  })
  if (!poste) throw new Error("Poste introuvable.")

  await prisma.estimateItem.delete({ where: { id: posteId } })
  revalidatePath(`/dashboard/projets/${poste.estimate.projectId}/chiffrage`)
}

// ═══════════════════════════════════════════════════════════════════════════
//  Lots
// ═══════════════════════════════════════════════════════════════════════════

const schemaLot = z.object({
  projectId: z.string().min(1),
  lotId: z.string().optional(),
  code: z.string().min(1, "Code obligatoire."),
  nom: z.string().min(2, "Nom obligatoire."),
  categorie: z.string().min(1),
  sousTraite: z.string().optional(),
  descriptif: z.string().optional(),
})

export async function enregistrerLot(
  _etat: EtatFormulaire,
  donnees: FormData
): Promise<EtatFormulaire> {
  const utilisateur = await requireAccess("chiffrage", "update")
  const parsed = schemaLot.safeParse(Object.fromEntries(donnees.entries()))
  if (!parsed.success) {
    return { erreur: parsed.error.issues[0]?.message ?? "Formulaire invalide." }
  }

  const d = parsed.data
  await verifierProjet(d.projectId, utilisateur.organizationId)

  const commun = {
    code: d.code,
    nom: d.nom,
    categorie: d.categorie as never,
    sousTraite: d.sousTraite === "on" || d.sousTraite === "true",
    descriptif: d.descriptif || null,
  }

  try {
    if (d.lotId) {
      await prisma.lot.update({ where: { id: d.lotId }, data: commun })
    } else {
      const dernier = await prisma.lot.findFirst({
        where: { projectId: d.projectId },
        orderBy: { ordre: "desc" },
        select: { ordre: true },
      })
      await prisma.lot.create({
        data: { ...commun, projectId: d.projectId, ordre: (dernier?.ordre ?? -1) + 1 },
      })
    }
  } catch {
    return { erreur: `Le code de lot « ${d.code} » est deja utilise sur ce projet.` }
  }

  revalidatePath(`/dashboard/projets/${d.projectId}/chiffrage`)
  return { ok: true }
}

export async function supprimerLot(lotId: string): Promise<void> {
  const utilisateur = await requireAccess("chiffrage", "delete")
  const lot = await prisma.lot.findFirst({
    where: { id: lotId, project: { organizationId: utilisateur.organizationId } },
    select: { id: true, projectId: true },
  })
  if (!lot) throw new Error("Lot introuvable.")

  await prisma.lot.delete({ where: { id: lotId } })
  revalidatePath(`/dashboard/projets/${lot.projectId}/chiffrage`)
}

// ═══════════════════════════════════════════════════════════════════════════
//  Scenarios
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Duplique un chiffrage en appliquant le coefficient du scenario cible aux
 * prix unitaires et aux couts. Les deux versions restent comparables poste
 * a poste.
 */
export async function creerScenario(estimateId: string, scenario: string): Promise<void> {
  const utilisateur = await requireAccess("chiffrage", "create")
  const estimate = await prisma.estimate.findFirst({
    where: { id: estimateId, project: { organizationId: utilisateur.organizationId } },
    include: { items: true },
  })
  if (!estimate) throw new Error("Chiffrage introuvable.")

  const coefficient = COEFFICIENTS_SCENARIO[scenario] ?? 1
  const derniereVersion = await prisma.estimate.count({ where: { projectId: estimate.projectId } })

  await prisma.$transaction(async (tx) => {
    const copie = await tx.estimate.create({
      data: {
        projectId: estimate.projectId,
        nom: `Variante ${scenario.toLowerCase()}`,
        scenario: scenario as never,
        version: derniereVersion + 1,
        retenu: false,
        commentaire: `Genere depuis « ${estimate.nom} » avec un coefficient de ${coefficient}.`,
      },
    })

    for (const item of estimate.items) {
      await tx.estimateItem.create({
        data: {
          estimateId: copie.id,
          lotId: item.lotId,
          priceItemId: item.priceItemId,
          ordre: item.ordre,
          designation: item.designation,
          description: item.description,
          unite: item.unite,
          quantite: item.quantite,
          prixUnitaire: arrondi(nb(item.prixUnitaire) * coefficient),
          coutMateriaux: arrondi(nb(item.coutMateriaux) * coefficient),
          coutMainOeuvre: arrondi(nb(item.coutMainOeuvre) * coefficient),
          coutSousTraitance: arrondi(nb(item.coutSousTraitance) * coefficient),
          coutMateriel: arrondi(nb(item.coutMateriel) * coefficient),
          coutTransport: arrondi(nb(item.coutTransport) * coefficient),
        },
      })
    }
  })

  revalidatePath(`/dashboard/projets/${estimate.projectId}/chiffrage`)
}

/**
 * Marque un chiffrage comme retenu : il devient la base du budget, du prix de
 * vente et des consultations.
 */
export async function retenirScenario(estimateId: string): Promise<void> {
  const utilisateur = await requireAccess("chiffrage", "update")
  const estimate = await prisma.estimate.findFirst({
    where: { id: estimateId, project: { organizationId: utilisateur.organizationId } },
    include: {
      items: true,
      project: {
        select: {
          id: true,
          margeCible: true,
          tauxFraisChantier: true,
          tauxFraisGeneraux: true,
          statut: true,
        },
      },
    },
  })
  if (!estimate) throw new Error("Chiffrage introuvable.")

  const montantHT = estimate.items.reduce((s, i) => s + nb(i.quantite) * nb(i.prixUnitaire), 0)
  const margeCible = nb(estimate.project.margeCible)
  const coutDirect = estimate.items.reduce((s, i) => {
    const unitaire =
      nb(i.coutMateriaux) + nb(i.coutMainOeuvre) + nb(i.coutSousTraitance) + nb(i.coutMateriel) + nb(i.coutTransport)
    return (
      s +
      nb(i.quantite) * (unitaire > 0 ? unitaire : nb(i.prixUnitaire) * (1 - margeCible / 100))
    )
  }, 0)

  const fraisChantier = coutDirect * (nb(estimate.project.tauxFraisChantier) / 100)
  const coutRevient = arrondi(
    coutDirect + fraisChantier + (coutDirect + fraisChantier) * (nb(estimate.project.tauxFraisGeneraux) / 100)
  )

  await prisma.$transaction([
    prisma.estimate.updateMany({
      where: { projectId: estimate.projectId },
      data: { retenu: false },
    }),
    prisma.estimate.update({ where: { id: estimateId }, data: { retenu: true } }),
    prisma.project.update({
      where: { id: estimate.projectId },
      data: {
        prixVenteHT: arrondi(montantHT),
        budgetInitial: coutRevient,
      },
    }),
  ])

  revalidatePath(`/dashboard/projets/${estimate.projectId}/chiffrage`)
  revalidatePath(`/dashboard/projets/${estimate.projectId}`)
  revalidatePath(`/dashboard/projets/${estimate.projectId}/budget`)
}

export async function supprimerScenario(estimateId: string): Promise<void> {
  const utilisateur = await requireAccess("chiffrage", "delete")
  const estimate = await prisma.estimate.findFirst({
    where: { id: estimateId, project: { organizationId: utilisateur.organizationId } },
    select: { id: true, projectId: true, retenu: true },
  })
  if (!estimate) throw new Error("Chiffrage introuvable.")
  if (estimate.retenu) throw new Error("Impossible de supprimer le chiffrage retenu.")

  await prisma.estimate.delete({ where: { id: estimateId } })
  revalidatePath(`/dashboard/projets/${estimate.projectId}/chiffrage`)
}

// ═══════════════════════════════════════════════════════════════════════════
//  Alimentation de la bibliotheque depuis un chiffrage
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Verse les postes d'un chiffrage dans la bibliotheque de prix : les prochains
 * projets partiront de prix reellement pratiques.
 */
export async function verserDansBibliotheque(estimateId: string): Promise<number> {
  const utilisateur = await requireAccess("bibliotheque", "create")
  const estimate = await prisma.estimate.findFirst({
    where: { id: estimateId, project: { organizationId: utilisateur.organizationId } },
    include: {
      items: { include: { lot: { select: { categorie: true } } } },
      project: { select: { reference: true, ville: true, id: true } },
    },
  })
  if (!estimate) throw new Error("Chiffrage introuvable.")

  let comptes = 0

  for (const item of estimate.items) {
    const prix = nb(item.prixUnitaire)
    if (prix <= 0) continue

    const cout =
      nb(item.coutMateriaux) +
      nb(item.coutMainOeuvre) +
      nb(item.coutSousTraitance) +
      nb(item.coutMateriel) +
      nb(item.coutTransport)

    const existant = await prisma.priceItem.findFirst({
      where: {
        organizationId: utilisateur.organizationId,
        designation: item.designation,
        unite: item.unite,
      },
    })

    if (existant) {
      const historique = await prisma.priceHistory.findMany({
        where: { priceItemId: existant.id },
        select: { prix: true },
      })
      const valeurs = [...historique.map((h) => nb(h.prix)), prix]
      await prisma.$transaction([
        prisma.priceHistory.create({
          data: {
            priceItemId: existant.id,
            prix,
            source: "Chiffrage",
            projetRef: estimate.project.reference,
            localisation: estimate.project.ville,
          },
        }),
        prisma.priceItem.update({
          where: { id: existant.id },
          data: {
            prixMin: Math.min(...valeurs),
            prixMax: Math.max(...valeurs),
            prixMoyen: arrondi(valeurs.reduce((s, v) => s + v, 0) / valeurs.length),
            dateReference: new Date(),
          },
        }),
      ])
    } else {
      const cree = await prisma.priceItem.create({
        data: {
          organizationId: utilisateur.organizationId,
          designation: item.designation,
          description: item.description,
          categorie: item.lot.categorie,
          unite: item.unite,
          prixReference: prix,
          coutReference: arrondi(cout),
          prixMin: prix,
          prixMax: prix,
          prixMoyen: prix,
          localisation: estimate.project.ville,
        },
      })
      await prisma.priceHistory.create({
        data: {
          priceItemId: cree.id,
          prix,
          source: "Chiffrage",
          projetRef: estimate.project.reference,
          localisation: estimate.project.ville,
        },
      })
    }
    comptes++
  }

  revalidatePath("/dashboard/bibliotheque")
  return comptes
}

/** Applique un pourcentage a tous les prix d'un lot (negociation globale). */
export async function ajusterPrixLot(
  estimateId: string,
  lotId: string,
  pourcentage: number
): Promise<void> {
  const utilisateur = await requireAccess("chiffrage", "update")
  const estimate = await verifierEstimate(estimateId, utilisateur.organizationId)

  const items = await prisma.estimateItem.findMany({ where: { estimateId, lotId } })
  const coefficient = 1 + pourcentage / 100

  await prisma.$transaction(
    items.map((i) =>
      prisma.estimateItem.update({
        where: { id: i.id },
        data: { prixUnitaire: arrondi(nb(i.prixUnitaire) * coefficient) },
      })
    )
  )

  revalidatePath(`/dashboard/projets/${estimate.projectId}/chiffrage`)
}

/** Ventile automatiquement un cout unitaire selon la nature du lot. */
export async function ventilerAutomatiquement(estimateId: string): Promise<void> {
  const utilisateur = await requireAccess("chiffrage", "update")
  const estimate = await prisma.estimate.findFirst({
    where: { id: estimateId, project: { organizationId: utilisateur.organizationId } },
    include: {
      items: { include: { lot: { select: { sousTraite: true } } } },
      project: { select: { id: true, margeCible: true } },
    },
  })
  if (!estimate) throw new Error("Chiffrage introuvable.")

  const margeCible = nb(estimate.project.margeCible)

  await prisma.$transaction(
    estimate.items
      .filter(
        (i) =>
          nb(i.coutMateriaux) +
            nb(i.coutMainOeuvre) +
            nb(i.coutSousTraitance) +
            nb(i.coutMateriel) +
            nb(i.coutTransport) ===
          0
      )
      .map((i) =>
        prisma.estimateItem.update({
          where: { id: i.id },
          data: ventilerCout(nb(i.prixUnitaire) * (1 - margeCible / 100), i.lot.sousTraite),
        })
      )
  )

  revalidatePath(`/dashboard/projets/${estimate.projectId}/chiffrage`)
}

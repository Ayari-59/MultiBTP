"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireAccess } from "@/lib/session"
import { prochaineReferenceProjet } from "@/lib/references"
import { genererProjet, type PrixOrganisation } from "@/lib/metier/lancement"
import { nb } from "@/lib/utils"

const schemaLancement = z.object({
  // Etape 1 — client
  contactId: z.string().optional(),
  clientNom: z.string().optional(),
  clientSociete: z.string().optional(),
  clientEmail: z.string().optional(),
  clientTelephone: z.string().optional(),

  // Etape 2 — bien / chantier
  nom: z.string().min(3, "Le nom du projet est obligatoire."),
  adresse: z.string().optional(),
  codePostal: z.string().optional(),
  ville: z.string().optional(),
  typeBien: z.string().optional(),

  // Etape 3 & 4 — nature et surface
  typeOperation: z.string().min(1),
  surface: z.coerce.number().positive("La surface doit etre superieure a zero."),

  // Etape 5 — lots exclus de la trame
  lotsExclus: z.array(z.string()).optional(),

  // Etape 6 — parametres economiques
  margeCible: z.coerce.number().min(0).max(80).default(18),
  tauxFraisChantier: z.coerce.number().min(0).max(50).default(4),
  tauxFraisGeneraux: z.coerce.number().min(0).max(50).default(8),
  tauxTva: z.coerce.number().min(0).max(30).default(20),

  // Etape 8 — planning
  dateDebut: z.string().optional(),

  // Etape 9 — options de generation
  genererConsultations: z.coerce.boolean().default(true),
  genererPlanning: z.coerce.boolean().default(true),

  description: z.string().optional(),
  contraintes: z.string().optional(),
})

export type EtatLancement = { erreur?: string; champs?: Record<string, string> }

/** Bibliotheque de prix de l'organisation, indexee par code de poste. */
async function prixOrganisation(organizationId: string): Promise<PrixOrganisation> {
  const items = await prisma.priceItem.findMany({
    where: { organizationId, actif: true, code: { not: null } },
    select: { code: true, prixReference: true, coutReference: true },
  })
  return new Map(
    items
      .filter((i) => i.code)
      .map((i) => [i.code as string, { prix: nb(i.prixReference), cout: nb(i.coutReference) }])
  )
}

/**
 * « Lancer le projet » : cree l'operation complete a partir de quelques
 * informations. Tout est genere en une transaction — lots, postes chiffres au
 * prix historique, budget, marge cible, consultations et planning previsionnel.
 */
export async function lancerProjet(
  _etat: EtatLancement,
  donnees: FormData
): Promise<EtatLancement> {
  const utilisateur = await requireAccess("projets", "create")

  const brut = {
    ...Object.fromEntries(donnees.entries()),
    lotsExclus: donnees.getAll("lotsExclus").map(String),
    genererConsultations: donnees.get("genererConsultations") === "on",
    genererPlanning: donnees.get("genererPlanning") !== "off",
  }

  const parsed = schemaLancement.safeParse(brut)
  if (!parsed.success) {
    const champs: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      champs[String(issue.path[0])] = issue.message
    }
    return { erreur: "Certaines informations sont incompletes.", champs }
  }

  const d = parsed.data
  const organizationId = utilisateur.organizationId

  // Quota d'abonnement
  const [organisation, nbProjets] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: organizationId } }),
    prisma.project.count({ where: { organizationId } }),
  ])
  if (nbProjets >= organisation.quotaProjets) {
    return {
      erreur: `Quota atteint : votre abonnement ${organisation.plan} autorise ${organisation.quotaProjets} projets.`,
    }
  }

  const dateDebut = d.dateDebut ? new Date(d.dateDebut) : new Date()
  const params = {
    margeCible: d.margeCible,
    tauxFraisChantier: d.tauxFraisChantier,
    tauxFraisGeneraux: d.tauxFraisGeneraux,
    tauxTva: d.tauxTva,
  }

  const proposition = genererProjet({
    typeOperation: d.typeOperation,
    surface: d.surface,
    params,
    prixOrganisation: await prixOrganisation(organizationId),
    dateDebut,
    lotsExclus: d.lotsExclus,
  })

  const reference = await prochaineReferenceProjet(organizationId)

  const projectId = await prisma.$transaction(async (tx) => {
    // ─── Client ──────────────────────────────────────────────────────────
    let contactId = d.contactId && d.contactId !== "" ? d.contactId : null

    if (contactId) {
      const existe = await tx.contact.findFirst({
        where: { id: contactId, organizationId },
        select: { id: true },
      })
      if (!existe) contactId = null
    }

    if (!contactId && (d.clientNom || d.clientSociete)) {
      const contact = await tx.contact.create({
        data: {
          organizationId,
          type: "CLIENT",
          nom: d.clientNom || d.clientSociete || "Client",
          societe: d.clientSociete || null,
          email: d.clientEmail || null,
          telephone: d.clientTelephone || null,
          ville: d.ville || null,
        },
      })
      contactId = contact.id
    }

    // ─── Bien immobilier ─────────────────────────────────────────────────
    let propertyId: string | null = null
    if (d.adresse && d.ville) {
      const bien = await tx.property.create({
        data: {
          organizationId,
          contactId,
          nom: d.nom,
          type: (d.typeBien as never) ?? "IMMEUBLE",
          adresse: d.adresse,
          codePostal: d.codePostal ?? "",
          ville: d.ville,
          surfaceUtile: d.surface,
        },
      })
      propertyId = bien.id
    }

    // ─── Projet ──────────────────────────────────────────────────────────
    const projet = await tx.project.create({
      data: {
        organizationId,
        reference,
        nom: d.nom,
        contactId,
        propertyId,
        responsableId: utilisateur.id,
        typeOperation: d.typeOperation as never,
        statut: "CHIFFRAGE",
        adresse: d.adresse || null,
        codePostal: d.codePostal || null,
        ville: d.ville || null,
        surface: d.surface,
        description: d.description || null,
        contraintes: d.contraintes || null,
        dateDebutPrevue: dateDebut,
        dateFinPrevue: proposition.dateFinPrevue,
        margeCible: d.margeCible,
        tauxFraisChantier: d.tauxFraisChantier,
        tauxFraisGeneraux: d.tauxFraisGeneraux,
        tauxTva: d.tauxTva,
        prixVenteHT: proposition.montantHT,
        budgetInitial: proposition.coutRevient,
      },
    })

    // ─── Lots ────────────────────────────────────────────────────────────
    const lotsCrees = new Map<string, string>()
    for (const [index, lot] of proposition.lots.entries()) {
      const cree = await tx.lot.create({
        data: {
          projectId: projet.id,
          code: lot.code,
          nom: lot.nom,
          categorie: lot.categorie as never,
          ordre: index,
          sousTraite: lot.sousTraite,
          descriptif: lot.descriptif,
          statut: "CHIFFRE",
        },
      })
      lotsCrees.set(lot.code, cree.id)
    }

    // ─── Chiffrage ───────────────────────────────────────────────────────
    const estimate = await tx.estimate.create({
      data: {
        projectId: projet.id,
        nom: "Chiffrage initial genere",
        scenario: "STANDARD",
        retenu: true,
        genereParIa: true,
        commentaire:
          "Chiffrage genere automatiquement a partir de la trame de lots et de la bibliotheque de prix. A verifier poste par poste avant diffusion.",
      },
    })

    for (const lot of proposition.lots) {
      const lotId = lotsCrees.get(lot.code)
      if (!lotId) continue
      for (const [index, poste] of lot.postes.entries()) {
        await tx.estimateItem.create({
          data: {
            estimateId: estimate.id,
            lotId,
            ordre: index,
            designation: poste.designation,
            unite: poste.unite as never,
            quantite: poste.quantite,
            prixUnitaire: poste.prixUnitaire,
            coutMateriaux: poste.coutMateriaux,
            coutMainOeuvre: poste.coutMainOeuvre,
            coutSousTraitance: poste.coutSousTraitance,
            coutMateriel: poste.coutMateriel,
            coutTransport: poste.coutTransport,
          },
        })
      }
    }

    // ─── Planning previsionnel ───────────────────────────────────────────
    if (d.genererPlanning) {
      const tachesCreees = new Map<string, string>()
      for (const tache of proposition.taches) {
        const creee = await tx.task.create({
          data: {
            projectId: projet.id,
            lotId: lotsCrees.get(tache.lotCode) ?? null,
            nom: tache.nom,
            dateDebut: tache.dateDebut,
            dateFin: tache.dateFin,
            dureeJours: tache.dureeJours,
            ordre: tache.ordre,
          },
        })
        tachesCreees.set(tache.lotCode, creee.id)
      }
      for (const tache of proposition.taches) {
        if (!tache.precedentCode) continue
        const predecesseurId = tachesCreees.get(tache.precedentCode)
        const successeurId = tachesCreees.get(tache.lotCode)
        if (!predecesseurId || !successeurId) continue
        await tx.taskDependency.create({
          data: { predecesseurId, successeurId, type: "FIN_DEBUT" },
        })
      }
    }

    // ─── Consultations preparees pour les lots sous-traites ──────────────
    if (d.genererConsultations) {
      for (const lot of proposition.lots.filter((l) => l.sousTraite)) {
        const lotId = lotsCrees.get(lot.code)
        if (!lotId) continue
        await tx.consultation.create({
          data: {
            organizationId,
            projectId: projet.id,
            lotId,
            reference: `CONS-${reference}-${lot.code}`,
            objet: `${lot.nom} — ${d.nom}`,
            statut: "BROUILLON",
            descriptif: lot.descriptif,
            budgetEstime: lot.coutDirect,
            delaiSouhaiteJours: lot.dureeJours,
          },
        })
      }
    }

    await tx.auditLog.create({
      data: {
        organizationId,
        userId: utilisateur.id,
        action: "LANCEMENT_PROJET",
        entite: "Project",
        entiteId: projet.id,
        details: `${proposition.lots.length} lots, ${proposition.montantHT} € HT generes automatiquement.`,
      },
    })

    return projet.id
  }, { timeout: 30_000 })

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/projets")
  redirect(`/dashboard/projets/${projectId}?lancement=1`)
}

// ═══════════════════════════════════════════════════════════════════════════
//  Mises a jour ponctuelles
// ═══════════════════════════════════════════════════════════════════════════

const schemaMaj = z.object({
  projectId: z.string().min(1),
  nom: z.string().min(3),
  statut: z.string(),
  priorite: z.string(),
  adresse: z.string().optional(),
  codePostal: z.string().optional(),
  ville: z.string().optional(),
  surface: z.string().optional(),
  description: z.string().optional(),
  contraintes: z.string().optional(),
  margeCible: z.coerce.number().min(0).max(80),
  tauxFraisChantier: z.coerce.number().min(0).max(50),
  tauxFraisGeneraux: z.coerce.number().min(0).max(50),
  tauxTva: z.coerce.number().min(0).max(30),
  prixVenteHT: z.string().optional(),
  dateDebutPrevue: z.string().optional(),
  dateFinPrevue: z.string().optional(),
})

export async function modifierProjet(_etat: EtatLancement, donnees: FormData): Promise<EtatLancement> {
  const utilisateur = await requireAccess("projets", "update")
  const parsed = schemaMaj.safeParse(Object.fromEntries(donnees.entries()))
  if (!parsed.success) return { erreur: "Formulaire invalide." }

  const d = parsed.data
  const projet = await prisma.project.findFirst({
    where: { id: d.projectId, organizationId: utilisateur.organizationId },
    select: { id: true },
  })
  if (!projet) return { erreur: "Projet introuvable." }

  await prisma.project.update({
    where: { id: d.projectId },
    data: {
      nom: d.nom,
      statut: d.statut as never,
      priorite: d.priorite as never,
      adresse: d.adresse || null,
      codePostal: d.codePostal || null,
      ville: d.ville || null,
      surface: d.surface ? Number(d.surface) : null,
      description: d.description || null,
      contraintes: d.contraintes || null,
      margeCible: d.margeCible,
      tauxFraisChantier: d.tauxFraisChantier,
      tauxFraisGeneraux: d.tauxFraisGeneraux,
      tauxTva: d.tauxTva,
      prixVenteHT: d.prixVenteHT ? Number(d.prixVenteHT) : null,
      dateDebutPrevue: d.dateDebutPrevue ? new Date(d.dateDebutPrevue) : null,
      dateFinPrevue: d.dateFinPrevue ? new Date(d.dateFinPrevue) : null,
    },
  })

  revalidatePath(`/dashboard/projets/${d.projectId}`)
  return {}
}

export async function changerStatutProjet(projectId: string, statut: string): Promise<void> {
  const utilisateur = await requireAccess("projets", "update")
  const projet = await prisma.project.findFirst({
    where: { id: projectId, organizationId: utilisateur.organizationId },
    select: { id: true },
  })
  if (!projet) throw new Error("Projet introuvable.")

  await prisma.project.update({
    where: { id: projectId },
    data: {
      statut: statut as never,
      ...(statut === "EN_COURS" ? { dateDebutReelle: new Date() } : {}),
      ...(statut === "RECEPTION" ? { dateReception: new Date() } : {}),
      ...(statut === "TERMINE" ? { dateFinReelle: new Date() } : {}),
    },
  })

  revalidatePath(`/dashboard/projets/${projectId}`)
  revalidatePath("/dashboard")
}

export async function supprimerProjet(projectId: string): Promise<void> {
  const utilisateur = await requireAccess("projets", "delete")
  const projet = await prisma.project.findFirst({
    where: { id: projectId, organizationId: utilisateur.organizationId },
    select: { id: true },
  })
  if (!projet) throw new Error("Projet introuvable.")

  await prisma.project.delete({ where: { id: projectId } })
  revalidatePath("/dashboard/projets")
  redirect("/dashboard/projets")
}

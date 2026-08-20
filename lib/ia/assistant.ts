// Module serveur uniquement : ne jamais importer depuis un composant client.
import { prisma } from "@/lib/prisma"
import { euros, nb, pourcent } from "@/lib/utils"
import { donneesAlertes, listeProjets, syntheseProjet } from "@/lib/queries/projets"
import { genererAlertes } from "@/lib/metier/alertes"
import { expliquerMarge, risquesPlanning } from "./analyses"
import { fournisseurIa, SYSTEME_METIER } from "./provider"

/**
 * Assistant metier.
 *
 * Deux niveaux de reponse :
 *  1. **Intentions reconnues** — certaines questions reviennent en permanence
 *     (cout engage sur un lot, devis en attente, baisse de marge). Elles sont
 *     traitees par des requetes exactes : la reponse est un chiffre verifiable,
 *     jamais une approximation.
 *  2. **Question libre** — un contexte factuel compact est construit puis remis
 *     au fournisseur IA, avec consigne de ne rien inventer.
 */

type Contexte = { organizationId: string; projectId?: string }

export async function repondreAssistant(question: string, contexte: Contexte): Promise<string> {
  const q = normaliser(question)

  // ─── Intentions reconnues ─────────────────────────────────────────────────
  if (/(pourquoi|explique|evolution).*(marge|rentabilit)/.test(q) || /marge.*(baisse|diminue|chute)/.test(q)) {
    const projectId = contexte.projectId ?? (await projetMentionne(q, contexte.organizationId))
    if (projectId) return expliquerMarge(projectId, contexte.organizationId)
  }

  if (/(retard|delai|planning|risque)/.test(q) && /(risque|retard|tenir|glisse)/.test(q)) {
    const projectId = contexte.projectId ?? (await projetMentionne(q, contexte.organizationId))
    if (projectId) return risquesPlanning(projectId, contexte.organizationId)
  }

  if (/(devis|offre).*(attente|manqu|recu|arriv)/.test(q) || /(attente).*(devis|offre)/.test(q)) {
    return devisEnAttente(contexte.organizationId)
  }

  if (/(cout|montant|engage|depense).*(lot|electricite|plomberie|maconnerie|peinture|carrelage)/.test(q)) {
    return coutParLot(q, contexte)
  }

  if (/(sous-traitant|entreprise).*(dernier|recent|travaille|intervenu)/.test(q)) {
    return sousTraitantsRecents(contexte.organizationId)
  }

  if (/(alerte|probleme|attention|urgent)/.test(q)) {
    return synthesesAlertes(contexte.organizationId)
  }

  // ─── Question libre ───────────────────────────────────────────────────────
  const faits = await contexteFactuel(contexte)

  return fournisseurIa().completer({
    systeme: SYSTEME_METIER,
    repli: `Voici les donnees dont je dispose pour repondre :\n\n${faits}\n\nReformulez votre question en visant un projet, un lot ou une entreprise pour obtenir une reponse chiffree.`,
    maxTokens: 900,
    messages: [
      {
        role: "user",
        contenu: `Question : ${question}\n\nDonnees de l'entreprise :\n${faits}\n\nReponds uniquement a partir de ces donnees. Si l'information manque, dis-le.`,
      },
    ],
  })
}

function normaliser(texte: string): string {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
}

/** Retrouve un projet cite dans la question par son nom, sa ville ou sa reference. */
async function projetMentionne(q: string, organizationId: string): Promise<string | null> {
  const projets = await prisma.project.findMany({
    where: { organizationId },
    select: { id: true, nom: true, reference: true, ville: true },
  })

  for (const p of projets) {
    const candidats = [p.reference, p.nom, p.ville].filter(Boolean).map((c) => normaliser(String(c)))
    if (candidats.some((c) => c.length > 3 && q.includes(c))) return p.id
  }

  // Un seul projet en cours : c'est forcement celui-la.
  const enCours = projets.length === 1 ? projets[0] : null
  return enCours?.id ?? null
}

// ═══════════════════════════════════════════════════════════════════════════
//  Reponses deterministes
// ═══════════════════════════════════════════════════════════════════════════

async function devisEnAttente(organizationId: string): Promise<string> {
  const consultations = await prisma.consultation.findMany({
    where: { organizationId, statut: { in: ["ENVOYEE", "EN_ANALYSE"] } },
    include: {
      project: { select: { nom: true, reference: true } },
      lot: { select: { code: true, nom: true } },
      _count: { select: { offers: true, invites: true } },
    },
    orderBy: { dateLimiteReponse: "asc" },
  })

  const sansOffre = consultations.filter((c) => c._count.offers === 0)
  if (sansOffre.length === 0) {
    return consultations.length === 0
      ? "Aucune consultation n'est en cours."
      : `Les ${consultations.length} consultations en cours ont toutes recu au moins une offre.`
  }

  const maintenant = new Date()
  const lignes = sansOffre.map((c) => {
    const retard =
      c.dateLimiteReponse && c.dateLimiteReponse < maintenant
        ? ` — HORS DELAI depuis le ${c.dateLimiteReponse.toLocaleDateString("fr-FR")}`
        : c.dateLimiteReponse
          ? ` — reponse attendue avant le ${c.dateLimiteReponse.toLocaleDateString("fr-FR")}`
          : ""
    return `• ${c.project.nom} · lot ${c.lot.code} ${c.lot.nom} : ${c._count.invites} entreprise(s) consultee(s), aucune offre${retard}`
  })

  return `${sansOffre.length} consultation(s) sans devis :\n${lignes.join("\n")}`
}

async function coutParLot(q: string, contexte: Contexte): Promise<string> {
  const lots = await prisma.lot.findMany({
    where: {
      project: {
        organizationId: contexte.organizationId,
        ...(contexte.projectId ? { id: contexte.projectId } : {}),
      },
    },
    include: {
      project: { select: { id: true, nom: true } },
      commitments: { where: { statut: { not: "ANNULE" } }, select: { montantHT: true } },
      expenses: { select: { montantHT: true } },
      contracts: {
        select: { montantActualise: true, subcontractor: { select: { raisonSociale: true } } },
      },
    },
  })

  const correspondants = lots.filter((l) => {
    const cible = normaliser(`${l.nom} ${l.categorie}`)
    return cible.split(/\W+/).some((mot) => mot.length > 4 && q.includes(mot))
  })

  const retenus = correspondants.length > 0 ? correspondants : lots.slice(0, 8)
  if (retenus.length === 0) return "Aucun lot ne correspond a cette question."

  const lignes = retenus.map((l) => {
    const engage = l.commitments.reduce((s, c) => s + nb(c.montantHT), 0)
    const realise = l.expenses.reduce((s, e) => s + nb(e.montantHT), 0)
    const entreprise = l.contracts[0]?.subcontractor.raisonSociale
    return `• ${l.project.nom} · lot ${l.code} ${l.nom} : ${euros(engage)} engages, ${euros(realise)} realises${entreprise ? ` (${entreprise})` : " — aucun marche attribue"}`
  })

  return lignes.join("\n")
}

async function sousTraitantsRecents(organizationId: string): Promise<string> {
  const marches = await prisma.contract.findMany({
    where: { organizationId },
    include: {
      subcontractor: { select: { raisonSociale: true, notation: true, nbLitiges: true } },
      project: { select: { nom: true, reference: true } },
      lot: { select: { code: true, nom: true } },
    },
    orderBy: { dateSignature: "desc" },
    take: 30,
  })

  if (marches.length === 0) return "Aucun marche n'a encore ete attribue."

  const projetsRecents = [...new Set(marches.map((m) => m.project.reference))].slice(0, 3)
  const concernes = marches.filter((m) => projetsRecents.includes(m.project.reference))

  const parProjet = new Map<string, string[]>()
  for (const m of concernes) {
    const liste = parProjet.get(m.project.nom) ?? []
    liste.push(
      `${m.subcontractor.raisonSociale} (lot ${m.lot.code} ${m.lot.nom}, ${euros(nb(m.montantActualise))}, note ${nb(m.subcontractor.notation, 3).toFixed(1)}/5)`
    )
    parProjet.set(m.project.nom, liste)
  }

  const lignes = [...parProjet.entries()].map(
    ([projet, entreprises]) => `• ${projet} : ${entreprises.join(" ; ")}`
  )

  const recurrents = compterRecurrences(concernes.map((m) => m.subcontractor.raisonSociale))
  const fideles = recurrents.filter(([, n]) => n > 1)

  return [
    `Entreprises intervenues sur les ${projetsRecents.length} derniers chantiers :`,
    ...lignes,
    fideles.length > 0
      ? `\nPartenaires recurrents : ${fideles.map(([nom, n]) => `${nom} (${n} chantiers)`).join(", ")}.`
      : "",
  ]
    .filter(Boolean)
    .join("\n")
}

function compterRecurrences(noms: string[]): [string, number][] {
  const compteur = new Map<string, number>()
  for (const nom of noms) compteur.set(nom, (compteur.get(nom) ?? 0) + 1)
  return [...compteur.entries()].sort((a, b) => b[1] - a[1])
}

async function synthesesAlertes(organizationId: string): Promise<string> {
  const alertes = genererAlertes(await donneesAlertes(organizationId))
  if (alertes.length === 0) return "Aucune alerte en cours : marges tenues, budgets respectes, plannings a jour."

  const critiques = alertes.filter((a) => a.niveau === "CRITIQUE")
  const importantes = alertes.filter((a) => a.niveau === "ALERTE")

  const formater = (liste: typeof alertes) =>
    liste.map((a) => `• ${a.titre} — ${a.message}`).join("\n")

  return [
    `${alertes.length} alerte(s) en cours, dont ${critiques.length} critique(s).`,
    critiques.length > 0 ? `\nCritiques :\n${formater(critiques)}` : "",
    importantes.length > 0 ? `\nA traiter :\n${formater(importantes.slice(0, 6))}` : "",
  ]
    .filter(Boolean)
    .join("\n")
}

// ═══════════════════════════════════════════════════════════════════════════
//  Contexte factuel pour les questions libres
// ═══════════════════════════════════════════════════════════════════════════

async function contexteFactuel(contexte: Contexte): Promise<string> {
  const projets = await listeProjets(contexte.organizationId, { actifs: true })
  const blocs: string[] = []

  blocs.push(
    `PORTEFEUILLE (${projets.length} projets actifs)\n` +
      projets
        .slice(0, 12)
        .map(
          (p) =>
            `- ${p.reference} « ${p.nom} »${p.ville ? ` a ${p.ville}` : ""} : statut ${p.statut}, ` +
            `vendu ${euros(p.montantHT)}, budget ${euros(p.budget)}, engage ${euros(p.engage)}, ` +
            `realise ${euros(p.realise)}, atterrissage ${euros(p.atterrissage)}, ` +
            `marge ${pourcent(p.margeTaux)} (cible ${pourcent(p.margeCible)}), ` +
            `avancement ${pourcent(p.avancementPhysique, 0)}`
        )
        .join("\n")
  )

  if (contexte.projectId) {
    const synthese = await syntheseProjet(contexte.projectId, contexte.organizationId)
    if (synthese) {
      blocs.push(
        `DETAIL PAR LOT DU PROJET SELECTIONNE\n` +
          synthese.lignes
            .map(
              (l) =>
                `- Lot ${l.code} ${l.nom} : budget ${euros(l.budget)}, engage ${euros(l.engage)}, realise ${euros(l.realise)}`
            )
            .join("\n")
      )
    }
  }

  const [consultations, sousTraitants, factures] = await Promise.all([
    prisma.consultation.findMany({
      where: { organizationId: contexte.organizationId, statut: { in: ["ENVOYEE", "EN_ANALYSE"] } },
      include: {
        project: { select: { nom: true } },
        lot: { select: { code: true, nom: true } },
        _count: { select: { offers: true } },
      },
      take: 12,
    }),
    prisma.subcontractor.findMany({
      where: { organizationId: contexte.organizationId, actif: true },
      select: {
        raisonSociale: true,
        notation: true,
        nbMarches: true,
        nbLitiges: true,
        specialites: true,
      },
      orderBy: { nbMarches: "desc" },
      take: 15,
    }),
    prisma.invoice.aggregate({
      where: { project: { organizationId: contexte.organizationId }, statut: "A_VALIDER" },
      _count: { _all: true },
      _sum: { montantHT: true },
    }),
  ])

  if (consultations.length > 0) {
    blocs.push(
      `CONSULTATIONS EN COURS\n` +
        consultations
          .map(
            (c) =>
              `- ${c.project.nom} · lot ${c.lot.code} ${c.lot.nom} : ${c._count.offers} offre(s) recue(s)`
          )
          .join("\n")
    )
  }

  if (sousTraitants.length > 0) {
    blocs.push(
      `ENTREPRISES PARTENAIRES\n` +
        sousTraitants
          .map(
            (s) =>
              `- ${s.raisonSociale} : note ${nb(s.notation, 3).toFixed(1)}/5, ${s.nbMarches} marche(s), ${s.nbLitiges} litige(s), specialites ${s.specialites.join("/") || "non renseignees"}`
          )
          .join("\n")
    )
  }

  blocs.push(
    `FACTURATION\n- ${factures._count._all} facture(s) a valider pour ${euros(nb(factures._sum.montantHT))}.`
  )

  return blocs.join("\n\n")
}

/** Questions proposees a l'utilisateur au premier affichage. */
export const QUESTIONS_SUGGEREES = [
  "Quels devis sont encore en attente ?",
  "Quel est le cout engage sur le lot electricite ?",
  "Pourquoi la marge de ce chantier baisse-t-elle ?",
  "Quels sous-traitants ont travaille sur nos trois derniers chantiers ?",
  "Quels sont les risques de retard ?",
  "Quelles sont les alertes a traiter en priorite ?",
]

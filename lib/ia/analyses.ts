// Module serveur uniquement : ne jamais importer depuis un composant client.
import { prisma } from "@/lib/prisma"
import { arrondi, euros, nb, pourcent, ratio } from "@/lib/utils"
import { comparerOffres } from "@/lib/metier/comparateur"
import { calculerPlanning } from "@/lib/metier/planning"
import { syntheseProjet } from "@/lib/queries/projets"
import { fournisseurIa, SYSTEME_METIER } from "./provider"

/**
 * Analyses IA metier.
 *
 * Principe : les faits sont d'abord calcules par le moteur metier, puis remis
 * au modele pour redaction. Le texte de repli (`repli`) est deja une reponse
 * complete et exacte — sans cle d'API, l'utilisateur obtient les memes
 * conclusions, simplement formulees de maniere plus mecanique.
 */

// ═══════════════════════════════════════════════════════════════════════════
//  Analyse d'un devis recu
// ═══════════════════════════════════════════════════════════════════════════

export async function analyserDevis(offerId: string, organizationId: string): Promise<string> {
  const offre = await prisma.offer.findFirst({
    where: { id: offerId, organizationId },
    include: {
      subcontractor: true,
      lignes: true,
      consultation: {
        include: {
          lot: {
            include: {
              items: { where: { estimate: { retenu: true } }, orderBy: { ordre: "asc" } },
            },
          },
          offers: { include: { subcontractor: { select: { raisonSociale: true } }, _count: { select: { lignes: true } } } },
        },
      },
    },
  })
  if (!offre) return "Offre introuvable."

  const budget = offre.consultation.budgetEstime ? nb(offre.consultation.budgetEstime) : null
  const montant = nb(offre.montantHT)

  const autres = offre.consultation.offers.filter((o) => o.id !== offerId)
  const moyenneAutres = autres.length
    ? autres.reduce((s, o) => s + nb(o.montantHT), 0) / autres.length
    : null

  // Postes du descriptif non retrouves dans le devis
  const postesDescriptif = offre.consultation.lot.items.map((i) => i.designation)
  const lignesDevis = offre.lignes.map((l) => l.designation.toLowerCase())
  const manquants = postesDescriptif.filter(
    (p) => !lignesDevis.some((l) => l.includes(p.toLowerCase().slice(0, 14)))
  )

  // Ecarts de prix ligne a ligne
  const ecarts: string[] = []
  for (const ligne of offre.lignes) {
    const reference = offre.consultation.lot.items.find((i) =>
      i.designation.toLowerCase().slice(0, 14) === ligne.designation.toLowerCase().slice(0, 14)
    )
    if (!reference) continue
    const prixRef = nb(reference.prixUnitaire)
    const prixDevis = nb(ligne.prixUnitaire)
    if (prixRef <= 0) continue
    const ecart = ratio(prixDevis - prixRef, prixRef) * 100
    if (Math.abs(ecart) >= 20) {
      ecarts.push(
        `${ligne.designation} : ${euros(prixDevis, 2)} contre ${euros(prixRef, 2)} au chiffrage (${ecart > 0 ? "+" : ""}${ecart.toFixed(0)} %)`
      )
    }
  }

  const constats: string[] = []

  constats.push(
    `Montant du devis : ${euros(montant)} HT` +
      (budget ? `, pour un budget estime de ${euros(budget)} (${ratio(montant - budget, budget) * 100 > 0 ? "+" : ""}${(ratio(montant - budget, budget) * 100).toFixed(1)} %).` : ".")
  )

  if (moyenneAutres !== null) {
    const ecart = ratio(montant - moyenneAutres, moyenneAutres) * 100
    constats.push(
      `Moyenne des ${autres.length} autre(s) offre(s) : ${euros(moyenneAutres)} (${ecart > 0 ? "+" : ""}${ecart.toFixed(1)} % pour cette offre).`
    )
    if (ecart < -25) {
      constats.push(
        "Prix anormalement bas : verifier que l'entreprise a bien integre l'ensemble des prestations, les protections et l'evacuation des dechets."
      )
    }
    if (ecart > 25) {
      constats.push(
        "Prix anormalement eleve : demander le detail des quantites et des prix unitaires avant d'ecarter l'offre."
      )
    }
  }

  if (manquants.length > 0) {
    constats.push(
      `Prestation(s) du descriptif absente(s) du devis : ${manquants.slice(0, 6).join(", ")}${manquants.length > 6 ? `, et ${manquants.length - 6} autre(s)` : ""}.`
    )
  } else if (offre.lignes.length > 0) {
    constats.push("Toutes les prestations du descriptif sont chiffrees.")
  } else {
    constats.push(
      "Le devis n'a pas ete detaille poste par poste : la comparaison ligne a ligne est impossible."
    )
  }

  if (ecarts.length > 0) {
    constats.push(`Ecarts de prix significatifs : ${ecarts.slice(0, 5).join(" ; ")}.`)
  }

  if (offre.exclusions) {
    constats.push(`Exclusions declarees : ${offre.exclusions}`)
  }
  if (!offre.delaiJours) {
    constats.push("Le delai d'execution n'est pas precise : le faire confirmer avant attribution.")
  }
  if (!offre.subcontractor.assuranceDecennaleValide) {
    constats.push(
      "Assurance decennale non validee dans la fiche entreprise : bloquant pour la signature du marche."
    )
  }
  if (!offre.subcontractor.attestationVigilanceValide) {
    constats.push(
      "Attestation de vigilance URSSAF manquante : obligation de verification du donneur d'ordre non remplie."
    )
  }
  if (offre.subcontractor.nbLitiges > 0) {
    constats.push(
      `${offre.subcontractor.nbLitiges} litige(s) enregistre(s) avec cette entreprise sur des marches anterieurs.`
    )
  }

  const repli = constats.map((c) => `• ${c}`).join("\n")

  return fournisseurIa().completer({
    systeme: SYSTEME_METIER,
    repli,
    maxTokens: 700,
    messages: [
      {
        role: "user",
        contenu: `Redige l'analyse d'un devis recu pour le lot « ${offre.consultation.lot.nom} », entreprise ${offre.subcontractor.raisonSociale}.
Constats etablis par le moteur de calcul :
${repli}

Restitue une analyse structuree en trois parties courtes : ce qui est conforme, ce qui pose question, et la recommandation. N'ajoute aucun chiffre absent des constats.`,
      },
    ],
  })
}

// ═══════════════════════════════════════════════════════════════════════════
//  Explication de la marge
// ═══════════════════════════════════════════════════════════════════════════

export async function expliquerMarge(projectId: string, organizationId: string): Promise<string> {
  const [projet, synthese] = await Promise.all([
    prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { nom: true, margeCible: true, reference: true },
    }),
    syntheseProjet(projectId, organizationId),
  ])
  if (!projet || !synthese) return "Projet introuvable."

  const { budget, lignes } = synthese
  const margeCible = nb(projet.margeCible)

  const [avenants, depassements] = await Promise.all([
    prisma.changeOrder.findMany({
      where: { projectId, statut: "ACCEPTE" },
      select: { reference: true, motif: true, impactCout: true, impactVente: true },
      orderBy: { impactCout: "desc" },
    }),
    Promise.resolve(
      lignes
        .filter((l) => l.engage > l.budget && l.budget > 0)
        .map((l) => ({ ...l, ecart: arrondi(l.engage - l.budget) }))
        .sort((a, b) => b.ecart - a.ecart)
    ),
  ])

  const constats: string[] = []

  constats.push(
    `Marge previsionnelle actuelle : ${pourcent(budget.tauxMargePrevisionnelle)} (${euros(budget.margePrevisionnelle)}), pour une cible de ${pourcent(margeCible)}.`
  )
  constats.push(
    `Marge a l'origine du projet : ${pourcent(budget.tauxMargeInitiale)} (${euros(budget.margeInitiale)}).`
  )

  const variation = budget.tauxMargePrevisionnelle - budget.tauxMargeInitiale
  if (Math.abs(variation) >= 0.1) {
    constats.push(
      `Variation depuis le lancement : ${variation > 0 ? "+" : ""}${variation.toFixed(1)} point(s).`
    )
  }

  if (depassements.length > 0) {
    constats.push(
      `Lots dont l'engagement depasse le budget : ${depassements
        .slice(0, 5)
        .map((l) => `${l.code} ${l.nom} (+${euros(l.ecart)})`)
        .join(", ")}.`
    )
  } else {
    constats.push("Aucun lot ne depasse son budget d'engagement.")
  }

  if (avenants.length > 0) {
    const coutTotal = avenants.reduce((s, a) => s + nb(a.impactCout), 0)
    const venteTotal = avenants.reduce((s, a) => s + nb(a.impactVente), 0)
    constats.push(
      `${avenants.length} avenant(s) accepte(s) : ${euros(coutTotal)} de surcout pour ${euros(venteTotal)} refactures au client (solde ${euros(venteTotal - coutTotal)}).`
    )
    const nonRefactures = avenants.filter((a) => nb(a.impactVente) < nb(a.impactCout))
    if (nonRefactures.length > 0) {
      constats.push(
        `Avenant(s) non integralement refacture(s) : ${nonRefactures.map((a) => `${a.reference} (${a.motif})`).join(", ")}.`
      )
    }
  } else {
    constats.push("Aucun avenant accepte a ce jour.")
  }

  constats.push(
    `Atterrissage estime a ${euros(budget.atterrissage)} pour un budget de ${euros(budget.budgetActualise)} (ecart ${euros(budget.ecart)}).`
  )

  const repli = constats.map((c) => `• ${c}`).join("\n")

  return fournisseurIa().completer({
    systeme: SYSTEME_METIER,
    repli,
    maxTokens: 600,
    messages: [
      {
        role: "user",
        contenu: `Explique l'evolution de la marge du chantier « ${projet.nom} » (${projet.reference}).
Faits etablis :
${repli}

Redige un paragraphe court qui identifie les facteurs principaux de variation de la marge, puis deux ou trois actions concretes. Aucun chiffre en dehors de ceux fournis.`,
      },
    ],
  })
}

// ═══════════════════════════════════════════════════════════════════════════
//  Risques de planning
// ═══════════════════════════════════════════════════════════════════════════

export async function risquesPlanning(projectId: string, organizationId: string): Promise<string> {
  const projet = await prisma.project.findFirst({
    where: { id: projectId, organizationId },
    select: { nom: true, dateFinPrevue: true },
  })
  if (!projet) return "Projet introuvable."

  const [taches, dependances, incidents] = await Promise.all([
    prisma.task.findMany({
      where: { projectId },
      include: {
        lot: { select: { code: true, nom: true } },
        subcontractor: { select: { raisonSociale: true } },
      },
    }),
    prisma.taskDependency.findMany({ where: { successeur: { projectId } } }),
    prisma.incident.findMany({
      where: { projectId, statut: { in: ["OUVERT", "EN_TRAITEMENT"] } },
      select: { titre: true, gravite: true, impactDelaiJours: true },
    }),
  ])

  const planning = calculerPlanning(
    taches.map((t) => ({
      id: t.id,
      nom: t.nom,
      lotId: t.lotId,
      lotCode: t.lot?.code ?? null,
      lotNom: t.lot?.nom ?? null,
      sousTraitant: t.subcontractor?.raisonSociale ?? null,
      statut: t.statut,
      dateDebut: t.dateDebut,
      dateFin: t.dateFin,
      dureeJours: t.dureeJours,
      avancement: nb(t.avancement),
      jalon: t.jalon,
      ordre: t.ordre,
    })),
    dependances.map((d) => ({
      predecesseurId: d.predecesseurId,
      successeurId: d.successeurId,
      type: d.type,
      decalageJours: d.decalageJours,
    }))
  )

  const constats: string[] = []

  if (planning.taches.length === 0) {
    return "Aucune tache planifiee : le planning ne peut pas encore etre analyse."
  }

  constats.push(
    `Avancement moyen : ${pourcent(planning.avancementMoyen)} sur ${planning.taches.length} taches, dont ${planning.nbTerminees} terminee(s).`
  )

  const enRetard = planning.taches.filter((t) => t.enRetard)
  if (enRetard.length > 0) {
    constats.push(
      `${enRetard.length} tache(s) en retard : ${enRetard
        .slice(0, 5)
        .map((t) => `${t.nom} (+${t.joursRetard} j${t.sousTraitant ? `, ${t.sousTraitant}` : ""})`)
        .join(", ")}.`
    )
  } else {
    constats.push("Aucune tache en retard.")
  }

  const critiquesNonFinies = planning.taches.filter((t) => t.critique && t.avancement < 100)
  if (critiquesNonFinies.length > 0) {
    constats.push(
      `Taches critiques sans marge encore ouvertes : ${critiquesNonFinies
        .slice(0, 5)
        .map((t) => t.nom)
        .join(", ")}. Tout retard sur ces taches decale la reception.`
    )
  }

  if (planning.nbConflits > 0) {
    const avecConflit = planning.taches.filter((t) => t.conflits.length > 0)
    constats.push(
      `${planning.nbConflits} conflit(s) de dependance : ${avecConflit
        .slice(0, 3)
        .map((t) => `${t.nom} — ${t.conflits[0]}`)
        .join(" ; ")}.`
    )
  }

  if (incidents.length > 0) {
    const impact = incidents.reduce((s, i) => s + i.impactDelaiJours, 0)
    constats.push(
      `${incidents.length} incident(s) ouvert(s), impact delai declare de ${impact} jour(s) : ${incidents
        .slice(0, 3)
        .map((i) => `${i.titre} (${i.gravite.toLowerCase()})`)
        .join(", ")}.`
    )
  }

  if (planning.retardProjet > 0) {
    constats.push(
      `Retard maximum constate : ${planning.retardProjet} jour(s). Fin de chantier prevue le ${planning.dateFin?.toLocaleDateString("fr-FR")}.`
    )
  }

  const repli = constats.map((c) => `• ${c}`).join("\n")

  return fournisseurIa().completer({
    systeme: SYSTEME_METIER,
    repli,
    maxTokens: 600,
    messages: [
      {
        role: "user",
        contenu: `Analyse les risques de retard du chantier « ${projet.nom} ».
Faits etablis :
${repli}

Redige une synthese courte : le risque principal, ses consequences, puis les mesures a prendre. Aucun chiffre invente.`,
      },
    ],
  })
}

// ═══════════════════════════════════════════════════════════════════════════
//  Synthese comparative d'une consultation
// ═══════════════════════════════════════════════════════════════════════════

export async function analyserConsultation(
  consultationId: string,
  organizationId: string
): Promise<string> {
  const consultation = await prisma.consultation.findFirst({
    where: { id: consultationId, organizationId },
    include: {
      lot: { select: { nom: true } },
      offers: { include: { subcontractor: true, _count: { select: { lignes: true } } } },
    },
  })
  if (!consultation) return "Consultation introuvable."
  if (consultation.offers.length === 0) return "Aucune offre recue pour cette consultation."

  const comparaison = comparerOffres(
    consultation.offers.map((o) => ({
      id: o.id,
      subcontractorId: o.subcontractorId,
      sousTraitant: o.subcontractor.raisonSociale,
      montantHT: nb(o.montantHT),
      delaiJours: o.delaiJours,
      notation: nb(o.subcontractor.notation, 3),
      noteQualite: nb(o.subcontractor.noteQualite, 3),
      noteDelai: nb(o.subcontractor.noteDelai, 3),
      nbMarches: o.subcontractor.nbMarches,
      nbLitiges: o.subcontractor.nbLitiges,
      assuranceRcValide: o.subcontractor.assuranceRcValide,
      assuranceDecennaleValide: o.subcontractor.assuranceDecennaleValide,
      attestationVigilanceValide: o.subcontractor.attestationVigilanceValide,
      exclusions: o.exclusions,
      garanties: o.garanties,
      conditionsPaiement: o.conditionsPaiement,
      statut: o.statut,
      nbLignes: o._count.lignes,
    })),
    consultation.budgetEstime ? nb(consultation.budgetEstime) : null
  )

  const lignes: string[] = comparaison.offres.map(
    (o) =>
      `${o.rang}. ${o.sousTraitant} — ${euros(o.montantHT)} · delai ${o.delaiJours ?? "?"} j · score ${o.score.toFixed(1)}/100${o.signaux.length ? ` · signaux : ${o.signaux.join(" ; ")}` : ""}`
  )

  const repli = [
    `Ecart entre la moins-disante et la plus chere : ${comparaison.ecartMinMax.toFixed(1)} %.`,
    ...lignes,
    comparaison.recommandee
      ? `Recommandation : ${comparaison.recommandee.sousTraitant}.`
      : "Aucune recommandation possible.",
  ].join("\n")

  return fournisseurIa().completer({
    systeme: SYSTEME_METIER,
    repli,
    maxTokens: 700,
    messages: [
      {
        role: "user",
        contenu: `Compare les offres recues pour le lot « ${consultation.lot.nom} ».
Donnees du comparateur :
${repli}

Redige une synthese d'aide a la decision : le classement, les points de vigilance par offre, et la recommandation motivee. N'invente aucun chiffre.`,
      },
    ],
  })
}

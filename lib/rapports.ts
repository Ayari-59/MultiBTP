// Module serveur uniquement : ne jamais importer depuis un composant client.
import { prisma } from "@/lib/prisma"
import { dateCourte, euros, nb, pourcent } from "@/lib/utils"
import { chiffrageProjet } from "@/lib/queries/chiffrage"
import { listeProjets, syntheseProjet } from "@/lib/queries/projets"
import { calculerLignesBudget } from "@/lib/metier/budget"
import { calculerPlanning } from "@/lib/metier/planning"
import { LIBELLES_UNITE } from "@/lib/metier/referentiel"
import type { Bloc, DocumentPdf } from "@/lib/pdf"

export type TypeRapport =
  | "devis"
  | "consultation"
  | "marche"
  | "chantier"
  | "financier"
  | "marge"
  | "sous-traitants"
  | "avancement"
  | "reception"

export const LIBELLES_RAPPORT: Record<TypeRapport, string> = {
  devis: "Devis client",
  consultation: "Dossier de consultation",
  marche: "Marche de sous-traitance",
  chantier: "Rapport de chantier",
  financier: "Rapport financier",
  marge: "Rapport de marge",
  "sous-traitants": "Rapport sous-traitants",
  avancement: "Rapport d'avancement",
  reception: "Proces-verbal de reception",
}

async function entete(organizationId: string) {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } })
  return {
    nom: org.nom,
    adresse: org.adresse,
    codePostal: org.codePostal,
    ville: org.ville,
    telephone: org.telephone,
    email: org.email,
    siret: org.siret,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Devis client
// ═══════════════════════════════════════════════════════════════════════════

export async function rapportDevis(
  projectId: string,
  organizationId: string
): Promise<DocumentPdf | null> {
  const [projet, chiffrage] = await Promise.all([
    prisma.project.findFirst({
      where: { id: projectId, organizationId },
      include: { contact: true },
    }),
    chiffrageProjet(projectId, organizationId),
  ])
  if (!projet || !chiffrage) return null

  const blocs: Bloc[] = [
    {
      type: "champs",
      valeurs: [
        ["Client", projet.contact?.societe || `${projet.contact?.prenom ?? ""} ${projet.contact?.nom ?? "—"}`.trim()],
        ["Chantier", [projet.adresse, projet.codePostal, projet.ville].filter(Boolean).join(", ") || "—"],
        ["Surface", projet.surface ? `${nb(projet.surface)} m2` : "—"],
        ["Date", dateCourte(new Date())],
        ["Validite", "3 mois"],
      ],
    },
  ]

  if (projet.description) {
    blocs.push({ type: "titre", texte: "Descriptif de l'operation" })
    blocs.push({ type: "paragraphe", texte: projet.description })
  }

  for (const lot of chiffrage.lots) {
    if (lot.postes.length === 0) continue
    const totaux = chiffrage.resultat.lots.find((l) => l.lotId === lot.id)

    blocs.push({ type: "titre", texte: `Lot ${lot.code} — ${lot.nom}` })
    if (lot.descriptif) blocs.push({ type: "paragraphe", texte: lot.descriptif })

    blocs.push({
      type: "tableau",
      colonnes: [
        { titre: "Designation", largeur: 46 },
        { titre: "Unite", largeur: 10, aligne: "droite" },
        { titre: "Quantite", largeur: 12, aligne: "droite" },
        { titre: "PU HT", largeur: 14, aligne: "droite" },
        { titre: "Total HT", largeur: 18, aligne: "droite" },
      ],
      lignes: lot.postes.map((p) => [
        p.designation,
        LIBELLES_UNITE[p.unite] ?? p.unite,
        String(p.quantite % 1 === 0 ? p.quantite : p.quantite.toFixed(2)),
        euros(p.prixUnitaire, 2),
        euros(p.totalHT),
      ]),
    })

    blocs.push({
      type: "totaux",
      valeurs: [[`Total lot ${lot.code}`, euros(totaux?.montantHT ?? 0)]],
    })
  }

  blocs.push({ type: "separateur" })
  blocs.push({
    type: "totaux",
    accent: true,
    valeurs: [
      ["Total HT", euros(chiffrage.resultat.montantHT)],
      [`TVA ${pourcent(chiffrage.params.tauxTva, 1)}`, euros(chiffrage.resultat.tva)],
      ["Total TTC", euros(chiffrage.resultat.montantTTC)],
    ],
  })

  blocs.push({ type: "espace", hauteur: 20 })
  blocs.push({
    type: "paragraphe",
    texte:
      "Devis etabli sur la base des elements communiques. Toute modification de programme fera l'objet d'un avenant chiffre. Bon pour accord, date et signature du maitre d'ouvrage :",
  })

  return {
    titre: "Devis",
    sousTitre: projet.nom,
    reference: projet.reference,
    organisation: await entete(organizationId),
    blocs,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Dossier de consultation
// ═══════════════════════════════════════════════════════════════════════════

export async function rapportConsultation(
  consultationId: string,
  organizationId: string
): Promise<DocumentPdf | null> {
  const consultation = await prisma.consultation.findFirst({
    where: { id: consultationId, organizationId },
    include: {
      project: true,
      lot: {
        include: {
          items: { where: { estimate: { retenu: true } }, orderBy: { ordre: "asc" } },
        },
      },
    },
  })
  if (!consultation) return null

  const blocs: Bloc[] = [
    {
      type: "champs",
      valeurs: [
        ["Operation", consultation.project.nom],
        [
          "Adresse du chantier",
          [consultation.project.adresse, consultation.project.codePostal, consultation.project.ville]
            .filter(Boolean)
            .join(", ") || "—",
        ],
        ["Lot consulte", `${consultation.lot.code} — ${consultation.lot.nom}`],
        [
          "Delai d'execution souhaite",
          consultation.delaiSouhaiteJours ? `${consultation.delaiSouhaiteJours} jours` : "A preciser",
        ],
        ["Demarrage souhaite", dateCourte(consultation.dateDebutSouhaitee)],
        ["Date limite de reponse", dateCourte(consultation.dateLimiteReponse)],
      ],
    },
  ]

  if (consultation.project.description) {
    blocs.push({ type: "titre", texte: "Presentation de l'operation" })
    blocs.push({ type: "paragraphe", texte: consultation.project.description })
  }
  if (consultation.project.contraintes) {
    blocs.push({ type: "sousTitre", texte: "Contraintes particulieres" })
    blocs.push({ type: "paragraphe", texte: consultation.project.contraintes })
  }
  if (consultation.descriptif) {
    blocs.push({ type: "titre", texte: "Descriptif des prestations attendues" })
    blocs.push({ type: "paragraphe", texte: consultation.descriptif })
  }

  if (consultation.lot.items.length > 0) {
    blocs.push({ type: "titre", texte: "Quantitatif" })
    blocs.push({
      type: "tableau",
      colonnes: [
        { titre: "Designation", largeur: 66 },
        { titre: "Unite", largeur: 14, aligne: "droite" },
        { titre: "Quantite", largeur: 20, aligne: "droite" },
      ],
      lignes: consultation.lot.items.map((i) => [
        i.designation,
        LIBELLES_UNITE[i.unite] ?? i.unite,
        String(nb(i.quantite) % 1 === 0 ? nb(i.quantite) : nb(i.quantite).toFixed(2)),
      ]),
    })
    blocs.push({
      type: "paragraphe",
      texte:
        "Les quantites sont donnees a titre indicatif. L'entreprise reste responsable de ses propres metres et signale toute prestation manquante.",
    })
  }

  blocs.push({ type: "titre", texte: "Pieces a joindre a l'offre" })
  blocs.push({
    type: "paragraphe",
    texte:
      "Devis detaille poste par poste, delai d'execution, planning previsionnel, attestation d'assurance decennale en cours de validite, attestation de vigilance URSSAF de moins de six mois, extrait Kbis, references de chantiers comparables.",
  })

  return {
    titre: "Dossier de consultation",
    sousTitre: consultation.objet,
    reference: consultation.reference,
    organisation: await entete(organizationId),
    blocs,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Rapport financier / marge
// ═══════════════════════════════════════════════════════════════════════════

export async function rapportFinancier(
  organizationId: string,
  projectId?: string
): Promise<DocumentPdf> {
  const projets = await listeProjets(organizationId, projectId ? undefined : { actifs: true })
  const retenus = projectId ? projets.filter((p) => p.id === projectId) : projets

  const totalVente = retenus.reduce((s, p) => s + p.montantHT, 0)
  const totalBudget = retenus.reduce((s, p) => s + p.budget, 0)
  const totalEngage = retenus.reduce((s, p) => s + p.engage, 0)
  const totalRealise = retenus.reduce((s, p) => s + p.realise, 0)
  const totalAtterrissage = retenus.reduce((s, p) => s + p.atterrissage, 0)
  const marge = totalVente - totalAtterrissage

  const blocs: Bloc[] = [
    {
      type: "tableau",
      colonnes: [
        { titre: "Reference", largeur: 14 },
        { titre: "Projet", largeur: 26 },
        { titre: "Statut", largeur: 12 },
        { titre: "Vendu HT", largeur: 12, aligne: "droite" },
        { titre: "Budget", largeur: 12, aligne: "droite" },
        { titre: "Engage", largeur: 12, aligne: "droite" },
        { titre: "Atterrissage", largeur: 12, aligne: "droite" },
      ],
      lignes: retenus.map((p) => [
        p.reference,
        p.nom,
        p.statut,
        euros(p.montantHT),
        euros(p.budget),
        euros(p.engage),
        euros(p.atterrissage),
      ]),
    },
    { type: "separateur" },
    {
      type: "totaux",
      accent: true,
      valeurs: [
        ["Chiffre d'affaires previsionnel", euros(totalVente)],
        ["Budget de couts", euros(totalBudget)],
        ["Couts engages", euros(totalEngage)],
        ["Couts realises", euros(totalRealise)],
        ["Atterrissage estime", euros(totalAtterrissage)],
        ["Marge previsionnelle", `${euros(marge)} (${pourcent(totalVente > 0 ? (marge / totalVente) * 100 : 0)})`],
      ],
    },
  ]

  const enDerive = retenus.filter((p) => p.enDerive)
  if (enDerive.length > 0) {
    blocs.push({ type: "titre", texte: "Projets en derive budgetaire" })
    blocs.push({
      type: "tableau",
      colonnes: [
        { titre: "Projet", largeur: 40 },
        { titre: "Budget", largeur: 20, aligne: "droite" },
        { titre: "Atterrissage", largeur: 20, aligne: "droite" },
        { titre: "Ecart", largeur: 20, aligne: "droite" },
      ],
      lignes: enDerive.map((p) => [
        p.nom,
        euros(p.budget),
        euros(p.atterrissage),
        euros(p.budget - p.atterrissage),
      ]),
    })
  }

  return {
    titre: projectId ? "Rapport financier du projet" : "Rapport financier",
    sousTitre: `${retenus.length} operation(s) — edite le ${dateCourte(new Date())}`,
    organisation: await entete(organizationId),
    blocs,
  }
}

export async function rapportMarge(
  projectId: string,
  organizationId: string
): Promise<DocumentPdf | null> {
  const [projet, synthese] = await Promise.all([
    prisma.project.findFirst({ where: { id: projectId, organizationId } }),
    syntheseProjet(projectId, organizationId),
  ])
  if (!projet || !synthese) return null

  const lignes = calculerLignesBudget(synthese.lignes)
  const { budget } = synthese

  const avenants = await prisma.changeOrder.findMany({
    where: { projectId, statut: "ACCEPTE" },
    orderBy: { impactCout: "desc" },
  })

  const blocs: Bloc[] = [
    {
      type: "champs",
      valeurs: [
        ["Marge cible", pourcent(nb(projet.margeCible))],
        ["Marge previsionnelle", pourcent(budget.tauxMargePrevisionnelle)],
        ["Marge a l'origine", pourcent(budget.tauxMargeInitiale)],
        [
          "Variation",
          `${(budget.tauxMargePrevisionnelle - budget.tauxMargeInitiale).toFixed(1)} point(s)`,
        ],
      ],
    },
    { type: "titre", texte: "Chaine budgetaire" },
    {
      type: "totaux",
      valeurs: [
        ["Budget initial", euros(budget.budgetInitial)],
        ["Avenants acceptes", euros(budget.avenantsCout)],
        ["Budget actualise", euros(budget.budgetActualise)],
        ["Couts engages", euros(budget.engage)],
        ["Couts realises", euros(budget.realise)],
        ["Reste a engager", euros(budget.resteAEngager)],
        ["Prevision d'atterrissage", euros(budget.atterrissage)],
      ],
    },
    { type: "separateur" },
    {
      type: "totaux",
      accent: true,
      valeurs: [
        ["Prix de vente actualise", euros(budget.prixVenteActualise)],
        ["Marge previsionnelle", euros(budget.margePrevisionnelle)],
        ["Ecart au budget", euros(budget.ecart)],
      ],
    },
    { type: "titre", texte: "Detail par lot" },
    {
      type: "tableau",
      colonnes: [
        { titre: "Lot", largeur: 34 },
        { titre: "Budget", largeur: 14, aligne: "droite" },
        { titre: "Engage", largeur: 14, aligne: "droite" },
        { titre: "Realise", largeur: 14, aligne: "droite" },
        { titre: "Atterrissage", largeur: 12, aligne: "droite" },
        { titre: "Ecart", largeur: 12, aligne: "droite" },
      ],
      lignes: lignes.map((l) => [
        `${l.code} ${l.nom}`,
        euros(l.budget),
        euros(l.engage),
        euros(l.realise),
        euros(l.atterrissage),
        euros(l.ecart),
      ]),
    },
  ]

  if (avenants.length > 0) {
    blocs.push({ type: "titre", texte: "Avenants acceptes" })
    blocs.push({
      type: "tableau",
      colonnes: [
        { titre: "Reference", largeur: 16 },
        { titre: "Motif", largeur: 44 },
        { titre: "Cout", largeur: 14, aligne: "droite" },
        { titre: "Refacture", largeur: 14, aligne: "droite" },
        { titre: "Delai", largeur: 12, aligne: "droite" },
      ],
      lignes: avenants.map((a) => [
        a.reference,
        a.motif,
        euros(nb(a.impactCout)),
        euros(nb(a.impactVente)),
        `${a.impactDelaiJours} j`,
      ]),
    })
  }

  return {
    titre: "Rapport de marge",
    sousTitre: projet.nom,
    reference: projet.reference,
    organisation: await entete(organizationId),
    blocs,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Rapport de chantier / avancement
// ═══════════════════════════════════════════════════════════════════════════

export async function rapportChantier(
  projectId: string,
  organizationId: string
): Promise<DocumentPdf | null> {
  const projet = await prisma.project.findFirst({
    where: { id: projectId, organizationId },
    include: {
      contact: true,
      tasks: {
        include: {
          lot: { select: { code: true, nom: true } },
          subcontractor: { select: { raisonSociale: true } },
        },
      },
      incidents: { where: { statut: { in: ["OUVERT", "EN_TRAITEMENT"] } } },
      reservations: { where: { statut: "OUVERTE" }, include: { lot: { select: { code: true } } } },
      siteReports: { orderBy: { date: "desc" }, take: 5, include: { auteur: { select: { name: true } } } },
    },
  })
  if (!projet) return null

  const dependances = await prisma.taskDependency.findMany({
    where: { successeur: { projectId } },
  })

  const planning = calculerPlanning(
    projet.tasks.map((t) => ({
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

  const blocs: Bloc[] = [
    {
      type: "champs",
      valeurs: [
        ["Maitre d'ouvrage", projet.contact?.societe || projet.contact?.nom || "—"],
        ["Adresse", [projet.adresse, projet.codePostal, projet.ville].filter(Boolean).join(", ") || "—"],
        ["Demarrage", dateCourte(projet.dateDebutReelle ?? projet.dateDebutPrevue)],
        ["Fin prevue", dateCourte(projet.dateFinPrevue)],
        ["Avancement", pourcent(planning.avancementMoyen)],
        ["Taches en retard", String(planning.nbEnRetard)],
      ],
    },
    { type: "titre", texte: "Avancement des taches" },
    {
      type: "tableau",
      colonnes: [
        { titre: "Tache", largeur: 30 },
        { titre: "Entreprise", largeur: 22 },
        { titre: "Debut", largeur: 12, aligne: "droite" },
        { titre: "Fin", largeur: 12, aligne: "droite" },
        { titre: "Avancement", largeur: 12, aligne: "droite" },
        { titre: "Etat", largeur: 12, aligne: "droite" },
      ],
      lignes: planning.taches.map((t) => [
        t.nom,
        t.sousTraitant ?? "—",
        dateCourte(t.dateDebut),
        dateCourte(t.dateFin),
        pourcent(t.avancement, 0),
        t.enRetard ? `retard ${t.joursRetard} j` : t.avancement >= 100 ? "terminee" : "en cours",
      ]),
    },
  ]

  if (projet.incidents.length > 0) {
    blocs.push({ type: "titre", texte: "Incidents ouverts" })
    blocs.push({
      type: "tableau",
      colonnes: [
        { titre: "Incident", largeur: 48 },
        { titre: "Gravite", largeur: 16, aligne: "droite" },
        { titre: "Impact cout", largeur: 18, aligne: "droite" },
        { titre: "Impact delai", largeur: 18, aligne: "droite" },
      ],
      lignes: projet.incidents.map((i) => [
        i.titre,
        i.gravite,
        euros(nb(i.impactCout)),
        `${i.impactDelaiJours} j`,
      ]),
    })
  }

  if (projet.reservations.length > 0) {
    blocs.push({ type: "titre", texte: "Reserves ouvertes" })
    blocs.push({
      type: "tableau",
      colonnes: [
        { titre: "Reserve", largeur: 52 },
        { titre: "Lot", largeur: 12 },
        { titre: "Localisation", largeur: 22 },
        { titre: "Limite", largeur: 14, aligne: "droite" },
      ],
      lignes: projet.reservations.map((r) => [
        r.libelle,
        r.lot?.code ?? "—",
        r.localisation ?? "—",
        dateCourte(r.dateLimite),
      ]),
    })
  }

  if (projet.siteReports.length > 0) {
    blocs.push({ type: "titre", texte: "Derniers comptes rendus" })
    for (const rapport of projet.siteReports) {
      blocs.push({
        type: "sousTitre",
        texte: `${dateCourte(rapport.date)} — ${rapport.auteur?.name ?? "—"}${rapport.meteo ? ` (${rapport.meteo})` : ""}`,
      })
      if (rapport.travauxRealises) {
        blocs.push({ type: "paragraphe", texte: rapport.travauxRealises })
      }
      if (rapport.decisions) {
        blocs.push({ type: "paragraphe", texte: `Decisions : ${rapport.decisions}` })
      }
    }
  }

  return {
    titre: "Rapport de chantier",
    sousTitre: projet.nom,
    reference: projet.reference,
    organisation: await entete(organizationId),
    blocs,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Rapport sous-traitants
// ═══════════════════════════════════════════════════════════════════════════

export async function rapportSousTraitants(organizationId: string): Promise<DocumentPdf> {
  const entreprises = await prisma.subcontractor.findMany({
    where: { organizationId },
    include: {
      contracts: { select: { montantActualise: true } },
      _count: { select: { offers: true, contracts: true } },
    },
    orderBy: { notation: "desc" },
  })

  return {
    titre: "Rapport sous-traitants",
    sousTitre: `${entreprises.length} entreprise(s) — edite le ${dateCourte(new Date())}`,
    organisation: await entete(organizationId),
    blocs: [
      {
        type: "tableau",
        colonnes: [
          { titre: "Entreprise", largeur: 26 },
          { titre: "Zone", largeur: 14 },
          { titre: "Note", largeur: 8, aligne: "droite" },
          { titre: "Marches", largeur: 10, aligne: "droite" },
          { titre: "Volume", largeur: 16, aligne: "droite" },
          { titre: "Litiges", largeur: 10, aligne: "droite" },
          { titre: "Conformite", largeur: 16, aligne: "droite" },
        ],
        lignes: entreprises.map((e) => [
          e.raisonSociale,
          e.zoneGeo ?? e.ville ?? "—",
          nb(e.notation, 3).toFixed(1),
          String(e._count.contracts),
          euros(e.contracts.reduce((s, c) => s + nb(c.montantActualise), 0)),
          String(e.nbLitiges),
          e.assuranceDecennaleValide && e.attestationVigilanceValide ? "A jour" : "Incomplet",
        ]),
      },
      { type: "separateur" },
      {
        type: "paragraphe",
        texte:
          "Les entreprises signalees « Incomplet » ne disposent pas d'une assurance decennale ou d'une attestation de vigilance URSSAF a jour dans le systeme. La verification de ces pieces est une obligation du donneur d'ordre.",
      },
    ],
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Proces-verbal de reception
// ═══════════════════════════════════════════════════════════════════════════

export async function rapportReception(
  projectId: string,
  organizationId: string
): Promise<DocumentPdf | null> {
  const projet = await prisma.project.findFirst({
    where: { id: projectId, organizationId },
    include: {
      contact: true,
      reservations: { include: { lot: { select: { code: true } } }, orderBy: { statut: "asc" } },
      contracts: {
        include: {
          subcontractor: { select: { raisonSociale: true } },
          lot: { select: { code: true, nom: true } },
        },
      },
    },
  })
  if (!projet) return null

  const ouvertes = projet.reservations.filter((r) => r.statut === "OUVERTE")

  return {
    titre: "Proces-verbal de reception des travaux",
    sousTitre: projet.nom,
    reference: projet.reference,
    organisation: await entete(organizationId),
    blocs: [
      {
        type: "champs",
        valeurs: [
          ["Maitre d'ouvrage", projet.contact?.societe || projet.contact?.nom || "—"],
          ["Adresse des travaux", [projet.adresse, projet.codePostal, projet.ville].filter(Boolean).join(", ") || "—"],
          ["Date de reception", dateCourte(projet.dateReception ?? new Date())],
          ["Reserves", ouvertes.length > 0 ? `${ouvertes.length} reserve(s)` : "Sans reserve"],
        ],
      },
      { type: "titre", texte: "Entreprises intervenantes" },
      {
        type: "tableau",
        colonnes: [
          { titre: "Lot", largeur: 30 },
          { titre: "Entreprise", largeur: 40 },
          { titre: "Montant du marche", largeur: 30, aligne: "droite" },
        ],
        lignes: projet.contracts.map((c) => [
          `${c.lot.code} ${c.lot.nom}`,
          c.subcontractor.raisonSociale,
          euros(nb(c.montantActualise)),
        ]),
      },
      ...(ouvertes.length > 0
        ? ([
            { type: "titre", texte: "Reserves emises" },
            {
              type: "tableau",
              colonnes: [
                { titre: "Reserve", largeur: 52 },
                { titre: "Lot", largeur: 12 },
                { titre: "Localisation", largeur: 22 },
                { titre: "Levee avant", largeur: 14, aligne: "droite" },
              ],
              lignes: ouvertes.map((r) => [
                r.libelle,
                r.lot?.code ?? "—",
                r.localisation ?? "—",
                dateCourte(r.dateLimite),
              ]),
            },
          ] as Bloc[])
        : ([{ type: "paragraphe", texte: "Les travaux sont receptionnes sans reserve." }] as Bloc[])),
      { type: "espace", hauteur: 24 },
      {
        type: "paragraphe",
        texte:
          "Le present proces-verbal vaut reception des travaux au sens de l'article 1792-6 du Code civil. Il fait courir les garanties de parfait achevement, de bon fonctionnement et decennale.",
      },
      { type: "espace", hauteur: 20 },
      {
        type: "champs",
        valeurs: [
          ["Le maitre d'ouvrage", "..............................."],
          ["Le maitre d'oeuvre", "..............................."],
        ],
      },
    ],
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Export CSV
// ═══════════════════════════════════════════════════════════════════════════

function echapper(valeur: string | number): string {
  const texte = String(valeur ?? "")
  return /[";\n]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte
}

export function versCsv(entetes: string[], lignes: (string | number)[][]): string {
  // Point-virgule et BOM : Excel francais ouvre le fichier sans reglage.
  const contenu = [entetes, ...lignes].map((l) => l.map(echapper).join(";")).join("\r\n")
  return `﻿${contenu}`
}

export async function csvProjets(organizationId: string): Promise<string> {
  const projets = await listeProjets(organizationId)
  return versCsv(
    [
      "Reference",
      "Projet",
      "Client",
      "Ville",
      "Statut",
      "Surface m2",
      "Montant HT",
      "Budget",
      "Engage",
      "Realise",
      "Atterrissage",
      "Marge %",
      "Marge cible %",
      "Avancement %",
      "Fin prevue",
    ],
    projets.map((p) => [
      p.reference,
      p.nom,
      p.client ?? "",
      p.ville ?? "",
      p.statut,
      p.surface ?? "",
      p.montantHT,
      p.budget,
      p.engage,
      p.realise,
      p.atterrissage,
      p.margeTaux,
      p.margeCible,
      p.avancementPhysique,
      p.dateFinPrevue ? dateCourte(p.dateFinPrevue) : "",
    ])
  )
}

export async function csvChiffrage(projectId: string, organizationId: string): Promise<string> {
  const chiffrage = await chiffrageProjet(projectId, organizationId)
  if (!chiffrage) return versCsv(["Aucun chiffrage"], [])

  return versCsv(
    [
      "Lot",
      "Intitule du lot",
      "Poste",
      "Unite",
      "Quantite",
      "PU HT",
      "Total HT",
      "Cout de revient",
      "Marge",
    ],
    chiffrage.lots.flatMap((lot) =>
      lot.postes.map((p) => [
        lot.code,
        lot.nom,
        p.designation,
        LIBELLES_UNITE[p.unite] ?? p.unite,
        p.quantite,
        p.prixUnitaire,
        p.totalHT,
        p.coutDirect,
        p.totalHT - p.coutDirect,
      ])
    )
  )
}

export async function csvBudget(projectId: string, organizationId: string): Promise<string> {
  const synthese = await syntheseProjet(projectId, organizationId)
  if (!synthese) return versCsv(["Aucune donnee"], [])

  const lignes = calculerLignesBudget(synthese.lignes)
  return versCsv(
    ["Lot", "Intitule", "Budget", "Engage", "Realise", "Reste a engager", "Atterrissage", "Ecart"],
    lignes.map((l) => [
      l.code,
      l.nom,
      l.budget,
      l.engage,
      l.realise,
      l.resteAEngager,
      l.atterrissage,
      l.ecart,
    ])
  )
}

export async function csvFactures(organizationId: string): Promise<string> {
  const factures = await prisma.invoice.findMany({
    where: { project: { organizationId } },
    include: { project: { select: { reference: true, nom: true } } },
    orderBy: { dateEmission: "desc" },
  })

  return versCsv(
    ["Numero", "Projet", "Emetteur", "Sens", "Montant HT", "TVA %", "Montant TTC", "Emission", "Echeance", "Statut"],
    factures.map((f) => [
      f.numero,
      `${f.project.reference} ${f.project.nom}`,
      f.emetteur,
      f.sens,
      nb(f.montantHT),
      nb(f.tauxTva),
      nb(f.montantTTC),
      dateCourte(f.dateEmission),
      f.dateEcheance ? dateCourte(f.dateEcheance) : "",
      f.statut,
    ])
  )
}

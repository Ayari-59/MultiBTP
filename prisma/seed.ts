/**
 * Jeu de donnees de demonstration.
 *
 * Il rejoue le scenario de reference du cahier des charges : une societe de
 * coordination de travaux qui pilote cinq operations a differents stades, dont
 * une renovation d'immeuble de 1 200 m² suivie de bout en bout — chiffrage,
 * consultations, comparaison d'offres, marches, avenants, situations, chantier.
 *
 * Lancement : npm run db:seed  (ou npm run db:reset pour repartir a zero)
 */

import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import bcrypt from "bcryptjs"

import { CATALOGUE_PRIX } from "../lib/metier/referentiel"
import { genererProjet, type PrixOrganisation } from "../lib/metier/lancement"
import { calculerSituation } from "../lib/metier/budget"

const prisma = new PrismaClient({
  adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })),
})

// ─── Utilitaires ────────────────────────────────────────────────────────────

const AUJOURDHUI = new Date()

function jours(n: number, base = AUJOURDHUI): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + n)
  return d
}

function mois(n: number, base = AUJOURDHUI): Date {
  const d = new Date(base)
  d.setMonth(d.getMonth() + n)
  return d
}

function arrondi(v: number): number {
  return Math.round(v * 100) / 100
}

/** Aleatoire deterministe : le seed produit toujours les memes donnees. */
let graine = 20260820
function alea(): number {
  graine = (graine * 1103515245 + 12345) % 2147483648
  return graine / 2147483648
}

function variation(base: number, amplitude: number): number {
  return arrondi(base * (1 + (alea() - 0.5) * 2 * amplitude))
}

// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log("Nettoyage de la base...")
  await prisma.organization.deleteMany()

  // ─── Organisation ─────────────────────────────────────────────────────────
  console.log("Creation de l'organisation...")
  const org = await prisma.organization.create({
    data: {
      nom: "Delcourt Coordination & Travaux",
      slug: "delcourt-coordination",
      prefixe: "DCT",
      siret: "89412375600018",
      adresse: "42 rue Nationale",
      codePostal: "59000",
      ville: "Lille",
      telephone: "03 20 14 88 20",
      email: "contact@delcourt-coordination.fr",
      siteWeb: "https://delcourt-coordination.fr",
      tauxTva: 20,
      tauxFraisChantier: 4,
      tauxFraisGeneraux: 8,
      margeCibleDefaut: 18,
      tauxRetenueGarantie: 5,
      seuilAlerteDerive: 2,
      plan: "PREMIUM",
      quotaProjets: 100,
      quotaUsers: 25,
      abonnementFin: mois(11),
    },
  })

  // ─── Utilisateurs ─────────────────────────────────────────────────────────
  console.log("Creation des utilisateurs...")
  const motDePasse = await bcrypt.hash("Chantier2026!", 10)

  const [dirigeant, conducteur, metreur] = await Promise.all([
    prisma.user.create({
      data: {
        organizationId: org.id,
        email: "karim.delcourt@delcourt-coordination.fr",
        password: motDePasse,
        name: "Karim Delcourt",
        role: "DIRIGEANT",
        fonction: "Gerant",
        telephone: "06 12 45 78 90",
      },
    }),
    prisma.user.create({
      data: {
        organizationId: org.id,
        email: "sofia.bensalah@delcourt-coordination.fr",
        password: motDePasse,
        name: "Sofia Ben Salah",
        role: "CONDUCTEUR",
        fonction: "Conductrice de travaux",
        telephone: "06 22 31 44 07",
      },
    }),
    prisma.user.create({
      data: {
        organizationId: org.id,
        email: "marc.lefebvre@delcourt-coordination.fr",
        password: motDePasse,
        name: "Marc Lefebvre",
        role: "METREUR",
        fonction: "Charge d'etudes de prix",
        telephone: "06 78 90 12 34",
      },
    }),
  ])

  await Promise.all([
    prisma.user.create({
      data: {
        organizationId: org.id,
        email: "admin@delcourt-coordination.fr",
        password: motDePasse,
        name: "Administrateur",
        role: "ADMIN",
        fonction: "Administration de la plateforme",
      },
    }),
    prisma.user.create({
      data: {
        organizationId: org.id,
        email: "nadia.roussel@delcourt-coordination.fr",
        password: motDePasse,
        name: "Nadia Roussel",
        role: "COMPTA",
        fonction: "Comptabilite",
      },
    }),
  ])

  // ─── Bibliotheque de prix ─────────────────────────────────────────────────
  console.log(`Import de ${CATALOGUE_PRIX.length} prix de reference...`)
  const prixOrganisation: PrixOrganisation = new Map()

  for (const poste of CATALOGUE_PRIX) {
    // Les prix pratiques s'ecartent legerement du catalogue : c'est ce qui rend
    // la bibliotheque utile (min / moyen / max reels).
    const prix = variation(poste.prix, 0.04)
    const cout = arrondi(prix * (poste.cout / poste.prix))

    const item = await prisma.priceItem.create({
      data: {
        organizationId: org.id,
        code: poste.code,
        designation: poste.designation,
        categorie: poste.categorie as never,
        unite: poste.unite as never,
        prixReference: prix,
        coutReference: cout,
        localisation: "Hauts-de-France",
      },
    })

    const releves = [
      variation(prix, 0.1),
      variation(prix, 0.07),
      variation(prix, 0.12),
      prix,
    ]

    await prisma.priceHistory.createMany({
      data: releves.map((valeur, i) => ({
        priceItemId: item.id,
        prix: valeur,
        source: i === releves.length - 1 ? "Catalogue de reference" : "Devis recu",
        localisation: "Hauts-de-France",
        date: mois(-(i + 1) * 3),
      })),
    })

    await prisma.priceItem.update({
      where: { id: item.id },
      data: {
        prixMin: Math.min(...releves),
        prixMax: Math.max(...releves),
        prixMoyen: arrondi(releves.reduce((s, v) => s + v, 0) / releves.length),
      },
    })

    prixOrganisation.set(poste.code, { prix, cout })
  }

  // ─── Sous-traitants ───────────────────────────────────────────────────────
  console.log("Creation du panel d'entreprises...")

  const definitionsSt = [
    {
      raisonSociale: "Nord Electricite SARL",
      specialites: ["ELECTRICITE"],
      ville: "Lille",
      zoneGeo: "Metropole lilloise",
      contactNom: "Julien Waeles",
      email: "contact@nord-electricite.fr",
      telephone: "03 20 55 12 45",
      effectif: 14,
      caAnnuel: 1_850_000,
      noteQualite: 4.5,
      noteDelai: 4,
      noteRelation: 4.5,
      nbMarches: 7,
      nbLitiges: 0,
      conforme: true,
    },
    {
      raisonSociale: "Elec Concept 59",
      specialites: ["ELECTRICITE", "CLIMATISATION"],
      ville: "Roubaix",
      zoneGeo: "Hauts-de-France",
      contactNom: "Samir Bouziane",
      email: "devis@elecconcept59.fr",
      telephone: "03 20 71 09 33",
      effectif: 8,
      caAnnuel: 940_000,
      noteQualite: 3.5,
      noteDelai: 3,
      noteRelation: 3.5,
      nbMarches: 3,
      nbLitiges: 1,
      conforme: true,
    },
    {
      raisonSociale: "Vandamme Electricite",
      specialites: ["ELECTRICITE"],
      ville: "Villeneuve-d'Ascq",
      zoneGeo: "Metropole lilloise",
      contactNom: "Pierre Vandamme",
      email: "p.vandamme@vandamme-elec.fr",
      telephone: "03 20 47 66 12",
      effectif: 5,
      caAnnuel: 610_000,
      noteQualite: 3,
      noteDelai: 2.5,
      noteRelation: 3,
      nbMarches: 2,
      nbLitiges: 1,
      conforme: false,
    },
    {
      raisonSociale: "Plomberie Deschamps",
      specialites: ["PLOMBERIE", "CHAUFFAGE"],
      ville: "Lille",
      zoneGeo: "Metropole lilloise",
      contactNom: "Antoine Deschamps",
      email: "contact@plomberie-deschamps.fr",
      telephone: "03 20 33 71 08",
      effectif: 11,
      caAnnuel: 1_420_000,
      noteQualite: 4.5,
      noteDelai: 4.5,
      noteRelation: 4,
      nbMarches: 9,
      nbLitiges: 0,
      conforme: true,
    },
    {
      raisonSociale: "Thermifluide Nord",
      specialites: ["PLOMBERIE", "CHAUFFAGE", "CLIMATISATION"],
      ville: "Tourcoing",
      zoneGeo: "Hauts-de-France",
      contactNom: "Laurent Kieffer",
      email: "l.kieffer@thermifluide.fr",
      telephone: "03 20 26 45 90",
      effectif: 22,
      caAnnuel: 3_100_000,
      noteQualite: 4,
      noteDelai: 3.5,
      noteRelation: 4,
      nbMarches: 5,
      nbLitiges: 0,
      conforme: true,
    },
    {
      raisonSociale: "Batiplatre Hauts-de-France",
      specialites: ["PLATRERIE", "ISOLATION"],
      ville: "Lens",
      zoneGeo: "Hauts-de-France",
      contactNom: "Christophe Merlin",
      email: "contact@batiplatre-hdf.fr",
      telephone: "03 21 44 12 78",
      effectif: 28,
      caAnnuel: 2_650_000,
      noteQualite: 4,
      noteDelai: 4,
      noteRelation: 3.5,
      nbMarches: 6,
      nbLitiges: 0,
      conforme: true,
    },
    {
      raisonSociale: "SAS Duflot Maconnerie",
      specialites: ["GROS_OEUVRE", "MACONNERIE", "DEMOLITION"],
      ville: "Armentieres",
      zoneGeo: "Metropole lilloise",
      contactNom: "Bernard Duflot",
      email: "contact@duflot-maconnerie.fr",
      telephone: "03 20 77 41 09",
      effectif: 19,
      caAnnuel: 2_300_000,
      noteQualite: 4,
      noteDelai: 3.5,
      noteRelation: 4,
      nbMarches: 8,
      nbLitiges: 1,
      conforme: true,
    },
    {
      raisonSociale: "Peinture & Finitions Leroy",
      specialites: ["PEINTURE"],
      ville: "Lille",
      zoneGeo: "Metropole lilloise",
      contactNom: "Sandrine Leroy",
      email: "contact@finitions-leroy.fr",
      telephone: "03 20 12 88 46",
      effectif: 9,
      caAnnuel: 780_000,
      noteQualite: 4.5,
      noteDelai: 4,
      noteRelation: 5,
      nbMarches: 11,
      nbLitiges: 0,
      conforme: true,
    },
    {
      raisonSociale: "Carrelage Moderne 59",
      specialites: ["CARRELAGE"],
      ville: "Wattrelos",
      zoneGeo: "Hauts-de-France",
      contactNom: "Mehdi Ouali",
      email: "contact@carrelagemoderne59.fr",
      telephone: "03 20 82 33 17",
      effectif: 7,
      caAnnuel: 690_000,
      noteQualite: 3.5,
      noteDelai: 3.5,
      noteRelation: 4,
      nbMarches: 4,
      nbLitiges: 0,
      conforme: true,
    },
    {
      raisonSociale: "Menuiseries du Ferrain",
      specialites: ["MENUISERIE"],
      ville: "Neuville-en-Ferrain",
      zoneGeo: "Hauts-de-France",
      contactNom: "Olivier Descamps",
      email: "contact@menuiseries-ferrain.fr",
      telephone: "03 20 94 55 21",
      effectif: 16,
      caAnnuel: 1_950_000,
      noteQualite: 4,
      noteDelai: 4,
      noteRelation: 4,
      nbMarches: 6,
      nbLitiges: 0,
      conforme: true,
    },
    {
      raisonSociale: "Toitures Vanhove",
      specialites: ["COUVERTURE", "CHARPENTE", "ETANCHEITE"],
      ville: "Seclin",
      zoneGeo: "Metropole lilloise",
      contactNom: "Eric Vanhove",
      email: "contact@toitures-vanhove.fr",
      telephone: "03 20 32 18 65",
      effectif: 13,
      caAnnuel: 1_600_000,
      noteQualite: 4,
      noteDelai: 3,
      noteRelation: 3.5,
      nbMarches: 3,
      nbLitiges: 0,
      conforme: true,
    },
    {
      raisonSociale: "Demolition Express Nord",
      specialites: ["DEMOLITION", "TERRASSEMENT"],
      ville: "Douai",
      zoneGeo: "Hauts-de-France",
      contactNom: "Franck Dubois",
      email: "contact@demolition-express.fr",
      telephone: "03 27 88 40 12",
      effectif: 21,
      caAnnuel: 2_050_000,
      noteQualite: 3.5,
      noteDelai: 4,
      noteRelation: 3,
      nbMarches: 5,
      nbLitiges: 0,
      conforme: true,
    },
  ]

  const sousTraitants = await Promise.all(
    definitionsSt.map((d) =>
      prisma.subcontractor.create({
        data: {
          organizationId: org.id,
          raisonSociale: d.raisonSociale,
          siret: `${Math.floor(alea() * 900_000_000 + 100_000_000)}00019`,
          formeJuridique: "SARL",
          contactNom: d.contactNom,
          email: d.email,
          telephone: d.telephone,
          adresse: `${Math.floor(alea() * 90 + 1)} rue de l'Industrie`,
          codePostal: "59000",
          ville: d.ville,
          zoneGeo: d.zoneGeo,
          specialites: d.specialites as never[],
          effectif: d.effectif,
          caAnnuel: d.caAnnuel,
          noteQualite: d.noteQualite,
          noteDelai: d.noteDelai,
          noteRelation: d.noteRelation,
          notation: arrondi((d.noteQualite + d.noteDelai + d.noteRelation) / 3),
          nbMarches: d.nbMarches,
          nbLitiges: d.nbLitiges,
          assuranceRcValide: d.conforme,
          assuranceDecennaleValide: d.conforme,
          attestationVigilanceValide: d.conforme,
          dateValiditeDocuments: d.conforme ? mois(8) : null,
        },
      })
    )
  )

  const parNom = new Map(sousTraitants.map((s) => [s.raisonSociale, s]))
  const st = (nom: string) => {
    const entreprise = parNom.get(nom)
    if (!entreprise) throw new Error(`Entreprise absente du jeu de donnees : ${nom}`)
    return entreprise
  }

  // Compte portail pour une entreprise partenaire
  await prisma.user.create({
    data: {
      organizationId: org.id,
      email: "julien.waeles@nord-electricite.fr",
      password: motDePasse,
      name: "Julien Waeles",
      role: "SOUS_TRAITANT",
      fonction: "Gerant — Nord Electricite",
      subcontractorId: st("Nord Electricite SARL").id,
    },
  })

  // ─── Contacts et pipeline ─────────────────────────────────────────────────
  console.log("Creation des contacts et du pipeline...")

  const contacts = await Promise.all(
    [
      {
        type: "CLIENT",
        nom: "Bernard",
        prenom: "Philippe",
        societe: "SCI Les Tilleuls",
        email: "p.bernard@sci-lestilleuls.fr",
        telephone: "06 07 88 45 12",
        adresse: "18 avenue du Peuple Belge",
        ville: "Lille",
        codePostal: "59000",
        origine: "Recommandation notaire",
      },
      {
        type: "CLIENT",
        nom: "Vermeulen",
        prenom: "Claire",
        societe: "Vermeulen Patrimoine",
        email: "c.vermeulen@vermeulen-patrimoine.fr",
        telephone: "06 45 12 99 03",
        ville: "Marcq-en-Baroeul",
        codePostal: "59700",
        origine: "Salon de l'immobilier",
      },
      {
        type: "MAITRE_OUVRAGE",
        nom: "Techlab Developpement",
        societe: "Techlab Developpement",
        email: "travaux@techlab-dev.fr",
        telephone: "03 20 19 44 00",
        ville: "Lille",
        codePostal: "59000",
        origine: "Appel d'offres prive",
      },
      {
        type: "INVESTISSEUR",
        nom: "Kaddour",
        prenom: "Nabil",
        email: "n.kaddour@gmail.com",
        telephone: "06 88 21 34 56",
        ville: "Roubaix",
        codePostal: "59100",
        origine: "Site web",
      },
      {
        type: "PROSPECT",
        nom: "Lemaire",
        prenom: "Sylvie",
        societe: "SCI Lemaire Freres",
        email: "contact@lemaire-freres.fr",
        telephone: "06 33 77 21 08",
        ville: "Tourcoing",
        codePostal: "59200",
        origine: "Recommandation client",
      },
      {
        type: "ARCHITECTE",
        nom: "Delattre",
        prenom: "Camille",
        societe: "Atelier Delattre Architecture",
        email: "c.delattre@atelier-delattre.fr",
        telephone: "03 20 55 88 12",
        ville: "Lille",
        codePostal: "59000",
        origine: "Partenariat",
      },
    ].map((c) =>
      prisma.contact.create({
        data: { ...c, organizationId: org.id, type: c.type as never },
      })
    )
  )

  const [sciTilleuls, vermeulen, techlab, kaddour, lemaire] = contacts

  await Promise.all([
    prisma.deal.create({
      data: {
        organizationId: org.id,
        contactId: lemaire.id,
        titre: "Renovation de 4 appartements — Tourcoing",
        stage: "NEGOCIATION",
        montantEstime: 285_000,
        probabilite: 65,
        dateCloturePrevue: jours(28),
        description:
          "Renovation complete de quatre appartements en vue d'une mise en location. Client presse par la fin d'un dispositif fiscal.",
      },
    }),
    prisma.deal.create({
      data: {
        organizationId: org.id,
        contactId: kaddour.id,
        titre: "Division d'un immeuble en 6 lots — Roubaix",
        stage: "CHIFFRAGE",
        montantEstime: 420_000,
        probabilite: 45,
        dateCloturePrevue: jours(45),
        description: "Division et remise aux normes. Etude de faisabilite en cours.",
      },
    }),
    prisma.deal.create({
      data: {
        organizationId: org.id,
        contactId: vermeulen.id,
        titre: "Surelevation maison — Marcq-en-Baroeul",
        stage: "PROPOSITION",
        montantEstime: 178_000,
        probabilite: 55,
        dateCloturePrevue: jours(21),
      },
    }),
    prisma.deal.create({
      data: {
        organizationId: org.id,
        contactId: techlab.id,
        titre: "Amenagement plateau de bureaux — phase 2",
        stage: "QUALIFICATION",
        montantEstime: 310_000,
        probabilite: 30,
        dateCloturePrevue: jours(75),
      },
    }),
    prisma.deal.create({
      data: {
        organizationId: org.id,
        contactId: sciTilleuls.id,
        titre: "Renovation immeuble Republique",
        stage: "GAGNE",
        montantEstime: 640_000,
        probabilite: 100,
        dateCloturePrevue: mois(-4),
      },
    }),
    prisma.deal.create({
      data: {
        organizationId: org.id,
        contactId: kaddour.id,
        titre: "Ravalement copropriete — Lille Moulins",
        stage: "PERDU",
        montantEstime: 96_000,
        probabilite: 0,
        motifPerte: "Offre concurrente 12 % moins chere",
        dateCloturePrevue: mois(-2),
      },
    }),
  ])

  await prisma.interaction.createMany({
    data: [
      {
        contactId: sciTilleuls.id,
        canal: "Reunion",
        objet: "Reunion de lancement de chantier",
        compteRendu:
          "Validation du planning general et des modalites d'acces au site occupe. Le client demande un compte rendu hebdomadaire.",
        auteur: "Karim Delcourt",
        date: mois(-3),
      },
      {
        contactId: sciTilleuls.id,
        canal: "Telephone",
        objet: "Demande d'ajout de salles d'eau",
        compteRendu:
          "Le client souhaite ajouter deux salles d'eau au 3e etage. Chiffrage a produire sous forme d'avenant.",
        auteur: "Sofia Ben Salah",
        date: jours(-38),
      },
      {
        contactId: lemaire.id,
        canal: "Visite",
        objet: "Visite des quatre appartements",
        compteRendu:
          "Etat d'usage correct, electricite a reprendre integralement. Amiante a diagnostiquer avant travaux.",
        auteur: "Marc Lefebvre",
        date: jours(-12),
      },
    ],
  })

  // ─── Biens immobiliers ────────────────────────────────────────────────────
  const bienRepublique = await prisma.property.create({
    data: {
      organizationId: org.id,
      contactId: sciTilleuls.id,
      nom: "Immeuble Republique",
      type: "IMMEUBLE",
      adresse: "14 rue de la Republique",
      codePostal: "59000",
      ville: "Lille",
      surfaceUtile: 1200,
      surfacePlancher: 1340,
      nbLogements: 18,
      nbNiveaux: 5,
      anneeConstruction: 1931,
      descriptif:
        "Immeuble de rapport en brique, 18 logements du studio au T3, cage d'escalier centrale, cour interieure.",
      contraintes:
        "Site partiellement occupe pendant les travaux. Acces poids lourds limite le matin. Facade en secteur sauvegarde.",
    },
  })

  // ═════════════════════════════════════════════════════════════════════════
  //  PROJET 1 — Renovation immeuble Republique (le chantier en cours)
  // ═════════════════════════════════════════════════════════════════════════
  console.log("Projet 1 : renovation immeuble Republique (1 200 m²)...")

  const debutP1 = mois(-3)
  const paramsP1 = {
    margeCible: 18,
    tauxFraisChantier: 4,
    tauxFraisGeneraux: 8,
    tauxTva: 20,
  }

  const propositionP1 = genererProjet({
    typeOperation: "RENOVATION_LOURDE",
    surface: 1200,
    params: paramsP1,
    prixOrganisation,
    dateDebut: debutP1,
  })

  const projetP1 = await prisma.project.create({
    data: {
      organizationId: org.id,
      reference: "DCT-2026-001",
      nom: "Renovation immeuble Republique",
      contactId: sciTilleuls.id,
      propertyId: bienRepublique.id,
      responsableId: conducteur.id,
      typeOperation: "RENOVATION_LOURDE",
      statut: "EN_COURS",
      priorite: "HAUTE",
      adresse: "14 rue de la Republique",
      codePostal: "59000",
      ville: "Lille",
      surface: 1200,
      description:
        "Renovation complete de 18 logements : reprise integrale des reseaux electriques et sanitaires, isolation thermique par l'interieur, remplacement des menuiseries, refection des sols et peintures. Parties communes comprises.",
      contraintes:
        "Site partiellement occupe. Six logements liberes par tranche. Nuisances sonores limitees a 8h-17h. Benne autorisee deux demi-journees par semaine.",
      dateDebutPrevue: debutP1,
      dateDebutReelle: debutP1,
      dateFinPrevue: propositionP1.dateFinPrevue,
      margeCible: 18,
      tauxFraisChantier: 4,
      tauxFraisGeneraux: 8,
      tauxTva: 20,
      prixVenteHT: propositionP1.montantHT,
      budgetInitial: propositionP1.coutRevient,
      avancementPhysique: 0,
    },
  })

  // Lots et chiffrage
  const lotsP1 = new Map<string, string>()
  for (const [index, lot] of propositionP1.lots.entries()) {
    const cree = await prisma.lot.create({
      data: {
        projectId: projetP1.id,
        code: lot.code,
        nom: lot.nom,
        categorie: lot.categorie as never,
        ordre: index,
        sousTraite: lot.sousTraite,
        descriptif: lot.descriptif,
        statut: lot.sousTraite ? "ATTRIBUE" : "EN_COURS",
      },
    })
    lotsP1.set(lot.code, cree.id)
  }

  const estimateP1 = await prisma.estimate.create({
    data: {
      projectId: projetP1.id,
      nom: "Chiffrage marche",
      scenario: "STANDARD",
      retenu: true,
      commentaire: "Chiffrage valide par le client le " + mois(-4).toLocaleDateString("fr-FR"),
    },
  })

  for (const lot of propositionP1.lots) {
    const lotId = lotsP1.get(lot.code)!
    for (const [index, poste] of lot.postes.entries()) {
      await prisma.estimateItem.create({
        data: {
          estimateId: estimateP1.id,
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

  // Variante economique, conservee comme comparatif
  await prisma.estimate.create({
    data: {
      projectId: projetP1.id,
      nom: "Variante economique",
      scenario: "ECONOMIQUE",
      version: 2,
      retenu: false,
      commentaire:
        "Variante etudiee avec le client : menuiseries PVC standard et suppression du plancher chauffant.",
      items: {
        create: propositionP1.lots.flatMap((lot) =>
          lot.postes.map((poste, index) => ({
            lotId: lotsP1.get(lot.code)!,
            ordre: index,
            designation: poste.designation,
            unite: poste.unite as never,
            quantite: poste.quantite,
            prixUnitaire: arrondi(poste.prixUnitaire * 0.85),
            coutMateriaux: arrondi(poste.coutMateriaux * 0.85),
            coutMainOeuvre: arrondi(poste.coutMainOeuvre * 0.85),
            coutSousTraitance: arrondi(poste.coutSousTraitance * 0.85),
            coutMateriel: arrondi(poste.coutMateriel * 0.85),
            coutTransport: arrondi(poste.coutTransport * 0.85),
          }))
        ),
      },
    },
  })

  // Consultations, offres et attribution
  const attributionsP1: {
    lotCode: string
    entreprises: string[]
    gagnant: string
    coefficients: number[]
  }[] = [
    {
      lotCode: "01",
      entreprises: ["Demolition Express Nord", "SAS Duflot Maconnerie"],
      gagnant: "Demolition Express Nord",
      coefficients: [0.96, 1.08],
    },
    {
      lotCode: "02",
      entreprises: ["SAS Duflot Maconnerie", "Demolition Express Nord"],
      gagnant: "SAS Duflot Maconnerie",
      coefficients: [1.01, 1.14],
    },
    {
      lotCode: "03",
      entreprises: ["Batiplatre Hauts-de-France"],
      gagnant: "Batiplatre Hauts-de-France",
      coefficients: [0.98],
    },
    {
      lotCode: "04",
      entreprises: ["Batiplatre Hauts-de-France"],
      gagnant: "Batiplatre Hauts-de-France",
      coefficients: [1.02],
    },
    {
      lotCode: "05",
      entreprises: ["Menuiseries du Ferrain"],
      gagnant: "Menuiseries du Ferrain",
      coefficients: [1.05],
    },
    {
      lotCode: "06",
      entreprises: ["Nord Electricite SARL", "Elec Concept 59", "Vandamme Electricite"],
      gagnant: "Nord Electricite SARL",
      coefficients: [0.99, 1.12, 0.72],
    },
    {
      lotCode: "07",
      entreprises: ["Plomberie Deschamps", "Thermifluide Nord"],
      gagnant: "Plomberie Deschamps",
      coefficients: [0.97, 1.06],
    },
    {
      lotCode: "08",
      entreprises: ["Thermifluide Nord", "Plomberie Deschamps"],
      gagnant: "Thermifluide Nord",
      coefficients: [1.0, 1.09],
    },
    {
      lotCode: "09",
      entreprises: ["Carrelage Moderne 59"],
      gagnant: "Carrelage Moderne 59",
      coefficients: [1.03],
    },
    {
      lotCode: "10",
      entreprises: ["Peinture & Finitions Leroy"],
      gagnant: "Peinture & Finitions Leroy",
      coefficients: [0.95],
    },
  ]

  const marchesP1 = new Map<string, { id: string; montant: number; entreprise: string }>()

  for (const attribution of attributionsP1) {
    const lot = propositionP1.lots.find((l) => l.code === attribution.lotCode)
    if (!lot) continue
    const lotId = lotsP1.get(attribution.lotCode)!

    const consultation = await prisma.consultation.create({
      data: {
        organizationId: org.id,
        projectId: projetP1.id,
        lotId,
        reference: `CONS-DCT-2026-001-${attribution.lotCode}`,
        objet: `${lot.nom} — Renovation immeuble Republique`,
        statut: "ATTRIBUEE",
        descriptif: lot.descriptif,
        budgetEstime: lot.coutDirect,
        delaiSouhaiteJours: lot.dureeJours,
        dateEnvoi: mois(-4),
        dateLimiteReponse: jours(-95),
        dateDebutSouhaitee: debutP1,
      },
    })

    let offreGagnante: { id: string; montant: number } | null = null

    for (const [i, nom] of attribution.entreprises.entries()) {
      const entreprise = st(nom)
      const montant = arrondi(lot.coutDirect * attribution.coefficients[i])
      const gagne = nom === attribution.gagnant

      await prisma.consultationInvite.create({
        data: {
          consultationId: consultation.id,
          subcontractorId: entreprise.id,
          statut: "REPONDU",
          dateEnvoi: mois(-4),
          dateReponse: jours(-100),
        },
      })

      const offre = await prisma.offer.create({
        data: {
          organizationId: org.id,
          consultationId: consultation.id,
          subcontractorId: entreprise.id,
          reference: `DEV-${entreprise.raisonSociale.slice(0, 3).toUpperCase()}-${attribution.lotCode}`,
          statut: gagne ? "RETENUE" : "ECARTEE",
          montantHT: montant,
          delaiJours: lot.dureeJours + Math.round((alea() - 0.4) * 8),
          conditionsPaiement: "Situations mensuelles a 45 jours",
          garanties: "Decennale, parfait achevement",
          dateReception: jours(-100),
          lignes: {
            create: lot.postes.map((poste, index) => ({
              ordre: index,
              designation: poste.designation,
              unite: poste.unite as never,
              quantite: poste.quantite,
              prixUnitaire: arrondi(poste.coutUnitaire * attribution.coefficients[i]),
            })),
          },
        },
      })

      if (gagne) offreGagnante = { id: offre.id, montant }
    }

    if (!offreGagnante) continue

    const entrepriseGagnante = st(attribution.gagnant)
    const marche = await prisma.contract.create({
      data: {
        organizationId: org.id,
        projectId: projetP1.id,
        lotId,
        subcontractorId: entrepriseGagnante.id,
        offerId: offreGagnante.id,
        reference: `MAR-DCT-2026-001-${attribution.lotCode}`,
        objet: `${attribution.lotCode} — ${lot.nom} · Renovation immeuble Republique`,
        statut: "EN_COURS",
        montantInitial: offreGagnante.montant,
        montantActualise: offreGagnante.montant,
        tauxRetenueGarantie: 5,
        dateSignature: jours(-92),
        dateDebut: debutP1,
        delaiJours: lot.dureeJours,
        dateFin: jours(lot.dureeJours, debutP1),
        conditions: "Situations mensuelles a 45 jours, retenue de garantie de 5 %.",
      },
    })

    await prisma.commitment.create({
      data: {
        projectId: projetP1.id,
        lotId,
        contractId: marche.id,
        libelle: `Marche MAR-DCT-2026-001-${attribution.lotCode} — ${entrepriseGagnante.raisonSociale}`,
        nature: "SOUS_TRAITANCE",
        montantHT: offreGagnante.montant,
        statut: "ENGAGE",
        date: jours(-92),
        reference: `MAR-DCT-2026-001-${attribution.lotCode}`,
      },
    })

    marchesP1.set(attribution.lotCode, {
      id: marche.id,
      montant: offreGagnante.montant,
      entreprise: entrepriseGagnante.raisonSociale,
    })
  }

  // Frais de chantier engages en direct
  await prisma.commitment.createMany({
    data: [
      {
        projectId: projetP1.id,
        libelle: "Location echafaudage de pied — 6 mois",
        nature: "MATERIEL",
        montantHT: 14_800,
        statut: "ENGAGE",
        date: jours(-90),
        reference: "BC-2026-014",
      },
      {
        projectId: projetP1.id,
        libelle: "Bureau de controle technique",
        nature: "HONORAIRES",
        montantHT: 4_800,
        statut: "ENGAGE",
        date: jours(-96),
        reference: "BC-2026-009",
      },
      {
        projectId: projetP1.id,
        libelle: "Coordination SPS",
        nature: "HONORAIRES",
        montantHT: 2_400,
        statut: "ENGAGE",
        date: jours(-96),
        reference: "BC-2026-010",
      },
      {
        projectId: projetP1.id,
        libelle: "Benne a gravats — forfait mensuel",
        nature: "FRAIS_CHANTIER",
        montantHT: 5_600,
        statut: "ENGAGE",
        date: jours(-85),
        reference: "BC-2026-021",
      },
    ],
  })

  // Planning avec avancement reel
  const tachesP1 = new Map<string, string>()
  for (const tache of propositionP1.taches) {
    const lotId = lotsP1.get(tache.lotCode) ?? null
    const marche = marchesP1.get(tache.lotCode)
    const entreprise = marche ? parNom.get(marche.entreprise) : undefined

    // L'avancement decroit avec l'ordre des lots : le chantier progresse.
    const progression = Math.max(
      0,
      Math.min(100, Math.round(100 - tache.ordre * 13 + (alea() - 0.5) * 12))
    )

    const creee = await prisma.task.create({
      data: {
        projectId: projetP1.id,
        lotId,
        subcontractorId: entreprise?.id ?? null,
        nom: tache.nom,
        dateDebut: tache.dateDebut,
        dateFin: tache.dateFin,
        dureeJours: tache.dureeJours,
        ordre: tache.ordre,
        avancement: progression,
        statut: progression >= 100 ? "TERMINE" : progression > 0 ? "EN_COURS" : "A_FAIRE",
        ...(progression >= 100 ? { dateFinReelle: tache.dateFin } : {}),
      },
    })
    tachesP1.set(tache.lotCode, creee.id)
  }

  for (const tache of propositionP1.taches) {
    if (!tache.precedentCode) continue
    const predecesseurId = tachesP1.get(tache.precedentCode)
    const successeurId = tachesP1.get(tache.lotCode)
    if (!predecesseurId || !successeurId) continue
    await prisma.taskDependency.create({
      data: { predecesseurId, successeurId, type: "FIN_DEBUT" },
    })
  }

  const avancementMoyenP1 = arrondi(
    (await prisma.task.findMany({
      where: { projectId: projetP1.id },
      select: { avancement: true },
    })).reduce((s, t) => s + Number(t.avancement), 0) / propositionP1.taches.length
  )
  await prisma.project.update({
    where: { id: projetP1.id },
    data: { avancementPhysique: avancementMoyenP1 },
  })

  // Avenants
  const marcheP1Plomberie = marchesP1.get("07")
  const avenant1 = await prisma.changeOrder.create({
    data: {
      projectId: projetP1.id,
      lotId: lotsP1.get("07"),
      contractId: marcheP1Plomberie?.id,
      reference: "AV-DCT-2026-001-01",
      motif: "Ajout de deux salles d'eau au 3e etage",
      origine: "CLIENT",
      statut: "ACCEPTE",
      impactCout: 14_200,
      impactVente: 18_500,
      impactDelaiJours: 6,
      description:
        "Le client transforme deux studios en T2 avec salle d'eau. Alimentations et evacuations a creer, cloisons a reprendre.",
      dateDemande: jours(-38),
      dateDecision: jours(-31),
    },
  })

  if (marcheP1Plomberie) {
    await prisma.contract.update({
      where: { id: marcheP1Plomberie.id },
      data: { montantActualise: arrondi(marcheP1Plomberie.montant + 14_200) },
    })
    await prisma.commitment.create({
      data: {
        projectId: projetP1.id,
        lotId: lotsP1.get("07"),
        contractId: marcheP1Plomberie.id,
        libelle: `Avenant ${avenant1.reference} — Ajout de deux salles d'eau`,
        nature: "SOUS_TRAITANCE",
        montantHT: 14_200,
        statut: "ENGAGE",
        date: jours(-31),
        reference: avenant1.reference,
      },
    })
    marchesP1.set("07", {
      ...marcheP1Plomberie,
      montant: arrondi(marcheP1Plomberie.montant + 14_200),
    })
  }

  const marcheP1GrosOeuvre = marchesP1.get("02")
  await prisma.changeOrder.create({
    data: {
      projectId: projetP1.id,
      lotId: lotsP1.get("02"),
      contractId: marcheP1GrosOeuvre?.id,
      reference: "AV-DCT-2026-001-02",
      motif: "Reprise de plancher bois degrade (alea technique)",
      origine: "ALEA_TECHNIQUE",
      statut: "ACCEPTE",
      impactCout: 9_800,
      impactVente: 4_500,
      impactDelaiJours: 8,
      description:
        "Solivage attaque par l'humidite decouvert a la depose des sols du 2e etage. Reprise structurelle non prevue au marche, partiellement prise en charge par le client.",
      dateDemande: jours(-26),
      dateDecision: jours(-20),
    },
  })

  if (marcheP1GrosOeuvre) {
    await prisma.contract.update({
      where: { id: marcheP1GrosOeuvre.id },
      data: { montantActualise: arrondi(marcheP1GrosOeuvre.montant + 9_800) },
    })
    await prisma.commitment.create({
      data: {
        projectId: projetP1.id,
        lotId: lotsP1.get("02"),
        contractId: marcheP1GrosOeuvre.id,
        libelle: "Avenant AV-DCT-2026-001-02 — Reprise de plancher",
        nature: "SOUS_TRAITANCE",
        montantHT: 9_800,
        statut: "ENGAGE",
        date: jours(-20),
        reference: "AV-DCT-2026-001-02",
      },
    })
    marchesP1.set("02", {
      ...marcheP1GrosOeuvre,
      montant: arrondi(marcheP1GrosOeuvre.montant + 9_800),
    })
  }

  await prisma.changeOrder.create({
    data: {
      projectId: projetP1.id,
      lotId: lotsP1.get("06"),
      reference: "AV-DCT-2026-001-03",
      motif: "Mise en conformite IRVE du parking",
      origine: "REGLEMENTAIRE",
      statut: "CHIFFRE",
      impactCout: 7_400,
      impactVente: 9_200,
      impactDelaiJours: 0,
      description: "Pre-equipement de six places pour bornes de recharge.",
      dateDemande: jours(-9),
    },
  })

  // Situations de travaux et factures
  console.log("  Situations et factures...")
  for (const [lotCode, marche] of marchesP1.entries()) {
    const tacheId = tachesP1.get(lotCode)
    const tache = tacheId
      ? await prisma.task.findUnique({ where: { id: tacheId }, select: { avancement: true } })
      : null
    const avancement = Number(tache?.avancement ?? 0)
    if (avancement < 20) continue

    // Deux situations : la premiere validee, la seconde en attente.
    const paliers = avancement >= 70 ? [Math.round(avancement * 0.6), avancement] : [avancement]
    let cumul = 0

    for (const [index, palier] of paliers.entries()) {
      const calcul = calculerSituation({
        marcheInitial: marche.montant,
        avenants: 0,
        cumulPrecedent: cumul,
        avancementCumule: palier,
        tauxRetenueGarantie: 5,
      })
      if (calcul.montantSituation <= 0) continue

      const derniere = index === paliers.length - 1
      const validee = !derniere || paliers.length === 1

      const situation = await prisma.situation.create({
        data: {
          projectId: projetP1.id,
          contractId: marche.id,
          numero: index + 1,
          periode: mois(-(paliers.length - index)).toLocaleDateString("fr-FR", {
            month: "long",
            year: "numeric",
          }),
          statut: validee ? "VALIDEE" : "DEPOSEE",
          avancementCumule: palier,
          cumulPrecedent: calcul.cumulPrecedent,
          montantHT: calcul.montantSituation,
          retenueGarantie: calcul.retenueGarantie,
          netAPayer: calcul.netAPayer,
          dateDepot: jours(-20 + index * 15),
          dateValidation: validee ? jours(-15 + index * 15) : null,
        },
      })

      if (validee) {
        cumul += calcul.montantSituation

        const facture = await prisma.invoice.create({
          data: {
            projectId: projetP1.id,
            contractId: marche.id,
            situationId: situation.id,
            sens: "FOURNISSEUR",
            numero: `${marche.id.slice(-4).toUpperCase()}-S${String(index + 1).padStart(2, "0")}`,
            emetteur: marche.entreprise,
            statut: index === 0 ? "PAYEE" : "VALIDEE",
            montantHT: calcul.netAPayer,
            tauxTva: 20,
            montantTTC: arrondi(calcul.netAPayer * 1.2),
            dateEmission: jours(-14 + index * 15),
            dateEcheance: jours(31 + index * 15),
            datePaiement: index === 0 ? jours(-2) : null,
          },
        })

        await prisma.expense.create({
          data: {
            projectId: projetP1.id,
            lotId: lotsP1.get(lotCode),
            invoiceId: facture.id,
            libelle: `Facture ${facture.numero} — ${marche.entreprise}`,
            nature: "SOUS_TRAITANCE",
            montantHT: calcul.netAPayer,
            date: facture.dateEmission,
            fournisseur: marche.entreprise,
            reference: facture.numero,
          },
        })
      }
    }
  }

  // Depenses directes
  await prisma.expense.createMany({
    data: [
      {
        projectId: projetP1.id,
        libelle: "Location echafaudage — mois 1 a 3",
        nature: "MATERIEL",
        montantHT: 7_400,
        date: jours(-60),
        fournisseur: "Loxam",
        reference: "F-LOX-88412",
      },
      {
        projectId: projetP1.id,
        libelle: "Bureau de controle — phase conception",
        nature: "HONORAIRES",
        montantHT: 2_400,
        date: jours(-75),
        fournisseur: "Socotec",
        reference: "F-SOC-20114",
      },
      {
        projectId: projetP1.id,
        libelle: "Evacuation de gravats — bennes supplementaires",
        nature: "FRAIS_CHANTIER",
        montantHT: 3_150,
        date: jours(-42),
        fournisseur: "Veolia Proprete",
        reference: "F-VEO-4471",
      },
    ],
  })

  // Facture client (situation d'avancement)
  await prisma.invoice.create({
    data: {
      projectId: projetP1.id,
      sens: "CLIENT",
      numero: "FC-2026-0031",
      emetteur: "SCI Les Tilleuls",
      statut: "PAYEE",
      montantHT: arrondi(propositionP1.montantHT * 0.4),
      tauxTva: 20,
      montantTTC: arrondi(propositionP1.montantHT * 0.4 * 1.2),
      dateEmission: jours(-45),
      dateEcheance: jours(-15),
      datePaiement: jours(-12),
    },
  })
  await prisma.invoice.create({
    data: {
      projectId: projetP1.id,
      sens: "CLIENT",
      numero: "FC-2026-0058",
      emetteur: "SCI Les Tilleuls",
      statut: "VALIDEE",
      montantHT: arrondi(propositionP1.montantHT * 0.25),
      tauxTva: 20,
      montantTTC: arrondi(propositionP1.montantHT * 0.25 * 1.2),
      dateEmission: jours(-8),
      dateEcheance: jours(22),
    },
  })

  // Suivi de chantier
  console.log("  Suivi de chantier...")
  await prisma.siteReport.createMany({
    data: [
      {
        projectId: projetP1.id,
        auteurId: conducteur.id,
        date: jours(-2),
        meteo: "Nuageux",
        effectif: 14,
        travauxRealises:
          "Poursuite du tirage des gaines electriques niveaux 2 et 3. Pose des cloisons de distribution du niveau 2 terminee. Demarrage de la faience des salles d'eau niveau 1.",
        observations:
          "Retard confirme sur la livraison des menuiseries : l'entreprise annonce trois semaines supplementaires.",
        decisions:
          "Inversion de l'ordre peinture / menuiseries au niveau 1 pour ne pas bloquer le planning.",
      },
      {
        projectId: projetP1.id,
        auteurId: conducteur.id,
        date: jours(-9),
        meteo: "Pluie",
        effectif: 11,
        travauxRealises:
          "Reprise du solivage du 2e etage apres decouverte d'humidite. Coulage de la chape de ravoirage niveau 1.",
        observations: "Infiltration en toiture signalee au-dessus de la cage d'escalier.",
        decisions: "Intervention du couvreur programmee sous 48 heures.",
      },
      {
        projectId: projetP1.id,
        auteurId: conducteur.id,
        date: jours(-16),
        meteo: "Degage",
        effectif: 16,
        travauxRealises:
          "Fin de la depose des cloisons anciennes. Evacuation de 12 tonnes de gravats. Demarrage de l'isolation thermique interieure niveaux 1 et 2.",
      },
    ],
  })

  await prisma.incident.createMany({
    data: [
      {
        projectId: projetP1.id,
        lotId: lotsP1.get("02"),
        titre: "Solivage degrade decouvert au 2e etage",
        gravite: "MAJEUR",
        statut: "EN_TRAITEMENT",
        description:
          "A la depose des revetements de sol, decouverte d'un solivage attaque par l'humidite sur environ 40 m². Reprise structurelle necessaire.",
        actionCorrective:
          "Avenant AV-DCT-2026-001-02 accepte. Renfort par moisage et remplacement de six solives.",
        impactCout: 9_800,
        impactDelaiJours: 8,
        dateOuverture: jours(-26),
      },
      {
        projectId: projetP1.id,
        lotId: lotsP1.get("05"),
        titre: "Retard de livraison des menuiseries exterieures",
        gravite: "MODERE",
        statut: "OUVERT",
        description:
          "Le fournisseur du menuisier annonce trois semaines de retard sur les fenetres PVC des niveaux 3 et 4.",
        actionCorrective:
          "Reorganisation du planning : peinture des parties communes avancee. Penalites de retard rappelees a l'entreprise.",
        impactCout: 0,
        impactDelaiJours: 15,
        dateOuverture: jours(-11),
      },
      {
        projectId: projetP1.id,
        titre: "Infiltration en toiture au-dessus de la cage d'escalier",
        gravite: "MODERE",
        statut: "RESOLU",
        description: "Infiltration constatee lors des fortes pluies.",
        actionCorrective: "Reprise ponctuelle de la couverture et remplacement de deux tuiles fendues.",
        impactCout: 850,
        impactDelaiJours: 0,
        dateOuverture: jours(-9),
        dateCloture: jours(-6),
      },
    ],
  })

  await prisma.reservation.createMany({
    data: [
      {
        projectId: projetP1.id,
        lotId: lotsP1.get("09"),
        libelle: "Joints de carrelage incomplets — salle d'eau appartement 104",
        localisation: "Niveau 1, appartement 104",
        statut: "OUVERTE",
        dateEmission: jours(-14),
        dateLimite: jours(-3),
      },
      {
        projectId: projetP1.id,
        lotId: lotsP1.get("04"),
        libelle: "Angle de cloison a reprendre — palier niveau 2",
        localisation: "Niveau 2, palier",
        statut: "OUVERTE",
        dateEmission: jours(-7),
        dateLimite: jours(10),
      },
      {
        projectId: projetP1.id,
        lotId: lotsP1.get("06"),
        libelle: "Prise manquante dans le sejour — appartement 102",
        localisation: "Niveau 1, appartement 102",
        statut: "LEVEE",
        dateEmission: jours(-21),
        dateLevee: jours(-13),
      },
    ],
  })

  await prisma.document.createMany({
    data: [
      {
        organizationId: org.id,
        projectId: projetP1.id,
        categorie: "PLANS",
        nom: "Plan de masse et niveaux — indice C.pdf",
        description: "Plans de l'architecte, indice C du 12 janvier",
        url: "/api/fichiers/exemple/plans-republique.pdf",
        mimeType: "application/pdf",
        taille: 2_450_000,
        visibleClient: true,
        visibleSousTraitant: true,
        auteur: "Marc Lefebvre",
      },
      {
        organizationId: org.id,
        projectId: projetP1.id,
        categorie: "ADMINISTRATIF",
        nom: "Declaration prealable de travaux.pdf",
        url: "/api/fichiers/exemple/dp-republique.pdf",
        mimeType: "application/pdf",
        taille: 890_000,
        visibleClient: true,
        auteur: "Karim Delcourt",
      },
      {
        organizationId: org.id,
        projectId: projetP1.id,
        categorie: "PLANNING",
        nom: "Planning general — revision 3.pdf",
        url: "/api/fichiers/exemple/planning-republique.pdf",
        mimeType: "application/pdf",
        taille: 420_000,
        visibleClient: true,
        visibleSousTraitant: true,
        auteur: "Sofia Ben Salah",
      },
      {
        organizationId: org.id,
        projectId: projetP1.id,
        categorie: "PV",
        nom: "Compte rendu de chantier n°12.pdf",
        url: "/api/fichiers/exemple/cr12-republique.pdf",
        mimeType: "application/pdf",
        taille: 310_000,
        visibleClient: true,
        auteur: "Sofia Ben Salah",
      },
    ],
  })

  await prisma.realEstateAnalysis.create({
    data: {
      projectId: projetP1.id,
      nom: "Scenario du client — conservation locative",
      prixAcquisition: 1_450_000,
      fraisAcquisition: 116_000,
      montantTravaux: propositionP1.montantHT,
      fraisDivers: 28_000,
      apport: 420_000,
      montantEmprunt: 1_800_000,
      tauxCredit: 3.65,
      dureeCreditAnnees: 20,
      valeurApresTravaux: 2_950_000,
      fraisRevente: 88_500,
      loyerMensuel: 13_400,
      chargesAnnuelles: 24_000,
      tauxImposition: 30,
      commentaire:
        "Le client privilegie la conservation locative. La revente reste une option si le marche lillois se tend.",
    },
  })

  // ═════════════════════════════════════════════════════════════════════════
  //  PROJET 2 — Amenagement de bureaux : consultations en cours d'analyse
  // ═════════════════════════════════════════════════════════════════════════
  console.log("Projet 2 : amenagement de bureaux (comparaison d'offres en cours)...")

  const debutP2 = jours(21)
  const propositionP2 = genererProjet({
    typeOperation: "AMENAGEMENT",
    surface: 640,
    params: { margeCible: 20, tauxFraisChantier: 3.5, tauxFraisGeneraux: 8, tauxTva: 20 },
    prixOrganisation,
    dateDebut: debutP2,
  })

  const projetP2 = await prisma.project.create({
    data: {
      organizationId: org.id,
      reference: "DCT-2026-002",
      nom: "Amenagement plateau de bureaux Euratechnologies",
      contactId: techlab.id,
      responsableId: metreur.id,
      typeOperation: "AMENAGEMENT",
      statut: "CONSULTATION",
      priorite: "NORMALE",
      adresse: "165 avenue de Bretagne",
      codePostal: "59000",
      ville: "Lille",
      surface: 640,
      description:
        "Amenagement d'un plateau de bureaux de 640 m² : creation de douze bureaux fermes, deux salles de reunion, un espace detente. Cloisons vitrees, faux plafonds acoustiques, reprise complete de l'eclairage et du reseau informatique.",
      contraintes:
        "Immeuble en exploitation. Travaux bruyants interdits entre 9h et 18h. Livraison imperative avant la fin du bail temporaire du client.",
      dateDebutPrevue: debutP2,
      dateFinPrevue: propositionP2.dateFinPrevue,
      margeCible: 20,
      tauxFraisChantier: 3.5,
      tauxFraisGeneraux: 8,
      tauxTva: 20,
      prixVenteHT: propositionP2.montantHT,
      budgetInitial: propositionP2.coutRevient,
    },
  })

  const lotsP2 = new Map<string, string>()
  for (const [index, lot] of propositionP2.lots.entries()) {
    const cree = await prisma.lot.create({
      data: {
        projectId: projetP2.id,
        code: lot.code,
        nom: lot.nom,
        categorie: lot.categorie as never,
        ordre: index,
        sousTraite: lot.sousTraite,
        descriptif: lot.descriptif,
        statut: lot.sousTraite ? "EN_CONSULTATION" : "CHIFFRE",
      },
    })
    lotsP2.set(lot.code, cree.id)
  }

  const estimateP2 = await prisma.estimate.create({
    data: {
      projectId: projetP2.id,
      nom: "Chiffrage de consultation",
      scenario: "STANDARD",
      retenu: true,
      items: {
        create: propositionP2.lots.flatMap((lot) =>
          lot.postes.map((poste, index) => ({
            lotId: lotsP2.get(lot.code)!,
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
          }))
        ),
      },
    },
  })
  void estimateP2

  // Consultation electricite : trois offres a comparer, dont une anormalement basse.
  const lotElecP2 = propositionP2.lots.find((l) => l.categorie === "ELECTRICITE")
  if (lotElecP2) {
    const consultation = await prisma.consultation.create({
      data: {
        organizationId: org.id,
        projectId: projetP2.id,
        lotId: lotsP2.get(lotElecP2.code)!,
        reference: `CONS-DCT-2026-002-${lotElecP2.code}`,
        objet: `${lotElecP2.nom} — Plateau Euratechnologies`,
        statut: "EN_ANALYSE",
        descriptif:
          "Reprise complete de la distribution electrique du plateau : tableau divisionnaire, chemins de cables, appareillage, eclairage LED sur detection, reseau informatique categorie 6A, controle d'acces.",
        budgetEstime: lotElecP2.coutDirect,
        delaiSouhaiteJours: lotElecP2.dureeJours,
        dateEnvoi: jours(-18),
        dateLimiteReponse: jours(4),
        dateDebutSouhaitee: debutP2,
      },
    })

    const candidats: { nom: string; coefficient: number; delai: number; exclusions?: string }[] = [
      { nom: "Nord Electricite SARL", coefficient: 1.02, delai: lotElecP2.dureeJours },
      {
        nom: "Elec Concept 59",
        coefficient: 1.16,
        delai: lotElecP2.dureeJours - 4,
        exclusions: "Controle d'acces et interphonie non compris.",
      },
      {
        nom: "Vandamme Electricite",
        coefficient: 0.66,
        delai: lotElecP2.dureeJours + 9,
        exclusions:
          "Chemins de cables, percements et rebouchages a la charge du lot gros oeuvre. Eclairage non fourni.",
      },
    ]

    for (const candidat of candidats) {
      const entreprise = st(candidat.nom)
      const montant = arrondi(lotElecP2.coutDirect * candidat.coefficient)
      const complet = candidat.coefficient > 0.8

      await prisma.consultationInvite.create({
        data: {
          consultationId: consultation.id,
          subcontractorId: entreprise.id,
          statut: "REPONDU",
          dateEnvoi: jours(-18),
          dateReponse: jours(-4),
        },
      })

      await prisma.offer.create({
        data: {
          organizationId: org.id,
          consultationId: consultation.id,
          subcontractorId: entreprise.id,
          reference: `DEV-${entreprise.raisonSociale.slice(0, 3).toUpperCase()}-2026-77`,
          statut: "RECUE",
          montantHT: montant,
          delaiJours: candidat.delai,
          conditionsPaiement: "40 % a la commande, solde a 45 jours",
          exclusions: candidat.exclusions ?? null,
          garanties: "Decennale, biennale",
          dateReception: jours(-4),
          lignes: {
            // L'offre incomplete ne chiffre qu'une partie des postes : le
            // comparateur doit le detecter.
            create: lotElecP2.postes
              .slice(0, complet ? lotElecP2.postes.length : Math.ceil(lotElecP2.postes.length * 0.6))
              .map((poste, index) => ({
                ordre: index,
                designation: poste.designation,
                unite: poste.unite as never,
                quantite: poste.quantite,
                prixUnitaire: arrondi(poste.coutUnitaire * candidat.coefficient),
              })),
          },
        },
      })
    }

    await prisma.consultationQuestion.create({
      data: {
        consultationId: consultation.id,
        auteur: "Elec Concept 59",
        question:
          "Le controle d'acces et l'interphonie sont-ils a integrer dans notre lot ou traites par un prestataire dedie ?",
        dateQuestion: jours(-9),
      },
    })
  }

  // Autres lots : consultations envoyees sans reponse
  for (const lot of propositionP2.lots.filter(
    (l) => l.sousTraite && l.categorie !== "ELECTRICITE"
  )) {
    await prisma.consultation.create({
      data: {
        organizationId: org.id,
        projectId: projetP2.id,
        lotId: lotsP2.get(lot.code)!,
        reference: `CONS-DCT-2026-002-${lot.code}`,
        objet: `${lot.nom} — Plateau Euratechnologies`,
        statut: "ENVOYEE",
        descriptif: lot.descriptif,
        budgetEstime: lot.coutDirect,
        delaiSouhaiteJours: lot.dureeJours,
        dateEnvoi: jours(-12),
        dateLimiteReponse: jours(lot.code === "01" ? -2 : 6),
        dateDebutSouhaitee: debutP2,
        invites: {
          create: [
            { subcontractorId: st("Batiplatre Hauts-de-France").id, dateEnvoi: jours(-12) },
            { subcontractorId: st("Peinture & Finitions Leroy").id, dateEnvoi: jours(-12) },
          ],
        },
      },
    })
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  PROJET 3 — Rehabilitation en phase de chiffrage
  // ═════════════════════════════════════════════════════════════════════════
  console.log("Projet 3 : rehabilitation maison Vauban (chiffrage)...")

  const propositionP3 = genererProjet({
    typeOperation: "REHABILITATION",
    surface: 210,
    params: { margeCible: 19, tauxFraisChantier: 4, tauxFraisGeneraux: 8, tauxTva: 20 },
    prixOrganisation,
    dateDebut: jours(60),
  })

  const projetP3 = await prisma.project.create({
    data: {
      organizationId: org.id,
      reference: "DCT-2026-003",
      nom: "Rehabilitation maison de maitre Vauban",
      contactId: vermeulen.id,
      responsableId: metreur.id,
      typeOperation: "REHABILITATION",
      statut: "CHIFFRAGE",
      priorite: "NORMALE",
      adresse: "7 rue Colbert",
      codePostal: "59000",
      ville: "Lille",
      surface: 210,
      description:
        "Rehabilitation complete d'une maison de maitre de 1880 : refection de la toiture, ravalement de la facade en brique, reprise des planchers, mise aux normes electrique et sanitaire, isolation interieure compatible avec le bati ancien.",
      contraintes:
        "Bati ancien en secteur sauvegarde. Materiaux et teintes soumis a l'accord de l'architecte des batiments de France.",
      dateDebutPrevue: jours(60),
      dateFinPrevue: propositionP3.dateFinPrevue,
      margeCible: 19,
      tauxFraisChantier: 4,
      tauxFraisGeneraux: 8,
      tauxTva: 20,
      prixVenteHT: propositionP3.montantHT,
      budgetInitial: propositionP3.coutRevient,
    },
  })

  const lotsP3 = new Map<string, string>()
  for (const [index, lot] of propositionP3.lots.entries()) {
    const cree = await prisma.lot.create({
      data: {
        projectId: projetP3.id,
        code: lot.code,
        nom: lot.nom,
        categorie: lot.categorie as never,
        ordre: index,
        sousTraite: lot.sousTraite,
        descriptif: lot.descriptif,
        statut: "CHIFFRE",
      },
    })
    lotsP3.set(lot.code, cree.id)
  }

  await prisma.estimate.create({
    data: {
      projectId: projetP3.id,
      nom: "Chiffrage initial genere",
      scenario: "STANDARD",
      retenu: true,
      genereParIa: true,
      commentaire:
        "Chiffrage genere a partir de la trame de rehabilitation et de la bibliotheque de prix. Quantites a confirmer apres releve sur site.",
      items: {
        create: propositionP3.lots.flatMap((lot) =>
          lot.postes.map((poste, index) => ({
            lotId: lotsP3.get(lot.code)!,
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
          }))
        ),
      },
    },
  })

  await prisma.realEstateAnalysis.create({
    data: {
      projectId: projetP3.id,
      nom: "Achat-revente",
      prixAcquisition: 385_000,
      fraisAcquisition: 30_800,
      montantTravaux: propositionP3.montantHT,
      fraisDivers: 9_500,
      apport: 120_000,
      montantEmprunt: 480_000,
      tauxCredit: 3.9,
      dureeCreditAnnees: 15,
      valeurApresTravaux: 720_000,
      fraisRevente: 21_600,
      loyerMensuel: 2_300,
      chargesAnnuelles: 4_800,
      tauxImposition: 30,
      commentaire: "Operation de marchand de biens sur 18 mois.",
    },
  })

  // ═════════════════════════════════════════════════════════════════════════
  //  PROJET 4 — Etude preliminaire
  // ═════════════════════════════════════════════════════════════════════════
  console.log("Projet 4 : extension pavillon (etude)...")

  const propositionP4 = genererProjet({
    typeOperation: "EXTENSION",
    surface: 45,
    params: { margeCible: 22, tauxFraisChantier: 4, tauxFraisGeneraux: 9, tauxTva: 20 },
    prixOrganisation,
    dateDebut: jours(120),
  })

  const projetP4 = await prisma.project.create({
    data: {
      organizationId: org.id,
      reference: "DCT-2026-004",
      nom: "Extension pavillon Marcq-en-Baroeul",
      contactId: vermeulen.id,
      responsableId: metreur.id,
      typeOperation: "EXTENSION",
      statut: "ETUDE",
      priorite: "BASSE",
      adresse: "22 avenue Foch",
      codePostal: "59700",
      ville: "Marcq-en-Baroeul",
      surface: 45,
      description:
        "Extension de 45 m² en ossature maconnee pour agrandir le sejour et creer une suite parentale. Toiture terrasse vegetalisee.",
      dateDebutPrevue: jours(120),
      dateFinPrevue: propositionP4.dateFinPrevue,
      margeCible: 22,
      tauxFraisChantier: 4,
      tauxFraisGeneraux: 9,
      tauxTva: 20,
      prixVenteHT: propositionP4.montantHT,
      budgetInitial: propositionP4.coutRevient,
    },
  })

  const lotsP4 = new Map<string, string>()
  for (const [index, lot] of propositionP4.lots.entries()) {
    const cree = await prisma.lot.create({
      data: {
        projectId: projetP4.id,
        code: lot.code,
        nom: lot.nom,
        categorie: lot.categorie as never,
        ordre: index,
        sousTraite: lot.sousTraite,
        descriptif: lot.descriptif,
        statut: "A_CHIFFRER",
      },
    })
    lotsP4.set(lot.code, cree.id)
  }

  await prisma.estimate.create({
    data: {
      projectId: projetP4.id,
      nom: "Estimation de faisabilite",
      scenario: "STANDARD",
      retenu: true,
      genereParIa: true,
      commentaire: "Estimation au ratio, a affiner apres le releve et l'avant-projet.",
      items: {
        create: propositionP4.lots.flatMap((lot) =>
          lot.postes.map((poste, index) => ({
            lotId: lotsP4.get(lot.code)!,
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
          }))
        ),
      },
    },
  })

  // ═════════════════════════════════════════════════════════════════════════
  //  PROJET 5 — Chantier termine (historique de marge)
  // ═════════════════════════════════════════════════════════════════════════
  console.log("Projet 5 : renovation Roubaix (termine)...")

  const debutP5 = mois(-14)
  const propositionP5 = genererProjet({
    typeOperation: "RENOVATION_LEGERE",
    surface: 480,
    params: { margeCible: 17, tauxFraisChantier: 4, tauxFraisGeneraux: 8, tauxTva: 20 },
    prixOrganisation,
    dateDebut: debutP5,
  })

  const projetP5 = await prisma.project.create({
    data: {
      organizationId: org.id,
      reference: "DCT-2025-018",
      nom: "Renovation de 6 logements — Roubaix",
      contactId: kaddour.id,
      responsableId: conducteur.id,
      typeOperation: "RENOVATION_LEGERE",
      statut: "TERMINE",
      priorite: "NORMALE",
      adresse: "31 rue de l'Alouette",
      codePostal: "59100",
      ville: "Roubaix",
      surface: 480,
      description:
        "Rafraichissement complet de six logements avant remise en location : peintures, sols, mise aux normes electriques partielle.",
      dateDebutPrevue: debutP5,
      dateDebutReelle: debutP5,
      dateFinPrevue: propositionP5.dateFinPrevue,
      dateFinReelle: mois(-9),
      dateReception: mois(-9),
      margeCible: 17,
      tauxFraisChantier: 4,
      tauxFraisGeneraux: 8,
      tauxTva: 20,
      prixVenteHT: propositionP5.montantHT,
      budgetInitial: propositionP5.coutRevient,
      avancementPhysique: 100,
    },
  })

  const lotsP5 = new Map<string, string>()
  for (const [index, lot] of propositionP5.lots.entries()) {
    const cree = await prisma.lot.create({
      data: {
        projectId: projetP5.id,
        code: lot.code,
        nom: lot.nom,
        categorie: lot.categorie as never,
        ordre: index,
        sousTraite: lot.sousTraite,
        descriptif: lot.descriptif,
        statut: "RECEPTIONNE",
      },
    })
    lotsP5.set(lot.code, cree.id)
  }

  await prisma.estimate.create({
    data: {
      projectId: projetP5.id,
      nom: "Chiffrage marche",
      scenario: "STANDARD",
      retenu: true,
      items: {
        create: propositionP5.lots.flatMap((lot) =>
          lot.postes.map((poste, index) => ({
            lotId: lotsP5.get(lot.code)!,
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
          }))
        ),
      },
    },
  })

  // Le chantier est solde : engagements et depenses au niveau du budget.
  for (const lot of propositionP5.lots.filter((l) => l.sousTraite)) {
    const lotId = lotsP5.get(lot.code)!
    const montant = arrondi(lot.coutDirect * variation(1, 0.03))

    await prisma.commitment.create({
      data: {
        projectId: projetP5.id,
        lotId,
        libelle: `Marche ${lot.nom}`,
        nature: "SOUS_TRAITANCE",
        montantHT: montant,
        statut: "SOLDE",
        date: mois(-13),
      },
    })
    await prisma.expense.create({
      data: {
        projectId: projetP5.id,
        lotId,
        libelle: `Solde ${lot.nom}`,
        nature: "SOUS_TRAITANCE",
        montantHT: montant,
        date: mois(-10),
      },
    })
  }

  // ─── Notifications et journal ─────────────────────────────────────────────
  await prisma.notification.createMany({
    data: [
      {
        organizationId: org.id,
        projectId: projetP2.id,
        niveau: "ALERTE",
        type: "DEVIS_ANORMAL",
        titre: "Offre anormalement basse detectee",
        message:
          "L'offre de Vandamme Electricite est inferieure de plus de 30 % a la moyenne des autres devis du lot electricite.",
        lien: `/dashboard/projets/${projetP2.id}/consultations`,
      },
      {
        organizationId: org.id,
        projectId: projetP1.id,
        niveau: "CRITIQUE",
        type: "DERIVE_BUDGET",
        titre: "Derive constatee sur le lot gros oeuvre",
        message: "L'avenant de reprise de plancher n'est refacture qu'a 46 % au client.",
        lien: `/dashboard/projets/${projetP1.id}/budget`,
      },
    ],
  })

  await prisma.auditLog.createMany({
    data: [
      {
        organizationId: org.id,
        userId: dirigeant.id,
        action: "ATTRIBUTION_MARCHE",
        entite: "Contract",
        details: "Attribution du lot electricite a Nord Electricite SARL.",
        createdAt: jours(-92),
      },
      {
        organizationId: org.id,
        userId: conducteur.id,
        action: "AVENANT_ACCEPTE",
        entite: "ChangeOrder",
        details: "Avenant AV-DCT-2026-001-01 accepte (+14 200 EUR).",
        createdAt: jours(-31),
      },
    ],
  })

  // ─── Recapitulatif ────────────────────────────────────────────────────────
  const [nbProjets, nbLots, nbPostes, nbOffres, nbMarches] = await Promise.all([
    prisma.project.count(),
    prisma.lot.count(),
    prisma.estimateItem.count(),
    prisma.offer.count(),
    prisma.contract.count(),
  ])

  console.log("\n─────────────────────────────────────────────")
  console.log("Jeu de donnees cree.")
  console.log(`  ${nbProjets} projets · ${nbLots} lots · ${nbPostes} postes chiffres`)
  console.log(`  ${nbOffres} offres · ${nbMarches} marches · ${CATALOGUE_PRIX.length} prix en bibliotheque`)
  console.log("\nComptes de demonstration (mot de passe : Chantier2026!) :")
  console.log("  karim.delcourt@delcourt-coordination.fr    Dirigeant")
  console.log("  sofia.bensalah@delcourt-coordination.fr    Conductrice de travaux")
  console.log("  marc.lefebvre@delcourt-coordination.fr     Metreur")
  console.log("  nadia.roussel@delcourt-coordination.fr     Comptabilite")
  console.log("  admin@delcourt-coordination.fr             Administrateur")
  console.log("  julien.waeles@nord-electricite.fr          Sous-traitant (portail)")
  console.log("─────────────────────────────────────────────\n")
}

main()
  .catch((erreur) => {
    console.error(erreur)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

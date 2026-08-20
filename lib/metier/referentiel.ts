/**
 * Referentiel metier : catalogue de prix de reference et trames de lots par
 * type d'operation.
 *
 * Ce fichier alimente trois usages :
 *  1. l'amorçage de la bibliotheque de prix d'une nouvelle organisation ;
 *  2. la generation automatique de chiffrage (bouton « Lancer le projet ») ;
 *  3. les suggestions de prix dans le moteur de chiffrage.
 *
 * Les prix sont des prix de vente unitaires HT, marche français, base 2026.
 * `cout` est le cout de revient unitaire correspondant.
 */

export const LIBELLES_CATEGORIE: Record<string, string> = {
  DEMOLITION: "Demolition",
  TERRASSEMENT: "Terrassement",
  VRD: "VRD",
  GROS_OEUVRE: "Gros oeuvre",
  MACONNERIE: "Maconnerie",
  CHARPENTE: "Charpente",
  COUVERTURE: "Couverture",
  ETANCHEITE: "Etancheite",
  ISOLATION: "Isolation",
  PLATRERIE: "Platrerie",
  MENUISERIE: "Menuiserie",
  ELECTRICITE: "Electricite",
  PLOMBERIE: "Plomberie",
  CHAUFFAGE: "Chauffage",
  CLIMATISATION: "Climatisation",
  CARRELAGE: "Carrelage / revetements",
  PEINTURE: "Peinture",
  VOIRIE: "Voirie",
  ESPACES_EXTERIEURS: "Espaces exterieurs",
  AUTRE: "Autre",
}

export const LIBELLES_UNITE: Record<string, string> = {
  U: "u",
  ML: "ml",
  M2: "m²",
  M3: "m³",
  KG: "kg",
  T: "t",
  FORFAIT: "forfait",
  HEURE: "h",
  JOUR: "j",
  ENS: "ens",
}

export const LIBELLES_OPERATION: Record<string, string> = {
  RENOVATION_LOURDE: "Renovation lourde",
  RENOVATION_LEGERE: "Renovation legere / rafraichissement",
  REHABILITATION: "Rehabilitation",
  CONSTRUCTION_NEUVE: "Construction neuve",
  EXTENSION: "Extension",
  AMENAGEMENT: "Amenagement interieur",
  SURELEVATION: "Surelevation",
  DEMOLITION: "Demolition",
  VRD: "VRD / amenagements exterieurs",
  AMO: "Assistance a maitrise d'ouvrage",
  CONSEIL: "Conseil immobilier",
}

export const LIBELLES_STATUT_PROJET: Record<string, string> = {
  ETUDE: "Etude",
  CHIFFRAGE: "Chiffrage",
  CONSULTATION: "Consultation",
  PREPARATION: "Preparation",
  EN_COURS: "En cours",
  RECEPTION: "Reception",
  TERMINE: "Termine",
  ARCHIVE: "Archive",
}

export const LIBELLES_STAGE: Record<string, string> = {
  NOUVEAU: "Nouveau",
  QUALIFICATION: "Qualification",
  ETUDE: "Etude",
  CHIFFRAGE: "Chiffrage",
  PROPOSITION: "Proposition",
  NEGOCIATION: "Negociation",
  GAGNE: "Gagne",
  PERDU: "Perdu",
}

export type PosteReference = {
  code: string
  designation: string
  categorie: string
  unite: string
  /** Prix de vente unitaire HT de reference */
  prix: number
  /** Cout de revient unitaire HT */
  cout: number
  fournisseur?: string
}

export const CATALOGUE_PRIX: PosteReference[] = [
  // ─── Demolition ──────────────────────────────────────────────────────────
  { code: "DEM-010", designation: "Depose complete de cloisons et doublages", categorie: "DEMOLITION", unite: "M2", prix: 28, cout: 21 },
  { code: "DEM-020", designation: "Depose de menuiseries interieures", categorie: "DEMOLITION", unite: "U", prix: 45, cout: 33 },
  { code: "DEM-030", designation: "Depose de revetements de sol", categorie: "DEMOLITION", unite: "M2", prix: 16, cout: 12 },
  { code: "DEM-040", designation: "Evacuation de gravats en benne, tri et traitement", categorie: "DEMOLITION", unite: "T", prix: 180, cout: 138 },
  { code: "DEM-050", designation: "Curage complet de logement", categorie: "DEMOLITION", unite: "M2", prix: 52, cout: 39 },
  { code: "DEM-060", designation: "Demolition de dalle beton", categorie: "DEMOLITION", unite: "M2", prix: 78, cout: 60 },

  // ─── Terrassement / VRD ──────────────────────────────────────────────────
  { code: "TER-010", designation: "Terrassement en pleine masse", categorie: "TERRASSEMENT", unite: "M3", prix: 28, cout: 21 },
  { code: "TER-020", designation: "Fouille en rigole pour fondations", categorie: "TERRASSEMENT", unite: "M3", prix: 42, cout: 32 },
  { code: "TER-030", designation: "Remblaiement et compactage", categorie: "TERRASSEMENT", unite: "M3", prix: 22, cout: 17 },
  { code: "VRD-010", designation: "Reseau eaux usees PVC 125 mm pose en tranchee", categorie: "VRD", unite: "ML", prix: 145, cout: 110 },
  { code: "VRD-020", designation: "Reseau eaux pluviales et regards", categorie: "VRD", unite: "ML", prix: 128, cout: 97 },
  { code: "VRD-030", designation: "Alimentation eau potable et fourreaux", categorie: "VRD", unite: "ML", prix: 96, cout: 73 },
  { code: "VRD-040", designation: "Raccordement au reseau public", categorie: "VRD", unite: "FORFAIT", prix: 3800, cout: 2900 },

  // ─── Gros oeuvre / maconnerie ────────────────────────────────────────────
  { code: "GO-010", designation: "Ouverture en mur porteur avec pose d'IPN", categorie: "GROS_OEUVRE", unite: "U", prix: 1850, cout: 1420 },
  { code: "GO-020", designation: "Reprise en sous-oeuvre", categorie: "GROS_OEUVRE", unite: "ML", prix: 950, cout: 730 },
  { code: "GO-030", designation: "Dalle beton arme sur herisson", categorie: "GROS_OEUVRE", unite: "M2", prix: 118, cout: 90 },
  { code: "GO-040", designation: "Chape de ravoirage et de mise a niveau", categorie: "GROS_OEUVRE", unite: "M2", prix: 32, cout: 24 },
  { code: "GO-050", designation: "Escalier beton prefabrique", categorie: "GROS_OEUVRE", unite: "U", prix: 4600, cout: 3550 },
  { code: "MAC-010", designation: "Mur en bloc beton 20 cm", categorie: "MACONNERIE", unite: "M2", prix: 96, cout: 73 },
  { code: "MAC-020", designation: "Enduit de facade monocouche gratte", categorie: "MACONNERIE", unite: "M2", prix: 58, cout: 44 },
  { code: "MAC-030", designation: "Rejointoiement de facade pierre", categorie: "MACONNERIE", unite: "M2", prix: 88, cout: 68 },
  { code: "MAC-040", designation: "Linteau beton arme", categorie: "MACONNERIE", unite: "ML", prix: 165, cout: 126 },

  // ─── Charpente / couverture / etancheite ─────────────────────────────────
  { code: "CHA-010", designation: "Charpente traditionnelle en sapin traite", categorie: "CHARPENTE", unite: "M2", prix: 165, cout: 127 },
  { code: "CHA-020", designation: "Renfort de charpente existante", categorie: "CHARPENTE", unite: "ML", prix: 92, cout: 71 },
  { code: "COU-010", designation: "Refection de couverture en tuiles mecaniques", categorie: "COUVERTURE", unite: "M2", prix: 145, cout: 111 },
  { code: "COU-020", designation: "Couverture zinc a joint debout", categorie: "COUVERTURE", unite: "M2", prix: 235, cout: 181 },
  { code: "COU-030", designation: "Gouttieres et descentes en zinc", categorie: "COUVERTURE", unite: "ML", prix: 62, cout: 47 },
  { code: "COU-040", designation: "Velux avec habillage interieur", categorie: "COUVERTURE", unite: "U", prix: 1250, cout: 960 },
  { code: "ETA-010", designation: "Etancheite bicouche sur toiture terrasse", categorie: "ETANCHEITE", unite: "M2", prix: 98, cout: 75 },
  { code: "ETA-020", designation: "Etancheite de salle d'eau (SPEC)", categorie: "ETANCHEITE", unite: "M2", prix: 34, cout: 26 },
  { code: "ETA-030", designation: "Drainage peripherique et cuvelage", categorie: "ETANCHEITE", unite: "ML", prix: 145, cout: 112 },

  // ─── Isolation ───────────────────────────────────────────────────────────
  { code: "ISO-010", designation: "Isolation thermique interieure laine de verre 100 mm + BA13", categorie: "ISOLATION", unite: "M2", prix: 58, cout: 44 },
  { code: "ISO-020", designation: "Isolation thermique par l'exterieur polystyrene + enduit", categorie: "ISOLATION", unite: "M2", prix: 168, cout: 129 },
  { code: "ISO-030", designation: "Isolation de combles perdus par soufflage", categorie: "ISOLATION", unite: "M2", prix: 26, cout: 19 },
  { code: "ISO-040", designation: "Isolation de plancher bas", categorie: "ISOLATION", unite: "M2", prix: 38, cout: 29 },
  { code: "ISO-050", designation: "Isolation phonique entre logements", categorie: "ISOLATION", unite: "M2", prix: 46, cout: 35 },

  // ─── Platrerie ───────────────────────────────────────────────────────────
  { code: "PLA-010", designation: "Cloison placo 98/48 avec isolant", categorie: "PLATRERIE", unite: "M2", prix: 62, cout: 47 },
  { code: "PLA-020", designation: "Doublage thermique colle", categorie: "PLATRERIE", unite: "M2", prix: 48, cout: 36 },
  { code: "PLA-030", designation: "Plafond suspendu BA13 sur ossature", categorie: "PLATRERIE", unite: "M2", prix: 45, cout: 34 },
  { code: "PLA-040", designation: "Enduit de lissage et ponçage", categorie: "PLATRERIE", unite: "M2", prix: 18, cout: 13 },
  { code: "PLA-050", designation: "Habillage de gaine technique", categorie: "PLATRERIE", unite: "ML", prix: 78, cout: 60 },
  { code: "PLA-060", designation: "Cloison coupe-feu 1 h", categorie: "PLATRERIE", unite: "M2", prix: 88, cout: 68 },

  // ─── Menuiserie ──────────────────────────────────────────────────────────
  { code: "MEN-010", designation: "Fenetre PVC double vitrage 120 x 120, pose en renovation", categorie: "MENUISERIE", unite: "U", prix: 680, cout: 520 },
  { code: "MEN-020", designation: "Fenetre aluminium double vitrage grande dimension", categorie: "MENUISERIE", unite: "U", prix: 1180, cout: 910 },
  { code: "MEN-030", designation: "Bloc-porte interieur ame pleine", categorie: "MENUISERIE", unite: "U", prix: 320, cout: 240 },
  { code: "MEN-040", designation: "Porte paliere blindee A2P", categorie: "MENUISERIE", unite: "U", prix: 1450, cout: 1120 },
  { code: "MEN-050", designation: "Placard amenage sur mesure", categorie: "MENUISERIE", unite: "ML", prix: 480, cout: 370 },
  { code: "MEN-060", designation: "Volet roulant electrique", categorie: "MENUISERIE", unite: "U", prix: 620, cout: 476 },
  { code: "MEN-070", designation: "Parquet contrecolle chene, pose flottante", categorie: "MENUISERIE", unite: "M2", prix: 78, cout: 59 },
  { code: "MEN-080", designation: "Sol souple PVC en le, pose collee", categorie: "MENUISERIE", unite: "M2", prix: 42, cout: 32 },
  { code: "MEN-090", designation: "Garde-corps metallique", categorie: "MENUISERIE", unite: "ML", prix: 385, cout: 296 },

  // ─── Electricite ─────────────────────────────────────────────────────────
  { code: "ELE-010", designation: "Prise electrique 16 A avec terre", categorie: "ELECTRICITE", unite: "U", prix: 18, cout: 13 },
  { code: "ELE-020", designation: "Interrupteur simple ou va-et-vient", categorie: "ELECTRICITE", unite: "U", prix: 15, cout: 11 },
  { code: "ELE-030", designation: "Tableau electrique complet avec protections", categorie: "ELECTRICITE", unite: "FORFAIT", prix: 1850, cout: 1420 },
  { code: "ELE-040", designation: "Point lumineux avec appareillage", categorie: "ELECTRICITE", unite: "U", prix: 42, cout: 32 },
  { code: "ELE-050", designation: "Prise reseau RJ45 categorie 6", categorie: "ELECTRICITE", unite: "U", prix: 68, cout: 52 },
  { code: "ELE-060", designation: "Colonne montante et distribution", categorie: "ELECTRICITE", unite: "ML", prix: 118, cout: 90 },
  { code: "ELE-070", designation: "Mise a la terre et liaison equipotentielle", categorie: "ELECTRICITE", unite: "FORFAIT", prix: 680, cout: 520 },
  { code: "ELE-080", designation: "Eclairage de securite et BAES", categorie: "ELECTRICITE", unite: "U", prix: 165, cout: 127 },
  { code: "ELE-090", designation: "Interphone video", categorie: "ELECTRICITE", unite: "U", prix: 480, cout: 370 },

  // ─── Plomberie ───────────────────────────────────────────────────────────
  { code: "PLO-010", designation: "Alimentation et evacuation d'un appareil sanitaire", categorie: "PLOMBERIE", unite: "U", prix: 320, cout: 245 },
  { code: "PLO-020", designation: "WC suspendu avec bati-support", categorie: "PLOMBERIE", unite: "U", prix: 780, cout: 600 },
  { code: "PLO-030", designation: "Douche a l'italienne complete avec receveur", categorie: "PLOMBERIE", unite: "U", prix: 1950, cout: 1500 },
  { code: "PLO-040", designation: "Meuble vasque avec robinetterie", categorie: "PLOMBERIE", unite: "U", prix: 620, cout: 476 },
  { code: "PLO-050", designation: "Baignoire avec tablier", categorie: "PLOMBERIE", unite: "U", prix: 890, cout: 685 },
  { code: "PLO-060", designation: "Colonne d'alimentation EF / EC", categorie: "PLOMBERIE", unite: "ML", prix: 85, cout: 65 },
  { code: "PLO-070", designation: "Chauffe-eau thermodynamique 200 L", categorie: "PLOMBERIE", unite: "U", prix: 2850, cout: 2190 },
  { code: "PLO-080", designation: "Evier de cuisine et raccordements", categorie: "PLOMBERIE", unite: "U", prix: 520, cout: 400 },

  // ─── Chauffage / climatisation ───────────────────────────────────────────
  { code: "CHF-010", designation: "Radiateur eau chaude avec robinet thermostatique", categorie: "CHAUFFAGE", unite: "U", prix: 480, cout: 370 },
  { code: "CHF-020", designation: "Chaudiere gaz a condensation murale", categorie: "CHAUFFAGE", unite: "U", prix: 4200, cout: 3230 },
  { code: "CHF-030", designation: "Pompe a chaleur air / eau", categorie: "CHAUFFAGE", unite: "U", prix: 12500, cout: 9600 },
  { code: "CHF-040", designation: "Plancher chauffant hydraulique", categorie: "CHAUFFAGE", unite: "M2", prix: 78, cout: 60 },
  { code: "CHF-050", designation: "Reseau de distribution chauffage", categorie: "CHAUFFAGE", unite: "ML", prix: 68, cout: 52 },
  { code: "CLI-010", designation: "Split mural reversible", categorie: "CLIMATISATION", unite: "U", prix: 1850, cout: 1420 },
  { code: "CLI-020", designation: "VMC double flux avec reseau", categorie: "CLIMATISATION", unite: "U", prix: 3400, cout: 2620 },
  { code: "CLI-030", designation: "VMC simple flux hygroreglable", categorie: "CLIMATISATION", unite: "U", prix: 980, cout: 754 },

  // ─── Carrelage / peinture ────────────────────────────────────────────────
  { code: "CAR-010", designation: "Carrelage sol 60 x 60, pose droite collee", categorie: "CARRELAGE", unite: "M2", prix: 68, cout: 52 },
  { code: "CAR-020", designation: "Faience murale de salle de bains", categorie: "CARRELAGE", unite: "M2", prix: 62, cout: 47 },
  { code: "CAR-030", designation: "Plinthes carrelage", categorie: "CARRELAGE", unite: "ML", prix: 14, cout: 10 },
  { code: "CAR-040", designation: "Chape fluide anhydrite", categorie: "CARRELAGE", unite: "M2", prix: 38, cout: 29 },
  { code: "PEI-010", designation: "Peinture murs et plafonds, impression + 2 couches", categorie: "PEINTURE", unite: "M2", prix: 24, cout: 18 },
  { code: "PEI-020", designation: "Peinture de boiseries et menuiseries", categorie: "PEINTURE", unite: "M2", prix: 38, cout: 29 },
  { code: "PEI-030", designation: "Ravalement de facade avec echafaudage", categorie: "PEINTURE", unite: "M2", prix: 86, cout: 66 },
  { code: "PEI-040", designation: "Papier peint et toile de verre", categorie: "PEINTURE", unite: "M2", prix: 32, cout: 24 },

  // ─── Voirie / espaces exterieurs ─────────────────────────────────────────
  { code: "VOI-010", designation: "Enrobe noir a chaud sur grave", categorie: "VOIRIE", unite: "M2", prix: 48, cout: 37 },
  { code: "VOI-020", designation: "Bordures beton prefabriquees", categorie: "VOIRIE", unite: "ML", prix: 42, cout: 32 },
  { code: "VOI-030", designation: "Pave beton drainant", categorie: "VOIRIE", unite: "M2", prix: 78, cout: 60 },
  { code: "EXT-010", designation: "Cloture panneaux rigides avec poteaux", categorie: "ESPACES_EXTERIEURS", unite: "ML", prix: 78, cout: 60 },
  { code: "EXT-020", designation: "Engazonnement et preparation de sol", categorie: "ESPACES_EXTERIEURS", unite: "M2", prix: 12, cout: 9 },
  { code: "EXT-030", designation: "Terrasse bois sur lambourdes", categorie: "ESPACES_EXTERIEURS", unite: "M2", prix: 145, cout: 111 },
  { code: "EXT-040", designation: "Portail coulissant motorise", categorie: "ESPACES_EXTERIEURS", unite: "U", prix: 3600, cout: 2770 },

  // ─── Prestations intellectuelles ─────────────────────────────────────────
  { code: "AMO-010", designation: "Mission d'assistance a maitrise d'ouvrage", categorie: "AUTRE", unite: "JOUR", prix: 850, cout: 520 },
  { code: "AMO-020", designation: "Coordination de travaux, suivi de chantier", categorie: "AUTRE", unite: "JOUR", prix: 720, cout: 440 },
  { code: "AMO-030", designation: "Etude de faisabilite et chiffrage", categorie: "AUTRE", unite: "FORFAIT", prix: 3500, cout: 1900 },
  { code: "AMO-040", designation: "Coordination SPS", categorie: "AUTRE", unite: "FORFAIT", prix: 2400, cout: 1850 },
  { code: "AMO-050", designation: "Bureau de controle technique", categorie: "AUTRE", unite: "FORFAIT", prix: 4800, cout: 3700 },
  { code: "AMO-060", designation: "Diagnostics avant travaux (amiante, plomb)", categorie: "AUTRE", unite: "FORFAIT", prix: 1800, cout: 1390 },
  { code: "AMO-070", designation: "Installation et repli de chantier", categorie: "AUTRE", unite: "FORFAIT", prix: 6500, cout: 5000 },
  { code: "AMO-080", designation: "Echafaudage de pied, location mensuelle", categorie: "AUTRE", unite: "M2", prix: 22, cout: 17 },
]

export const CATALOGUE_PAR_CODE = new Map(CATALOGUE_PRIX.map((p) => [p.code, p]))

// ═══════════════════════════════════════════════════════════════════════════
//  TRAMES DE LOTS PAR TYPE D'OPERATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * `ratio` : quantite du poste par m² de surface de l'operation.
 * `minimum` : quantite plancher, pour les postes forfaitaires.
 */
export type PosteTrame = {
  code: string
  ratio: number
  minimum?: number
  /** Quantite arrondie a l'entier (portes, prises, appareils...) */
  entier?: boolean
}

export type LotTrame = {
  code: string
  nom: string
  categorie: string
  sousTraite: boolean
  descriptif: string
  postes: PosteTrame[]
}

const LOT_INSTALLATION: LotTrame = {
  code: "00",
  nom: "Installation de chantier et prestations communes",
  categorie: "AUTRE",
  sousTraite: false,
  descriptif:
    "Installation et repli de chantier, echafaudages, coordination SPS, bureau de controle, diagnostics reglementaires.",
  postes: [
    { code: "AMO-070", ratio: 0, minimum: 1, entier: true },
    { code: "AMO-040", ratio: 0, minimum: 1, entier: true },
    { code: "AMO-060", ratio: 0, minimum: 1, entier: true },
    { code: "AMO-080", ratio: 0.35 },
  ],
}

const LOT_DEMOLITION: LotTrame = {
  code: "01",
  nom: "Demolition et curage",
  categorie: "DEMOLITION",
  sousTraite: true,
  descriptif:
    "Depose des cloisons, doublages, revetements et menuiseries interieures. Tri et evacuation des gravats.",
  postes: [
    { code: "DEM-010", ratio: 0.8 },
    { code: "DEM-020", ratio: 0.05, entier: true },
    { code: "DEM-030", ratio: 0.85 },
    { code: "DEM-040", ratio: 0.05 },
  ],
}

const LOT_GROS_OEUVRE: LotTrame = {
  code: "02",
  nom: "Gros oeuvre et maconnerie",
  categorie: "GROS_OEUVRE",
  sousTraite: true,
  descriptif: "Ouvertures en mur porteur, reprises structurelles, chapes de ravoirage.",
  postes: [
    { code: "GO-010", ratio: 0.004, entier: true },
    { code: "GO-040", ratio: 0.3 },
    { code: "MAC-040", ratio: 0.01 },
  ],
}

const LOT_ISOLATION: LotTrame = {
  code: "03",
  nom: "Isolation thermique et phonique",
  categorie: "ISOLATION",
  sousTraite: true,
  descriptif: "Isolation des murs par l'interieur, des combles et des planchers.",
  postes: [
    { code: "ISO-010", ratio: 0.9 },
    { code: "ISO-030", ratio: 0.15 },
    { code: "ISO-050", ratio: 0.25 },
  ],
}

const LOT_PLATRERIE: LotTrame = {
  code: "04",
  nom: "Platrerie et cloisonnement",
  categorie: "PLATRERIE",
  sousTraite: true,
  descriptif: "Cloisons de distribution, doublages, plafonds suspendus, habillages de gaines.",
  postes: [
    { code: "PLA-010", ratio: 0.55 },
    { code: "PLA-020", ratio: 0.35 },
    { code: "PLA-030", ratio: 0.85 },
    { code: "PLA-040", ratio: 1.2 },
    { code: "PLA-050", ratio: 0.04 },
  ],
}

const LOT_MENUISERIE: LotTrame = {
  code: "05",
  nom: "Menuiseries interieures et exterieures",
  categorie: "MENUISERIE",
  sousTraite: true,
  descriptif: "Fenetres, portes interieures et palieres, placards, volets roulants.",
  postes: [
    { code: "MEN-010", ratio: 0.06, entier: true },
    { code: "MEN-030", ratio: 0.05, entier: true },
    { code: "MEN-040", ratio: 0.012, entier: true },
    { code: "MEN-050", ratio: 0.03 },
    { code: "MEN-060", ratio: 0.04, entier: true },
  ],
}

const LOT_ELECTRICITE: LotTrame = {
  code: "06",
  nom: "Electricite courants forts et faibles",
  categorie: "ELECTRICITE",
  sousTraite: true,
  descriptif:
    "Distribution, tableaux, appareillage, eclairage, reseau informatique et interphonie. Conformite NF C 15-100.",
  postes: [
    { code: "ELE-010", ratio: 0.35, entier: true },
    { code: "ELE-020", ratio: 0.12, entier: true },
    { code: "ELE-030", ratio: 0.008, entier: true, minimum: 1 },
    { code: "ELE-040", ratio: 0.15, entier: true },
    { code: "ELE-050", ratio: 0.03, entier: true },
    { code: "ELE-060", ratio: 0.05 },
    { code: "ELE-070", ratio: 0.008, entier: true, minimum: 1 },
  ],
}

const LOT_PLOMBERIE: LotTrame = {
  code: "07",
  nom: "Plomberie et sanitaires",
  categorie: "PLOMBERIE",
  sousTraite: true,
  descriptif: "Alimentations, evacuations, appareils sanitaires, production d'eau chaude.",
  postes: [
    { code: "PLO-010", ratio: 0.04, entier: true },
    { code: "PLO-020", ratio: 0.012, entier: true },
    { code: "PLO-030", ratio: 0.012, entier: true },
    { code: "PLO-040", ratio: 0.012, entier: true },
    { code: "PLO-060", ratio: 0.06 },
    { code: "PLO-080", ratio: 0.012, entier: true },
  ],
}

const LOT_CHAUFFAGE: LotTrame = {
  code: "08",
  nom: "Chauffage et ventilation",
  categorie: "CHAUFFAGE",
  sousTraite: true,
  descriptif: "Emetteurs, production de chaleur, reseaux et ventilation mecanique.",
  postes: [
    { code: "CHF-010", ratio: 0.05, entier: true },
    { code: "CHF-050", ratio: 0.08 },
    { code: "CLI-030", ratio: 0.012, entier: true },
  ],
}

const LOT_CARRELAGE: LotTrame = {
  code: "09",
  nom: "Carrelage et revetements de sol",
  categorie: "CARRELAGE",
  sousTraite: true,
  descriptif: "Carrelage, faience, parquet, sols souples et plinthes.",
  postes: [
    { code: "CAR-010", ratio: 0.4 },
    { code: "CAR-020", ratio: 0.12 },
    { code: "CAR-030", ratio: 0.35 },
    { code: "MEN-070", ratio: 0.5 },
  ],
}

const LOT_PEINTURE: LotTrame = {
  code: "10",
  nom: "Peinture et finitions",
  categorie: "PEINTURE",
  sousTraite: true,
  descriptif: "Preparation des supports, peinture des murs, plafonds et boiseries.",
  postes: [
    { code: "PEI-010", ratio: 2.4 },
    { code: "PEI-020", ratio: 0.15 },
  ],
}

const LOT_COUVERTURE: LotTrame = {
  code: "11",
  nom: "Charpente, couverture et etancheite",
  categorie: "COUVERTURE",
  sousTraite: true,
  descriptif: "Refection de couverture, zinguerie, etancheite des parties horizontales.",
  postes: [
    { code: "COU-010", ratio: 0.35 },
    { code: "COU-030", ratio: 0.06 },
    { code: "CHA-020", ratio: 0.05 },
    { code: "ETA-020", ratio: 0.05 },
  ],
}

const LOT_FACADE: LotTrame = {
  code: "12",
  nom: "Facades et ravalement",
  categorie: "MACONNERIE",
  sousTraite: true,
  descriptif: "Ravalement, enduits, traitement des fissures.",
  postes: [
    { code: "PEI-030", ratio: 0.55 },
    { code: "MAC-020", ratio: 0.15 },
  ],
}

const LOT_VRD: LotTrame = {
  code: "13",
  nom: "VRD et amenagements exterieurs",
  categorie: "VRD",
  sousTraite: true,
  descriptif: "Reseaux, voirie, clotures et espaces verts.",
  postes: [
    { code: "VRD-010", ratio: 0.03 },
    { code: "VRD-020", ratio: 0.03 },
    { code: "VOI-010", ratio: 0.12 },
    { code: "EXT-010", ratio: 0.04 },
    { code: "EXT-020", ratio: 0.15 },
  ],
}

const LOT_TERRASSEMENT: LotTrame = {
  code: "01",
  nom: "Terrassement et fondations",
  categorie: "TERRASSEMENT",
  sousTraite: true,
  descriptif: "Terrassement, fouilles, fondations et dallage.",
  postes: [
    { code: "TER-010", ratio: 0.9 },
    { code: "TER-020", ratio: 0.15 },
    { code: "TER-030", ratio: 0.3 },
    { code: "GO-030", ratio: 1 },
  ],
}

const LOT_STRUCTURE_NEUVE: LotTrame = {
  code: "02",
  nom: "Structure et maconnerie",
  categorie: "GROS_OEUVRE",
  sousTraite: true,
  descriptif: "Murs porteurs, planchers, escaliers.",
  postes: [
    { code: "MAC-010", ratio: 1.1 },
    { code: "MAC-040", ratio: 0.06 },
    { code: "GO-050", ratio: 0.004, entier: true },
  ],
}

const LOT_CHARPENTE_NEUVE: LotTrame = {
  code: "03",
  nom: "Charpente et couverture",
  categorie: "CHARPENTE",
  sousTraite: true,
  descriptif: "Charpente traditionnelle, couverture et zinguerie.",
  postes: [
    { code: "CHA-010", ratio: 0.6 },
    { code: "COU-010", ratio: 0.6 },
    { code: "COU-030", ratio: 0.08 },
  ],
}

const LOT_AMO: LotTrame = {
  code: "01",
  nom: "Mission d'assistance et de conseil",
  categorie: "AUTRE",
  sousTraite: false,
  descriptif: "Etude, coordination, suivi et reddition de comptes.",
  postes: [
    { code: "AMO-030", ratio: 0, minimum: 1, entier: true },
    { code: "AMO-010", ratio: 0.012, entier: true, minimum: 5 },
    { code: "AMO-020", ratio: 0.02, entier: true, minimum: 8 },
  ],
}

/** Trames de lots proposees par le generateur, selon le type d'operation. */
export const TRAMES: Record<string, LotTrame[]> = {
  RENOVATION_LOURDE: [
    LOT_INSTALLATION,
    LOT_DEMOLITION,
    LOT_GROS_OEUVRE,
    LOT_ISOLATION,
    LOT_PLATRERIE,
    LOT_MENUISERIE,
    LOT_ELECTRICITE,
    LOT_PLOMBERIE,
    LOT_CHAUFFAGE,
    LOT_CARRELAGE,
    LOT_PEINTURE,
  ],
  RENOVATION_LEGERE: [
    LOT_INSTALLATION,
    { ...LOT_DEMOLITION, postes: [{ code: "DEM-030", ratio: 0.6 }, { code: "DEM-040", ratio: 0.02 }] },
    { ...LOT_PLATRERIE, postes: [{ code: "PLA-040", ratio: 1.6 }, { code: "PLA-030", ratio: 0.3 }] },
    { ...LOT_ELECTRICITE, postes: [
      { code: "ELE-010", ratio: 0.2, entier: true },
      { code: "ELE-020", ratio: 0.08, entier: true },
      { code: "ELE-040", ratio: 0.1, entier: true },
    ] },
    LOT_CARRELAGE,
    LOT_PEINTURE,
  ],
  REHABILITATION: [
    LOT_INSTALLATION,
    LOT_DEMOLITION,
    LOT_GROS_OEUVRE,
    LOT_COUVERTURE,
    LOT_FACADE,
    LOT_ISOLATION,
    LOT_PLATRERIE,
    LOT_MENUISERIE,
    LOT_ELECTRICITE,
    LOT_PLOMBERIE,
    LOT_CHAUFFAGE,
    LOT_CARRELAGE,
    LOT_PEINTURE,
  ],
  CONSTRUCTION_NEUVE: [
    LOT_INSTALLATION,
    LOT_TERRASSEMENT,
    LOT_STRUCTURE_NEUVE,
    LOT_CHARPENTE_NEUVE,
    { ...LOT_ISOLATION, code: "04" },
    { ...LOT_PLATRERIE, code: "05" },
    { ...LOT_MENUISERIE, code: "06" },
    { ...LOT_ELECTRICITE, code: "07" },
    { ...LOT_PLOMBERIE, code: "08" },
    { ...LOT_CHAUFFAGE, code: "09" },
    { ...LOT_CARRELAGE, code: "10" },
    { ...LOT_PEINTURE, code: "11" },
    { ...LOT_VRD, code: "12" },
  ],
  EXTENSION: [
    LOT_INSTALLATION,
    LOT_TERRASSEMENT,
    LOT_STRUCTURE_NEUVE,
    LOT_CHARPENTE_NEUVE,
    { ...LOT_ISOLATION, code: "04" },
    { ...LOT_PLATRERIE, code: "05" },
    { ...LOT_MENUISERIE, code: "06" },
    { ...LOT_ELECTRICITE, code: "07" },
    { ...LOT_PLOMBERIE, code: "08" },
    { ...LOT_CARRELAGE, code: "09" },
    { ...LOT_PEINTURE, code: "10" },
  ],
  AMENAGEMENT: [
    LOT_INSTALLATION,
    { ...LOT_PLATRERIE, code: "01" },
    { ...LOT_MENUISERIE, code: "02" },
    { ...LOT_ELECTRICITE, code: "03" },
    { ...LOT_CARRELAGE, code: "04" },
    { ...LOT_PEINTURE, code: "05" },
  ],
  SURELEVATION: [
    LOT_INSTALLATION,
    LOT_GROS_OEUVRE,
    LOT_CHARPENTE_NEUVE,
    { ...LOT_ISOLATION, code: "04" },
    { ...LOT_PLATRERIE, code: "05" },
    { ...LOT_MENUISERIE, code: "06" },
    { ...LOT_ELECTRICITE, code: "07" },
    { ...LOT_PLOMBERIE, code: "08" },
    { ...LOT_PEINTURE, code: "09" },
  ],
  DEMOLITION: [LOT_INSTALLATION, LOT_DEMOLITION],
  VRD: [LOT_INSTALLATION, LOT_TERRASSEMENT, LOT_VRD],
  AMO: [LOT_AMO],
  CONSEIL: [LOT_AMO],
}

/** Duree indicative d'un lot, en jours ouvres, pour 100 m² traites. */
export const DUREES_LOT: Record<string, number> = {
  AUTRE: 4,
  DEMOLITION: 4,
  TERRASSEMENT: 5,
  VRD: 6,
  GROS_OEUVRE: 8,
  MACONNERIE: 7,
  CHARPENTE: 6,
  COUVERTURE: 7,
  ETANCHEITE: 4,
  ISOLATION: 4,
  PLATRERIE: 7,
  MENUISERIE: 5,
  ELECTRICITE: 6,
  PLOMBERIE: 6,
  CHAUFFAGE: 5,
  CLIMATISATION: 4,
  CARRELAGE: 6,
  PEINTURE: 6,
  VOIRIE: 5,
  ESPACES_EXTERIEURS: 4,
}

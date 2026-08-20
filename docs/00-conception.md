# BTP Pilote — dossier de conception

> Pilotage opérationnel et économique des opérations immobilières et des chantiers.
> Chaîne couverte : **Prospect → Projet → Chiffrage → Consultation → Comparaison → Marché → Exécution → Situations → Avenants → Réception → Rentabilité**.

Ce document répond aux huit préalables de méthode demandés au chapitre 29 du cahier des charges,
avant toute écriture de code.

---

## 1. Périmètre du MVP

### Dans le MVP (livré)

| # | Bloc | Contenu |
|---|------|---------|
| 1 | Multi-tenant | Organisation, utilisateurs, rôles, isolation stricte des données |
| 2 | Authentification | E-mail / mot de passe, session JWT, cloisonnement des espaces |
| 3 | Tableau de bord | KPI dirigeant + moteur d'alertes, lecture en moins de 30 secondes |
| 4 | CRM | Contacts (prospects, clients, MOA, architectes, partenaires) + pipeline commercial |
| 5 | Projets | Fiche complète, statuts, indicateurs de synthèse |
| 6 | Chiffrage | Lots → postes → quantités → PU → totaux, ventilation des coûts, marge, TVA, scénarios |
| 7 | Bibliothèque de prix | Base interne, historique, min / moyen / max, suggestion automatique |
| 8 | Sous-traitants | Fiche entreprise, spécialités, notation, pièces administratives, assurances |
| 9 | Consultations | Génération depuis le chiffrage, envoi multi-entreprises, suivi des réponses |
| 10 | Comparateur d'offres | Tableau comparatif, score multicritère, détection des anomalies, recommandation |
| 11 | Marchés | Contractualisation d'une offre retenue → bascule en coût engagé |
| 12 | Budget | Budget initial / actualisé, engagé, réalisé, reste à engager, atterrissage, marge |
| 13 | Avenants | Impact coût + vente + délai, recalcul automatique du budget et de la date de fin |
| 14 | Situations & factures | Situation de travaux, cumul, retenue de garantie, reste à facturer |
| 15 | Planning | Gantt par lot, dépendances, chemin critique, détection des retards et conflits |
| 16 | Suivi de chantier | Compte rendu, avancement, photos, incidents, réserves — interface tablette |
| 17 | Documents | Arborescence automatique, versionnage, visibilité client / sous-traitant |
| 18 | Conseil immobilier | Coût global, marge de revente, rendement, cash-flow, ROI, arbitrage de scénarios |
| 19 | IA métier | Chiffrage assisté, analyse de devis, explication de marge, risques planning, assistant |
| 20 | Portail sous-traitant | Consultations, dépôt de devis, questions, marchés, situations |
| 21 | Espace client | Avancement, planning, documents rendus visibles |
| 22 | Reporting | Devis, DCE, rapport financier / marge / chantier / sous-traitants, PV de réception — PDF + CSV |
| 23 | « Lancer le projet » | Génération automatique lots + postes + prix + budget + consultations + planning |

### Hors MVP (v2 et suivantes)

Comptabilité générale, paie, gestion de stock, achats de matériaux, pointage des heures salariés,
signature électronique, application mobile native, OCR sur documents scannés, facturation SaaS
(Stripe), synchronisation bancaire, BIM / IFC.

---

## 2. Personas

| Persona | Rôle applicatif | Besoin principal | Écran d'entrée |
|---|---|---|---|
| Karim, dirigeant | `DIRIGEANT` | Marge, trésorerie, dérives, arbitrage | Tableau de bord |
| Sofia, conductrice de travaux | `CONDUCTEUR` | Planning, avancement, sous-traitants, incidents | Projets / Planning |
| Marc, métreur | `METREUR` | Chiffrage, bibliothèque de prix, consultations | Projets → Chiffrage |
| Nadia, comptabilité | `COMPTA` | Situations, factures, paiements | Factures & situations |
| Entreprise partenaire | `SOUS_TRAITANT` | Consultations reçues, dépôt de devis, ses situations | Portail |
| Client / MOA | `CLIENT` | Avancement de son opération, documents | Espace client |
| Administrateur | `ADMIN` | Paramétrage société, utilisateurs, référentiels | Paramètres |

---

## 3. Parcours utilisateurs

### P1 — De l'affaire au chantier (parcours central, critère de réussite du chapitre 30)

1. Le dirigeant crée un contact et une affaire dans le pipeline.
2. L'affaire devient un **projet** via l'assistant en neuf étapes.
3. Le métreur construit le **chiffrage**, assisté par la bibliothèque de prix.
4. Il fixe la **marge cible** ; l'application calcule le prix de vente et le budget de coûts.
5. Il sélectionne les lots à sous-traiter et génère les **consultations**.
6. Les entreprises déposent leurs **offres** (portail ou saisie interne).
7. Le **comparateur** classe les offres et recommande une entreprise.
8. L'offre retenue devient un **marché** → le montant alimente le **coût engagé**.
9. Le planning est généré, le chantier démarre.
10. Le conducteur pointe l'avancement, les incidents, les photos.
11. Les situations et factures alimentent le **coût réalisé**.
12. Le module budget recalcule en continu **atterrissage** et **marge finale estimée**.

### P2 — Lancement express

Saisie minimale (client, adresse, type d'opération, surface) → bouton **« Lancer le projet »** →
l'application génère lots, postes, quantités au ratio, prix issus de l'historique, budget, marge
cible, lots à sous-traiter, consultations préparées et planning prévisionnel. L'utilisateur valide.

### P3 — Contrôle de gestion hebdomadaire

Tableau de bord → alertes (dépassement, retard, devis manquant, facture en attente) → clic sur
l'alerte → écran concerné → décision (avenant, relance, arbitrage).

### P4 — Étude d'opportunité immobilière

Prix d'acquisition, frais, travaux (repris du chiffrage), financement → coût global, marge de
revente, rendement locatif, cash-flow, ROI → comparaison de scénarios.

---

## 4. Modèle de données

```
Organization
 ├─ User (role)
 ├─ Contact ─── Interaction, Deal (pipeline)
 ├─ Property
 ├─ Subcontractor ─── SubcontractorDocument
 ├─ PriceItem ─── PriceHistory
 └─ Project
     ├─ Estimate (scénario) ─── EstimateItem
     ├─ Lot
     │   ├─ Consultation ─── ConsultationInvite, ConsultationQuestion
     │   │                └─ Offer ─── OfferLine
     │   ├─ Contract (marché) ─── Situation ─── Invoice
     │   ├─ Task (Gantt) ─── TaskDependency
     │   ├─ Commitment (engagé) / Expense (réalisé)
     │   └─ ChangeOrder (avenant)
     ├─ Document / SitePhoto
     ├─ SiteReport ─── Incident / Reservation
     ├─ RealEstateAnalysis
     └─ AiConversation ─── AiMessage
Notification, AuditLog
```

Règles structurelles :

- **Toute** table métier porte `organizationId` — isolation multi-tenant.
- Suppression d'un projet ⇒ cascade sur ses enfants ; suppression d'une organisation ⇒ cascade totale.
- Montants en `Decimal(14,2)`, quantités en `Decimal(14,3)`, taux en `Decimal(6,3)` (pourcentage).
- Les `Decimal` sont convertis en nombres simples dans la couche `lib/queries` : aucun objet non
  sérialisable ne traverse la frontière serveur → client.

---

## 5. Règles métier

### R1 — Coût direct d'un poste

```
coutDirect = quantite × (materiaux + mainOeuvre + sousTraitance + materiel + transport)
```

Si la ventilation n'est pas saisie, repli sur `quantite × PU × (1 − margeCible)` — jamais un coût
nul, qui afficherait une marge de 100 %.

### R2 — Du coût de revient au prix de vente

```
coutDirect     = Σ coutDirect(postes)
fraisChantier  = coutDirect × tauxFraisChantier
fraisGeneraux  = (coutDirect + fraisChantier) × tauxFraisGeneraux
coutRevient    = coutDirect + fraisChantier + fraisGeneraux
prixVenteCible = coutRevient / (1 − margeCible)        ← marge sur prix de vente (usage BTP)
montantHT      = Σ (quantite × PU)                     ← ce qui est proposé au client
marge          = montantHT − coutRevient
ecartCible     = montantHT − prixVenteCible            ← négatif : le chiffrage ne tient pas la cible
```

Les deux montants sont volontairement distincts : l'écart est l'indicateur d'arbitrage du chargé
d'études.

### R3 — Scénarios

`ECONOMIQUE ×0,85` · `STANDARD ×1,00` · `PREMIUM ×1,25` appliqués aux prix et aux coûts. Chaque
scénario est un chiffrage complet et versionné ; un seul est marqué **retenu** — c'est lui qui
alimente le budget, le prix de vente et les consultations.

### R4 — Suivi budgétaire

```
budgetActualise  = budgetInitial + Σ avenants acceptés (impact coût)
engage           = Σ marchés signés + commandes fermes
realise          = Σ dépenses + factures validées
resteAEngager    = max(0, budgetActualise − engage)
atterrissage     = max(engage + resteAEngager, realise)
margePrevisionnelle = prixVenteActualise − atterrissage
ecart            = budgetActualise − atterrissage       ← négatif : dérive
```

Alerte dès que `atterrissage > budgetActualise × (1 + seuil)` (seuil paramétrable, 2 % par défaut).

### R5 — Avancement

- **Physique** : moyenne des avancements de tâches pondérée par le budget du lot.
- **Financier** : `realise / atterrissage`.

### R6 — Score du comparateur d'offres

```
scorePrix       = 100 × (montantMin / montantOffre)              poids 40
scoreDelai      = 100 × (delaiMin / delaiOffre)                  poids 20
scoreQualite    = 20 × note qualité (0–5)                        poids 20
scoreFiabilite  = RC 35 + décennale 40 + vigilance 25            poids 10
scoreHistorique = 30 + 12/marché (max 70) − 20/litige (max 60)   poids 10
```

Signaux automatiques : prix inférieur de plus de 25 % à la moyenne des autres offres, postes du
descriptif non chiffrés, exclusions déclarées, délai non précisé, assurances manquantes, litiges.

### R7 — Situation de travaux

```
marcheActualise   = marcheInitial + avenants
montantCumule     = marcheActualise × avancementCumule
montantSituation  = montantCumule − cumulPrecedent
retenueGarantie   = montantSituation × tauxRG (5 % par défaut)
netAPayer         = montantSituation − retenueGarantie
resteAFacturer    = marcheActualise − montantCumule
```

La validation d'une situation génère la facture fournisseur ; la validation de la facture crée la
dépense — c'est le moment précis où le coût passe d'« engagé » à « réalisé ».

### R8 — Planning

Calcul CPM (passe avant / passe arrière) sur les durées et les liens. Une tâche est **critique** si
sa marge totale est nulle, **en retard** si `aujourd'hui > dateFin` et `avancement < 100`. Une
dépendance `FIN_DEBUT` non respectée par les dates saisies lève un **conflit**.

### R9 — Rentabilité d'une opération immobilière

```
coutGlobal    = acquisition + frais + travaux + divers + frais financiers de portage
margeRevente  = valeurApresTravaux − coutGlobal − fraisRevente
rendementNet  = (loyerAnnuel − charges) / coutGlobal
cashFlow      = loyerAnnuel − charges − annuiteCredit
ROI           = margeRevente / apport
```

Arbitrage : la marge immédiate de revente est comparée au cash-flow net cumulé sur dix ans.

### R10 — Référence projet

`{PREFIXE}-{ANNEE}-{COMPTEUR:3}` — ex. `DCT-2026-014`, unique par organisation.

---

## 6. Écrans

| Route | Écran | Rôles |
|---|---|---|
| `/dashboard` | Tableau de bord + alertes | internes |
| `/dashboard/crm` · `/crm/[id]` | Contacts, pipeline, fiche contact | ADMIN, DIRIGEANT, METREUR, CONDUCTEUR (R), COMPTA (R) |
| `/dashboard/projets` | Liste + filtres | internes |
| `/dashboard/projets/nouveau` | Assistant de création en 9 étapes | ADMIN, DIRIGEANT, METREUR |
| `/dashboard/projets/[id]` | Synthèse projet | internes |
| `…/chiffrage` | Moteur de chiffrage | ADMIN, DIRIGEANT, METREUR |
| `…/consultations` · `…/[cid]` | Consultations et comparateur | ADMIN, DIRIGEANT, METREUR, CONDUCTEUR |
| `…/budget` | Contrôle budgétaire | ADMIN, DIRIGEANT, COMPTA, METREUR (R) |
| `…/planning` | Gantt | internes |
| `…/chantier` | Suivi de chantier (mobile) | ADMIN, DIRIGEANT, CONDUCTEUR |
| `…/avenants` | Avenants | ADMIN, DIRIGEANT, COMPTA |
| `…/situations` | Situations & factures | ADMIN, COMPTA, DIRIGEANT (R) |
| `…/documents` | GED projet | internes |
| `…/rentabilite` | Conseil immobilier | ADMIN, DIRIGEANT |
| `/dashboard/bibliotheque` | Bibliothèque de prix | ADMIN, DIRIGEANT, METREUR |
| `/dashboard/sous-traitants` · `/[id]` | Annuaire et fiche entreprise | internes |
| `/dashboard/consultations` | Toutes les consultations | internes |
| `/dashboard/factures` | Factures et situations à traiter | ADMIN, COMPTA, DIRIGEANT |
| `/dashboard/rapports` | Documents PDF et exports CSV | ADMIN, DIRIGEANT, COMPTA |
| `/dashboard/assistant` | Assistant IA métier | internes |
| `/dashboard/parametres` | Société, taux, utilisateurs, quotas | ADMIN, DIRIGEANT |
| `/portail` | Espace sous-traitant | SOUS_TRAITANT |
| `/espace-client` | Espace client | CLIENT |

---

## 7. Permissions

Matrice `rôle × ressource × action` centralisée dans [`lib/permissions.ts`](../lib/permissions.ts).

| Ressource | ADMIN | DIRIGEANT | CONDUCTEUR | METREUR | COMPTA | SOUS_TRAITANT | CLIENT |
|---|---|---|---|---|---|---|---|
| Organisation / utilisateurs | CRUD | R(U) | – | – | – | – | – |
| CRM | CRUD | CRUD | R | RU | R | – | – |
| Projets | CRUD | CRUD | RU | RU | R | – | R |
| Chiffrage | CRUD | CRUD | R | CRUD | R | – | – |
| Bibliothèque de prix | CRUD | CRUD | R | CRUD | R | – | – |
| Sous-traitants | CRUD | CRUD | RU | R | R | RU | – |
| Consultations | CRUD | CRUD | RU | CRUD | R | R | – |
| Offres | CRUD | CRUD | R | CRUD | R | CRU | – |
| Marchés | CRUD | CRUD | R | R | R | R | – |
| Budget / marge | CRUD | CRUD | – | R | R | – | – |
| Planning | CRUD | CRUD | CRUD | R | – | R | R |
| Suivi de chantier | CRUD | R | CRUD | R | – | – | R |
| Situations / factures | CRUD | R | R | – | CRUD | CR | – |
| Documents | CRUD | CRUD | CRU | CRU | R | CR | R |
| Rentabilité | CRUD | CRUD | – | R | R | – | – |

Deux gardes complémentaires, appliquées à chaque lecture et à chaque écriture :

1. **Isolation tenant** — `requireSession()` fournit `organizationId` depuis le JWT ; il n'est
   jamais accepté depuis le client.
2. **Garde de rôle** — `requireAccess(ressource, action)` refuse l'accès avant toute requête.

---

## 8. Architecture technique

| Couche | Choix | Justification |
|---|---|---|
| Frontend | Next.js 15 (App Router, React 19), TypeScript strict | Rendu serveur, pages dynamiques par défaut |
| UI | Tailwind CSS 4 + primitives Radix | Aucune dépendance de design lourde |
| Données | PostgreSQL via Prisma 7 + `@prisma/adapter-pg` | Compatible Neon, Supabase, instance dédiée |
| Auth | NextAuth v5 (credentials, JWT) + middleware Edge | Cloisonnement des trois espaces |
| Mutations | Server Actions typées + Zod | Pas de couche REST à maintenir |
| Fichiers | Abstraction `lib/storage.ts`, pilote local | Aucun fichier servi en statique : route protégée |
| IA | Interface `FournisseurIa` + `anthropic` / `openai` / `local` | Changement de fournisseur par variable d'environnement |
| PDF | `pdf-lib`, générateur maison | Rendu serveur identique partout |
| Graphiques | Recharts | Déjà éprouvé, léger |

### Écart assumé par rapport au cahier des charges

Le chapitre 21 mentionne Supabase (Auth, Storage, RLS) « de préférence ». L'application utilise
**Prisma + NextAuth + abstraction de stockage** à la place. Raisons :

- le modèle de données reste du **PostgreSQL pur** : la base peut être hébergée sur Supabase sans
  aucune modification ;
- l'isolation multi-tenant est appliquée au niveau de la couche d'accès aux données, avec un point
  d'entrée unique — vérifiable et testable ;
- une bascule vers Supabase se limiterait à brancher `lib/storage.ts` sur Supabase Storage,
  `lib/auth.ts` sur Supabase Auth, et à ajouter des policies RLS en surcouche du schéma existant.

### Ordre de construction suivi

base de données → authentification → tableau de bord → CRM → projets → chiffrage → bibliothèque →
sous-traitants → consultations → comparateur → budget → planning → IA → portails → reporting.

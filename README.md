# BTP Pilote

SaaS vertical de **coordination de travaux, chiffrage et pilotage de la rentabilité des chantiers**.

L'application répond en permanence aux quatre questions du dirigeant :

1. Combien le projet doit-il coûter ? → **chiffrage** et **budget**
2. Combien avons-nous réellement engagé ? → **marchés**, **engagements**, **dépenses**
3. Où en est le chantier ? → **planning**, **avancement**, **suivi de chantier**
4. Quelle sera la marge finale probable ? → **atterrissage** et **marge prévisionnelle**

---

## Démarrage

### 1. Dépendances

```bash
npm install
```

### 2. Base de données

Créez une base PostgreSQL (Neon, Supabase, Railway ou instance locale) puis renseignez `.env` :

```bash
cp .env.example .env
```

```
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"
AUTH_SECRET="<secret de 32 caractères minimum>"
```

Générer un secret : `npx auth secret` ou `openssl rand -base64 32`.

### 3. Schéma et données de démonstration

```bash
npm run db:push
npm run db:seed
```

`npm run db:reset` réinitialise entièrement la base et rejoue le jeu de démonstration.

### 4. Lancer l'application

```bash
npm run dev
```

L'application est disponible sur **http://localhost:3010**.

---

## Comptes de démonstration

Mot de passe commun : `Chantier2026!`

| Adresse | Rôle | Ce qu'il voit |
|---|---|---|
| `karim.delcourt@delcourt-coordination.fr` | Dirigeant | Tout, avec la vision financière |
| `sofia.bensalah@delcourt-coordination.fr` | Conductrice de travaux | Projets, planning, chantier — pas le budget |
| `marc.lefebvre@delcourt-coordination.fr` | Métreur | Chiffrage, bibliothèque de prix, consultations |
| `nadia.roussel@delcourt-coordination.fr` | Comptabilité | Situations, factures, paiements |
| `admin@delcourt-coordination.fr` | Administrateur | Accès complet + paramétrage |
| `julien.waeles@nord-electricite.fr` | Sous-traitant | Portail entreprise uniquement |

---

## Ce que contient le jeu de démonstration

- **Delcourt Coordination & Travaux**, société lilloise de coordination de travaux.
- **5 opérations** à des stades différents :
  - `DCT-2026-001` — Rénovation d'un immeuble de **1 200 m²** à Lille, **chantier en cours** :
    10 lots attribués, marchés signés, avenants, situations, factures, incidents, réserves,
    comptes rendus de chantier ;
  - `DCT-2026-002` — Aménagement de bureaux, **consultations en cours d'analyse**, dont un lot
    électricité avec **trois offres à comparer** (l'une anormalement basse et incomplète) ;
  - `DCT-2026-003` — Réhabilitation en phase de **chiffrage** ;
  - `DCT-2026-004` — Extension en phase d'**étude** ;
  - `DCT-2025-018` — Chantier **terminé**, pour l'historique de marge.
- **12 entreprises partenaires** avec spécialités, notation et conformité administrative.
- **~90 prix de référence** avec historique min / moyen / max.
- Pipeline commercial, contacts, biens immobiliers, analyses de rentabilité.

### Parcours de démonstration recommandé

1. **Tableau de bord** — les alertes classées par gravité, la chaîne budgétaire, les lots en dérive.
2. **Projets → `DCT-2026-002` → Consultations → lot électricité** — le comparateur d'offres :
   score multicritère, détection de l'offre anormalement basse, postes non chiffrés, recommandation.
   Le bouton **Retenir** transforme l'offre en marché et bascule le montant en coût engagé.
3. **Projets → `DCT-2026-001` → Budget** — budget → engagé → réalisé → atterrissage, écarts par lot,
   puis **Expliquer la marge** pour l'analyse.
4. **Projets → Nouveau projet** — l'assistant en neuf étapes et le bouton **Lancer le projet** :
   l'aperçu se recalcule en direct, la génération crée lots, postes, budget, consultations et planning.
5. **Assistant métier** — « Quels devis sont encore en attente ? », « Pourquoi la marge baisse-t-elle ? »

---

## Architecture

```
app/                      Routes (App Router)
  dashboard/              Interface interne
  portail/                Espace sous-traitant
  espace-client/          Espace client
  api/rapports/           Génération PDF et exports CSV
  api/fichiers/           Service de fichiers protégé
components/
  ui/                     Primitives (boutons, tableaux, dialogues)
  app/                    Composants métier (KPI, Gantt, alertes, graphiques)
lib/
  metier/                 Moteur de calcul pur, sans dépendance à la base
    chiffrage.ts          Coût de revient → prix de vente → marge
    budget.ts             Budget → engagé → réalisé → atterrissage, situations
    comparateur.ts        Score multicritère des offres
    planning.ts           CPM, retards, conflits de dépendance
    immobilier.ts         Rentabilité d'une opération
    alertes.ts            Moteur d'alertes
    lancement.ts          Générateur « Lancer le projet »
    referentiel.ts        Catalogue de prix et trames de lots
  queries/                Lecture : conversion Decimal → nombre, DTO sérialisables
  actions/                Server Actions (écritures), validées par Zod
  ia/                     Abstraction IA + analyses métier
prisma/
  schema.prisma           30 modèles, multi-tenant
  seed.ts                 Jeu de démonstration
docs/00-conception.md     Périmètre, personas, parcours, règles métier, permissions
```

Le **moteur métier** (`lib/metier/`) est constitué de fonctions pures : il ne touche ni à la base,
ni au réseau. Il est donc partagé entre le serveur et le navigateur — c'est ce qui permet à
l'assistant de création d'afficher un aperçu **strictement identique** à ce qui sera enregistré.

---

## Sécurité

- **Isolation multi-tenant** : chaque table métier porte `organizationId` ; il provient du JWT et
  n'est jamais accepté depuis le client. Point d'entrée unique : `lib/session.ts`.
- **Contrôle par rôle** : matrice `rôle × ressource × action` dans `lib/permissions.ts`, appliquée
  avant toute requête via `requireAccess()`.
- **Cloisonnement des espaces** : le middleware redirige chaque rôle vers son espace ; un
  sous-traitant ne peut pas atteindre `/dashboard`.
- **Fichiers** : stockés hors de `public/`, servis par une route qui vérifie l'organisation et la
  visibilité déclarée du document.
- **Journalisation** : les décisions structurantes (attribution de marché, acceptation d'avenant,
  lancement de projet) sont tracées dans `audit_logs`.

---

## Assistant IA

L'assistant fonctionne selon deux niveaux :

1. **Intentions reconnues** — coût engagé sur un lot, devis en attente, baisse de marge, risques de
   retard, alertes : traitées par des requêtes exactes sur la base. La réponse est un chiffre
   vérifiable.
2. **Questions libres** — un contexte factuel compact est transmis au fournisseur configuré, avec
   consigne stricte de ne rien inventer.

Le fournisseur se change dans `.env` sans toucher au reste de l'application :

```
AI_PROVIDER="local"       # local | anthropic | openai
ANTHROPIC_API_KEY="..."
```

En mode `local` (par défaut), **aucune donnée ne sort de votre infrastructure** : les analyses sont
produites par le moteur de calcul interne et restituées telles quelles.

---

## Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement (port 3010) |
| `npm run build` | Build de production |
| `npm run typecheck` | Vérification TypeScript |
| `npm run lint` | ESLint |
| `npm run db:push` | Applique le schéma à la base |
| `npm run db:seed` | Charge le jeu de démonstration |
| `npm run db:reset` | Réinitialise la base et recharge la démonstration |
| `npm run db:studio` | Explorateur Prisma Studio |

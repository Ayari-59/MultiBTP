/**
 * Matrice de permissions role x ressource x action.
 *
 * Deuxieme garde du modele de securite : la premiere est l'isolation
 * multi-tenant (`requireSession` injecte systematiquement organizationId dans
 * les requetes), celle-ci controle ce que le role a le droit de faire.
 */

export type Role =
  | "ADMIN"
  | "DIRIGEANT"
  | "CONDUCTEUR"
  | "METREUR"
  | "COMPTA"
  | "SOUS_TRAITANT"
  | "CLIENT"

export type Action = "read" | "create" | "update" | "delete"

export type Resource =
  | "organisation"
  | "utilisateurs"
  | "crm"
  | "projets"
  | "chiffrage"
  | "bibliotheque"
  | "sous_traitants"
  | "consultations"
  | "offres"
  | "marches"
  | "budget"
  | "planning"
  | "chantier"
  | "situations"
  | "documents"
  | "rentabilite"
  | "assistant"
  | "rapports"

const R: Action[] = ["read"]
const RU: Action[] = ["read", "update"]
const CR: Action[] = ["create", "read"]
const CRU: Action[] = ["create", "read", "update"]
const CRUD: Action[] = ["create", "read", "update", "delete"]
const NONE: Action[] = []

type Matrice = Record<Resource, Partial<Record<Role, Action[]>>>

const MATRICE: Matrice = {
  organisation: { ADMIN: CRUD, DIRIGEANT: RU },
  utilisateurs: { ADMIN: CRUD, DIRIGEANT: R },
  crm: { ADMIN: CRUD, DIRIGEANT: CRUD, CONDUCTEUR: R, METREUR: RU, COMPTA: R },
  projets: { ADMIN: CRUD, DIRIGEANT: CRUD, CONDUCTEUR: RU, METREUR: RU, COMPTA: R, CLIENT: R },
  chiffrage: { ADMIN: CRUD, DIRIGEANT: CRUD, CONDUCTEUR: R, METREUR: CRUD, COMPTA: R },
  bibliotheque: { ADMIN: CRUD, DIRIGEANT: CRUD, CONDUCTEUR: R, METREUR: CRUD, COMPTA: R },
  sous_traitants: {
    ADMIN: CRUD,
    DIRIGEANT: CRUD,
    CONDUCTEUR: RU,
    METREUR: R,
    COMPTA: R,
    SOUS_TRAITANT: RU,
  },
  consultations: {
    ADMIN: CRUD,
    DIRIGEANT: CRUD,
    CONDUCTEUR: RU,
    METREUR: CRUD,
    COMPTA: R,
    SOUS_TRAITANT: R,
  },
  offres: {
    ADMIN: CRUD,
    DIRIGEANT: CRUD,
    CONDUCTEUR: R,
    METREUR: CRUD,
    COMPTA: R,
    SOUS_TRAITANT: CRU,
  },
  marches: { ADMIN: CRUD, DIRIGEANT: CRUD, CONDUCTEUR: R, METREUR: R, COMPTA: R, SOUS_TRAITANT: R },
  budget: { ADMIN: CRUD, DIRIGEANT: CRUD, CONDUCTEUR: NONE, METREUR: R, COMPTA: R },
  planning: {
    ADMIN: CRUD,
    DIRIGEANT: CRUD,
    CONDUCTEUR: CRUD,
    METREUR: R,
    SOUS_TRAITANT: R,
    CLIENT: R,
  },
  chantier: { ADMIN: CRUD, DIRIGEANT: R, CONDUCTEUR: CRUD, METREUR: R, CLIENT: R },
  situations: {
    ADMIN: CRUD,
    DIRIGEANT: R,
    CONDUCTEUR: R,
    COMPTA: CRUD,
    SOUS_TRAITANT: CR,
  },
  documents: {
    ADMIN: CRUD,
    DIRIGEANT: CRUD,
    CONDUCTEUR: CRU,
    METREUR: CRU,
    COMPTA: R,
    SOUS_TRAITANT: CR,
    CLIENT: R,
  },
  rentabilite: { ADMIN: CRUD, DIRIGEANT: CRUD, METREUR: R, COMPTA: R },
  assistant: { ADMIN: CRUD, DIRIGEANT: CRUD, CONDUCTEUR: CRU, METREUR: CRU, COMPTA: CRU },
  rapports: { ADMIN: CRUD, DIRIGEANT: CRUD, CONDUCTEUR: R, METREUR: R, COMPTA: CRU },
}

/** Roles disposant d'un acces a l'interface interne (hors portails externes). */
export const ROLES_INTERNES: Role[] = ["ADMIN", "DIRIGEANT", "CONDUCTEUR", "METREUR", "COMPTA"]

export const LIBELLES_ROLES: Record<Role, string> = {
  ADMIN: "Administrateur",
  DIRIGEANT: "Dirigeant",
  CONDUCTEUR: "Conducteur de travaux",
  METREUR: "Metreur / charge d'etudes",
  COMPTA: "Comptabilite",
  SOUS_TRAITANT: "Sous-traitant",
  CLIENT: "Client",
}

export function can(role: Role, resource: Resource, action: Action = "read"): boolean {
  return MATRICE[resource]?.[role]?.includes(action) ?? false
}

/** Leve une erreur si le role n'a pas le droit demande. */
export function assertCan(role: Role, resource: Resource, action: Action = "read"): void {
  if (!can(role, resource, action)) {
    throw new Error(`Acces refuse : ${role} ne peut pas ${action} ${resource}.`)
  }
}

export function estInterne(role: Role): boolean {
  return ROLES_INTERNES.includes(role)
}

/** Page d'accueil selon le role, utilisee apres connexion. */
export function accueilPourRole(role: Role): string {
  if (role === "SOUS_TRAITANT") return "/portail"
  if (role === "CLIENT") return "/espace-client"
  if (role === "METREUR") return "/dashboard/projets"
  if (role === "COMPTA") return "/dashboard/factures"
  return "/dashboard"
}

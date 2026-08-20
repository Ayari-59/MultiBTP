import { redirect } from "next/navigation"
import { auth } from "./auth"
import { assertCan, type Action, type Resource, type Role } from "./permissions"
import { prisma } from "./prisma"

export type Utilisateur = {
  id: string
  email: string
  nom: string
  role: Role
  organizationId: string
  subcontractorId: string | null
  contactId: string | null
}

/**
 * Garde d'isolation multi-tenant. Toute lecture ou ecriture metier passe par
 * ici : `organizationId` provient du JWT et n'est jamais accepte depuis le
 * client, ce qui rend impossible l'acces croise entre societes.
 */
export async function requireSession(): Promise<Utilisateur> {
  const session = await auth()
  if (!session?.user?.id) redirect("/connexion")

  return {
    id: session.user.id,
    email: session.user.email,
    nom: session.user.name,
    role: session.user.role,
    organizationId: session.user.organizationId,
    subcontractorId: session.user.subcontractorId ?? null,
    contactId: session.user.contactId ?? null,
  }
}

/** Session + controle de droit en une seule etape. */
export async function requireAccess(
  resource: Resource,
  action: Action = "read"
): Promise<Utilisateur> {
  const user = await requireSession()
  assertCan(user.role, resource, action)
  return user
}

/**
 * Verifie qu'un projet appartient bien a l'organisation de l'utilisateur.
 * Renvoie 404 (notFound via redirect) plutot que 403 pour ne pas divulguer
 * l'existence d'une ressource d'une autre societe.
 */
export async function requireProjet(projectId: string, user: Utilisateur) {
  const projet = await prisma.project.findFirst({
    where: { id: projectId, organizationId: user.organizationId },
    select: { id: true, nom: true, reference: true, statut: true },
  })
  if (!projet) redirect("/dashboard/projets")
  return projet
}

export async function getOrganisation(organizationId: string) {
  return prisma.organization.findUniqueOrThrow({ where: { id: organizationId } })
}

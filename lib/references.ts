import { prisma } from "./prisma"

/**
 * Generation des references metier (regle R10).
 *
 * Le compteur est deduit du nombre d'enregistrements existants puis verifie :
 * en cas de collision (suppression, concurrence) on incremente jusqu'a trouver
 * une reference libre. L'unicite reelle est garantie par la contrainte
 * @@unique([organizationId, reference]) au niveau de la base.
 */

function numero(n: number, taille = 3): string {
  return String(n).padStart(taille, "0")
}

export async function prochaineReferenceProjet(organizationId: string): Promise<string> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { prefixe: true },
  })
  const annee = new Date().getFullYear()
  const debut = `${org.prefixe}-${annee}-`

  const existants = await prisma.project.findMany({
    where: { organizationId, reference: { startsWith: debut } },
    select: { reference: true },
  })

  const utilises = new Set(existants.map((p) => p.reference))
  let i = existants.length + 1
  while (utilises.has(`${debut}${numero(i)}`)) i++
  return `${debut}${numero(i)}`
}

export async function prochaineReferenceConsultation(
  organizationId: string,
  projetReference: string,
  lotCode: string
): Promise<string> {
  const debut = `CONS-${projetReference}-${lotCode}`
  const existants = await prisma.consultation.count({
    where: { organizationId, reference: { startsWith: debut } },
  })
  return existants === 0 ? debut : `${debut}-${numero(existants + 1, 2)}`
}

export async function prochaineReferenceContrat(
  organizationId: string,
  projetReference: string,
  lotCode: string
): Promise<string> {
  const debut = `MAR-${projetReference}-${lotCode}`
  const existants = await prisma.contract.count({
    where: { organizationId, reference: { startsWith: debut } },
  })
  return existants === 0 ? debut : `${debut}-${numero(existants + 1, 2)}`
}

export async function prochaineReferenceAvenant(
  projectId: string,
  projetReference: string
): Promise<string> {
  const existants = await prisma.changeOrder.count({ where: { projectId } })
  return `AV-${projetReference}-${numero(existants + 1, 2)}`
}

export async function prochainNumeroSituation(contractId: string): Promise<number> {
  const derniere = await prisma.situation.findFirst({
    where: { contractId },
    orderBy: { numero: "desc" },
    select: { numero: true },
  })
  return (derniere?.numero ?? 0) + 1
}

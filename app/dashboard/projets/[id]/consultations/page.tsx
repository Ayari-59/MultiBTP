import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { requireAccess } from "@/lib/session"
import { listeConsultations } from "@/lib/queries/consultations"
import { can } from "@/lib/permissions"
import { StatutBadge } from "@/components/app/indicateurs"
import {
  Carte,
  EnteteCarte,
  EnteteTableau,
  Tableau,
  Td,
  Th,
  Tr,
  Vide,
} from "@/components/ui/primitives"
import {
  BoutonPreparerConsultations,
  BoutonSupprimerConsultation,
  DialogueConsultation,
} from "./formulaires"
import { dateCourte, euros, ratio } from "@/lib/utils"

export default async function PageConsultationsProjet({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const utilisateur = await requireAccess("consultations", "read")

  const [consultations, lots] = await Promise.all([
    listeConsultations(utilisateur.organizationId, { projectId: id }),
    prisma.lot.findMany({
      where: { projectId: id, project: { organizationId: utilisateur.organizationId } },
      select: { id: true, code: true, nom: true },
      orderBy: { ordre: "asc" },
    }),
  ])

  const modifiable = can(utilisateur.role, "consultations", "update")
  const budgetTotal = consultations.reduce((s, c) => s + (c.budgetEstime ?? 0), 0)
  const offresTotal = consultations.reduce((s, c) => s + (c.meilleureOffre ?? 0), 0)
  const avecOffres = consultations.filter((c) => c.meilleureOffre !== null)

  return (
    <div className="space-y-4">
      <Carte>
        <EnteteCarte
          titre="Consultations"
          description={`${consultations.length} consultation(s) · ${consultations.filter((c) => c.nbOffres > 0).length} avec offres`}
          action={
            modifiable ? (
              <div className="flex flex-wrap gap-2">
                <BoutonPreparerConsultations projectId={id} />
                <DialogueConsultation projectId={id} lots={lots} />
              </div>
            ) : undefined
          }
        />

        {avecOffres.length > 0 && (
          <div className="grid gap-3 border-b border-ardoise-200/70 px-4 py-3 sm:grid-cols-3">
            <Resume libelle="Budget estime des lots consultes" valeur={euros(budgetTotal)} />
            <Resume libelle="Meilleures offres cumulees" valeur={euros(offresTotal)} />
            <Resume
              libelle="Ecart"
              valeur={`${euros(budgetTotal - offresTotal)} (${(ratio(budgetTotal - offresTotal, budgetTotal) * 100).toFixed(1)} %)`}
              ton={budgetTotal - offresTotal >= 0 ? "positif" : "negatif"}
            />
          </div>
        )}

        {consultations.length === 0 ? (
          <Vide
            titre="Aucune consultation"
            description="Preparez une consultation par lot sous-traite pour recevoir des devis comparables."
            action={modifiable ? <DialogueConsultation projectId={id} lots={lots} /> : undefined}
          />
        ) : (
          <Tableau>
            <EnteteTableau>
              <tr>
                <Th>Reference</Th>
                <Th>Lot</Th>
                <Th>Statut</Th>
                <Th numerique>Budget estime</Th>
                <Th numerique>Consultees</Th>
                <Th numerique>Offres</Th>
                <Th numerique>Meilleure offre</Th>
                <Th numerique>Ecart</Th>
                <Th numerique>Reponse avant</Th>
                {modifiable && <Th />}
              </tr>
            </EnteteTableau>
            <tbody>
              {consultations.map((c) => {
                const ecart =
                  c.budgetEstime !== null && c.meilleureOffre !== null
                    ? c.budgetEstime - c.meilleureOffre
                    : null
                return (
                  <Tr key={c.id}>
                    <Td>
                      <Link
                        href={`/dashboard/projets/${id}/consultations/${c.id}`}
                        className="text-xs font-medium tabulaire text-ardoise-700 hover:underline"
                      >
                        {c.reference}
                      </Link>
                    </Td>
                    <Td>
                      <Link href={`/dashboard/projets/${id}/consultations/${c.id}`} className="block min-w-40">
                        <span className="block truncate text-sm text-ardoise-900">
                          {c.lotCode} — {c.lotNom}
                        </span>
                      </Link>
                    </Td>
                    <Td>
                      <span className="flex items-center gap-1.5">
                        <StatutBadge statut={c.statut} />
                        {c.enRetard && (
                          <span className="text-[10px] font-medium text-red-600">hors delai</span>
                        )}
                      </span>
                    </Td>
                    <Td numerique className="text-xs text-ardoise-600">
                      {c.budgetEstime !== null ? euros(c.budgetEstime) : "—"}
                    </Td>
                    <Td numerique className="text-xs text-ardoise-500">{c.nbInvites}</Td>
                    <Td numerique className="text-xs font-medium text-ardoise-800">{c.nbOffres}</Td>
                    <Td numerique className="text-sm">
                      {c.meilleureOffre !== null ? euros(c.meilleureOffre) : "—"}
                    </Td>
                    <Td numerique>
                      {ecart !== null ? (
                        <span
                          className={
                            ecart >= 0
                              ? "text-xs font-medium tabulaire text-emerald-600"
                              : "text-xs font-medium tabulaire text-red-600"
                          }
                        >
                          {ecart > 0 ? "+" : ""}
                          {euros(ecart)}
                        </span>
                      ) : (
                        <span className="text-xs text-ardoise-400">—</span>
                      )}
                    </Td>
                    <Td numerique className="text-xs text-ardoise-500">
                      {dateCourte(c.dateLimiteReponse)}
                    </Td>
                    {modifiable && (
                      <Td>
                        <div className="flex justify-end">
                          <BoutonSupprimerConsultation consultationId={c.id} />
                        </div>
                      </Td>
                    )}
                  </Tr>
                )
              })}
            </tbody>
          </Tableau>
        )}
      </Carte>
    </div>
  )
}

function Resume({
  libelle,
  valeur,
  ton,
}: {
  libelle: string
  valeur: string
  ton?: "positif" | "negatif"
}) {
  return (
    <div>
      <p className="text-[11px] text-ardoise-500">{libelle}</p>
      <p
        className={
          ton === "negatif"
            ? "text-sm font-semibold tabulaire text-red-600"
            : ton === "positif"
              ? "text-sm font-semibold tabulaire text-emerald-600"
              : "text-sm font-semibold tabulaire text-ardoise-900"
        }
      >
        {valeur}
      </p>
    </div>
  )
}

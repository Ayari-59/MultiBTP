import type { Metadata } from "next"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { getOrganisation, requireSession } from "@/lib/session"
import { calculerPlanning } from "@/lib/metier/planning"
import { BarreSuperieure } from "@/components/app/barre-superieure"
import { Kpi, StatutProjet } from "@/components/app/indicateurs"
import {
  Carte,
  CorpsCarte,
  EnteteCarte,
  EnteteTableau,
  Jauge,
  Tableau,
  Td,
  Th,
  Tr,
  Vide,
} from "@/components/ui/primitives"
import { dateCourte, euros, nb, pourcent } from "@/lib/utils"

export const metadata: Metadata = { title: "Espace client" }

export default async function PageEspaceClient() {
  const utilisateur = await requireSession()
  const organisation = await getOrganisation(utilisateur.organizationId)

  const projets = utilisateur.contactId
    ? await prisma.project.findMany({
        where: { contactId: utilisateur.contactId, organizationId: utilisateur.organizationId },
        include: {
          tasks: {
            include: { lot: { select: { code: true, nom: true } } },
            orderBy: { dateDebut: "asc" },
          },
          documents: { where: { visibleClient: true }, orderBy: { createdAt: "desc" } },
          reservations: { where: { statut: "OUVERTE" } },
        },
        orderBy: { updatedAt: "desc" },
      })
    : []

  return (
    <div className="min-h-screen">
      <div className="border-b border-ardoise-800 bg-ardoise-900 px-4 py-3 lg:px-6">
        <span className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-chantier-500 text-[13px] font-bold text-white">
            BP
          </span>
          <span className="text-sm font-semibold tracking-tight text-white">Espace client</span>
        </span>
      </div>

      <BarreSuperieure
        nom={utilisateur.nom}
        email={utilisateur.email}
        role={utilisateur.role}
        organisation={organisation.nom}
      />

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-5 lg:px-6">
        <div>
          <h1 className="text-lg font-semibold text-ardoise-900">Mes operations</h1>
          <p className="text-sm text-ardoise-500">
            Avancement, planning et documents de vos chantiers suivis par {organisation.nom}.
          </p>
        </div>

        {projets.length === 0 ? (
          <Carte>
            <Vide
              titre="Aucune operation"
              description="Aucun projet ne vous est rattache pour le moment."
            />
          </Carte>
        ) : (
          projets.map((projet) => {
            const planning = calculerPlanning(
              projet.tasks.map((t) => ({
                id: t.id,
                nom: t.nom,
                lotId: t.lotId,
                lotCode: t.lot?.code ?? null,
                lotNom: t.lot?.nom ?? null,
                sousTraitant: null,
                statut: t.statut,
                dateDebut: t.dateDebut,
                dateFin: t.dateFin,
                dureeJours: t.dureeJours,
                avancement: nb(t.avancement),
                jalon: t.jalon,
                ordre: t.ordre,
              })),
              []
            )

            return (
              <div key={projet.id} className="space-y-3">
                <Carte>
                  <EnteteCarte
                    titre={projet.nom}
                    description={[projet.adresse, projet.codePostal, projet.ville]
                      .filter(Boolean)
                      .join(", ")}
                    action={<StatutProjet statut={projet.statut} />}
                  />
                  <CorpsCarte>
                    <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
                      <Kpi
                        compact
                        libelle="Avancement"
                        valeur={pourcent(planning.avancementMoyen, 0)}
                      />
                      <Kpi
                        compact
                        libelle="Montant des travaux"
                        valeur={projet.prixVenteHT ? euros(nb(projet.prixVenteHT)) : "—"}
                      />
                      <Kpi compact libelle="Demarrage" valeur={dateCourte(projet.dateDebutPrevue)} />
                      <Kpi compact libelle="Fin prevue" valeur={dateCourte(projet.dateFinPrevue)} />
                    </div>

                    {projet.description && (
                      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ardoise-700">
                        {projet.description}
                      </p>
                    )}
                  </CorpsCarte>
                </Carte>

                {planning.taches.length > 0 && (
                  <Carte>
                    <EnteteCarte titre="Avancement des travaux" />
                    <Tableau>
                      <EnteteTableau>
                        <tr>
                          <Th>Poste</Th>
                          <Th numerique>Debut</Th>
                          <Th numerique>Fin prevue</Th>
                          <Th>Avancement</Th>
                        </tr>
                      </EnteteTableau>
                      <tbody>
                        {planning.taches.map((t) => (
                          <Tr key={t.id}>
                            <Td className="text-sm">{t.nom}</Td>
                            <Td numerique className="text-xs text-ardoise-500">
                              {dateCourte(t.dateDebut)}
                            </Td>
                            <Td numerique className="text-xs text-ardoise-500">
                              {dateCourte(t.dateFin)}
                            </Td>
                            <Td>
                              <div className="w-32">
                                <Jauge
                                  valeur={t.avancement}
                                  ton={t.avancement >= 100 ? "succes" : "chantier"}
                                />
                                <span className="mt-1 block text-[10px] tabulaire text-ardoise-500">
                                  {pourcent(t.avancement, 0)}
                                </span>
                              </div>
                            </Td>
                          </Tr>
                        ))}
                      </tbody>
                    </Tableau>
                  </Carte>
                )}

                {projet.documents.length > 0 && (
                  <Carte>
                    <EnteteCarte titre="Documents" description="Pieces mises a votre disposition" />
                    <CorpsCarte>
                      <ul className="space-y-1.5">
                        {projet.documents.map((d) => (
                          <li key={d.id}>
                            <a
                              href={d.url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center justify-between gap-3 rounded-md border border-ardoise-200 px-3 py-2 text-sm text-ardoise-800 hover:bg-ardoise-50"
                            >
                              <span className="truncate">{d.nom}</span>
                              <span className="shrink-0 text-[11px] text-ardoise-400">
                                {dateCourte(d.createdAt)}
                              </span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </CorpsCarte>
                  </Carte>
                )}
              </div>
            )
          })
        )}

        <p className="pt-2 text-center text-xs text-ardoise-400">
          Une question sur votre chantier ?{" "}
          {organisation.email ? (
            <Link href={`mailto:${organisation.email}`} className="underline">
              {organisation.email}
            </Link>
          ) : (
            organisation.telephone
          )}
        </p>
      </main>
    </div>
  )
}

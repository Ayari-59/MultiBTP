import { prisma } from "@/lib/prisma"
import { requireAccess } from "@/lib/session"
import { can } from "@/lib/permissions"
import { Kpi, StatutBadge } from "@/components/app/indicateurs"
import {
  Badge,
  Carte,
  CorpsCarte,
  EnteteCarte,
  EnteteTableau,
  Tableau,
  Td,
  Th,
  Tr,
  Vide,
} from "@/components/ui/primitives"
import {
  BoutonLeverReserve,
  BoutonSupprimerPhoto,
  DialogueIncident,
  DialoguePhotos,
  DialogueRapport,
  DialogueReserve,
  SelecteurIncident,
} from "./formulaires"
import { dateCourte, euros, nb } from "@/lib/utils"

export default async function PageChantier({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const utilisateur = await requireAccess("chantier", "read")

  const [lots, rapports, photos, incidents, reserves] = await Promise.all([
    prisma.lot.findMany({
      where: { projectId: id, project: { organizationId: utilisateur.organizationId } },
      select: { id: true, code: true, nom: true },
      orderBy: { ordre: "asc" },
    }),
    prisma.siteReport.findMany({
      where: { projectId: id },
      include: { auteur: { select: { name: true } }, photos: true },
      orderBy: { date: "desc" },
      take: 20,
    }),
    prisma.sitePhoto.findMany({
      where: { projectId: id },
      include: { lot: { select: { code: true } } },
      orderBy: { date: "desc" },
      take: 24,
    }),
    prisma.incident.findMany({
      where: { projectId: id },
      include: { lot: { select: { code: true } } },
      orderBy: [{ statut: "asc" }, { dateOuverture: "desc" }],
    }),
    prisma.reservation.findMany({
      where: { projectId: id },
      include: { lot: { select: { code: true } } },
      orderBy: [{ statut: "asc" }, { dateEmission: "desc" }],
    }),
  ])

  const modifiable = can(utilisateur.role, "chantier", "create")
  const incidentsOuverts = incidents.filter((i) => i.statut === "OUVERT" || i.statut === "EN_TRAITEMENT")
  const reservesOuvertes = reserves.filter((r) => r.statut === "OUVERTE")
  const impactCout = incidentsOuverts.reduce((s, i) => s + nb(i.impactCout), 0)
  const impactDelai = incidentsOuverts.reduce((s, i) => s + i.impactDelaiJours, 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ardoise-900">Suivi de chantier</h2>
        {modifiable && (
          <div className="flex flex-wrap gap-2">
            <DialogueRapport projectId={id} />
            <DialoguePhotos projectId={id} lots={lots} />
            <DialogueIncident projectId={id} lots={lots} />
            <DialogueReserve projectId={id} lots={lots} />
          </div>
        )}
      </div>

      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        <Kpi compact libelle="Comptes rendus" valeur={rapports.length} />
        <Kpi
          compact
          libelle="Incidents ouverts"
          valeur={incidentsOuverts.length}
          precision={impactCout > 0 ? `${euros(impactCout)} · ${impactDelai} j` : "Aucun impact declare"}
          ton={incidentsOuverts.length > 0 ? "negatif" : "positif"}
        />
        <Kpi
          compact
          libelle="Reserves ouvertes"
          valeur={reservesOuvertes.length}
          precision={`${reserves.filter((r) => r.statut === "LEVEE").length} levee(s)`}
          ton={reservesOuvertes.length > 0 ? "attention" : "positif"}
        />
        <Kpi compact libelle="Photos" valeur={photos.length} />
      </div>

      {/* ─── Photos ─────────────────────────────────────────────────────── */}
      <Carte>
        <EnteteCarte titre="Photos de chantier" description="Projet → lot → localisation → date" />
        {photos.length === 0 ? (
          <Vide titre="Aucune photo" description="Les photos prises sur site apparaissent ici." />
        ) : (
          <CorpsCarte>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {photos.map((p) => (
                <figure key={p.id} className="group relative overflow-hidden rounded-md border border-ardoise-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt={p.legende ?? "Photo de chantier"}
                    className="aspect-square w-full object-cover"
                    loading="lazy"
                  />
                  <figcaption className="bg-white px-2 py-1.5">
                    <p className="truncate text-[11px] font-medium text-ardoise-800">
                      {p.legende ?? "Sans legende"}
                    </p>
                    <p className="truncate text-[10px] text-ardoise-400">
                      {[p.lot?.code, p.localisation, dateCourte(p.date)].filter(Boolean).join(" · ")}
                    </p>
                  </figcaption>
                  {modifiable && (
                    <div className="absolute right-1 top-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <BoutonSupprimerPhoto photoId={p.id} />
                    </div>
                  )}
                </figure>
              ))}
            </div>
          </CorpsCarte>
        )}
      </Carte>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ─── Incidents ────────────────────────────────────────────────── */}
        <Carte>
          <EnteteCarte titre="Incidents" description={`${incidents.length} declare(s)`} />
          {incidents.length === 0 ? (
            <Vide titre="Aucun incident" />
          ) : (
            <ul className="divide-y divide-ardoise-100">
              {incidents.map((i) => (
                <li key={i.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-ardoise-900">{i.titre}</span>
                        <StatutBadge statut={i.gravite} />
                        {i.lot && <Badge>{i.lot.code}</Badge>}
                      </p>
                      <p className="mt-0.5 text-[11px] text-ardoise-400">
                        Ouvert le {dateCourte(i.dateOuverture)}
                        {nb(i.impactCout) > 0 && ` · impact ${euros(nb(i.impactCout))}`}
                        {i.impactDelaiJours > 0 && ` · ${i.impactDelaiJours} j de retard`}
                      </p>
                    </div>
                    {modifiable ? (
                      <SelecteurIncident incidentId={i.id} statut={i.statut} />
                    ) : (
                      <StatutBadge statut={i.statut} />
                    )}
                  </div>
                  {i.description && (
                    <p className="mt-1.5 text-xs leading-relaxed text-ardoise-600">{i.description}</p>
                  )}
                  {i.actionCorrective && (
                    <p className="mt-1 rounded bg-ardoise-50 px-2 py-1.5 text-[11px] text-ardoise-700">
                      Action : {i.actionCorrective}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Carte>

        {/* ─── Reserves ─────────────────────────────────────────────────── */}
        <Carte>
          <EnteteCarte
            titre="Reserves"
            description="Leur levee conditionne la reception et le solde des marches."
          />
          {reserves.length === 0 ? (
            <Vide titre="Aucune reserve" />
          ) : (
            <Tableau>
              <EnteteTableau>
                <tr>
                  <Th>Reserve</Th>
                  <Th>Lot</Th>
                  <Th numerique>Emise</Th>
                  <Th numerique>Limite</Th>
                  <Th>Statut</Th>
                  {modifiable && <Th />}
                </tr>
              </EnteteTableau>
              <tbody>
                {reserves.map((r) => {
                  const enRetard =
                    r.statut === "OUVERTE" && r.dateLimite !== null && r.dateLimite < new Date()
                  return (
                    <Tr key={r.id}>
                      <Td>
                        <span className="block max-w-56 truncate text-xs text-ardoise-900">
                          {r.libelle}
                        </span>
                        {r.localisation && (
                          <span className="block text-[10px] text-ardoise-400">{r.localisation}</span>
                        )}
                      </Td>
                      <Td className="text-xs text-ardoise-500">{r.lot?.code ?? "—"}</Td>
                      <Td numerique className="text-xs text-ardoise-500">
                        {dateCourte(r.dateEmission)}
                      </Td>
                      <Td numerique className="text-xs">
                        <span className={enRetard ? "font-medium text-red-600" : "text-ardoise-500"}>
                          {dateCourte(r.dateLimite)}
                        </span>
                      </Td>
                      <Td>
                        <StatutBadge statut={r.statut} />
                      </Td>
                      {modifiable && (
                        <Td>
                          <div className="flex justify-end">
                            <BoutonLeverReserve reserveId={r.id} statut={r.statut} />
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

      {/* ─── Comptes rendus ─────────────────────────────────────────────── */}
      <Carte>
        <EnteteCarte titre="Comptes rendus de chantier" />
        {rapports.length === 0 ? (
          <Vide titre="Aucun compte rendu" description="Saisissez le premier compte rendu depuis le terrain." />
        ) : (
          <ul className="divide-y divide-ardoise-100">
            {rapports.map((r) => (
              <li key={r.id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-ardoise-900">{dateCourte(r.date)}</p>
                  <p className="text-[11px] text-ardoise-400">
                    {[r.auteur?.name, r.meteo, r.effectif ? `${r.effectif} personne(s)` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                {r.travauxRealises && (
                  <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-ardoise-700">
                    {r.travauxRealises}
                  </p>
                )}
                {r.observations && (
                  <p className="mt-1 text-xs text-ardoise-500">Observations : {r.observations}</p>
                )}
                {r.decisions && (
                  <p className="mt-1 rounded bg-chantier-50 px-2 py-1.5 text-[11px] text-chantier-900">
                    Decisions : {r.decisions}
                  </p>
                )}
                {r.photos.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {r.photos.map((p) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={p.id}
                        src={p.url}
                        alt={p.legende ?? ""}
                        className="h-16 w-16 rounded border border-ardoise-200 object-cover"
                        loading="lazy"
                      />
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Carte>
    </div>
  )
}

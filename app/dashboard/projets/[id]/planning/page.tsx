import { prisma } from "@/lib/prisma"
import { requireAccess } from "@/lib/session"
import { calculerPlanning } from "@/lib/metier/planning"
import { can } from "@/lib/permissions"
import { Gantt } from "@/components/app/gantt"
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
  AnalyseRisques,
  BoutonModifierTache,
  BoutonSupprimerTache,
  CurseurAvancement,
  DialogueTache,
} from "./formulaires"
import { dateCourte, nb, pourcent } from "@/lib/utils"

export default async function PagePlanning({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const utilisateur = await requireAccess("planning", "read")

  const [taches, dependances, lots, sousTraitants] = await Promise.all([
    prisma.task.findMany({
      where: { projectId: id, project: { organizationId: utilisateur.organizationId } },
      include: {
        lot: { select: { code: true, nom: true } },
        subcontractor: { select: { id: true, raisonSociale: true } },
      },
      orderBy: [{ dateDebut: "asc" }, { ordre: "asc" }],
    }),
    prisma.taskDependency.findMany({ where: { successeur: { projectId: id } } }),
    prisma.lot.findMany({
      where: { projectId: id },
      select: { id: true, code: true, nom: true },
      orderBy: { ordre: "asc" },
    }),
    prisma.subcontractor.findMany({
      where: { organizationId: utilisateur.organizationId, actif: true },
      select: { id: true, raisonSociale: true },
      orderBy: { raisonSociale: "asc" },
    }),
  ])

  const planning = calculerPlanning(
    taches.map((t) => ({
      id: t.id,
      nom: t.nom,
      lotId: t.lotId,
      lotCode: t.lot?.code ?? null,
      lotNom: t.lot?.nom ?? null,
      sousTraitant: t.subcontractor?.raisonSociale ?? null,
      statut: t.statut,
      dateDebut: t.dateDebut,
      dateFin: t.dateFin,
      dureeJours: t.dureeJours,
      avancement: nb(t.avancement),
      jalon: t.jalon,
      ordre: t.ordre,
    })),
    dependances.map((d) => ({
      predecesseurId: d.predecesseurId,
      successeurId: d.successeurId,
      type: d.type,
      decalageJours: d.decalageJours,
    }))
  )

  const modifiable = can(utilisateur.role, "planning", "update")
  const listeTaches = taches.map((t) => ({ id: t.id, nom: t.nom }))

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 xl:grid-cols-5">
        <Kpi compact libelle="Taches" valeur={planning.taches.length} precision={`${planning.nbTerminees} terminee(s)`} />
        <Kpi compact libelle="Avancement moyen" valeur={pourcent(planning.avancementMoyen, 0)} />
        <Kpi
          compact
          libelle="En retard"
          valeur={planning.nbEnRetard}
          precision={planning.retardProjet > 0 ? `jusqu'a ${planning.retardProjet} j` : "Aucun retard"}
          ton={planning.nbEnRetard > 0 ? "negatif" : "positif"}
        />
        <Kpi
          compact
          libelle="Taches critiques"
          valeur={planning.nbCritiques}
          precision="Sans marge de manoeuvre"
          ton={planning.nbCritiques > 0 ? "attention" : "neutre"}
        />
        <Kpi
          compact
          libelle="Conflits"
          valeur={planning.nbConflits}
          precision="Dependances non respectees"
          ton={planning.nbConflits > 0 ? "negatif" : "neutre"}
        />
      </div>

      <Carte>
        <EnteteCarte
          titre="Diagramme de Gantt"
          description={
            planning.dateDebut
              ? `${dateCourte(planning.dateDebut)} → ${dateCourte(planning.dateFin)} · ${planning.dureeTotaleJours} jours`
              : undefined
          }
          action={
            modifiable ? (
              <DialogueTache
                projectId={id}
                lots={lots}
                sousTraitants={sousTraitants}
                taches={listeTaches}
              />
            ) : undefined
          }
        />
        <Gantt planning={planning} />
      </Carte>

      {planning.nbConflits > 0 && (
        <Carte className="border-red-200">
          <EnteteCarte titre="Conflits de dependance" />
          <ul className="divide-y divide-ardoise-100">
            {planning.taches
              .filter((t) => t.conflits.length > 0)
              .map((t) => (
                <li key={t.id} className="px-4 py-2.5">
                  <p className="text-sm font-medium text-ardoise-900">{t.nom}</p>
                  {t.conflits.map((c, i) => (
                    <p key={i} className="mt-0.5 text-xs text-red-600">
                      • {c}
                    </p>
                  ))}
                </li>
              ))}
          </ul>
        </Carte>
      )}

      <Carte>
        <EnteteCarte titre="Taches" action={<AnalyseRisques projectId={id} />} />
        {planning.taches.length === 0 ? (
          <Vide
            titre="Aucune tache"
            description="Ajoutez les taches du chantier ou relancez la generation depuis l'assistant de creation."
            action={
              modifiable ? (
                <DialogueTache
                  projectId={id}
                  lots={lots}
                  sousTraitants={sousTraitants}
                  taches={listeTaches}
                />
              ) : undefined
            }
          />
        ) : (
          <Tableau>
            <EnteteTableau>
              <tr>
                <Th>Tache</Th>
                <Th>Lot</Th>
                <Th>Entreprise</Th>
                <Th numerique>Debut</Th>
                <Th numerique>Fin</Th>
                <Th numerique>Duree</Th>
                <Th numerique>Marge</Th>
                <Th>Avancement</Th>
                <Th>Statut</Th>
                {modifiable && <Th />}
              </tr>
            </EnteteTableau>
            <tbody>
              {planning.taches.map((t) => {
                const source = taches.find((x) => x.id === t.id)!
                return (
                  <Tr key={t.id}>
                    <Td>
                      <span className="block text-sm text-ardoise-900">{t.nom}</span>
                      {t.predecesseurs.length > 0 && (
                        <span className="block truncate text-[10px] text-ardoise-400">
                          apres : {t.predecesseurs.join(", ")}
                        </span>
                      )}
                    </Td>
                    <Td className="text-xs text-ardoise-500">{t.lotCode ?? "—"}</Td>
                    <Td className="max-w-32 truncate text-xs text-ardoise-600">
                      {t.sousTraitant ?? "—"}
                    </Td>
                    <Td numerique className="text-xs">{dateCourte(t.dateDebut)}</Td>
                    <Td numerique className="text-xs">
                      <span className={t.enRetard ? "font-medium text-red-600" : ""}>
                        {dateCourte(t.dateFin)}
                      </span>
                    </Td>
                    <Td numerique className="text-xs text-ardoise-500">{t.dureeJours} j</Td>
                    <Td numerique>
                      {t.critique ? (
                        <Badge ton="chantier">critique</Badge>
                      ) : (
                        <span className="text-xs tabulaire text-ardoise-500">{t.margeTotale} j</span>
                      )}
                    </Td>
                    <Td>
                      <CurseurAvancement
                        tacheId={t.id}
                        avancement={t.avancement}
                        desactive={!modifiable}
                      />
                    </Td>
                    <Td>
                      {t.enRetard ? (
                        <Badge ton="danger">+{t.joursRetard} j</Badge>
                      ) : (
                        <StatutBadge statut={t.statut} />
                      )}
                    </Td>
                    {modifiable && (
                      <Td>
                        <div className="flex justify-end gap-0.5">
                          <BoutonModifierTache
                            projectId={id}
                            lots={lots}
                            sousTraitants={sousTraitants}
                            taches={listeTaches}
                            tache={{
                              id: t.id,
                              nom: t.nom,
                              lotId: t.lotId,
                              subcontractorId: source.subcontractorId,
                              dateDebut: t.dateDebut.toISOString(),
                              dateFin: t.dateFin.toISOString(),
                              responsable: source.responsable,
                              commentaire: source.commentaire,
                            }}
                          />
                          <BoutonSupprimerTache tacheId={t.id} />
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

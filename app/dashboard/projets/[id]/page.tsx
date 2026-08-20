import Link from "next/link"
import { notFound } from "next/navigation"
import { CheckCircle2, FileText, Rocket } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requireAccess } from "@/lib/session"
import { ficheProjet, syntheseProjet } from "@/lib/queries/projets"
import { calculerPlanning } from "@/lib/metier/planning"
import { genererAlertes } from "@/lib/metier/alertes"
import { donneesAlertes } from "@/lib/queries/projets"
import { Kpi, Montant, StatutBadge, TauxMarge, BarreAvancement } from "@/components/app/indicateurs"
import { ListeAlertes } from "@/components/app/liste-alertes"
import { SelecteurStatut } from "@/components/app/selecteur-statut"
import { GraphiqueLots } from "@/components/app/graphiques"
import {
  Bouton,
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
import { can } from "@/lib/permissions"
import { dateCourte, euros, eurosCompact, nb, pourcent } from "@/lib/utils"

export default async function PageSyntheseProjet({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ lancement?: string }>
}) {
  const { id } = await params
  const { lancement } = await searchParams
  const utilisateur = await requireAccess("projets", "read")

  const [projet, synthese] = await Promise.all([
    ficheProjet(id, utilisateur.organizationId),
    syntheseProjet(id, utilisateur.organizationId),
  ])
  if (!projet || !synthese) notFound()

  const [taches, lots, alertesBrutes] = await Promise.all([
    prisma.task.findMany({
      where: { projectId: id },
      include: {
        lot: { select: { code: true, nom: true } },
        subcontractor: { select: { raisonSociale: true } },
        prerequis: true,
      },
      orderBy: { dateDebut: "asc" },
    }),
    prisma.lot.findMany({
      where: { projectId: id },
      include: {
        contracts: {
          select: { montantActualise: true, subcontractor: { select: { raisonSociale: true } } },
        },
        _count: { select: { consultations: true } },
      },
      orderBy: { ordre: "asc" },
    }),
    donneesAlertes(utilisateur.organizationId),
  ])

  const dependances = await prisma.taskDependency.findMany({
    where: { successeur: { projectId: id } },
  })

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

  const alertes = genererAlertes(alertesBrutes.filter((a) => a.id === id))
  const { budget, lignes, chiffrage } = synthese

  const budgetParLot = new Map(lignes.map((l) => [l.lotId, l]))

  return (
    <div className="space-y-4">
      {lancement === "1" && (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <Rocket className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <div className="text-sm text-emerald-900">
            <p className="font-medium">Projet lance.</p>
            <p className="mt-0.5 text-xs text-emerald-800">
              {projet.compteurs.lots} lots, {chiffrage?.nbPostes ?? 0} postes chiffres,{" "}
              {projet.compteurs.consultations} consultations preparees et{" "}
              {projet.compteurs.taches} taches de planning ont ete generees. Verifiez le chiffrage
              poste par poste avant de lancer les consultations.
            </p>
          </div>
        </div>
      )}

      {/* ─── Indicateurs cles ───────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          libelle="Montant HT vendu"
          valeur={eurosCompact(budget.prixVenteActualise)}
          precision={
            budget.avenantsVente !== 0
              ? `dont ${euros(budget.avenantsVente)} d'avenants`
              : "Chiffrage retenu"
          }
        />
        <Kpi
          libelle="Atterrissage"
          valeur={eurosCompact(budget.atterrissage)}
          precision={`Budget ${euros(budget.budgetActualise)}`}
          ton={budget.enDerive ? "negatif" : "neutre"}
        />
        <Kpi
          libelle="Marge previsionnelle"
          valeur={eurosCompact(budget.margePrevisionnelle)}
          precision={`${pourcent(budget.tauxMargePrevisionnelle)} · cible ${pourcent(projet.margeCible)}`}
          ton={
            budget.tauxMargePrevisionnelle < projet.margeCible - 3
              ? "negatif"
              : "positif"
          }
        />
        <Kpi
          libelle="Avancement"
          valeur={pourcent(synthese.avancementPhysique, 0)}
          precision={`Financier ${pourcent(budget.avancementFinancier, 0)} · ${planning.nbEnRetard} tache(s) en retard`}
          ton={planning.nbEnRetard > 0 ? "attention" : "neutre"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ─── Chaine budgetaire ───────────────────────────────────────── */}
        <Carte className="lg:col-span-2">
          <EnteteCarte
            titre="Budget → engage → realise → atterrissage"
            description="Chaine de controle economique du projet"
            action={
              can(utilisateur.role, "budget", "read") ? (
                <Bouton asChild variant="contour" taille="sm">
                  <Link href={`/dashboard/projets/${id}/budget`}>Detail budgetaire</Link>
                </Bouton>
              ) : undefined
            }
          />
          <CorpsCarte className="space-y-3">
            <BarreAvancement
              libelle="Budget actualise"
              valeur={budget.budgetActualise}
              total={budget.budgetActualise}
              ton="ardoise"
            />
            <BarreAvancement
              libelle="Engage (marches signes et commandes)"
              valeur={budget.engage}
              total={budget.budgetActualise}
              ton="chantier"
            />
            <BarreAvancement
              libelle="Realise (depenses et factures validees)"
              valeur={budget.realise}
              total={budget.budgetActualise}
              ton="succes"
            />

            <div className="grid grid-cols-2 gap-3 border-t border-ardoise-100 pt-3 sm:grid-cols-4">
              <Chiffre libelle="Reste a engager" valeur={euros(budget.resteAEngager)} />
              <Chiffre libelle="Prevision finale" valeur={euros(budget.atterrissage)} />
              <Chiffre
                libelle="Ecart / budget"
                valeur={euros(budget.ecart)}
                ton={budget.ecart < 0 ? "negatif" : "positif"}
              />
              <Chiffre
                libelle="Marge finale estimee"
                valeur={pourcent(budget.tauxMargePrevisionnelle)}
                ton={budget.tauxMargePrevisionnelle < projet.margeCible - 3 ? "negatif" : "positif"}
              />
            </div>
          </CorpsCarte>
        </Carte>

        {/* ─── Pilotage ───────────────────────────────────────────────── */}
        <Carte>
          <EnteteCarte titre="Pilotage" />
          <CorpsCarte className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-ardoise-600">Statut du projet</span>
              <SelecteurStatut
                projectId={id}
                statut={projet.statut}
                desactive={!can(utilisateur.role, "projets", "update")}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-ardoise-100 pt-3 text-xs">
              <Compteur libelle="Lots" valeur={projet.compteurs.lots} />
              <Compteur libelle="Consultations" valeur={projet.compteurs.consultations} />
              <Compteur libelle="Marches" valeur={projet.compteurs.marches} />
              <Compteur libelle="Avenants" valeur={projet.compteurs.avenants} />
              <Compteur libelle="Situations" valeur={projet.compteurs.situations} />
              <Compteur libelle="Documents" valeur={projet.compteurs.documents} />
              <Compteur libelle="Incidents" valeur={projet.compteurs.incidents} />
              <Compteur libelle="Reserves" valeur={projet.compteurs.reserves} />
            </div>

            <div className="border-t border-ardoise-100 pt-3">
              <Bouton asChild variant="contour" taille="sm" className="w-full">
                <Link href={`/dashboard/projets/${id}/chiffrage`}>
                  <FileText className="h-4 w-4" /> Ouvrir le chiffrage
                </Link>
              </Bouton>
            </div>
          </CorpsCarte>
        </Carte>
      </div>

      {alertes.length > 0 && (
        <Carte>
          <EnteteCarte titre="Points d'attention sur ce projet" />
          <ListeAlertes alertes={alertes} />
        </Carte>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ─── Lots ───────────────────────────────────────────────────── */}
        <Carte>
          <EnteteCarte
            titre="Lots"
            description="Budget, engagement et attribution par corps d'etat"
          />
          {lots.length === 0 ? (
            <Vide titre="Aucun lot" description="Le chiffrage n'a pas encore ete construit." />
          ) : (
            <Tableau>
              <EnteteTableau>
                <tr>
                  <Th>Lot</Th>
                  <Th>Statut</Th>
                  <Th>Entreprise</Th>
                  <Th numerique>Budget</Th>
                  <Th numerique>Engage</Th>
                  <Th numerique>Ecart</Th>
                </tr>
              </EnteteTableau>
              <tbody>
                {lots.map((lot) => {
                  const ligne = budgetParLot.get(lot.id)
                  const engage = ligne?.engage ?? 0
                  const budgetLot = ligne?.budget ?? 0
                  const entreprise = lot.contracts[0]?.subcontractor.raisonSociale
                  return (
                    <Tr key={lot.id}>
                      <Td>
                        <span className="block text-sm font-medium text-ardoise-900">
                          {lot.code} — {lot.nom}
                        </span>
                        <span className="text-[11px] text-ardoise-400">
                          {lot.sousTraite ? "Sous-traite" : "Interne"}
                          {lot._count.consultations > 0 && ` · ${lot._count.consultations} consultation(s)`}
                        </span>
                      </Td>
                      <Td>
                        <StatutBadge statut={lot.statut} />
                      </Td>
                      <Td className="text-xs text-ardoise-600">{entreprise ?? "—"}</Td>
                      <Td numerique className="text-xs text-ardoise-600">{euros(budgetLot)}</Td>
                      <Td numerique className="text-xs">{euros(engage)}</Td>
                      <Td numerique>
                        <Montant valeur={budgetLot - engage} signe className="text-xs" />
                      </Td>
                    </Tr>
                  )
                })}
              </tbody>
            </Tableau>
          )}
        </Carte>

        {/* ─── Planning resume ────────────────────────────────────────── */}
        <Carte>
          <EnteteCarte
            titre="Planning"
            description={
              planning.dateDebut
                ? `${dateCourte(planning.dateDebut)} → ${dateCourte(planning.dateFin)} · ${planning.dureeTotaleJours} jours`
                : "Aucune tache planifiee"
            }
            action={
              <Bouton asChild variant="contour" taille="sm">
                <Link href={`/dashboard/projets/${id}/planning`}>Gantt</Link>
              </Bouton>
            }
          />
          {planning.taches.length === 0 ? (
            <Vide titre="Planning vide" description="Aucune tache n'a encore ete planifiee." />
          ) : (
            <ul className="divide-y divide-ardoise-100">
              {planning.taches.slice(0, 8).map((t) => (
                <li key={t.id} className="px-4 py-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm text-ardoise-900">{t.nom}</span>
                    <span className="shrink-0 text-[11px] tabulaire text-ardoise-500">
                      {dateCourte(t.dateDebut)} → {dateCourte(t.dateFin)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <Jauge
                      valeur={t.avancement}
                      ton={t.enRetard ? "danger" : t.avancement >= 100 ? "succes" : "chantier"}
                      className="flex-1"
                    />
                    <span className="w-9 shrink-0 text-right text-[10px] tabulaire text-ardoise-500">
                      {pourcent(t.avancement, 0)}
                    </span>
                    {t.enRetard && (
                      <span className="shrink-0 text-[10px] font-medium text-red-600">
                        +{t.joursRetard} j
                      </span>
                    )}
                    {t.critique && !t.enRetard && (
                      <span className="shrink-0 text-[10px] font-medium text-chantier-600">
                        critique
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Carte>
      </div>

      {/* ─── Repartition par lot ────────────────────────────────────────── */}
      {lignes.length > 0 && (
        <Carte>
          <EnteteCarte titre="Budget, engage et realise par lot" />
          <CorpsCarte>
            <GraphiqueLots
              donnees={lignes.map((l) => ({
                code: l.code,
                budget: l.budget,
                engage: l.engage,
                realise: l.realise,
              }))}
            />
          </CorpsCarte>
        </Carte>
      )}

      {projet.description && (
        <Carte>
          <EnteteCarte titre="Description et contraintes" />
          <CorpsCarte className="space-y-3 text-sm leading-relaxed text-ardoise-700">
            <p className="whitespace-pre-line">{projet.description}</p>
            {projet.contraintes && (
              <div className="rounded-md bg-chantier-50 px-3 py-2 text-xs text-chantier-900">
                <p className="font-medium">Contraintes</p>
                <p className="mt-0.5 whitespace-pre-line">{projet.contraintes}</p>
              </div>
            )}
          </CorpsCarte>
        </Carte>
      )}
    </div>
  )
}

function Chiffre({
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

function Compteur({ libelle, valeur }: { libelle: string; valeur: number }) {
  return (
    <div className="flex items-center justify-between rounded bg-ardoise-50 px-2 py-1.5">
      <span className="text-ardoise-500">{libelle}</span>
      <span className="font-semibold tabulaire text-ardoise-900">{valeur}</span>
    </div>
  )
}

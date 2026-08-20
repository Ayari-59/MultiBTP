import type { Metadata } from "next"
import Link from "next/link"
import { Plus } from "lucide-react"
import { requireAccess } from "@/lib/session"
import { donneesDashboard } from "@/lib/queries/dashboard"
import { Kpi, Montant, StatutProjet, TauxMarge } from "@/components/app/indicateurs"
import { ListeAlertes } from "@/components/app/liste-alertes"
import { GraphiqueFlux, GraphiqueStatuts } from "@/components/app/graphiques"
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
import { dateCourte, euros, eurosCompact, pourcent } from "@/lib/utils"

export const metadata: Metadata = { title: "Tableau de bord" }

export default async function PageDashboard() {
  const utilisateur = await requireAccess("projets", "read")
  const { kpi, alertes, projets, repartitionStatuts, evolutionMensuelle, topLotsDerive } =
    await donneesDashboard(utilisateur.organizationId)

  const actifs = projets.filter((p) =>
    ["ETUDE", "CHIFFRAGE", "CONSULTATION", "PREPARATION", "EN_COURS", "RECEPTION"].includes(p.statut)
  )

  const margeSousCible = kpi.tauxMargePrevisionnelle < kpi.margeCibleMoyenne - 1

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ardoise-900">Tableau de bord</h1>
          <p className="text-sm text-ardoise-500">
            {kpi.projetsActifs} operation{kpi.projetsActifs > 1 ? "s" : ""} active
            {kpi.projetsActifs > 1 ? "s" : ""} · {alertes.length} alerte
            {alertes.length > 1 ? "s" : ""} en cours
          </p>
        </div>
        <Bouton asChild variant="chantier">
          <Link href="/dashboard/projets/nouveau">
            <Plus className="h-4 w-4" /> Nouveau projet
          </Link>
        </Bouton>
      </div>

      {/* ─── Ligne 1 : l'economique ─────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          libelle="CA previsionnel"
          valeur={eurosCompact(kpi.caPrevisionnel)}
          precision={`${kpi.projetsActifs} projet(s) actif(s)`}
        />
        <Kpi
          libelle="Couts engages"
          valeur={eurosCompact(kpi.coutsEngages)}
          precision={`dont ${eurosCompact(kpi.coutsRealises)} deja realises`}
        />
        <Kpi
          libelle="Marge previsionnelle"
          valeur={eurosCompact(kpi.margePrevisionnelle)}
          precision={`${pourcent(kpi.tauxMargePrevisionnelle)} · cible ${pourcent(kpi.margeCibleMoyenne)}`}
          ton={margeSousCible ? "negatif" : "positif"}
        />
        <Kpi
          libelle="Ecart budgetaire"
          valeur={eurosCompact(kpi.ecartBudgetaire)}
          precision={
            kpi.ecartBudgetaire >= 0
              ? "Atterrissage sous le budget"
              : `${kpi.projetsEnDerive} projet(s) en derive`
          }
          ton={kpi.ecartBudgetaire >= 0 ? "positif" : "negatif"}
        />
      </div>

      {/* ─── Ligne 2 : l'operationnel ───────────────────────────────────── */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <Kpi compact libelle="En etude" valeur={kpi.projetsEtude} lien="/dashboard/projets?statut=ETUDE" />
        <Kpi compact libelle="En cours" valeur={kpi.projetsEnCours} lien="/dashboard/projets?statut=EN_COURS" />
        <Kpi
          compact
          libelle="En retard"
          valeur={kpi.projetsEnRetard}
          ton={kpi.projetsEnRetard > 0 ? "negatif" : "neutre"}
        />
        <Kpi
          compact
          libelle="Consultations"
          valeur={kpi.consultationsEnAttente}
          precision={`${kpi.offresRecues} offre(s) recue(s)`}
          lien="/dashboard/consultations"
        />
        <Kpi
          compact
          libelle="Avenants"
          valeur={kpi.avenantsEnCours}
          precision={eurosCompact(kpi.avenantsMontant)}
          ton={kpi.avenantsEnCours > 0 ? "attention" : "neutre"}
        />
        <Kpi
          compact
          libelle="Factures a valider"
          valeur={kpi.facturesAValider}
          precision={eurosCompact(kpi.facturesMontant)}
          lien="/dashboard/factures"
          ton={kpi.facturesAValider > 0 ? "attention" : "neutre"}
        />
        <Kpi
          compact
          libelle="Situations"
          valeur={kpi.situationsATraiter}
          lien="/dashboard/factures"
          ton={kpi.situationsATraiter > 0 ? "attention" : "neutre"}
        />
        <Kpi
          compact
          libelle="Sous-traitants"
          valeur={kpi.sousTraitantsActifs}
          lien="/dashboard/sous-traitants"
        />
      </div>

      {/* ─── Alertes + pipeline ─────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Carte className="lg:col-span-2">
          <EnteteCarte
            titre="Alertes"
            description="Marges, budgets, delais, documents et facturation"
            action={
              alertes.length > 8 ? (
                <span className="text-xs text-ardoise-500">{alertes.length} au total</span>
              ) : undefined
            }
          />
          <ListeAlertes alertes={alertes} limite={8} />
        </Carte>

        <Carte>
          <EnteteCarte titre="Repartition du portefeuille" description="Montant HT par statut" />
          <CorpsCarte>
            <GraphiqueStatuts donnees={repartitionStatuts} />
            <div className="mt-3 rounded-md bg-ardoise-50 px-3 py-2">
              <p className="text-xs text-ardoise-600">Pipeline commercial</p>
              <p className="text-lg font-semibold tabulaire text-ardoise-900">
                {eurosCompact(kpi.pipelineMontant)}
              </p>
              <p className="text-[11px] text-ardoise-500">
                {kpi.pipelineNbAffaires} affaire(s) en cours de negociation
              </p>
            </div>
          </CorpsCarte>
        </Carte>
      </div>

      {/* ─── Flux + derives ─────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Carte className="lg:col-span-2">
          <EnteteCarte
            titre="Engagements et depenses"
            description="12 derniers mois, tous projets confondus"
          />
          <CorpsCarte>
            <GraphiqueFlux donnees={evolutionMensuelle} />
          </CorpsCarte>
        </Carte>

        <Carte>
          <EnteteCarte titre="Lots en depassement" description="Ecart budget / engage le plus fort" />
          {topLotsDerive.length === 0 ? (
            <Vide titre="Aucun lot en depassement" description="Tous les engagements tiennent dans leur budget." />
          ) : (
            <ul className="divide-y divide-ardoise-100">
              {topLotsDerive.map((lot, i) => (
                <li key={i} className="px-4 py-2.5">
                  <Link href={`/dashboard/projets/${lot.projetId}/budget`} className="block">
                    <p className="truncate text-sm font-medium text-ardoise-900">{lot.lot}</p>
                    <div className="mt-0.5 flex items-baseline justify-between gap-2">
                      <span className="truncate text-xs text-ardoise-500">{lot.projet}</span>
                      <Montant valeur={lot.ecart} signe compact className="text-xs font-medium" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Carte>
      </div>

      {/* ─── Operations actives ─────────────────────────────────────────── */}
      <Carte>
        <EnteteCarte
          titre="Operations actives"
          description="Budget, engagement et marge de chaque projet"
          action={
            <Bouton asChild variant="contour" taille="sm">
              <Link href="/dashboard/projets">Tous les projets</Link>
            </Bouton>
          }
        />
        {actifs.length === 0 ? (
          <Vide
            titre="Aucun projet actif"
            description="Creez votre premiere operation pour voir apparaitre les indicateurs de pilotage."
            action={
              <Bouton asChild variant="chantier" taille="sm">
                <Link href="/dashboard/projets/nouveau">Creer un projet</Link>
              </Bouton>
            }
          />
        ) : (
          <Tableau>
            <EnteteTableau>
              <tr>
                <Th>Projet</Th>
                <Th>Statut</Th>
                <Th>Avancement</Th>
                <Th numerique>Montant HT</Th>
                <Th numerique>Budget</Th>
                <Th numerique>Engage</Th>
                <Th numerique>Atterrissage</Th>
                <Th numerique>Marge</Th>
                <Th numerique>Fin prevue</Th>
              </tr>
            </EnteteTableau>
            <tbody>
              {actifs.slice(0, 12).map((p) => (
                <Tr key={p.id}>
                  <Td>
                    <Link href={`/dashboard/projets/${p.id}`} className="block min-w-48">
                      <span className="block truncate text-sm font-medium text-ardoise-900">
                        {p.nom}
                      </span>
                      <span className="block truncate text-[11px] tabulaire text-ardoise-400">
                        {p.reference}
                        {p.ville ? ` · ${p.ville}` : ""}
                        {p.client ? ` · ${p.client}` : ""}
                      </span>
                    </Link>
                  </Td>
                  <Td>
                    <StatutProjet statut={p.statut} />
                  </Td>
                  <Td>
                    <div className="w-24">
                      <Jauge
                        valeur={p.avancementPhysique}
                        ton={p.avancementPhysique >= 100 ? "succes" : "chantier"}
                      />
                      <span className="mt-1 block text-[10px] tabulaire text-ardoise-500">
                        {pourcent(p.avancementPhysique, 0)}
                      </span>
                    </div>
                  </Td>
                  <Td numerique className="text-sm">{euros(p.montantHT)}</Td>
                  <Td numerique className="text-sm text-ardoise-600">{euros(p.budget)}</Td>
                  <Td numerique className="text-sm text-ardoise-600">{euros(p.engage)}</Td>
                  <Td numerique className="text-sm">
                    <span className={p.enDerive ? "font-medium text-red-600" : ""}>
                      {euros(p.atterrissage)}
                    </span>
                  </Td>
                  <Td numerique>
                    <TauxMarge taux={p.margeTaux} cible={p.margeCible} />
                  </Td>
                  <Td numerique className="text-xs text-ardoise-500">
                    {dateCourte(p.dateFinPrevue)}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Tableau>
        )}
      </Carte>
    </div>
  )
}

import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, CheckCircle2, Pencil, Sparkles, Trophy } from "lucide-react"
import { requireAccess } from "@/lib/session"
import { consultationDetail, sousTraitantsSuggeres } from "@/lib/queries/consultations"
import { phraseRecommandation, POIDS } from "@/lib/metier/comparateur"
import { LIBELLES_UNITE } from "@/lib/metier/referentiel"
import { can } from "@/lib/permissions"
import { StatutBadge } from "@/components/app/indicateurs"
import { GraphiqueOffres } from "@/components/app/graphiques"
import {
  Badge,
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
import {
  ActionsOffre,
  DialogueConsultation,
  DialogueEnvoi,
  DialogueOffre,
  ReponseQuestion,
} from "../formulaires"
import { cn, dateCourte, euros, nombre, pourcent } from "@/lib/utils"

export default async function PageComparateur({
  params,
}: {
  params: Promise<{ id: string; cid: string }>
}) {
  const { id, cid } = await params
  const utilisateur = await requireAccess("consultations", "read")

  const consultation = await consultationDetail(cid, utilisateur.organizationId)
  if (!consultation || consultation.projet.id !== id) notFound()

  const suggeres = await sousTraitantsSuggeres(
    utilisateur.organizationId,
    consultation.lot.categorie,
    consultation.projet.ville
  )

  const modifiable = can(utilisateur.role, "consultations", "update")
  const peutAttribuer = can(utilisateur.role, "marches", "create")
  const { comparaison } = consultation
  const attribue = consultation.statut === "ATTRIBUEE"

  // Les offres peuvent venir d'entreprises consultees ou saisies a la volee.
  const entreprisesPossibles = suggeres.map((s) => ({ id: s.id, raisonSociale: s.raisonSociale }))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/dashboard/projets/${id}/consultations`}
            className="inline-flex items-center gap-1.5 text-xs text-ardoise-500 hover:text-ardoise-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Consultations
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-ardoise-900">{consultation.objet}</h2>
            <StatutBadge statut={consultation.statut} />
          </div>
          <p className="mt-0.5 text-xs text-ardoise-500">
            <span className="tabulaire">{consultation.reference}</span> · Lot{" "}
            {consultation.lot.code} — {consultation.lot.nom}
            {consultation.budgetEstime !== null && (
              <> · Budget estime {euros(consultation.budgetEstime)}</>
            )}
          </p>
        </div>

        {modifiable && !attribue && (
          <div className="flex flex-wrap gap-2">
            <DialogueConsultation
              projectId={id}
              lots={[{ id: consultation.lot.id, code: consultation.lot.code, nom: consultation.lot.nom }]}
              consultation={{
                id: consultation.id,
                lotId: consultation.lot.id,
                objet: consultation.objet,
                descriptif: consultation.descriptif,
                budgetEstime: consultation.budgetEstime,
                delaiSouhaiteJours: consultation.delaiSouhaiteJours,
                dateLimiteReponse: consultation.dateLimiteReponse,
                dateDebutSouhaitee: consultation.dateDebutSouhaitee,
              }}
              declencheur={
                <Bouton variant="contour" taille="sm">
                  <Pencil className="h-3.5 w-3.5" /> Modifier
                </Bouton>
              }
            />
            <DialogueOffre consultationId={cid} entreprises={entreprisesPossibles} />
            <DialogueEnvoi
              consultationId={cid}
              suggeres={suggeres}
              dejaInvites={consultation.invites.map((i) => i.subcontractorId)}
              delaiDefaut={15}
            />
          </div>
        )}
      </div>

      {attribue && consultation.offreRetenue && (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <div className="text-sm text-emerald-900">
            <p className="font-medium">
              Lot attribue a {consultation.offreRetenue.sousTraitant}.
            </p>
            {consultation.marcheExistant && (
              <p className="mt-0.5 text-xs">
                Marche <span className="tabulaire">{consultation.marcheExistant.reference}</span>{" "}
                cree ; le montant est desormais compte dans le cout engage du projet.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ─── Recommandation ─────────────────────────────────────────────── */}
      {comparaison.recommandee && (
        <Carte className="border-chantier-200 bg-chantier-50/50">
          <div className="flex items-start gap-3 px-4 py-3">
            <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-chantier-600" />
            <div>
              <p className="text-sm font-medium text-chantier-900">
                {phraseRecommandation(comparaison)}
              </p>
              <p className="mt-1 text-[11px] text-chantier-700">
                Score pondere : prix {POIDS.prix} % · delai {POIDS.delai} % · qualite {POIDS.qualite} %
                · fiabilite administrative {POIDS.fiabilite} % · historique {POIDS.historique} %
              </p>
            </div>
          </div>
        </Carte>
      )}

      {/* ─── Tableau comparatif ─────────────────────────────────────────── */}
      <Carte>
        <EnteteCarte
          titre="Comparatif des offres"
          description={
            comparaison.offres.length > 1
              ? `Ecart de ${pourcent(comparaison.ecartMinMax)} entre la moins-disante (${euros(comparaison.montantMin)}) et la plus chere (${euros(comparaison.montantMax)})`
              : "Une seule offre recue : la comparaison sera plus fiable avec au moins trois devis."
          }
        />

        {comparaison.offres.length === 0 ? (
          <Vide
            titre="Aucune offre recue"
            description={
              consultation.invites.length > 0
                ? `${consultation.invites.length} entreprise(s) consultee(s). Les devis apparaitront ici des leur depot ou leur saisie.`
                : "Envoyez la consultation a des entreprises pour recevoir des devis."
            }
            action={
              modifiable ? (
                <DialogueOffre consultationId={cid} entreprises={entreprisesPossibles} />
              ) : undefined
            }
          />
        ) : (
          <>
            <Tableau>
              <EnteteTableau>
                <tr>
                  <Th>Rang</Th>
                  <Th>Entreprise</Th>
                  <Th numerique>Montant HT</Th>
                  <Th numerique>Ecart budget</Th>
                  <Th numerique>Delai</Th>
                  <Th numerique>Prix</Th>
                  <Th numerique>Delai</Th>
                  <Th numerique>Qualite</Th>
                  <Th numerique>Fiabilite</Th>
                  <Th numerique>Historique</Th>
                  <Th numerique>Score</Th>
                  <Th>Statut</Th>
                  {peutAttribuer && <Th />}
                </tr>
              </EnteteTableau>
              <tbody>
                {comparaison.offres.map((o) => (
                  <Tr key={o.id} className={o.statut === "RETENUE" ? "bg-emerald-50/60" : undefined}>
                    <Td>
                      <span
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded text-[11px] font-semibold",
                          o.rang === 1
                            ? "bg-chantier-500 text-white"
                            : "bg-ardoise-100 text-ardoise-600"
                        )}
                      >
                        {o.rang}
                      </span>
                    </Td>
                    <Td>
                      <Link
                        href={`/dashboard/sous-traitants/${o.subcontractorId}`}
                        className="block min-w-36 text-sm font-medium text-ardoise-900 hover:underline"
                      >
                        {o.sousTraitant}
                      </Link>
                      {o.moinsDisante && (
                        <Badge ton="info" className="mt-0.5">
                          moins-disante
                        </Badge>
                      )}
                    </Td>
                    <Td numerique className="text-sm font-medium">{euros(o.montantHT)}</Td>
                    <Td numerique>
                      {o.ecartBudget !== null ? (
                        <span
                          className={
                            o.ecartBudget <= 0
                              ? "text-xs tabulaire text-emerald-600"
                              : "text-xs tabulaire text-red-600"
                          }
                        >
                          {o.ecartBudget > 0 ? "+" : ""}
                          {o.ecartBudget.toFixed(1)} %
                        </span>
                      ) : (
                        <span className="text-xs text-ardoise-400">—</span>
                      )}
                    </Td>
                    <Td numerique className="text-xs text-ardoise-600">
                      {o.delaiJours ? `${o.delaiJours} j` : "—"}
                    </Td>
                    <Td numerique><Note valeur={o.scorePrix} /></Td>
                    <Td numerique><Note valeur={o.scoreDelai} /></Td>
                    <Td numerique><Note valeur={o.scoreQualite} /></Td>
                    <Td numerique><Note valeur={o.scoreFiabilite} /></Td>
                    <Td numerique><Note valeur={o.scoreHistorique} /></Td>
                    <Td numerique>
                      <span className="text-sm font-semibold tabulaire text-ardoise-900">
                        {o.score.toFixed(1)}
                      </span>
                      <Jauge
                        valeur={o.score}
                        ton={o.score >= 75 ? "succes" : o.score >= 55 ? "chantier" : "danger"}
                        className="mt-1 w-14"
                      />
                    </Td>
                    <Td>
                      <StatutBadge statut={o.statut} />
                    </Td>
                    {peutAttribuer && (
                      <Td>
                        <ActionsOffre
                          offerId={o.id}
                          statut={o.statut}
                          montant={o.montantHT}
                          sousTraitant={o.sousTraitant}
                          attribue={attribue}
                        />
                      </Td>
                    )}
                  </Tr>
                ))}
              </tbody>
            </Tableau>

            <div className="border-t border-ardoise-200/70 p-4">
              <GraphiqueOffres
                donnees={comparaison.offres.map((o) => ({
                  sousTraitant: o.sousTraitant,
                  montantHT: o.montantHT,
                  retenue: o.statut === "RETENUE",
                }))}
                budget={consultation.budgetEstime}
              />
            </div>
          </>
        )}
      </Carte>

      {/* ─── Signaux et analyses ────────────────────────────────────────── */}
      {comparaison.offres.some((o) => o.signaux.length > 0) && (
        <Carte>
          <EnteteCarte
            titre="Points de vigilance par offre"
            description="Detection automatique des ecarts, exclusions et manquements administratifs"
          />
          <ul className="divide-y divide-ardoise-100">
            {comparaison.offres
              .filter((o) => o.signaux.length > 0)
              .map((o) => (
                <li key={o.id} className="px-4 py-3">
                  <p className="text-sm font-medium text-ardoise-900">{o.sousTraitant}</p>
                  <ul className="mt-1 space-y-0.5">
                    {o.signaux.map((s, i) => (
                      <li
                        key={i}
                        className={cn(
                          "text-xs",
                          s.includes("anormalement") || s.includes("decennale") || s.includes("vigilance")
                            ? "text-red-600"
                            : "text-ardoise-600"
                        )}
                      >
                        • {s}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
          </ul>
        </Carte>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ─── Descriptif consulte ──────────────────────────────────────── */}
        <Carte>
          <EnteteCarte
            titre="Descriptif de la consultation"
            description={`${consultation.lot.postes.length} poste(s) communique(s) aux entreprises`}
          />
          <CorpsCarte className="space-y-3">
            {consultation.descriptif && (
              <p className="whitespace-pre-line text-xs leading-relaxed text-ardoise-600">
                {consultation.descriptif}
              </p>
            )}
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <Info libelle="Delai souhaite" valeur={consultation.delaiSouhaiteJours ? `${consultation.delaiSouhaiteJours} jours` : "—"} />
              <Info libelle="Demarrage" valeur={dateCourte(consultation.dateDebutSouhaitee)} />
              <Info libelle="Envoyee le" valeur={dateCourte(consultation.dateEnvoi)} />
              <Info libelle="Reponse avant" valeur={dateCourte(consultation.dateLimiteReponse)} />
            </dl>
          </CorpsCarte>

          {consultation.lot.postes.length > 0 && (
            <Tableau>
              <EnteteTableau>
                <tr>
                  <Th>Poste</Th>
                  <Th numerique>Unite</Th>
                  <Th numerique>Quantite</Th>
                </tr>
              </EnteteTableau>
              <tbody>
                {consultation.lot.postes.map((p, i) => (
                  <Tr key={i}>
                    <Td className="text-xs">{p.designation}</Td>
                    <Td numerique className="text-xs text-ardoise-500">
                      {LIBELLES_UNITE[p.unite] ?? p.unite}
                    </Td>
                    <Td numerique className="text-xs">
                      {nombre(p.quantite, p.quantite % 1 === 0 ? 0 : 2)}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Tableau>
          )}
        </Carte>

        {/* ─── Entreprises consultees ───────────────────────────────────── */}
        <Carte>
          <EnteteCarte
            titre="Entreprises consultees"
            description={`${consultation.invites.filter((i) => i.aRepondu).length} reponse(s) sur ${consultation.invites.length}`}
          />
          {consultation.invites.length === 0 ? (
            <Vide titre="Aucune entreprise consultee" />
          ) : (
            <ul className="divide-y divide-ardoise-100">
              {consultation.invites.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/sous-traitants/${i.subcontractorId}`}
                      className="block truncate text-sm text-ardoise-900 hover:underline"
                    >
                      {i.raisonSociale}
                    </Link>
                    <p className="truncate text-[11px] text-ardoise-400">
                      {i.email ?? "e-mail non renseigne"} · consultee le {dateCourte(i.dateEnvoi)}
                    </p>
                  </div>
                  <StatutBadge statut={i.aRepondu ? "REPONDU" : i.statut} />
                </li>
              ))}
            </ul>
          )}
        </Carte>
      </div>

      {/* ─── Questions des entreprises ──────────────────────────────────── */}
      {consultation.questions.length > 0 && (
        <Carte>
          <EnteteCarte
            titre="Questions des entreprises"
            description="Les reponses sont communiquees a toutes les entreprises consultees."
          />
          <ul className="divide-y divide-ardoise-100">
            {consultation.questions.map((q) => (
              <li key={q.id} className="px-4 py-3">
                <p className="text-xs text-ardoise-400">
                  {q.auteur} · {dateCourte(q.dateQuestion)}
                </p>
                <p className="mt-0.5 text-sm text-ardoise-900">{q.question}</p>
                {q.reponse ? (
                  <p className="mt-1.5 rounded-md bg-ardoise-50 px-3 py-2 text-xs text-ardoise-700">
                    {q.reponse}
                  </p>
                ) : (
                  modifiable && <ReponseQuestion questionId={q.id} />
                )}
              </li>
            ))}
          </ul>
        </Carte>
      )}

      {/* ─── Analyses IA ────────────────────────────────────────────────── */}
      {comparaison.offres.some((o) => o.id) && <AnalysesOffres consultationId={cid} />}
    </div>
  )
}

async function AnalysesOffres({ consultationId }: { consultationId: string }) {
  const utilisateur = await requireAccess("consultations", "read")
  const { prisma } = await import("@/lib/prisma")

  const offres = await prisma.offer.findMany({
    where: { consultationId, organizationId: utilisateur.organizationId, analyseIa: { not: null } },
    select: { id: true, analyseIa: true, subcontractor: { select: { raisonSociale: true } } },
  })

  if (offres.length === 0) return null

  return (
    <Carte>
      <EnteteCarte
        titre="Analyse des devis"
        description="Produite par l'assistant metier a partir du descriptif et des offres recues"
      />
      <ul className="divide-y divide-ardoise-100">
        {offres.map((o) => (
          <li key={o.id} className="px-4 py-3">
            <p className="flex items-center gap-1.5 text-sm font-medium text-ardoise-900">
              <Sparkles className="h-3.5 w-3.5 text-violet-500" />
              {o.subcontractor.raisonSociale}
            </p>
            <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-ardoise-600">
              {o.analyseIa}
            </p>
          </li>
        ))}
      </ul>
    </Carte>
  )
}

function Note({ valeur }: { valeur: number }) {
  return (
    <span
      className={cn(
        "text-xs tabulaire",
        valeur >= 80 ? "text-emerald-600" : valeur >= 55 ? "text-ardoise-600" : "text-red-600"
      )}
    >
      {valeur.toFixed(0)}
    </span>
  )
}

function Info({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div>
      <dt className="text-ardoise-400">{libelle}</dt>
      <dd className="tabulaire text-ardoise-800">{valeur}</dd>
    </div>
  )
}

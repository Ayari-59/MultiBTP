import type { Metadata } from "next"
import { AlertTriangle } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/session"
import { Kpi, StatutBadge } from "@/components/app/indicateurs"
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
import {
  DialogueDevis,
  DialogueQuestion,
  DialogueSituationPortail,
  ReponseInvitation,
  type MarchePortail,
} from "./formulaires"
import { dateCourte, euros, nb, pourcent } from "@/lib/utils"

export const metadata: Metadata = { title: "Espace entreprise" }

export default async function PagePortail() {
  const utilisateur = await requireSession()

  if (!utilisateur.subcontractorId) {
    return (
      <Carte>
        <Vide
          titre="Compte non rattache"
          description="Votre compte n'est associe a aucune entreprise. Contactez votre donneur d'ordre."
        />
      </Carte>
    )
  }

  const entreprise = await prisma.subcontractor.findFirstOrThrow({
    where: { id: utilisateur.subcontractorId, organizationId: utilisateur.organizationId },
    include: {
      invites: {
        include: {
          consultation: {
            include: {
              project: { select: { nom: true, ville: true } },
              lot: { select: { code: true, nom: true } },
              documents: { where: { visibleSousTraitant: true } },
            },
          },
        },
        orderBy: { dateEnvoi: "desc" },
      },
      offers: {
        include: { consultation: { select: { objet: true } } },
        orderBy: { dateReception: "desc" },
      },
      contracts: {
        include: {
          project: { select: { nom: true, reference: true } },
          lot: { select: { code: true, nom: true } },
          situations: true,
          invoices: true,
        },
        orderBy: { dateSignature: "desc" },
      },
      documents: { orderBy: { createdAt: "desc" } },
    },
  })

  const consultationsOuvertes = entreprise.invites.filter(
    (i) =>
      (i.consultation.statut === "ENVOYEE" || i.consultation.statut === "EN_ANALYSE") &&
      !entreprise.offers.some((o) => o.consultationId === i.consultationId)
  )

  const volume = entreprise.contracts.reduce((s, c) => s + nb(c.montantActualise), 0)
  const facture = entreprise.contracts.reduce(
    (s, c) => s + c.situations.filter((x) => x.statut === "VALIDEE").reduce((t, x) => t + nb(x.montantHT), 0),
    0
  )
  const impayees = entreprise.contracts
    .flatMap((c) => c.invoices)
    .filter((f) => f.statut !== "PAYEE" && f.statut !== "ANNULEE")

  const marchesPortail: MarchePortail[] = entreprise.contracts
    .filter((c) => c.statut === "SIGNE" || c.statut === "EN_COURS")
    .map((c) => {
      const validees = c.situations.filter((s) => s.statut === "VALIDEE")
      return {
        id: c.id,
        reference: c.reference,
        lot: `${c.lot.code} — ${c.lot.nom}`,
        projet: c.project.nom,
        montantInitial: nb(c.montantInitial),
        montantActualise: nb(c.montantActualise),
        tauxRetenueGarantie: nb(c.tauxRetenueGarantie, 5),
        cumulValide: validees.reduce((s, x) => s + nb(x.montantHT), 0),
        avancementPrecedent: Math.max(0, ...validees.map((x) => nb(x.avancementCumule)), 0),
      }
    })

  const documentsManquants =
    !entreprise.assuranceDecennaleValide || !entreprise.attestationVigilanceValide

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ardoise-900">{entreprise.raisonSociale}</h1>
          <p className="text-sm text-ardoise-500">
            {consultationsOuvertes.length} consultation(s) en attente de reponse ·{" "}
            {entreprise.contracts.length} marche(s)
          </p>
        </div>
        <DialogueSituationPortail marches={marchesPortail} />
      </div>

      {documentsManquants && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <div className="text-xs text-red-900">
            <p className="font-medium">Pieces administratives incompletes.</p>
            <p className="mt-0.5">
              {!entreprise.assuranceDecennaleValide && "Assurance decennale manquante. "}
              {!entreprise.attestationVigilanceValide && "Attestation de vigilance URSSAF manquante. "}
              Transmettez ces pieces a votre donneur d&apos;ordre : elles conditionnent la signature
              de vos marches.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        <Kpi compact libelle="Consultations ouvertes" valeur={consultationsOuvertes.length} />
        <Kpi compact libelle="Marches" valeur={entreprise.contracts.length} precision={euros(volume)} />
        <Kpi compact libelle="Deja facture" valeur={euros(facture)} />
        <Kpi
          compact
          libelle="Factures en attente"
          valeur={impayees.length}
          precision={euros(impayees.reduce((s, f) => s + nb(f.montantTTC), 0))}
        />
      </div>

      {/* ─── Consultations ──────────────────────────────────────────────── */}
      <Carte>
        <EnteteCarte
          titre="Consultations recues"
          description="Repondez avant la date limite pour que votre offre soit comparee."
        />
        {entreprise.invites.length === 0 ? (
          <Vide titre="Aucune consultation" />
        ) : (
          <ul className="divide-y divide-ardoise-100">
            {entreprise.invites.map((i) => {
              const c = i.consultation
              const aRepondu = entreprise.offers.some((o) => o.consultationId === c.id)
              const horsDelai =
                c.dateLimiteReponse !== null && c.dateLimiteReponse < new Date() && !aRepondu

              return (
                <li key={i.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-ardoise-900">{c.objet}</span>
                        <StatutBadge statut={aRepondu ? "REPONDU" : i.statut} />
                        {horsDelai && (
                          <span className="text-[10px] font-medium text-red-600">hors delai</span>
                        )}
                      </p>
                      <p className="mt-0.5 text-[11px] text-ardoise-500">
                        {c.project.nom}
                        {c.project.ville ? ` · ${c.project.ville}` : ""} · lot {c.lot.code}{" "}
                        {c.lot.nom}
                        {c.delaiSouhaiteJours ? ` · delai souhaite ${c.delaiSouhaiteJours} j` : ""}
                        {c.dateLimiteReponse
                          ? ` · reponse avant le ${dateCourte(c.dateLimiteReponse)}`
                          : ""}
                      </p>
                      {c.descriptif && (
                        <p className="mt-1.5 max-w-3xl text-xs leading-relaxed text-ardoise-600">
                          {c.descriptif}
                        </p>
                      )}
                      {c.documents.length > 0 && (
                        <p className="mt-1.5 flex flex-wrap gap-2">
                          {c.documents.map((d) => (
                            <a
                              key={d.id}
                              href={d.url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded border border-ardoise-200 px-2 py-0.5 text-[11px] text-ardoise-700 hover:bg-ardoise-50"
                            >
                              {d.nom}
                            </a>
                          ))}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-1.5">
                      {!aRepondu && (
                        <>
                          <ReponseInvitation consultationId={c.id} statut={i.statut} />
                          <DialogueQuestion consultationId={c.id} />
                          <DialogueDevis consultationId={c.id} objet={c.objet} />
                        </>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Carte>

      {/* ─── Marches ────────────────────────────────────────────────────── */}
      <Carte>
        <EnteteCarte titre="Mes marches" />
        {entreprise.contracts.length === 0 ? (
          <Vide titre="Aucun marche" />
        ) : (
          <Tableau>
            <EnteteTableau>
              <tr>
                <Th>Reference</Th>
                <Th>Chantier</Th>
                <Th>Lot</Th>
                <Th numerique>Montant</Th>
                <Th numerique>Facture</Th>
                <Th numerique>Reste</Th>
                <Th>Avancement facture</Th>
                <Th>Statut</Th>
              </tr>
            </EnteteTableau>
            <tbody>
              {entreprise.contracts.map((c) => {
                const factureMarche = c.situations
                  .filter((s) => s.statut === "VALIDEE")
                  .reduce((s, x) => s + nb(x.montantHT), 0)
                const montant = nb(c.montantActualise)
                const taux = montant > 0 ? (factureMarche / montant) * 100 : 0
                return (
                  <Tr key={c.id}>
                    <Td className="text-xs tabulaire text-ardoise-700">{c.reference}</Td>
                    <Td className="max-w-40 truncate text-sm">{c.project.nom}</Td>
                    <Td className="text-xs text-ardoise-500">
                      {c.lot.code} — {c.lot.nom}
                    </Td>
                    <Td numerique className="text-sm font-medium">{euros(montant)}</Td>
                    <Td numerique className="text-sm">{euros(factureMarche)}</Td>
                    <Td numerique className="text-sm text-ardoise-600">
                      {euros(montant - factureMarche)}
                    </Td>
                    <Td>
                      <div className="w-24">
                        <Jauge valeur={taux} ton={taux >= 100 ? "succes" : "ardoise"} />
                        <span className="mt-1 block text-[10px] tabulaire text-ardoise-500">
                          {pourcent(taux, 0)}
                        </span>
                      </div>
                    </Td>
                    <Td>
                      <StatutBadge statut={c.statut} />
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
          </Tableau>
        )}
      </Carte>

      {/* ─── Situations ─────────────────────────────────────────────────── */}
      <Carte>
        <EnteteCarte titre="Mes situations et factures" />
        {entreprise.contracts.every((c) => c.situations.length === 0) ? (
          <Vide titre="Aucune situation deposee" />
        ) : (
          <Tableau>
            <EnteteTableau>
              <tr>
                <Th>Marche</Th>
                <Th numerique>N°</Th>
                <Th>Periode</Th>
                <Th numerique>Avancement</Th>
                <Th numerique>Montant</Th>
                <Th numerique>Retenue</Th>
                <Th numerique>Net a payer</Th>
                <Th>Statut</Th>
                <Th numerique>Depot</Th>
              </tr>
            </EnteteTableau>
            <tbody>
              {entreprise.contracts.flatMap((c) =>
                c.situations.map((s) => (
                  <Tr key={s.id}>
                    <Td className="text-xs tabulaire text-ardoise-600">{c.reference}</Td>
                    <Td numerique className="text-xs">{s.numero}</Td>
                    <Td className="text-xs">{s.periode}</Td>
                    <Td numerique className="text-xs">{nb(s.avancementCumule).toFixed(1)} %</Td>
                    <Td numerique className="text-sm font-medium">{euros(nb(s.montantHT))}</Td>
                    <Td numerique className="text-xs text-ardoise-500">
                      − {euros(nb(s.retenueGarantie))}
                    </Td>
                    <Td numerique className="text-sm">{euros(nb(s.netAPayer))}</Td>
                    <Td>
                      <StatutBadge statut={s.statut} />
                    </Td>
                    <Td numerique className="text-xs text-ardoise-500">
                      {dateCourte(s.dateDepot)}
                    </Td>
                  </Tr>
                ))
              )}
            </tbody>
          </Tableau>
        )}
      </Carte>

      {/* ─── Mes offres ─────────────────────────────────────────────────── */}
      {entreprise.offers.length > 0 && (
        <Carte>
          <EnteteCarte titre="Mes offres deposees" />
          <Tableau>
            <EnteteTableau>
              <tr>
                <Th>Consultation</Th>
                <Th numerique>Montant HT</Th>
                <Th numerique>Delai</Th>
                <Th>Statut</Th>
                <Th numerique>Deposee</Th>
              </tr>
            </EnteteTableau>
            <tbody>
              {entreprise.offers.map((o) => (
                <Tr key={o.id}>
                  <Td className="max-w-56 truncate text-sm">{o.consultation.objet}</Td>
                  <Td numerique className="text-sm font-medium">{euros(nb(o.montantHT))}</Td>
                  <Td numerique className="text-xs text-ardoise-500">
                    {o.delaiJours ? `${o.delaiJours} j` : "—"}
                  </Td>
                  <Td>
                    <StatutBadge statut={o.statut} />
                  </Td>
                  <Td numerique className="text-xs text-ardoise-500">
                    {dateCourte(o.dateReception)}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Tableau>
        </Carte>
      )}

      {/* ─── Pieces administratives ─────────────────────────────────────── */}
      <Carte>
        <EnteteCarte
          titre="Mes pieces administratives"
          description="Transmettez vos attestations a votre donneur d'ordre pour les mettre a jour."
        />
        {entreprise.documents.length === 0 ? (
          <Vide titre="Aucune piece enregistree" />
        ) : (
          <CorpsCarte>
            <ul className="space-y-1.5">
              {entreprise.documents.map((d) => {
                const expiree = d.dateExpiration !== null && d.dateExpiration < new Date()
                return (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-ardoise-200 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-sm text-ardoise-900 hover:underline"
                      >
                        {d.nom}
                      </a>
                      <p className="text-[11px] text-ardoise-400">
                        {d.dateExpiration ? `expire le ${dateCourte(d.dateExpiration)}` : "sans echeance"}
                      </p>
                    </div>
                    <StatutBadge statut={expiree ? "REJETEE" : "VALIDEE"} libelle={expiree ? "expiree" : "valide"} />
                  </li>
                )
              })}
            </ul>
          </CorpsCarte>
        )}
      </Carte>
    </div>
  )
}

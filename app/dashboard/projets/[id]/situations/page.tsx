import { prisma } from "@/lib/prisma"
import { requireAccess } from "@/lib/session"
import { can } from "@/lib/permissions"
import { Kpi, StatutBadge } from "@/components/app/indicateurs"
import {
  Carte,
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
  BoutonSupprimerFacture,
  BoutonSupprimerSituation,
  DecisionSituation,
  DialogueFacture,
  DialogueSituation,
  SelecteurStatutFacture,
  type MarchePourSituation,
} from "./formulaires"
import { dateCourte, euros, nb, pourcent } from "@/lib/utils"

export default async function PageSituations({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const utilisateur = await requireAccess("situations", "read")

  const [marches, situations, factures] = await Promise.all([
    prisma.contract.findMany({
      where: { projectId: id, organizationId: utilisateur.organizationId },
      include: {
        subcontractor: { select: { raisonSociale: true } },
        lot: { select: { code: true, nom: true } },
        situations: { select: { montantHT: true, avancementCumule: true, statut: true } },
      },
      orderBy: { reference: "asc" },
    }),
    prisma.situation.findMany({
      where: { projectId: id },
      include: {
        contract: {
          select: { reference: true, subcontractor: { select: { raisonSociale: true } } },
        },
      },
      orderBy: [{ dateDepot: "desc" }],
    }),
    prisma.invoice.findMany({
      where: { projectId: id },
      include: { contract: { select: { reference: true } } },
      orderBy: { dateEmission: "desc" },
    }),
  ])

  const modifiable = can(utilisateur.role, "situations", "update")

  const marchesPourSituation: MarchePourSituation[] = marches.map((m) => {
    const validees = m.situations.filter((s) => s.statut === "VALIDEE")
    return {
      id: m.id,
      reference: m.reference,
      sousTraitant: m.subcontractor.raisonSociale,
      lot: `${m.lot.code} — ${m.lot.nom}`,
      montantInitial: nb(m.montantInitial),
      montantActualise: nb(m.montantActualise),
      tauxRetenueGarantie: nb(m.tauxRetenueGarantie, 5),
      cumulValide: validees.reduce((s, x) => s + nb(x.montantHT), 0),
      avancementPrecedent: Math.max(0, ...validees.map((x) => nb(x.avancementCumule)), 0),
    }
  })

  const totalMarches = marchesPourSituation.reduce((s, m) => s + m.montantActualise, 0)
  const totalFacture = marchesPourSituation.reduce((s, m) => s + m.cumulValide, 0)
  const aValider = situations.filter((s) => s.statut === "DEPOSEE" || s.statut === "EN_VERIFICATION")
  const facturesAPayer = factures.filter(
    (f) => f.sens === "FOURNISSEUR" && (f.statut === "A_VALIDER" || f.statut === "VALIDEE")
  )
  const retenuesGaranties = situations
    .filter((s) => s.statut === "VALIDEE")
    .reduce((s, x) => s + nb(x.retenueGarantie), 0)

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        <Kpi compact libelle="Marches actualises" valeur={euros(totalMarches)} precision={`${marches.length} marche(s)`} />
        <Kpi
          compact
          libelle="Deja facture"
          valeur={euros(totalFacture)}
          precision={`${pourcent(totalMarches > 0 ? (totalFacture / totalMarches) * 100 : 0, 0)} des marches`}
        />
        <Kpi compact libelle="Reste a facturer" valeur={euros(totalMarches - totalFacture)} />
        <Kpi
          compact
          libelle="Retenues de garantie"
          valeur={euros(retenuesGaranties)}
          precision="Liberees a la levee des reserves"
        />
      </div>

      {/* ─── Etat des marches ───────────────────────────────────────────── */}
      <Carte>
        <EnteteCarte
          titre="Etat de facturation des marches"
          action={
            modifiable ? (
              <div className="flex gap-2">
                <DialogueSituation marches={marchesPourSituation} />
                <DialogueFacture
                  projectId={id}
                  marches={marches.map((m) => ({
                    id: m.id,
                    reference: m.reference,
                    sousTraitant: m.subcontractor.raisonSociale,
                  }))}
                />
              </div>
            ) : undefined
          }
        />
        {marches.length === 0 ? (
          <Vide
            titre="Aucun marche"
            description="Attribuez d'abord une consultation pour creer un marche."
          />
        ) : (
          <Tableau>
            <EnteteTableau>
              <tr>
                <Th>Marche</Th>
                <Th>Entreprise</Th>
                <Th numerique>Marche initial</Th>
                <Th numerique>Avenants</Th>
                <Th numerique>Marche actualise</Th>
                <Th numerique>Deja facture</Th>
                <Th numerique>Reste a facturer</Th>
                <Th>Avancement facture</Th>
              </tr>
            </EnteteTableau>
            <tbody>
              {marchesPourSituation.map((m) => {
                const avenants = m.montantActualise - m.montantInitial
                const taux = m.montantActualise > 0 ? (m.cumulValide / m.montantActualise) * 100 : 0
                return (
                  <Tr key={m.id}>
                    <Td>
                      <span className="block text-xs font-medium tabulaire text-ardoise-700">
                        {m.reference}
                      </span>
                      <span className="block truncate text-[10px] text-ardoise-400">{m.lot}</span>
                    </Td>
                    <Td className="max-w-40 truncate text-sm">{m.sousTraitant}</Td>
                    <Td numerique className="text-sm text-ardoise-600">{euros(m.montantInitial)}</Td>
                    <Td numerique className="text-xs">
                      {avenants !== 0 ? (
                        <span className="text-chantier-600">+{euros(avenants)}</span>
                      ) : (
                        <span className="text-ardoise-400">—</span>
                      )}
                    </Td>
                    <Td numerique className="text-sm font-medium">{euros(m.montantActualise)}</Td>
                    <Td numerique className="text-sm">{euros(m.cumulValide)}</Td>
                    <Td numerique className="text-sm text-ardoise-600">
                      {euros(m.montantActualise - m.cumulValide)}
                    </Td>
                    <Td>
                      <div className="w-24">
                        <Jauge valeur={taux} ton={taux >= 100 ? "succes" : "ardoise"} />
                        <span className="mt-1 block text-[10px] tabulaire text-ardoise-500">
                          {pourcent(taux, 0)}
                        </span>
                      </div>
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
        <EnteteCarte
          titre="Situations de travaux"
          description={`${situations.length} situation(s) · ${aValider.length} a traiter`}
        />
        {situations.length === 0 ? (
          <Vide titre="Aucune situation" />
        ) : (
          <Tableau>
            <EnteteTableau>
              <tr>
                <Th>N°</Th>
                <Th>Marche</Th>
                <Th>Periode</Th>
                <Th numerique>Avancement</Th>
                <Th numerique>Cumul precedent</Th>
                <Th numerique>Situation</Th>
                <Th numerique>Retenue</Th>
                <Th numerique>Net a payer</Th>
                <Th>Statut</Th>
                <Th numerique>Depot</Th>
                {modifiable && <Th />}
              </tr>
            </EnteteTableau>
            <tbody>
              {situations.map((s) => (
                <Tr key={s.id}>
                  <Td className="text-xs tabulaire text-ardoise-600">{s.numero}</Td>
                  <Td>
                    <span className="block text-xs tabulaire text-ardoise-700">
                      {s.contract.reference}
                    </span>
                    <span className="block max-w-32 truncate text-[10px] text-ardoise-400">
                      {s.contract.subcontractor.raisonSociale}
                    </span>
                  </Td>
                  <Td className="text-xs">{s.periode}</Td>
                  <Td numerique className="text-xs">{pourcent(nb(s.avancementCumule), 1)}</Td>
                  <Td numerique className="text-xs text-ardoise-500">{euros(nb(s.cumulPrecedent))}</Td>
                  <Td numerique className="text-sm font-medium">{euros(nb(s.montantHT))}</Td>
                  <Td numerique className="text-xs text-ardoise-500">
                    − {euros(nb(s.retenueGarantie))}
                  </Td>
                  <Td numerique className="text-sm">{euros(nb(s.netAPayer))}</Td>
                  <Td>
                    <StatutBadge statut={s.statut} />
                  </Td>
                  <Td numerique className="text-xs text-ardoise-500">{dateCourte(s.dateDepot)}</Td>
                  {modifiable && (
                    <Td>
                      <div className="flex items-center justify-end gap-1">
                        <DecisionSituation situationId={s.id} statut={s.statut} />
                        <BoutonSupprimerSituation situationId={s.id} />
                      </div>
                    </Td>
                  )}
                </Tr>
              ))}
            </tbody>
          </Tableau>
        )}
      </Carte>

      {/* ─── Factures ───────────────────────────────────────────────────── */}
      <Carte>
        <EnteteCarte
          titre="Factures"
          description={`${factures.length} facture(s) · ${facturesAPayer.length} en attente de paiement`}
        />
        {factures.length === 0 ? (
          <Vide titre="Aucune facture" />
        ) : (
          <Tableau>
            <EnteteTableau>
              <tr>
                <Th>Numero</Th>
                <Th>Emetteur</Th>
                <Th>Sens</Th>
                <Th>Marche</Th>
                <Th numerique>Montant HT</Th>
                <Th numerique>TTC</Th>
                <Th numerique>Emission</Th>
                <Th numerique>Echeance</Th>
                <Th>Statut</Th>
                {modifiable && <Th />}
              </tr>
            </EnteteTableau>
            <tbody>
              {factures.map((f) => {
                const enRetard =
                  f.dateEcheance !== null &&
                  f.dateEcheance < new Date() &&
                  f.statut !== "PAYEE" &&
                  f.statut !== "ANNULEE"
                return (
                  <Tr key={f.id}>
                    <Td className="text-xs font-medium tabulaire text-ardoise-700">{f.numero}</Td>
                    <Td className="max-w-40 truncate text-sm">{f.emetteur}</Td>
                    <Td className="text-xs text-ardoise-500">
                      {f.sens === "FOURNISSEUR" ? "Fournisseur" : "Client"}
                    </Td>
                    <Td className="text-xs tabulaire text-ardoise-500">
                      {f.contract?.reference ?? "—"}
                    </Td>
                    <Td numerique className="text-sm font-medium">{euros(nb(f.montantHT))}</Td>
                    <Td numerique className="text-xs text-ardoise-500">{euros(nb(f.montantTTC))}</Td>
                    <Td numerique className="text-xs text-ardoise-500">
                      {dateCourte(f.dateEmission)}
                    </Td>
                    <Td numerique className="text-xs">
                      <span className={enRetard ? "font-medium text-red-600" : "text-ardoise-500"}>
                        {dateCourte(f.dateEcheance)}
                      </span>
                    </Td>
                    <Td>
                      {modifiable ? (
                        <SelecteurStatutFacture invoiceId={f.id} statut={f.statut} />
                      ) : (
                        <StatutBadge statut={f.statut} />
                      )}
                    </Td>
                    {modifiable && (
                      <Td>
                        <div className="flex justify-end">
                          <BoutonSupprimerFacture invoiceId={f.id} />
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

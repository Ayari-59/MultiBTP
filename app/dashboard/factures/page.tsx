import type { Metadata } from "next"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { requireAccess } from "@/lib/session"
import { can } from "@/lib/permissions"
import { Kpi, StatutBadge } from "@/components/app/indicateurs"
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
import { SelecteurStatutFacture } from "../projets/[id]/situations/formulaires"
import { DecisionSituation } from "../projets/[id]/situations/formulaires"
import { dateCourte, euros, nb } from "@/lib/utils"

export const metadata: Metadata = { title: "Factures & situations" }

export default async function PageFactures() {
  const utilisateur = await requireAccess("situations", "read")

  const [factures, situations] = await Promise.all([
    prisma.invoice.findMany({
      where: { project: { organizationId: utilisateur.organizationId } },
      include: {
        project: { select: { id: true, nom: true, reference: true } },
        contract: { select: { reference: true } },
      },
      orderBy: [{ statut: "asc" }, { dateEcheance: "asc" }],
      take: 200,
    }),
    prisma.situation.findMany({
      where: {
        project: { organizationId: utilisateur.organizationId },
        statut: { in: ["DEPOSEE", "EN_VERIFICATION"] },
      },
      include: {
        project: { select: { id: true, nom: true } },
        contract: {
          select: { reference: true, subcontractor: { select: { raisonSociale: true } } },
        },
      },
      orderBy: { dateDepot: "asc" },
    }),
  ])

  const modifiable = can(utilisateur.role, "situations", "update")
  const maintenant = new Date()

  const aValider = factures.filter((f) => f.statut === "A_VALIDER")
  const aPayer = factures.filter((f) => f.statut === "VALIDEE")
  const enRetard = factures.filter(
    (f) =>
      f.dateEcheance !== null &&
      f.dateEcheance < maintenant &&
      f.statut !== "PAYEE" &&
      f.statut !== "ANNULEE"
  )
  const clientAEncaisser = factures.filter(
    (f) => f.sens === "CLIENT" && f.statut !== "PAYEE" && f.statut !== "ANNULEE"
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-ardoise-900">Factures & situations</h1>
        <p className="text-sm text-ardoise-500">
          {factures.length} facture(s) · {situations.length} situation(s) a traiter
        </p>
      </div>

      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        <Kpi
          compact
          libelle="A valider"
          valeur={aValider.length}
          precision={euros(aValider.reduce((s, f) => s + nb(f.montantHT), 0))}
          ton={aValider.length > 0 ? "attention" : "neutre"}
        />
        <Kpi
          compact
          libelle="A payer"
          valeur={aPayer.length}
          precision={euros(aPayer.reduce((s, f) => s + nb(f.montantTTC), 0))}
        />
        <Kpi
          compact
          libelle="En retard de paiement"
          valeur={enRetard.length}
          precision={euros(enRetard.reduce((s, f) => s + nb(f.montantTTC), 0))}
          ton={enRetard.length > 0 ? "negatif" : "positif"}
        />
        <Kpi
          compact
          libelle="A encaisser (client)"
          valeur={euros(clientAEncaisser.reduce((s, f) => s + nb(f.montantTTC), 0))}
          precision={`${clientAEncaisser.length} facture(s)`}
        />
      </div>

      {situations.length > 0 && (
        <Carte>
          <EnteteCarte
            titre="Situations en attente de validation"
            description="La validation genere automatiquement la facture fournisseur."
          />
          <Tableau>
            <EnteteTableau>
              <tr>
                <Th>Projet</Th>
                <Th>Marche</Th>
                <Th>Entreprise</Th>
                <Th>Periode</Th>
                <Th numerique>Avancement</Th>
                <Th numerique>Montant</Th>
                <Th numerique>Net a payer</Th>
                <Th numerique>Depot</Th>
                {modifiable && <Th />}
              </tr>
            </EnteteTableau>
            <tbody>
              {situations.map((s) => (
                <Tr key={s.id}>
                  <Td>
                    <Link
                      href={`/dashboard/projets/${s.project.id}/situations`}
                      className="block max-w-40 truncate text-sm hover:underline"
                    >
                      {s.project.nom}
                    </Link>
                  </Td>
                  <Td className="text-xs tabulaire text-ardoise-600">{s.contract.reference}</Td>
                  <Td className="max-w-36 truncate text-xs">
                    {s.contract.subcontractor.raisonSociale}
                  </Td>
                  <Td className="text-xs">{s.periode}</Td>
                  <Td numerique className="text-xs">{nb(s.avancementCumule).toFixed(1)} %</Td>
                  <Td numerique className="text-sm font-medium">{euros(nb(s.montantHT))}</Td>
                  <Td numerique className="text-sm">{euros(nb(s.netAPayer))}</Td>
                  <Td numerique className="text-xs text-ardoise-500">{dateCourte(s.dateDepot)}</Td>
                  {modifiable && (
                    <Td>
                      <div className="flex justify-end">
                        <DecisionSituation situationId={s.id} statut={s.statut} />
                      </div>
                    </Td>
                  )}
                </Tr>
              ))}
            </tbody>
          </Tableau>
        </Carte>
      )}

      <Carte>
        <EnteteCarte titre="Factures" />
        {factures.length === 0 ? (
          <Vide
            titre="Aucune facture"
            description="Les factures fournisseurs naissent de la validation des situations."
          />
        ) : (
          <Tableau>
            <EnteteTableau>
              <tr>
                <Th>Numero</Th>
                <Th>Projet</Th>
                <Th>Emetteur</Th>
                <Th>Sens</Th>
                <Th numerique>Montant HT</Th>
                <Th numerique>TTC</Th>
                <Th numerique>Emission</Th>
                <Th numerique>Echeance</Th>
                <Th>Statut</Th>
              </tr>
            </EnteteTableau>
            <tbody>
              {factures.map((f) => {
                const retard =
                  f.dateEcheance !== null &&
                  f.dateEcheance < maintenant &&
                  f.statut !== "PAYEE" &&
                  f.statut !== "ANNULEE"
                return (
                  <Tr key={f.id}>
                    <Td className="text-xs font-medium tabulaire text-ardoise-700">{f.numero}</Td>
                    <Td>
                      <Link
                        href={`/dashboard/projets/${f.project.id}/situations`}
                        className="block max-w-40 truncate text-sm hover:underline"
                      >
                        {f.project.nom}
                      </Link>
                    </Td>
                    <Td className="max-w-40 truncate text-xs">{f.emetteur}</Td>
                    <Td className="text-xs text-ardoise-500">
                      {f.sens === "FOURNISSEUR" ? "Fournisseur" : "Client"}
                    </Td>
                    <Td numerique className="text-sm font-medium">{euros(nb(f.montantHT))}</Td>
                    <Td numerique className="text-xs text-ardoise-500">{euros(nb(f.montantTTC))}</Td>
                    <Td numerique className="text-xs text-ardoise-500">
                      {dateCourte(f.dateEmission)}
                    </Td>
                    <Td numerique className="text-xs">
                      <span className={retard ? "font-medium text-red-600" : "text-ardoise-500"}>
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

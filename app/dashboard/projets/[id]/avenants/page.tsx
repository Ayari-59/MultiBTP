import { prisma } from "@/lib/prisma"
import { requireAccess } from "@/lib/session"
import { can } from "@/lib/permissions"
import { Kpi, Montant, StatutBadge } from "@/components/app/indicateurs"
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
import { BoutonSupprimerAvenant, DecisionAvenant, DialogueAvenant } from "./formulaires"
import { dateCourte, euros, libelleEnum, nb } from "@/lib/utils"

export default async function PageAvenants({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const utilisateur = await requireAccess("budget", "read")

  const [avenants, lots, marches] = await Promise.all([
    prisma.changeOrder.findMany({
      where: { projectId: id, project: { organizationId: utilisateur.organizationId } },
      include: {
        lot: { select: { code: true, nom: true } },
        contract: { select: { reference: true, subcontractor: { select: { raisonSociale: true } } } },
      },
      orderBy: { dateDemande: "desc" },
    }),
    prisma.lot.findMany({
      where: { projectId: id },
      select: { id: true, code: true, nom: true },
      orderBy: { ordre: "asc" },
    }),
    prisma.contract.findMany({
      where: { projectId: id },
      select: {
        id: true,
        reference: true,
        lotId: true,
        subcontractor: { select: { raisonSociale: true } },
      },
    }),
  ])

  const modifiable = can(utilisateur.role, "budget", "create")
  const acceptes = avenants.filter((a) => a.statut === "ACCEPTE")
  const enAttente = avenants.filter((a) => a.statut === "DEMANDE" || a.statut === "CHIFFRE")

  const coutAccepte = acceptes.reduce((s, a) => s + nb(a.impactCout), 0)
  const venteAcceptee = acceptes.reduce((s, a) => s + nb(a.impactVente), 0)
  const delaiAccepte = acceptes.reduce((s, a) => s + a.impactDelaiJours, 0)

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        <Kpi compact libelle="Avenants acceptes" valeur={acceptes.length} precision={`${enAttente.length} en attente`} />
        <Kpi compact libelle="Surcout accepte" valeur={euros(coutAccepte)} ton="negatif" />
        <Kpi compact libelle="Refacture au client" valeur={euros(venteAcceptee)} ton="positif" />
        <Kpi
          compact
          libelle="Solde / delai"
          valeur={euros(venteAcceptee - coutAccepte)}
          precision={`${delaiAccepte > 0 ? "+" : ""}${delaiAccepte} jour(s) sur le planning`}
          ton={venteAcceptee - coutAccepte >= 0 ? "positif" : "negatif"}
        />
      </div>

      <Carte>
        <EnteteCarte
          titre="Avenants"
          description="Chaque acceptation repercute l'impact sur le marche, le budget et la date de fin."
          action={
            modifiable ? (
              <DialogueAvenant
                projectId={id}
                lots={lots}
                marches={marches.map((m) => ({
                  id: m.id,
                  reference: m.reference,
                  lotId: m.lotId,
                  sousTraitant: m.subcontractor.raisonSociale,
                }))}
              />
            ) : undefined
          }
        />

        {avenants.length === 0 ? (
          <Vide
            titre="Aucun avenant"
            description="Les modifications de programme, aleas techniques et demandes client se tracent ici."
            action={
              modifiable ? (
                <DialogueAvenant
                  projectId={id}
                  lots={lots}
                  marches={marches.map((m) => ({
                    id: m.id,
                    reference: m.reference,
                    lotId: m.lotId,
                    sousTraitant: m.subcontractor.raisonSociale,
                  }))}
                />
              ) : undefined
            }
          />
        ) : (
          <Tableau>
            <EnteteTableau>
              <tr>
                <Th>Reference</Th>
                <Th>Motif</Th>
                <Th>Origine</Th>
                <Th>Lot / marche</Th>
                <Th numerique>Impact cout</Th>
                <Th numerique>Refacture</Th>
                <Th numerique>Solde</Th>
                <Th numerique>Delai</Th>
                <Th>Statut</Th>
                <Th numerique>Demande</Th>
                {modifiable && <Th />}
              </tr>
            </EnteteTableau>
            <tbody>
              {avenants.map((a) => {
                const cout = nb(a.impactCout)
                const vente = nb(a.impactVente)
                return (
                  <Tr key={a.id}>
                    <Td className="text-xs font-medium tabulaire text-ardoise-700">{a.reference}</Td>
                    <Td>
                      <span className="block max-w-56 truncate text-sm text-ardoise-900">{a.motif}</span>
                      {a.description && (
                        <span className="block max-w-56 truncate text-[10px] text-ardoise-400">
                          {a.description}
                        </span>
                      )}
                    </Td>
                    <Td className="text-xs text-ardoise-500">{libelleEnum(a.origine)}</Td>
                    <Td className="text-xs text-ardoise-600">
                      {a.lot ? a.lot.code : "—"}
                      {a.contract && (
                        <span className="block text-[10px] text-ardoise-400">
                          {a.contract.subcontractor.raisonSociale}
                        </span>
                      )}
                    </Td>
                    <Td numerique className="text-sm">{euros(cout)}</Td>
                    <Td numerique className="text-sm text-ardoise-600">{euros(vente)}</Td>
                    <Td numerique>
                      <Montant valeur={vente - cout} signe className="text-sm font-medium" />
                    </Td>
                    <Td numerique className="text-xs text-ardoise-600">
                      {a.impactDelaiJours !== 0 ? `${a.impactDelaiJours > 0 ? "+" : ""}${a.impactDelaiJours} j` : "—"}
                    </Td>
                    <Td>
                      <StatutBadge statut={a.statut} />
                    </Td>
                    <Td numerique className="text-xs text-ardoise-500">
                      {dateCourte(a.dateDemande)}
                    </Td>
                    {modifiable && (
                      <Td>
                        <div className="flex items-center justify-end gap-1">
                          <DecisionAvenant
                            avenantId={a.id}
                            statut={a.statut}
                            impactCout={cout}
                            impactVente={vente}
                          />
                          <BoutonSupprimerAvenant avenantId={a.id} />
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

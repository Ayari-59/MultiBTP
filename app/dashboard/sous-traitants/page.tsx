import type { Metadata } from "next"
import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requireAccess } from "@/lib/session"
import { can } from "@/lib/permissions"
import { LIBELLES_CATEGORIE } from "@/lib/metier/referentiel"
import { Kpi } from "@/components/app/indicateurs"
import {
  Badge,
  Carte,
  EnteteCarte,
  EnteteTableau,
  Tableau,
  Td,
  Th,
  Tr,
  Vide,
} from "@/components/ui/primitives"
import {
  BasculeActivationSt,
  BoutonModifierSousTraitant,
  BoutonSupprimerSt,
  DialogueSousTraitant,
} from "./formulaires"
import { euros, nb } from "@/lib/utils"

export const metadata: Metadata = { title: "Sous-traitants" }

export default async function PageSousTraitants() {
  const utilisateur = await requireAccess("sous_traitants", "read")

  const entreprises = await prisma.subcontractor.findMany({
    where: { organizationId: utilisateur.organizationId },
    include: {
      contracts: { select: { montantActualise: true } },
      _count: { select: { offers: true, contracts: true, documents: true } },
    },
    orderBy: [{ actif: "desc" }, { notation: "desc" }],
  })

  const modifiable = can(utilisateur.role, "sous_traitants", "update")
  const actives = entreprises.filter((e) => e.actif)
  const nonConformes = entreprises.filter(
    (e) => e.actif && (!e.assuranceDecennaleValide || !e.attestationVigilanceValide)
  )
  const volumeTotal = entreprises.reduce(
    (s, e) => s + e.contracts.reduce((t, c) => t + nb(c.montantActualise), 0),
    0
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ardoise-900">Sous-traitants</h1>
          <p className="text-sm text-ardoise-500">
            {actives.length} entreprise(s) active(s) sur {entreprises.length}
          </p>
        </div>
        {modifiable && <DialogueSousTraitant />}
      </div>

      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        <Kpi compact libelle="Entreprises actives" valeur={actives.length} />
        <Kpi
          compact
          libelle="Documents non a jour"
          valeur={nonConformes.length}
          precision="Assurance ou vigilance manquante"
          ton={nonConformes.length > 0 ? "negatif" : "positif"}
        />
        <Kpi compact libelle="Volume confie" valeur={euros(volumeTotal)} />
        <Kpi
          compact
          libelle="Marches en cours"
          valeur={entreprises.reduce((s, e) => s + e._count.contracts, 0)}
        />
      </div>

      {nonConformes.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <div className="text-xs text-red-900">
            <p className="font-medium">
              {nonConformes.length} entreprise(s) sans assurance decennale ou attestation de
              vigilance a jour.
            </p>
            <p className="mt-0.5">
              {nonConformes.map((e) => e.raisonSociale).join(", ")}. La verification est une
              obligation du donneur d&apos;ordre : reclamez les pieces avant toute signature.
            </p>
          </div>
        </div>
      )}

      <Carte>
        <EnteteCarte titre="Annuaire" />
        {entreprises.length === 0 ? (
          <Vide
            titre="Aucune entreprise"
            description="Constituez votre panel d'entreprises pour lancer des consultations."
            action={modifiable ? <DialogueSousTraitant /> : undefined}
          />
        ) : (
          <Tableau>
            <EnteteTableau>
              <tr>
                <Th>Entreprise</Th>
                <Th>Specialites</Th>
                <Th>Zone</Th>
                <Th numerique>Notation</Th>
                <Th numerique>Marches</Th>
                <Th numerique>Volume</Th>
                <Th numerique>Offres</Th>
                <Th>Conformite</Th>
                {modifiable && <Th />}
              </tr>
            </EnteteTableau>
            <tbody>
              {entreprises.map((e) => {
                const volume = e.contracts.reduce((s, c) => s + nb(c.montantActualise), 0)
                const conforme = e.assuranceDecennaleValide && e.attestationVigilanceValide
                return (
                  <Tr key={e.id} className={e.actif ? undefined : "opacity-50"}>
                    <Td>
                      <Link
                        href={`/dashboard/sous-traitants/${e.id}`}
                        className="block max-w-52 truncate text-sm font-medium text-ardoise-900 hover:underline"
                      >
                        {e.raisonSociale}
                      </Link>
                      <span className="block truncate text-[11px] text-ardoise-400">
                        {[e.contactNom, e.telephone, e.ville].filter(Boolean).join(" · ") || "—"}
                      </span>
                    </Td>
                    <Td>
                      <div className="flex max-w-52 flex-wrap gap-1">
                        {e.specialites.slice(0, 3).map((s) => (
                          <Badge key={s}>{LIBELLES_CATEGORIE[s] ?? s}</Badge>
                        ))}
                        {e.specialites.length > 3 && (
                          <Badge>+{e.specialites.length - 3}</Badge>
                        )}
                        {e.specialites.length === 0 && (
                          <span className="text-xs text-ardoise-400">—</span>
                        )}
                      </div>
                    </Td>
                    <Td className="text-xs text-ardoise-500">{e.zoneGeo ?? e.ville ?? "—"}</Td>
                    <Td numerique>
                      <span className="text-sm font-medium tabulaire text-ardoise-900">
                        {nb(e.notation, 3).toFixed(1)}
                      </span>
                      <span className="block text-[10px] text-ardoise-400">
                        {e.nbLitiges > 0 ? `${e.nbLitiges} litige(s)` : "sans litige"}
                      </span>
                    </Td>
                    <Td numerique className="text-xs">{e._count.contracts}</Td>
                    <Td numerique className="text-sm">{euros(volume)}</Td>
                    <Td numerique className="text-xs text-ardoise-500">{e._count.offers}</Td>
                    <Td>
                      {conforme ? (
                        <Badge ton="succes">a jour</Badge>
                      ) : (
                        <Badge ton="danger">incomplet</Badge>
                      )}
                    </Td>
                    {modifiable && (
                      <Td>
                        <div className="flex items-center justify-end gap-0.5">
                          <BasculeActivationSt id={e.id} actif={e.actif} />
                          <BoutonModifierSousTraitant
                            sousTraitant={{
                              id: e.id,
                              raisonSociale: e.raisonSociale,
                              siret: e.siret,
                              formeJuridique: e.formeJuridique,
                              contactNom: e.contactNom,
                              email: e.email,
                              telephone: e.telephone,
                              adresse: e.adresse,
                              codePostal: e.codePostal,
                              ville: e.ville,
                              zoneGeo: e.zoneGeo,
                              effectif: e.effectif,
                              caAnnuel: e.caAnnuel ? nb(e.caAnnuel) : null,
                              noteQualite: nb(e.noteQualite, 3),
                              noteDelai: nb(e.noteDelai, 3),
                              noteRelation: nb(e.noteRelation, 3),
                              nbLitiges: e.nbLitiges,
                              notes: e.notes,
                              specialites: e.specialites,
                              assuranceRcValide: e.assuranceRcValide,
                              assuranceDecennaleValide: e.assuranceDecennaleValide,
                              attestationVigilanceValide: e.attestationVigilanceValide,
                              dateValiditeDocuments:
                                e.dateValiditeDocuments?.toISOString() ?? null,
                            }}
                          />
                          <BoutonSupprimerSt id={e.id} />
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

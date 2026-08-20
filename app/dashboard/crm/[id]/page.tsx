import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Mail, MapPin, Phone } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requireAccess } from "@/lib/session"
import { can } from "@/lib/permissions"
import { LIBELLES_STAGE } from "@/lib/metier/referentiel"
import { StatutProjet, StatutBadge } from "@/components/app/indicateurs"
import {
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
import { BoutonModifierContact, DialogueAffaire, FormulaireInteraction } from "../formulaires"
import { dateCourte, euros, libelleEnum, nb } from "@/lib/utils"

export default async function PageContact({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const utilisateur = await requireAccess("crm", "read")

  const contact = await prisma.contact.findFirst({
    where: { id, organizationId: utilisateur.organizationId },
    include: {
      deals: { orderBy: { updatedAt: "desc" } },
      projects: { orderBy: { updatedAt: "desc" } },
      properties: true,
      interactions: { orderBy: { date: "desc" }, take: 30 },
    },
  })
  if (!contact) notFound()

  const modifiable = can(utilisateur.role, "crm", "update")
  const nomComplet = `${contact.prenom ?? ""} ${contact.nom}`.trim()

  const factures = contact.projects.length
    ? await prisma.invoice.findMany({
        where: { projectId: { in: contact.projects.map((p) => p.id) }, sens: "CLIENT" },
        orderBy: { dateEmission: "desc" },
      })
    : []

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/dashboard/crm"
          className="inline-flex items-center gap-1.5 text-xs text-ardoise-500 hover:text-ardoise-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Clients & pipeline
        </Link>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold text-ardoise-900">{nomComplet}</h1>
              <StatutBadge statut={contact.type} libelle={libelleEnum(contact.type)} />
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ardoise-500">
              {contact.societe && <span className="font-medium text-ardoise-700">{contact.societe}</span>}
              {contact.email && (
                <span className="inline-flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {contact.email}
                </span>
              )}
              {contact.telephone && (
                <span className="inline-flex items-center gap-1 tabulaire">
                  <Phone className="h-3 w-3" />
                  {contact.telephone}
                </span>
              )}
              {contact.ville && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {[contact.adresse, contact.codePostal, contact.ville].filter(Boolean).join(", ")}
                </span>
              )}
            </p>
          </div>

          {modifiable && (
            <div className="flex gap-2">
              <DialogueAffaire
                contacts={[{ id: contact.id, libelle: contact.societe || nomComplet }]}
                contactId={contact.id}
              />
              <BoutonModifierContact
                contact={{
                  id: contact.id,
                  type: contact.type,
                  nom: contact.nom,
                  prenom: contact.prenom,
                  societe: contact.societe,
                  siret: contact.siret,
                  email: contact.email,
                  telephone: contact.telephone,
                  adresse: contact.adresse,
                  codePostal: contact.codePostal,
                  ville: contact.ville,
                  origine: contact.origine,
                  notes: contact.notes,
                }}
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Carte className="lg:col-span-2">
          <EnteteCarte titre="Projets" description={`${contact.projects.length} operation(s)`} />
          {contact.projects.length === 0 ? (
            <Vide titre="Aucun projet" />
          ) : (
            <Tableau>
              <EnteteTableau>
                <tr>
                  <Th>Reference</Th>
                  <Th>Projet</Th>
                  <Th>Statut</Th>
                  <Th numerique>Montant HT</Th>
                  <Th numerique>Fin prevue</Th>
                </tr>
              </EnteteTableau>
              <tbody>
                {contact.projects.map((p) => (
                  <Tr key={p.id}>
                    <Td>
                      <Link
                        href={`/dashboard/projets/${p.id}`}
                        className="text-xs font-medium tabulaire text-ardoise-700 hover:underline"
                      >
                        {p.reference}
                      </Link>
                    </Td>
                    <Td className="max-w-56 truncate text-sm">{p.nom}</Td>
                    <Td>
                      <StatutProjet statut={p.statut} />
                    </Td>
                    <Td numerique className="text-sm">
                      {p.prixVenteHT ? euros(nb(p.prixVenteHT)) : "—"}
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

        <Carte>
          <EnteteCarte titre="Affaires" />
          {contact.deals.length === 0 ? (
            <Vide titre="Aucune affaire" />
          ) : (
            <ul className="divide-y divide-ardoise-100">
              {contact.deals.map((d) => (
                <li key={d.id} className="px-4 py-2.5">
                  <p className="truncate text-sm text-ardoise-900">{d.titre}</p>
                  <p className="mt-0.5 flex items-center justify-between gap-2">
                    <StatutBadge statut={d.stage} libelle={LIBELLES_STAGE[d.stage]} />
                    <span className="text-xs font-medium tabulaire text-ardoise-700">
                      {d.montantEstime ? euros(nb(d.montantEstime)) : "—"}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Carte>
      </div>

      {contact.properties.length > 0 && (
        <Carte>
          <EnteteCarte titre="Biens" />
          <Tableau>
            <EnteteTableau>
              <tr>
                <Th>Bien</Th>
                <Th>Type</Th>
                <Th>Adresse</Th>
                <Th numerique>Surface</Th>
              </tr>
            </EnteteTableau>
            <tbody>
              {contact.properties.map((b) => (
                <Tr key={b.id}>
                  <Td className="text-sm">{b.nom}</Td>
                  <Td className="text-xs text-ardoise-500">{libelleEnum(b.type)}</Td>
                  <Td className="text-xs text-ardoise-600">
                    {[b.adresse, b.codePostal, b.ville].filter(Boolean).join(", ")}
                  </Td>
                  <Td numerique className="text-xs">
                    {b.surfaceUtile ? `${nb(b.surfaceUtile)} m²` : "—"}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Tableau>
        </Carte>
      )}

      {factures.length > 0 && (
        <Carte>
          <EnteteCarte titre="Factures client" />
          <Tableau>
            <EnteteTableau>
              <tr>
                <Th>Numero</Th>
                <Th numerique>Montant HT</Th>
                <Th numerique>TTC</Th>
                <Th numerique>Emission</Th>
                <Th>Statut</Th>
              </tr>
            </EnteteTableau>
            <tbody>
              {factures.map((f) => (
                <Tr key={f.id}>
                  <Td className="text-xs tabulaire">{f.numero}</Td>
                  <Td numerique className="text-sm">{euros(nb(f.montantHT))}</Td>
                  <Td numerique className="text-xs text-ardoise-500">{euros(nb(f.montantTTC))}</Td>
                  <Td numerique className="text-xs text-ardoise-500">
                    {dateCourte(f.dateEmission)}
                  </Td>
                  <Td>
                    <StatutBadge statut={f.statut} />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Tableau>
        </Carte>
      )}

      <Carte>
        <EnteteCarte
          titre="Historique des echanges"
          description={`${contact.interactions.length} echange(s) enregistre(s)`}
        />
        {contact.interactions.length === 0 ? (
          <Vide titre="Aucun echange enregistre" />
        ) : (
          <ul className="divide-y divide-ardoise-100">
            {contact.interactions.map((i) => (
              <li key={i.id} className="px-4 py-2.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-ardoise-900">{i.objet}</p>
                  <p className="text-[11px] text-ardoise-400">
                    {i.canal} · {dateCourte(i.date)}
                    {i.auteur && ` · ${i.auteur}`}
                  </p>
                </div>
                {i.compteRendu && (
                  <p className="mt-1 text-xs leading-relaxed text-ardoise-600">{i.compteRendu}</p>
                )}
              </li>
            ))}
          </ul>
        )}
        {modifiable && <FormulaireInteraction contactId={contact.id} />}
      </Carte>

      {contact.notes && (
        <Carte>
          <EnteteCarte titre="Notes" />
          <CorpsCarte>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ardoise-700">
              {contact.notes}
            </p>
          </CorpsCarte>
        </Carte>
      )}
    </div>
  )
}

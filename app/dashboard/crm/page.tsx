import type { Metadata } from "next"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { requireAccess } from "@/lib/session"
import { can } from "@/lib/permissions"
import { LIBELLES_STAGE } from "@/lib/metier/referentiel"
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
import {
  BoutonModifierContact,
  BoutonSupprimerAffaire,
  BoutonSupprimerContact,
  DialogueAffaire,
  DialogueContact,
  SelecteurEtape,
} from "./formulaires"
import { dateCourte, euros, libelleEnum, nb } from "@/lib/utils"

export const metadata: Metadata = { title: "Clients & pipeline" }

const ETAPES_OUVERTES = ["NOUVEAU", "QUALIFICATION", "ETUDE", "CHIFFRAGE", "PROPOSITION", "NEGOCIATION"]

export default async function PageCrm() {
  const utilisateur = await requireAccess("crm", "read")

  const [contacts, affaires] = await Promise.all([
    prisma.contact.findMany({
      where: { organizationId: utilisateur.organizationId },
      include: { _count: { select: { projects: true, deals: true } } },
      orderBy: [{ type: "asc" }, { nom: "asc" }],
    }),
    prisma.deal.findMany({
      where: { organizationId: utilisateur.organizationId },
      include: { contact: { select: { id: true, nom: true, prenom: true, societe: true } } },
      orderBy: { updatedAt: "desc" },
    }),
  ])

  const modifiable = can(utilisateur.role, "crm", "update")
  const ouvertes = affaires.filter((a) => ETAPES_OUVERTES.includes(a.stage))
  const gagnees = affaires.filter((a) => a.stage === "GAGNE")
  const perdues = affaires.filter((a) => a.stage === "PERDU")

  const montantPipeline = ouvertes.reduce((s, a) => s + nb(a.montantEstime), 0)
  const montantPondere = ouvertes.reduce(
    (s, a) => s + (nb(a.montantEstime) * a.probabilite) / 100,
    0
  )
  const tauxTransformation =
    gagnees.length + perdues.length > 0
      ? (gagnees.length / (gagnees.length + perdues.length)) * 100
      : 0

  const listeContacts = contacts.map((c) => ({
    id: c.id,
    libelle: c.societe || `${c.prenom ?? ""} ${c.nom}`.trim(),
  }))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ardoise-900">Clients & pipeline</h1>
          <p className="text-sm text-ardoise-500">
            {contacts.length} contact(s) · {ouvertes.length} affaire(s) en cours
          </p>
        </div>
        {modifiable && (
          <div className="flex gap-2">
            <DialogueAffaire contacts={listeContacts} />
            <DialogueContact />
          </div>
        )}
      </div>

      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        <Kpi compact libelle="Pipeline" valeur={euros(montantPipeline)} precision={`${ouvertes.length} affaire(s)`} />
        <Kpi
          compact
          libelle="Pipeline pondere"
          valeur={euros(montantPondere)}
          precision="Par la probabilite de signature"
        />
        <Kpi
          compact
          libelle="Taux de transformation"
          valeur={`${tauxTransformation.toFixed(0)} %`}
          precision={`${gagnees.length} gagnee(s) / ${perdues.length} perdue(s)`}
        />
        <Kpi
          compact
          libelle="Clients actifs"
          valeur={contacts.filter((c) => c.type === "CLIENT").length}
          precision={`${contacts.filter((c) => c.type === "PROSPECT").length} prospect(s)`}
        />
      </div>

      {/* ─── Pipeline en colonnes ───────────────────────────────────────── */}
      <Carte>
        <EnteteCarte
          titre="Pipeline commercial"
          description="Nouveau → Qualification → Etude → Chiffrage → Proposition → Negociation → Gagne / Perdu"
        />
        <div className="defilement-fin overflow-x-auto p-3">
          <div className="flex gap-3">
            {Object.entries(LIBELLES_STAGE).map(([cle, libelle]) => {
              const colonne = affaires.filter((a) => a.stage === cle)
              const montant = colonne.reduce((s, a) => s + nb(a.montantEstime), 0)
              return (
                <div key={cle} className="w-56 shrink-0">
                  <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
                    <span className="text-xs font-medium text-ardoise-700">{libelle}</span>
                    <span className="text-[10px] tabulaire text-ardoise-400">
                      {colonne.length} · {euros(montant)}
                    </span>
                  </div>
                  <ul className="space-y-1.5">
                    {colonne.map((a) => (
                      <li
                        key={a.id}
                        className="rounded-md border border-ardoise-200 bg-white px-2.5 py-2"
                      >
                        <p className="truncate text-xs font-medium text-ardoise-900">{a.titre}</p>
                        <Link
                          href={`/dashboard/crm/${a.contact.id}`}
                          className="block truncate text-[10px] text-ardoise-400 hover:underline"
                        >
                          {a.contact.societe || `${a.contact.prenom ?? ""} ${a.contact.nom}`.trim()}
                        </Link>
                        <p className="mt-1 flex items-baseline justify-between gap-1">
                          <span className="text-xs font-semibold tabulaire text-ardoise-800">
                            {a.montantEstime ? euros(nb(a.montantEstime)) : "—"}
                          </span>
                          <span className="text-[10px] tabulaire text-ardoise-400">
                            {a.probabilite} %
                          </span>
                        </p>
                      </li>
                    ))}
                    {colonne.length === 0 && (
                      <li className="rounded-md border border-dashed border-ardoise-200 px-2.5 py-3 text-center text-[10px] text-ardoise-300">
                        Aucune affaire
                      </li>
                    )}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      </Carte>

      {/* ─── Affaires ───────────────────────────────────────────────────── */}
      <Carte>
        <EnteteCarte titre="Affaires" description={`${affaires.length} au total`} />
        {affaires.length === 0 ? (
          <Vide
            titre="Aucune affaire"
            description="Le pipeline se remplit a mesure que vous enregistrez des opportunites."
            action={modifiable ? <DialogueAffaire contacts={listeContacts} /> : undefined}
          />
        ) : (
          <Tableau>
            <EnteteTableau>
              <tr>
                <Th>Affaire</Th>
                <Th>Contact</Th>
                <Th>Etape</Th>
                <Th numerique>Montant estime</Th>
                <Th numerique>Probabilite</Th>
                <Th numerique>Pondere</Th>
                <Th numerique>Cloture prevue</Th>
                {modifiable && <Th />}
              </tr>
            </EnteteTableau>
            <tbody>
              {affaires.map((a) => (
                <Tr key={a.id}>
                  <Td className="max-w-56 truncate text-sm">{a.titre}</Td>
                  <Td>
                    <Link
                      href={`/dashboard/crm/${a.contact.id}`}
                      className="block max-w-40 truncate text-xs text-ardoise-700 hover:underline"
                    >
                      {a.contact.societe || `${a.contact.prenom ?? ""} ${a.contact.nom}`.trim()}
                    </Link>
                  </Td>
                  <Td>
                    {modifiable ? (
                      <SelecteurEtape dealId={a.id} stage={a.stage} />
                    ) : (
                      <StatutBadge statut={a.stage} libelle={LIBELLES_STAGE[a.stage]} />
                    )}
                  </Td>
                  <Td numerique className="text-sm">
                    {a.montantEstime ? euros(nb(a.montantEstime)) : "—"}
                  </Td>
                  <Td numerique className="text-xs text-ardoise-500">{a.probabilite} %</Td>
                  <Td numerique className="text-xs text-ardoise-600">
                    {euros((nb(a.montantEstime) * a.probabilite) / 100)}
                  </Td>
                  <Td numerique className="text-xs text-ardoise-500">
                    {dateCourte(a.dateCloturePrevue)}
                  </Td>
                  {modifiable && (
                    <Td>
                      <div className="flex justify-end">
                        <BoutonSupprimerAffaire dealId={a.id} />
                      </div>
                    </Td>
                  )}
                </Tr>
              ))}
            </tbody>
          </Tableau>
        )}
      </Carte>

      {/* ─── Contacts ───────────────────────────────────────────────────── */}
      <Carte>
        <EnteteCarte titre="Contacts" />
        {contacts.length === 0 ? (
          <Vide
            titre="Aucun contact"
            action={modifiable ? <DialogueContact /> : undefined}
          />
        ) : (
          <Tableau>
            <EnteteTableau>
              <tr>
                <Th>Nom</Th>
                <Th>Type</Th>
                <Th>Societe</Th>
                <Th>Ville</Th>
                <Th>Contact</Th>
                <Th numerique>Projets</Th>
                <Th numerique>Affaires</Th>
                {modifiable && <Th />}
              </tr>
            </EnteteTableau>
            <tbody>
              {contacts.map((c) => (
                <Tr key={c.id}>
                  <Td>
                    <Link
                      href={`/dashboard/crm/${c.id}`}
                      className="block text-sm font-medium text-ardoise-900 hover:underline"
                    >
                      {`${c.prenom ?? ""} ${c.nom}`.trim()}
                    </Link>
                  </Td>
                  <Td>
                    <StatutBadge statut={c.type} libelle={libelleEnum(c.type)} />
                  </Td>
                  <Td className="max-w-40 truncate text-xs text-ardoise-600">{c.societe ?? "—"}</Td>
                  <Td className="text-xs text-ardoise-500">{c.ville ?? "—"}</Td>
                  <Td className="text-xs text-ardoise-500">
                    <span className="block truncate">{c.email ?? "—"}</span>
                    <span className="block truncate tabulaire">{c.telephone ?? ""}</span>
                  </Td>
                  <Td numerique className="text-xs">{c._count.projects}</Td>
                  <Td numerique className="text-xs">{c._count.deals}</Td>
                  {modifiable && (
                    <Td>
                      <div className="flex items-center justify-end gap-0.5">
                        <BoutonModifierContact
                          contact={{
                            id: c.id,
                            type: c.type,
                            nom: c.nom,
                            prenom: c.prenom,
                            societe: c.societe,
                            siret: c.siret,
                            email: c.email,
                            telephone: c.telephone,
                            adresse: c.adresse,
                            codePostal: c.codePostal,
                            ville: c.ville,
                            origine: c.origine,
                            notes: c.notes,
                          }}
                        />
                        <BoutonSupprimerContact contactId={c.id} />
                      </div>
                    </Td>
                  )}
                </Tr>
              ))}
            </tbody>
          </Tableau>
        )}
      </Carte>
    </div>
  )
}

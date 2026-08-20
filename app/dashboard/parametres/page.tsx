import type { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import { requireAccess } from "@/lib/session"
import { can, LIBELLES_ROLES, type Role } from "@/lib/permissions"
import { Kpi } from "@/components/app/indicateurs"
import {
  Badge,
  Carte,
  CorpsCarte,
  EnteteCarte,
  EnteteTableau,
  Jauge,
  Tableau,
  Td,
  Th,
  Tr,
} from "@/components/ui/primitives"
import {
  ActionsUtilisateur,
  BoutonModifierUtilisateur,
  DialogueUtilisateur,
  FormulaireOrganisation,
} from "./formulaires"
import { dateCourte, nb } from "@/lib/utils"

export const metadata: Metadata = { title: "Parametres" }

export default async function PageParametres() {
  const utilisateur = await requireAccess("organisation", "read")

  const [organisation, utilisateurs, sousTraitants, contacts, compteurs] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: utilisateur.organizationId } }),
    prisma.user.findMany({
      where: { organizationId: utilisateur.organizationId },
      include: {
        subcontractor: { select: { raisonSociale: true } },
        contact: { select: { nom: true, societe: true } },
      },
      orderBy: [{ actif: "desc" }, { role: "asc" }, { name: "asc" }],
    }),
    prisma.subcontractor.findMany({
      where: { organizationId: utilisateur.organizationId },
      select: { id: true, raisonSociale: true },
      orderBy: { raisonSociale: "asc" },
    }),
    prisma.contact.findMany({
      where: { organizationId: utilisateur.organizationId, type: { in: ["CLIENT", "MAITRE_OUVRAGE"] } },
      select: { id: true, nom: true, prenom: true, societe: true },
      orderBy: { nom: "asc" },
    }),
    prisma.project.count({ where: { organizationId: utilisateur.organizationId } }),
  ])

  const peutGerer = can(utilisateur.role, "utilisateurs", "create")
  const listeContacts = contacts.map((c) => ({
    id: c.id,
    libelle: c.societe || `${c.prenom ?? ""} ${c.nom}`.trim(),
  }))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-ardoise-900">Parametres</h1>
        <p className="text-sm text-ardoise-500">
          Societe, parametres economiques, utilisateurs et abonnement.
        </p>
      </div>

      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        <Kpi compact libelle="Abonnement" valeur={organisation.plan} />
        <Kpi
          compact
          libelle="Projets"
          valeur={`${compteurs} / ${organisation.quotaProjets}`}
          ton={compteurs >= organisation.quotaProjets ? "negatif" : "neutre"}
        />
        <Kpi
          compact
          libelle="Utilisateurs"
          valeur={`${utilisateurs.length} / ${organisation.quotaUsers}`}
          ton={utilisateurs.length >= organisation.quotaUsers ? "negatif" : "neutre"}
        />
        <Kpi
          compact
          libelle="Echeance"
          valeur={organisation.abonnementFin ? dateCourte(organisation.abonnementFin) : "—"}
        />
      </div>

      <Carte>
        <EnteteCarte titre="Consommation de l'abonnement" />
        <CorpsCarte className="space-y-3">
          <Consommation
            libelle="Projets"
            valeur={compteurs}
            maximum={organisation.quotaProjets}
          />
          <Consommation
            libelle="Comptes utilisateurs"
            valeur={utilisateurs.length}
            maximum={organisation.quotaUsers}
          />
        </CorpsCarte>
      </Carte>

      <Carte>
        <EnteteCarte
          titre="Societe"
          description="Ces informations apparaissent sur les devis, consultations et marches generes."
        />
        <FormulaireOrganisation
          organisation={{
            nom: organisation.nom,
            prefixe: organisation.prefixe,
            siret: organisation.siret,
            adresse: organisation.adresse,
            codePostal: organisation.codePostal,
            ville: organisation.ville,
            telephone: organisation.telephone,
            email: organisation.email,
            siteWeb: organisation.siteWeb,
            tauxTva: nb(organisation.tauxTva, 20),
            tauxFraisChantier: nb(organisation.tauxFraisChantier, 4),
            tauxFraisGeneraux: nb(organisation.tauxFraisGeneraux, 8),
            margeCibleDefaut: nb(organisation.margeCibleDefaut, 18),
            tauxRetenueGarantie: nb(organisation.tauxRetenueGarantie, 5),
            seuilAlerteDerive: nb(organisation.seuilAlerteDerive, 2),
          }}
        />
      </Carte>

      <Carte>
        <EnteteCarte
          titre="Utilisateurs"
          description={`${utilisateurs.filter((u) => u.actif).length} compte(s) actif(s)`}
          action={
            peutGerer ? (
              <DialogueUtilisateur sousTraitants={sousTraitants} contacts={listeContacts} />
            ) : undefined
          }
        />
        <Tableau>
          <EnteteTableau>
            <tr>
              <Th>Nom</Th>
              <Th>E-mail</Th>
              <Th>Role</Th>
              <Th>Rattachement</Th>
              <Th numerique>Derniere connexion</Th>
              <Th>Etat</Th>
              {peutGerer && <Th />}
            </tr>
          </EnteteTableau>
          <tbody>
            {utilisateurs.map((u) => (
              <Tr key={u.id} className={u.actif ? undefined : "opacity-50"}>
                <Td>
                  <span className="block text-sm font-medium text-ardoise-900">{u.name}</span>
                  {u.fonction && (
                    <span className="block text-[11px] text-ardoise-400">{u.fonction}</span>
                  )}
                </Td>
                <Td className="text-xs text-ardoise-600">{u.email}</Td>
                <Td>
                  <Badge ton={u.role === "ADMIN" || u.role === "DIRIGEANT" ? "info" : "neutre"}>
                    {LIBELLES_ROLES[u.role as Role]}
                  </Badge>
                </Td>
                <Td className="text-xs text-ardoise-500">
                  {u.subcontractor?.raisonSociale ??
                    u.contact?.societe ??
                    u.contact?.nom ??
                    "—"}
                </Td>
                <Td numerique className="text-xs text-ardoise-500">
                  {u.derniereConnexion ? dateCourte(u.derniereConnexion) : "jamais"}
                </Td>
                <Td>
                  {u.actif ? <Badge ton="succes">actif</Badge> : <Badge>desactive</Badge>}
                </Td>
                {peutGerer && (
                  <Td>
                    <div className="flex items-center justify-end gap-0.5">
                      <BoutonModifierUtilisateur
                        utilisateur={{
                          id: u.id,
                          email: u.email,
                          name: u.name,
                          role: u.role,
                          fonction: u.fonction,
                          telephone: u.telephone,
                          subcontractorId: u.subcontractorId,
                          contactId: u.contactId,
                        }}
                        sousTraitants={sousTraitants}
                        contacts={listeContacts}
                      />
                      <ActionsUtilisateur userId={u.id} actif={u.actif} />
                    </div>
                  </Td>
                )}
              </Tr>
            ))}
          </tbody>
        </Tableau>
      </Carte>

      <Carte>
        <EnteteCarte titre="Isolation des donnees" />
        <CorpsCarte className="space-y-2 text-xs leading-relaxed text-ardoise-600">
          <p>
            Chaque societe cliente dispose d&apos;un environnement completement isole : toutes les
            tables metier portent l&apos;identifiant de l&apos;organisation, et chaque requete est
            filtree par l&apos;identifiant issu de la session, jamais par un parametre transmis
            depuis le navigateur.
          </p>
          <p>
            Les roles ajoutent une seconde barriere : un conducteur de travaux n&apos;accede pas au
            budget, un sous-traitant ne voit que ses propres consultations et marches, un client ne
            voit que les documents que vous lui rendez visibles.
          </p>
          <p className="tabulaire text-[11px] text-ardoise-400">
            Identifiant de votre organisation : {organisation.id}
          </p>
        </CorpsCarte>
      </Carte>
    </div>
  )
}

function Consommation({
  libelle,
  valeur,
  maximum,
}: {
  libelle: string
  valeur: number
  maximum: number
}) {
  const taux = maximum > 0 ? (valeur / maximum) * 100 : 0
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs text-ardoise-600">{libelle}</span>
        <span className="text-xs font-medium tabulaire text-ardoise-800">
          {valeur} / {maximum}
        </span>
      </div>
      <Jauge valeur={taux} ton={taux >= 90 ? "danger" : taux >= 70 ? "alerte" : "ardoise"} />
    </div>
  )
}

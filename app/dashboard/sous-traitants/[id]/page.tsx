import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Mail, MapPin, Phone } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requireAccess } from "@/lib/session"
import { can } from "@/lib/permissions"
import { LIBELLES_CATEGORIE } from "@/lib/metier/referentiel"
import { Kpi, StatutBadge } from "@/components/app/indicateurs"
import {
  Badge,
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
import {
  BoutonModifierSousTraitant,
  BoutonSupprimerPiece,
  DialoguePieces,
} from "../formulaires"
import { dateCourte, euros, libelleEnum, nb, pourcent } from "@/lib/utils"

export default async function PageSousTraitant({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const utilisateur = await requireAccess("sous_traitants", "read")

  const entreprise = await prisma.subcontractor.findFirst({
    where: { id, organizationId: utilisateur.organizationId },
    include: {
      documents: { orderBy: { createdAt: "desc" } },
      contracts: {
        include: {
          project: { select: { id: true, nom: true, reference: true } },
          lot: { select: { code: true, nom: true } },
          situations: { where: { statut: "VALIDEE" }, select: { montantHT: true } },
        },
        orderBy: { dateSignature: "desc" },
      },
      offers: {
        include: {
          consultation: {
            select: {
              id: true,
              objet: true,
              projectId: true,
              budgetEstime: true,
              lot: { select: { code: true } },
            },
          },
        },
        orderBy: { dateReception: "desc" },
        take: 20,
      },
    },
  })
  if (!entreprise) notFound()

  const modifiable = can(utilisateur.role, "sous_traitants", "update")
  const volume = entreprise.contracts.reduce((s, c) => s + nb(c.montantActualise), 0)
  const facture = entreprise.contracts.reduce(
    (s, c) => s + c.situations.reduce((t, x) => t + nb(x.montantHT), 0),
    0
  )
  const offresRetenues = entreprise.offers.filter((o) => o.statut === "RETENUE").length
  const tauxReussite =
    entreprise.offers.length > 0 ? (offresRetenues / entreprise.offers.length) * 100 : 0

  const conforme = entreprise.assuranceDecennaleValide && entreprise.attestationVigilanceValide

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/dashboard/sous-traitants"
          className="inline-flex items-center gap-1.5 text-xs text-ardoise-500 hover:text-ardoise-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Sous-traitants
        </Link>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold text-ardoise-900">{entreprise.raisonSociale}</h1>
              {conforme ? (
                <Badge ton="succes">documents a jour</Badge>
              ) : (
                <Badge ton="danger">documents incomplets</Badge>
              )}
              {!entreprise.actif && <Badge>desactivee</Badge>}
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ardoise-500">
              {entreprise.formeJuridique && <span>{entreprise.formeJuridique}</span>}
              {entreprise.siret && <span className="tabulaire">SIRET {entreprise.siret}</span>}
              {entreprise.email && (
                <span className="inline-flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {entreprise.email}
                </span>
              )}
              {entreprise.telephone && (
                <span className="inline-flex items-center gap-1 tabulaire">
                  <Phone className="h-3 w-3" />
                  {entreprise.telephone}
                </span>
              )}
              {entreprise.ville && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {entreprise.ville}
                  {entreprise.zoneGeo ? ` · ${entreprise.zoneGeo}` : ""}
                </span>
              )}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {entreprise.specialites.map((s) => (
                <Badge key={s} ton="info">
                  {LIBELLES_CATEGORIE[s] ?? s}
                </Badge>
              ))}
            </div>
          </div>

          {modifiable && (
            <div className="flex flex-wrap gap-2">
              <DialoguePieces subcontractorId={entreprise.id} />
              <BoutonModifierSousTraitant
                sousTraitant={{
                  id: entreprise.id,
                  raisonSociale: entreprise.raisonSociale,
                  siret: entreprise.siret,
                  formeJuridique: entreprise.formeJuridique,
                  contactNom: entreprise.contactNom,
                  email: entreprise.email,
                  telephone: entreprise.telephone,
                  adresse: entreprise.adresse,
                  codePostal: entreprise.codePostal,
                  ville: entreprise.ville,
                  zoneGeo: entreprise.zoneGeo,
                  effectif: entreprise.effectif,
                  caAnnuel: entreprise.caAnnuel ? nb(entreprise.caAnnuel) : null,
                  noteQualite: nb(entreprise.noteQualite, 3),
                  noteDelai: nb(entreprise.noteDelai, 3),
                  noteRelation: nb(entreprise.noteRelation, 3),
                  nbLitiges: entreprise.nbLitiges,
                  notes: entreprise.notes,
                  specialites: entreprise.specialites,
                  assuranceRcValide: entreprise.assuranceRcValide,
                  assuranceDecennaleValide: entreprise.assuranceDecennaleValide,
                  attestationVigilanceValide: entreprise.attestationVigilanceValide,
                  dateValiditeDocuments:
                    entreprise.dateValiditeDocuments?.toISOString() ?? null,
                }}
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 xl:grid-cols-5">
        <Kpi compact libelle="Notation" valeur={`${nb(entreprise.notation, 3).toFixed(1)}/5`} />
        <Kpi compact libelle="Marches" valeur={entreprise.nbMarches} />
        <Kpi compact libelle="Volume confie" valeur={euros(volume)} />
        <Kpi compact libelle="Deja facture" valeur={euros(facture)} />
        <Kpi
          compact
          libelle="Taux de reussite"
          valeur={pourcent(tauxReussite, 0)}
          precision={`${offresRetenues} offre(s) retenue(s)`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Carte>
          <EnteteCarte titre="Notation detaillee" />
          <CorpsCarte className="space-y-2 text-xs">
            <Note libelle="Qualite d'execution" valeur={nb(entreprise.noteQualite, 3)} />
            <Note libelle="Respect des delais" valeur={nb(entreprise.noteDelai, 3)} />
            <Note libelle="Relation de travail" valeur={nb(entreprise.noteRelation, 3)} />
            <div className="border-t border-ardoise-100 pt-2">
              <div className="flex items-baseline justify-between">
                <span className="text-ardoise-500">Litiges</span>
                <span
                  className={
                    entreprise.nbLitiges > 0
                      ? "font-medium tabulaire text-red-600"
                      : "font-medium tabulaire text-emerald-600"
                  }
                >
                  {entreprise.nbLitiges}
                </span>
              </div>
              {entreprise.effectif && (
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-ardoise-500">Effectif</span>
                  <span className="tabulaire text-ardoise-800">{entreprise.effectif}</span>
                </div>
              )}
              {entreprise.caAnnuel && (
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-ardoise-500">CA annuel</span>
                  <span className="tabulaire text-ardoise-800">{euros(nb(entreprise.caAnnuel))}</span>
                </div>
              )}
            </div>
          </CorpsCarte>
        </Carte>

        <Carte className="lg:col-span-2">
          <EnteteCarte
            titre="Pieces administratives"
            description={
              entreprise.dateValiditeDocuments
                ? `Validite jusqu'au ${dateCourte(entreprise.dateValiditeDocuments)}`
                : "Aucune date de validite renseignee"
            }
          />
          {entreprise.documents.length === 0 ? (
            <Vide
              titre="Aucune piece deposee"
              description="Kbis, assurances, attestation de vigilance."
              action={modifiable ? <DialoguePieces subcontractorId={entreprise.id} /> : undefined}
            />
          ) : (
            <ul className="divide-y divide-ardoise-100">
              {entreprise.documents.map((d) => {
                const expiree = d.dateExpiration !== null && d.dateExpiration < new Date()
                return (
                  <li key={d.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-sm text-ardoise-900 hover:underline"
                      >
                        {d.nom}
                      </a>
                      <p className="text-[11px] text-ardoise-400">
                        {libelleEnum(d.type)}
                        {d.dateExpiration && ` · expire le ${dateCourte(d.dateExpiration)}`}
                      </p>
                    </div>
                    {expiree ? <Badge ton="danger">expiree</Badge> : <Badge ton="succes">valide</Badge>}
                    {modifiable && <BoutonSupprimerPiece documentId={d.id} />}
                  </li>
                )
              })}
            </ul>
          )}
        </Carte>
      </div>

      <Carte>
        <EnteteCarte titre="Marches" description={`${entreprise.contracts.length} marche(s)`} />
        {entreprise.contracts.length === 0 ? (
          <Vide titre="Aucun marche" />
        ) : (
          <Tableau>
            <EnteteTableau>
              <tr>
                <Th>Reference</Th>
                <Th>Projet</Th>
                <Th>Lot</Th>
                <Th numerique>Montant initial</Th>
                <Th numerique>Actualise</Th>
                <Th numerique>Facture</Th>
                <Th>Statut</Th>
                <Th numerique>Signature</Th>
              </tr>
            </EnteteTableau>
            <tbody>
              {entreprise.contracts.map((c) => (
                <Tr key={c.id}>
                  <Td className="text-xs tabulaire text-ardoise-700">{c.reference}</Td>
                  <Td>
                    <Link
                      href={`/dashboard/projets/${c.project.id}`}
                      className="block max-w-44 truncate text-sm hover:underline"
                    >
                      {c.project.nom}
                    </Link>
                  </Td>
                  <Td className="text-xs text-ardoise-500">
                    {c.lot.code} — {c.lot.nom}
                  </Td>
                  <Td numerique className="text-sm text-ardoise-600">
                    {euros(nb(c.montantInitial))}
                  </Td>
                  <Td numerique className="text-sm font-medium">{euros(nb(c.montantActualise))}</Td>
                  <Td numerique className="text-sm text-ardoise-600">
                    {euros(c.situations.reduce((s, x) => s + nb(x.montantHT), 0))}
                  </Td>
                  <Td>
                    <StatutBadge statut={c.statut} />
                  </Td>
                  <Td numerique className="text-xs text-ardoise-500">
                    {dateCourte(c.dateSignature)}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Tableau>
        )}
      </Carte>

      <Carte>
        <EnteteCarte titre="Historique des offres" description="Prix pratiques par cette entreprise" />
        {entreprise.offers.length === 0 ? (
          <Vide titre="Aucune offre deposee" />
        ) : (
          <Tableau>
            <EnteteTableau>
              <tr>
                <Th>Consultation</Th>
                <Th>Lot</Th>
                <Th numerique>Montant HT</Th>
                <Th numerique>Budget estime</Th>
                <Th numerique>Ecart</Th>
                <Th numerique>Delai</Th>
                <Th>Statut</Th>
                <Th numerique>Recue</Th>
              </tr>
            </EnteteTableau>
            <tbody>
              {entreprise.offers.map((o) => {
                const budget = o.consultation.budgetEstime ? nb(o.consultation.budgetEstime) : null
                const montant = nb(o.montantHT)
                const ecart = budget ? ((montant - budget) / budget) * 100 : null
                return (
                  <Tr key={o.id}>
                    <Td>
                      <Link
                        href={`/dashboard/projets/${o.consultation.projectId}/consultations/${o.consultation.id}`}
                        className="block max-w-56 truncate text-sm hover:underline"
                      >
                        {o.consultation.objet}
                      </Link>
                    </Td>
                    <Td className="text-xs text-ardoise-500">{o.consultation.lot.code}</Td>
                    <Td numerique className="text-sm font-medium">{euros(montant)}</Td>
                    <Td numerique className="text-xs text-ardoise-500">
                      {budget ? euros(budget) : "—"}
                    </Td>
                    <Td numerique>
                      {ecart !== null ? (
                        <span
                          className={
                            ecart <= 0
                              ? "text-xs tabulaire text-emerald-600"
                              : "text-xs tabulaire text-red-600"
                          }
                        >
                          {ecart > 0 ? "+" : ""}
                          {ecart.toFixed(1)} %
                        </span>
                      ) : (
                        <span className="text-xs text-ardoise-400">—</span>
                      )}
                    </Td>
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
                )
              })}
            </tbody>
          </Tableau>
        )}
      </Carte>

      {entreprise.notes && (
        <Carte>
          <EnteteCarte titre="Notes" />
          <CorpsCarte>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ardoise-700">
              {entreprise.notes}
            </p>
          </CorpsCarte>
        </Carte>
      )}
    </div>
  )
}

function Note({ libelle, valeur }: { libelle: string; valeur: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-ardoise-500">{libelle}</span>
        <span className="font-medium tabulaire text-ardoise-800">{valeur.toFixed(1)}/5</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ardoise-100">
        <div
          className={
            valeur >= 4 ? "h-full bg-emerald-500" : valeur >= 3 ? "h-full bg-chantier-500" : "h-full bg-red-500"
          }
          style={{ width: `${(valeur / 5) * 100}%` }}
        />
      </div>
    </div>
  )
}

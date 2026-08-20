import type { Metadata } from "next"
import Link from "next/link"
import { Plus, Search } from "lucide-react"
import { requireAccess } from "@/lib/session"
import { listeProjets } from "@/lib/queries/projets"
import { LIBELLES_OPERATION, LIBELLES_STATUT_PROJET } from "@/lib/metier/referentiel"
import { StatutProjet, TauxMarge } from "@/components/app/indicateurs"
import {
  Bouton,
  Carte,
  Champ,
  EnteteTableau,
  Jauge,
  Tableau,
  Td,
  Th,
  Tr,
  Vide,
} from "@/components/ui/primitives"
import { dateCourte, euros, nombre, pourcent } from "@/lib/utils"

export const metadata: Metadata = { title: "Projets" }

const STATUTS = Object.keys(LIBELLES_STATUT_PROJET)

export default async function PageProjets({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string; q?: string }>
}) {
  const utilisateur = await requireAccess("projets", "read")
  const { statut, q } = await searchParams

  const projets = await listeProjets(utilisateur.organizationId, {
    statut: statut && STATUTS.includes(statut) ? statut : undefined,
    recherche: q || undefined,
  })

  const totalMontant = projets.reduce((s, p) => s + p.montantHT, 0)
  const totalEngage = projets.reduce((s, p) => s + p.engage, 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ardoise-900">Projets</h1>
          <p className="text-sm text-ardoise-500">
            {projets.length} operation{projets.length > 1 ? "s" : ""} · {euros(totalMontant)} HT ·{" "}
            {euros(totalEngage)} engages
          </p>
        </div>
        <Bouton asChild variant="chantier">
          <Link href="/dashboard/projets/nouveau">
            <Plus className="h-4 w-4" /> Nouveau projet
          </Link>
        </Bouton>
      </div>

      <Carte className="p-3">
        <form className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-ardoise-400" />
            <Champ
              name="q"
              defaultValue={q ?? ""}
              placeholder="Rechercher par nom, reference ou ville..."
              className="pl-8"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <FiltreStatut actif={!statut} libelle="Tous" href={q ? `?q=${q}` : "?"} />
            {STATUTS.map((s) => (
              <FiltreStatut
                key={s}
                actif={statut === s}
                libelle={LIBELLES_STATUT_PROJET[s]}
                href={`?statut=${s}${q ? `&q=${q}` : ""}`}
              />
            ))}
          </div>
          <Bouton type="submit" variant="contour" taille="sm">
            Filtrer
          </Bouton>
        </form>
      </Carte>

      <Carte>
        {projets.length === 0 ? (
          <Vide
            titre="Aucun projet ne correspond"
            description="Modifiez les filtres ou creez une nouvelle operation."
            action={
              <Bouton asChild variant="chantier" taille="sm">
                <Link href="/dashboard/projets/nouveau">Creer un projet</Link>
              </Bouton>
            }
          />
        ) : (
          <Tableau>
            <EnteteTableau>
              <tr>
                <Th>Reference</Th>
                <Th>Projet</Th>
                <Th>Type</Th>
                <Th>Statut</Th>
                <Th numerique>Surface</Th>
                <Th>Avancement</Th>
                <Th numerique>Montant HT</Th>
                <Th numerique>Engage</Th>
                <Th numerique>Atterrissage</Th>
                <Th numerique>Marge</Th>
                <Th numerique>Fin prevue</Th>
              </tr>
            </EnteteTableau>
            <tbody>
              {projets.map((p) => (
                <Tr key={p.id}>
                  <Td>
                    <Link
                      href={`/dashboard/projets/${p.id}`}
                      className="text-xs font-medium tabulaire text-ardoise-700 hover:underline"
                    >
                      {p.reference}
                    </Link>
                  </Td>
                  <Td>
                    <Link href={`/dashboard/projets/${p.id}`} className="block min-w-44">
                      <span className="block truncate text-sm font-medium text-ardoise-900">
                        {p.nom}
                      </span>
                      <span className="block truncate text-[11px] text-ardoise-400">
                        {[p.ville, p.client, p.responsable].filter(Boolean).join(" · ") || "—"}
                      </span>
                    </Link>
                  </Td>
                  <Td className="text-xs text-ardoise-600">
                    {LIBELLES_OPERATION[p.typeOperation] ?? p.typeOperation}
                  </Td>
                  <Td>
                    <StatutProjet statut={p.statut} />
                  </Td>
                  <Td numerique className="text-xs text-ardoise-600">
                    {p.surface ? `${nombre(p.surface)} m²` : "—"}
                  </Td>
                  <Td>
                    <div className="w-20">
                      <Jauge
                        valeur={p.avancementPhysique}
                        ton={p.avancementPhysique >= 100 ? "succes" : "chantier"}
                      />
                      <span className="mt-1 block text-[10px] tabulaire text-ardoise-500">
                        {pourcent(p.avancementPhysique, 0)}
                      </span>
                    </div>
                  </Td>
                  <Td numerique className="text-sm">{euros(p.montantHT)}</Td>
                  <Td numerique className="text-sm text-ardoise-600">{euros(p.engage)}</Td>
                  <Td numerique className="text-sm">
                    <span className={p.enDerive ? "font-medium text-red-600" : ""}>
                      {euros(p.atterrissage)}
                    </span>
                  </Td>
                  <Td numerique>
                    <TauxMarge taux={p.margeTaux} cible={p.margeCible} />
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
    </div>
  )
}

function FiltreStatut({
  actif,
  libelle,
  href,
}: {
  actif: boolean
  libelle: string
  href: string
}) {
  return (
    <Link
      href={href}
      className={
        actif
          ? "rounded-md bg-ardoise-800 px-2.5 py-1 text-xs font-medium text-white"
          : "rounded-md border border-ardoise-200 px-2.5 py-1 text-xs text-ardoise-600 hover:bg-ardoise-50"
      }
    >
      {libelle}
    </Link>
  )
}

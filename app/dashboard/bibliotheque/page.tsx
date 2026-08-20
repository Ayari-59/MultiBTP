import type { Metadata } from "next"
import Link from "next/link"
import { Search } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requireAccess } from "@/lib/session"
import { can } from "@/lib/permissions"
import { LIBELLES_CATEGORIE, LIBELLES_UNITE } from "@/lib/metier/referentiel"
import { Kpi } from "@/components/app/indicateurs"
import {
  Badge,
  Bouton,
  Carte,
  Champ,
  EnteteCarte,
  EnteteTableau,
  Tableau,
  Td,
  Th,
  Tr,
  Vide,
} from "@/components/ui/primitives"
import {
  BasculeActivation,
  BoutonImportCatalogue,
  BoutonModifierPrix,
  BoutonSupprimerPrix,
  DialoguePrix,
} from "./formulaires"
import { dateCourte, euros, nb } from "@/lib/utils"

export const metadata: Metadata = { title: "Bibliotheque de prix" }

const CATEGORIES = Object.keys(LIBELLES_CATEGORIE)

export default async function PageBibliotheque({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string; q?: string }>
}) {
  const utilisateur = await requireAccess("bibliotheque", "read")
  const { cat, q } = await searchParams

  const items = await prisma.priceItem.findMany({
    where: {
      organizationId: utilisateur.organizationId,
      ...(cat && CATEGORIES.includes(cat) ? { categorie: cat as never } : {}),
      ...(q
        ? {
            OR: [
              { designation: { contains: q, mode: "insensitive" as const } },
              { code: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    include: { _count: { select: { historique: true, items: true } } },
    orderBy: [{ categorie: "asc" }, { designation: "asc" }],
    take: 500,
  })

  const modifiable = can(utilisateur.role, "bibliotheque", "update")
  const parCategorie = new Map<string, number>()
  for (const i of items) {
    parCategorie.set(i.categorie, (parCategorie.get(i.categorie) ?? 0) + 1)
  }

  const margeMoyenne =
    items.length > 0
      ? items.reduce((s, i) => {
          const pv = nb(i.prixReference)
          const cr = nb(i.coutReference)
          return s + (pv > 0 ? ((pv - cr) / pv) * 100 : 0)
        }, 0) / items.length
      : 0

  const totalReleves = items.reduce((s, i) => s + i._count.historique, 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ardoise-900">Bibliotheque de prix</h1>
          <p className="text-sm text-ardoise-500">
            {items.length} poste(s) · {totalReleves} releve(s) de prix
          </p>
        </div>
        {modifiable && (
          <div className="flex flex-wrap gap-2">
            <BoutonImportCatalogue />
            <DialoguePrix />
          </div>
        )}
      </div>

      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        <Kpi compact libelle="Postes references" valeur={items.length} />
        <Kpi compact libelle="Categories couvertes" valeur={parCategorie.size} />
        <Kpi compact libelle="Marge moyenne" valeur={`${margeMoyenne.toFixed(1)} %`} />
        <Kpi
          compact
          libelle="Postes utilises"
          valeur={items.filter((i) => i._count.items > 0).length}
          precision="Dans au moins un chiffrage"
        />
      </div>

      <Carte className="p-3">
        <form className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-ardoise-400" />
            <Champ name="q" defaultValue={q ?? ""} placeholder="Rechercher un poste..." className="pl-8" />
          </div>
          <Bouton type="submit" variant="contour" taille="sm">
            Rechercher
          </Bouton>
        </form>

        <div className="mt-2 flex flex-wrap gap-1.5">
          <Filtre actif={!cat} libelle="Toutes" href={q ? `?q=${q}` : "?"} />
          {CATEGORIES.map((c) => (
            <Filtre
              key={c}
              actif={cat === c}
              libelle={`${LIBELLES_CATEGORIE[c]}${parCategorie.has(c) ? ` (${parCategorie.get(c)})` : ""}`}
              href={`?cat=${c}${q ? `&q=${q}` : ""}`}
            />
          ))}
        </div>
      </Carte>

      <Carte>
        <EnteteCarte
          titre="Postes"
          description="Les prix min / moyen / max proviennent de l'historique des chiffrages et des devis recus."
        />
        {items.length === 0 ? (
          <Vide
            titre="Bibliotheque vide"
            description="Importez le catalogue de reference pour demarrer, puis enrichissez-le avec vos prix reels."
            action={modifiable ? <BoutonImportCatalogue /> : undefined}
          />
        ) : (
          <Tableau>
            <EnteteTableau>
              <tr>
                <Th>Code</Th>
                <Th>Designation</Th>
                <Th>Categorie</Th>
                <Th numerique>Unite</Th>
                <Th numerique>Prix ref.</Th>
                <Th numerique>Cout</Th>
                <Th numerique>Marge</Th>
                <Th numerique>Min</Th>
                <Th numerique>Moyen</Th>
                <Th numerique>Max</Th>
                <Th numerique>Releves</Th>
                <Th numerique>Maj</Th>
                {modifiable && <Th />}
              </tr>
            </EnteteTableau>
            <tbody>
              {items.map((i) => {
                const pv = nb(i.prixReference)
                const cr = nb(i.coutReference)
                const marge = pv > 0 ? ((pv - cr) / pv) * 100 : 0
                return (
                  <Tr key={i.id} className={i.actif ? undefined : "opacity-50"}>
                    <Td className="text-[11px] tabulaire text-ardoise-500">{i.code ?? "—"}</Td>
                    <Td>
                      <span className="block max-w-72 truncate text-sm text-ardoise-900">
                        {i.designation}
                      </span>
                      {i.fournisseur && (
                        <span className="block truncate text-[10px] text-ardoise-400">
                          {i.fournisseur}
                          {i.localisation ? ` · ${i.localisation}` : ""}
                        </span>
                      )}
                    </Td>
                    <Td>
                      <Badge>{LIBELLES_CATEGORIE[i.categorie]}</Badge>
                    </Td>
                    <Td numerique className="text-xs text-ardoise-500">
                      {LIBELLES_UNITE[i.unite]}
                    </Td>
                    <Td numerique className="text-sm font-medium">{euros(pv, 2)}</Td>
                    <Td numerique className="text-xs text-ardoise-600">{euros(cr, 2)}</Td>
                    <Td numerique>
                      <span
                        className={
                          marge < 10
                            ? "text-xs tabulaire text-chantier-600"
                            : "text-xs tabulaire text-emerald-600"
                        }
                      >
                        {marge.toFixed(0)} %
                      </span>
                    </Td>
                    <Td numerique className="text-xs text-ardoise-500">
                      {i.prixMin ? euros(nb(i.prixMin), 2) : "—"}
                    </Td>
                    <Td numerique className="text-xs text-ardoise-700">
                      {i.prixMoyen ? euros(nb(i.prixMoyen), 2) : "—"}
                    </Td>
                    <Td numerique className="text-xs text-ardoise-500">
                      {i.prixMax ? euros(nb(i.prixMax), 2) : "—"}
                    </Td>
                    <Td numerique className="text-xs text-ardoise-500">{i._count.historique}</Td>
                    <Td numerique className="text-[11px] text-ardoise-400">
                      {dateCourte(i.dateReference)}
                    </Td>
                    {modifiable && (
                      <Td>
                        <div className="flex items-center justify-end gap-0.5">
                          <BasculeActivation priceItemId={i.id} actif={i.actif} />
                          <BoutonModifierPrix
                            prix={{
                              id: i.id,
                              code: i.code,
                              designation: i.designation,
                              description: i.description,
                              categorie: i.categorie,
                              unite: i.unite,
                              prixReference: pv,
                              coutReference: cr,
                              fournisseur: i.fournisseur,
                              localisation: i.localisation,
                            }}
                          />
                          <BoutonSupprimerPrix priceItemId={i.id} />
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

function Filtre({ actif, libelle, href }: { actif: boolean; libelle: string; href: string }) {
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

import { prisma } from "@/lib/prisma"
import { requireAccess } from "@/lib/session"
import { can } from "@/lib/permissions"
import { Badge, Carte, EnteteCarte, Vide } from "@/components/ui/primitives"
import { BasculeVisibilite, BoutonSupprimerDocument, DialogueDocuments } from "./formulaires"
import { dateCourte, libelleEnum } from "@/lib/utils"

/** Arborescence documentaire imposee a tout projet. */
const ARBORESCENCE = [
  "ADMINISTRATIF",
  "PLANS",
  "DEVIS",
  "MARCHES",
  "SOUS_TRAITANTS",
  "PLANNING",
  "SITUATIONS",
  "FACTURES",
  "PHOTOS",
  "PV",
  "RECEPTION",
  "AUTRE",
]

function poids(taille: number | null): string {
  if (!taille) return "—"
  if (taille > 1024 * 1024) return `${(taille / 1024 / 1024).toFixed(1)} Mo`
  return `${Math.max(1, Math.round(taille / 1024))} Ko`
}

export default async function PageDocuments({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const utilisateur = await requireAccess("documents", "read")

  const documents = await prisma.document.findMany({
    where: { projectId: id, organizationId: utilisateur.organizationId },
    orderBy: [{ categorie: "asc" }, { nom: "asc" }, { version: "desc" }],
  })

  const modifiable = can(utilisateur.role, "documents", "create")

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-ardoise-900">Gestion documentaire</h2>
          <p className="text-xs text-ardoise-500">
            {documents.length} document(s) · arborescence automatique par categorie
          </p>
        </div>
        {modifiable && <DialogueDocuments projectId={id} categories={ARBORESCENCE} />}
      </div>

      {ARBORESCENCE.map((categorie) => {
        const fichiers = documents.filter((d) => d.categorie === categorie)
        if (fichiers.length === 0) return null

        return (
          <Carte key={categorie}>
            <EnteteCarte
              titre={libelleEnum(categorie)}
              description={`${fichiers.length} fichier(s)`}
            />
            <ul className="divide-y divide-ardoise-100">
              {fichiers.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-sm font-medium text-ardoise-900 hover:underline"
                    >
                      {d.nom}
                    </a>
                    <p className="truncate text-[11px] text-ardoise-400">
                      {[
                        d.version > 1 ? `version ${d.version}` : null,
                        poids(d.taille),
                        d.auteur,
                        dateCourte(d.createdAt),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      {d.description && ` — ${d.description}`}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {d.visibleClient && <Badge ton="info">client</Badge>}
                    {d.visibleSousTraitant && <Badge ton="violet">sous-traitants</Badge>}
                    {modifiable && (
                      <>
                        <BasculeVisibilite
                          documentId={d.id}
                          cible="client"
                          actif={d.visibleClient}
                        />
                        <BasculeVisibilite
                          documentId={d.id}
                          cible="sousTraitant"
                          actif={d.visibleSousTraitant}
                        />
                        <BoutonSupprimerDocument documentId={d.id} />
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Carte>
        )
      })}

      {documents.length === 0 && (
        <Carte>
          <Vide
            titre="Aucun document"
            description="Plans, devis, marches, PV et attestations se rangent automatiquement dans leur categorie."
            action={modifiable ? <DialogueDocuments projectId={id} categories={ARBORESCENCE} /> : undefined}
          />
        </Carte>
      )}

      <Carte>
        <EnteteCarte titre="Arborescence du projet" description="Categories disponibles" />
        <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4 lg:grid-cols-6">
          {ARBORESCENCE.map((c) => {
            const n = documents.filter((d) => d.categorie === c).length
            return (
              <div
                key={c}
                className="rounded-md border border-ardoise-200 px-2.5 py-2 text-center"
              >
                <p className="truncate text-[11px] font-medium text-ardoise-700">
                  {libelleEnum(c)}
                </p>
                <p className="text-sm font-semibold tabulaire text-ardoise-900">{n}</p>
              </div>
            )
          })}
        </div>
      </Carte>
    </div>
  )
}

import { moisDuPlanning, type ResultatPlanning } from "@/lib/metier/planning"
import { cn, dateCourte, joursEntre, pourcent } from "@/lib/utils"

/**
 * Diagramme de Gantt rendu en CSS pur (pas de dependance graphique).
 * Chaque tache occupe une barre positionnee en pourcentage de la duree totale,
 * ce qui reste lisible et imprimable a toutes les largeurs.
 */
export function Gantt({ planning }: { planning: ResultatPlanning }) {
  if (!planning.dateDebut || !planning.dateFin || planning.taches.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-xs text-ardoise-400">
        Aucune tache planifiee.
      </p>
    )
  }

  const total = Math.max(1, joursEntre(planning.dateDebut, planning.dateFin) + 1)
  const mois = moisDuPlanning(planning.dateDebut, planning.dateFin)
  const aujourdhui = new Date()
  const positionAujourdhui =
    aujourdhui >= planning.dateDebut && aujourdhui <= planning.dateFin
      ? (joursEntre(planning.dateDebut, aujourdhui) / total) * 100
      : null

  return (
    <div className="defilement-fin overflow-x-auto">
      <div className="min-w-[900px]">
        {/* En-tete des mois */}
        <div className="flex border-b border-ardoise-200 bg-ardoise-50/60">
          <div className="w-64 shrink-0 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-ardoise-500">
            Tache
          </div>
          <div className="relative flex flex-1">
            {mois.map((m, i) => (
              <div
                key={i}
                style={{ width: `${(m.jours / total) * 100}%` }}
                className="border-l border-ardoise-200 px-2 py-2 text-[11px] font-medium text-ardoise-500"
              >
                {m.label}
              </div>
            ))}
          </div>
        </div>

        {/* Lignes */}
        <div className="relative">
          {positionAujourdhui !== null && (
            // Le repere se place dans un calque limite a la zone temporelle
            // (a droite de la colonne des libelles) pour que le pourcentage
            // porte bien sur la duree du planning et non sur toute la largeur.
            <div className="pointer-events-none absolute bottom-0 left-64 right-0 top-0 z-10" aria-hidden>
              <div
                className="absolute bottom-0 top-0 w-px bg-chantier-500"
                style={{ left: `${positionAujourdhui}%` }}
              />
            </div>
          )}

          {planning.taches.map((tache) => {
            const debut = (joursEntre(planning.dateDebut!, tache.dateDebut) / total) * 100
            const largeur = Math.max(0.8, ((tache.dureeJours + 1) / total) * 100)

            return (
              <div
                key={tache.id}
                className="flex items-center border-b border-ardoise-100 last:border-0 hover:bg-ardoise-50/40"
              >
                <div className="w-64 shrink-0 px-3 py-2">
                  <p className="truncate text-xs font-medium text-ardoise-900" title={tache.nom}>
                    {tache.lotCode ? `${tache.lotCode} · ` : ""}
                    {tache.nom}
                  </p>
                  <p className="truncate text-[10px] text-ardoise-400">
                    {tache.sousTraitant ?? "Non attribue"} · {tache.dureeJours} j
                    {tache.critique && " · critique"}
                  </p>
                </div>

                <div className="relative h-9 flex-1">
                  <div
                    className={cn(
                      "absolute top-1.5 h-6 overflow-hidden rounded",
                      tache.enRetard
                        ? "bg-red-100 ring-1 ring-red-300"
                        : tache.critique
                          ? "bg-chantier-100 ring-1 ring-chantier-300"
                          : "bg-ardoise-100 ring-1 ring-ardoise-200"
                    )}
                    style={{ left: `${debut}%`, width: `${largeur}%` }}
                    title={`${dateCourte(tache.dateDebut)} → ${dateCourte(tache.dateFin)} · ${pourcent(tache.avancement, 0)}`}
                  >
                    <div
                      className={cn(
                        "h-full",
                        tache.enRetard
                          ? "bg-red-400"
                          : tache.avancement >= 100
                            ? "bg-emerald-500"
                            : tache.critique
                              ? "bg-chantier-500"
                              : "bg-ardoise-500"
                      )}
                      style={{ width: `${Math.min(100, tache.avancement)}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 border-t border-ardoise-200 px-3 py-2 text-[10px] text-ardoise-500">
        <Legende couleur="bg-ardoise-500" libelle="Tache planifiee" />
        <Legende couleur="bg-chantier-500" libelle="Chemin critique" />
        <Legende couleur="bg-emerald-500" libelle="Terminee" />
        <Legende couleur="bg-red-400" libelle="En retard" />
        <Legende couleur="bg-chantier-500" libelle="Aujourd'hui (trait vertical)" />
      </div>
    </div>
  )
}

function Legende({ couleur, libelle }: { couleur: string; libelle: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-2 w-3 rounded-sm", couleur)} />
      {libelle}
    </span>
  )
}

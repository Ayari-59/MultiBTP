import { ajouterJours, arrondi, joursEntre } from "@/lib/utils"

/**
 * Planning : calcul du chemin critique, detection des retards et des conflits
 * de dependance (regle R8).
 *
 * Les taches portent des dates planifiees. Le calcul CPM est mene sur les
 * durees et les liens, puis confronte aux dates saisies : l'ecart revele les
 * taches sans marge (critiques) et les enchainements incoherents.
 */

export type TachePlanning = {
  id: string
  nom: string
  lotId: string | null
  lotCode: string | null
  lotNom: string | null
  sousTraitant: string | null
  statut: string
  dateDebut: Date
  dateFin: Date
  dureeJours: number
  avancement: number
  jalon: boolean
  ordre: number
}

export type Dependance = {
  predecesseurId: string
  successeurId: string
  type: string
  decalageJours: number
}

export type TacheCalculee = TachePlanning & {
  /** Decalage en jours depuis le debut du planning (pour le rendu Gantt) */
  offsetJours: number
  /** Marge totale en jours : 0 = tache critique */
  margeTotale: number
  critique: boolean
  enRetard: boolean
  joursRetard: number
  /** Dependances non respectees par les dates saisies */
  conflits: string[]
  predecesseurs: string[]
}

export type ResultatPlanning = {
  taches: TacheCalculee[]
  dateDebut: Date | null
  dateFin: Date | null
  dureeTotaleJours: number
  avancementMoyen: number
  nbEnRetard: number
  nbCritiques: number
  nbConflits: number
  nbTerminees: number
  /** Nombre de jours de retard du projet (tache la plus en retard) */
  retardProjet: number
}

/** Tri topologique des taches selon les liens de dependance. */
function ordreTopologique(taches: TachePlanning[], deps: Dependance[]): string[] {
  const entrants = new Map<string, number>()
  const sortants = new Map<string, string[]>()

  for (const t of taches) {
    entrants.set(t.id, 0)
    sortants.set(t.id, [])
  }
  for (const d of deps) {
    if (!entrants.has(d.successeurId) || !entrants.has(d.predecesseurId)) continue
    entrants.set(d.successeurId, (entrants.get(d.successeurId) ?? 0) + 1)
    sortants.get(d.predecesseurId)!.push(d.successeurId)
  }

  const file = [...entrants.entries()].filter(([, n]) => n === 0).map(([id]) => id)
  const ordre: string[] = []

  while (file.length > 0) {
    const id = file.shift()!
    ordre.push(id)
    for (const suivant of sortants.get(id) ?? []) {
      const n = (entrants.get(suivant) ?? 1) - 1
      entrants.set(suivant, n)
      if (n === 0) file.push(suivant)
    }
  }

  // Cycle detecte : on complete avec les taches restantes pour ne rien perdre.
  if (ordre.length < taches.length) {
    for (const t of taches) if (!ordre.includes(t.id)) ordre.push(t.id)
  }
  return ordre
}

export function calculerPlanning(
  taches: TachePlanning[],
  deps: Dependance[],
  aujourdhui: Date = new Date()
): ResultatPlanning {
  if (taches.length === 0) {
    return {
      taches: [],
      dateDebut: null,
      dateFin: null,
      dureeTotaleJours: 0,
      avancementMoyen: 0,
      nbEnRetard: 0,
      nbCritiques: 0,
      nbConflits: 0,
      nbTerminees: 0,
      retardProjet: 0,
    }
  }

  const debutProjet = new Date(Math.min(...taches.map((t) => t.dateDebut.getTime())))
  const finProjet = new Date(Math.max(...taches.map((t) => t.dateFin.getTime())))

  const parId = new Map(taches.map((t) => [t.id, t]))
  const ordre = ordreTopologique(taches, deps)

  // Passe avant : date de fin au plus tot.
  const finTot = new Map<string, number>()
  for (const id of ordre) {
    const t = parId.get(id)
    if (!t) continue
    const propres = joursEntre(debutProjet, t.dateDebut) + t.dureeJours
    let auPlusTot = propres
    for (const d of deps.filter((x) => x.successeurId === id)) {
      const finPred = finTot.get(d.predecesseurId)
      if (finPred === undefined) continue
      const contrainte =
        d.type === "DEBUT_DEBUT"
          ? finPred - (parId.get(d.predecesseurId)?.dureeJours ?? 0) + d.decalageJours + t.dureeJours
          : finPred + d.decalageJours + (d.type === "FIN_FIN" ? 0 : t.dureeJours)
      auPlusTot = Math.max(auPlusTot, contrainte)
    }
    finTot.set(id, auPlusTot)
  }

  const finLaPlusTardive = Math.max(...finTot.values())

  // Passe arriere : date de fin au plus tard.
  const finTard = new Map<string, number>()
  for (const id of [...ordre].reverse()) {
    const t = parId.get(id)
    if (!t) continue
    const successeurs = deps.filter((x) => x.predecesseurId === id)
    if (successeurs.length === 0) {
      finTard.set(id, finLaPlusTardive)
      continue
    }
    let auPlusTard = finLaPlusTardive
    for (const d of successeurs) {
      const suivant = parId.get(d.successeurId)
      const finSuivant = finTard.get(d.successeurId)
      if (!suivant || finSuivant === undefined) continue

      // La contrainte porte sur la fin au plus tard de la tache courante, mais
      // le lien peut relier des debuts ou des fins : ignorer le type reviendrait
      // a traiter tout le planning en fin -> debut, ce qui annule toute marge et
      // fait apparaitre l'integralite des taches comme critiques.
      const debutTardSuivant = finSuivant - suivant.dureeJours
      const contrainte =
        d.type === "DEBUT_DEBUT"
          ? // debut(courante) + decalage <= debut(suivante)
            debutTardSuivant - d.decalageJours + t.dureeJours
          : d.type === "FIN_FIN"
            ? // fin(courante) + decalage <= fin(suivante)
              finSuivant - d.decalageJours
            : // FIN_DEBUT : fin(courante) + decalage <= debut(suivante)
              debutTardSuivant - d.decalageJours

      auPlusTard = Math.min(auPlusTard, contrainte)
    }
    finTard.set(id, auPlusTard)
  }

  const calculees: TacheCalculee[] = taches.map((t) => {
    const marge = Math.max(0, (finTard.get(t.id) ?? 0) - (finTot.get(t.id) ?? 0))
    const terminee = t.avancement >= 100 || t.statut === "TERMINE"
    const enRetard = !terminee && aujourdhui > t.dateFin
    const joursRetard = enRetard ? joursEntre(t.dateFin, aujourdhui) : 0

    const conflits: string[] = []
    const predecesseurs: string[] = []
    for (const d of deps.filter((x) => x.successeurId === t.id)) {
      const pred = parId.get(d.predecesseurId)
      if (!pred) continue
      predecesseurs.push(pred.nom)
      const finRequise = ajouterJours(pred.dateFin, d.decalageJours)
      if (d.type === "FIN_DEBUT" && t.dateDebut < finRequise) {
        conflits.push(
          `Demarre avant la fin de « ${pred.nom} » (${joursEntre(t.dateDebut, finRequise)} j de recouvrement)`
        )
      }
    }

    return {
      ...t,
      offsetJours: joursEntre(debutProjet, t.dateDebut),
      margeTotale: marge,
      critique: marge === 0,
      enRetard,
      joursRetard,
      conflits,
      predecesseurs,
    }
  })

  calculees.sort((a, b) => a.dateDebut.getTime() - b.dateDebut.getTime() || a.ordre - b.ordre)

  const avancementMoyen = arrondi(
    calculees.reduce((s, t) => s + t.avancement, 0) / calculees.length,
    2
  )

  return {
    taches: calculees,
    dateDebut: debutProjet,
    dateFin: finProjet,
    dureeTotaleJours: joursEntre(debutProjet, finProjet),
    avancementMoyen,
    nbEnRetard: calculees.filter((t) => t.enRetard).length,
    nbCritiques: calculees.filter((t) => t.critique).length,
    nbConflits: calculees.reduce((s, t) => s + t.conflits.length, 0),
    nbTerminees: calculees.filter((t) => t.avancement >= 100).length,
    retardProjet: Math.max(0, ...calculees.map((t) => t.joursRetard)),
  }
}

/** Decoupe l'axe temporel du Gantt en mois pour l'en-tete du diagramme. */
export function moisDuPlanning(debut: Date, fin: Date): { label: string; jours: number }[] {
  const mois: { label: string; jours: number }[] = []
  const curseur = new Date(debut.getFullYear(), debut.getMonth(), 1)

  while (curseur <= fin) {
    const premierJourMois = new Date(curseur.getFullYear(), curseur.getMonth(), 1)
    const dernierJourMois = new Date(curseur.getFullYear(), curseur.getMonth() + 1, 0)
    const from = premierJourMois < debut ? debut : premierJourMois
    const to = dernierJourMois > fin ? fin : dernierJourMois
    mois.push({
      label: curseur.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
      jours: Math.max(1, joursEntre(from, to) + 1),
    })
    curseur.setMonth(curseur.getMonth() + 1)
  }
  return mois
}

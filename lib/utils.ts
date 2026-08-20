import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Convertit une valeur Prisma (Decimal | number | string | null) en nombre.
 * Les Decimal ne sont pas serialisables vers les composants client : toute
 * lecture passe par ce convertisseur au niveau de la couche `lib/queries`.
 */
export function nb(valeur: unknown, defaut = 0): number {
  if (valeur === null || valeur === undefined) return defaut
  if (typeof valeur === "number") return Number.isFinite(valeur) ? valeur : defaut
  if (typeof valeur === "string") {
    const n = Number(valeur)
    return Number.isFinite(n) ? n : defaut
  }
  if (typeof valeur === "object" && "toString" in (valeur as object)) {
    const n = Number((valeur as { toString(): string }).toString())
    return Number.isFinite(n) ? n : defaut
  }
  return defaut
}

export function euros(valeur: number | null | undefined, decimales = 0): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(nb(valeur))
}

/** Format compact pour les tuiles de KPI : 1 240 000 € -> 1,24 M€ */
export function eurosCompact(valeur: number | null | undefined): string {
  const v = nb(valeur)
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `${(v / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} M€`
  if (abs >= 10_000) return `${(v / 1_000).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} k€`
  return euros(v)
}

export function pourcent(valeur: number | null | undefined, decimales = 1): string {
  return `${nb(valeur).toLocaleString("fr-FR", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })} %`
}

export function nombre(valeur: number | null | undefined, decimales = 0): string {
  return nb(valeur).toLocaleString("fr-FR", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })
}

export function dateCourte(valeur: Date | string | null | undefined): string {
  if (!valeur) return "—"
  const d = typeof valeur === "string" ? new Date(valeur) : valeur
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export function dateLongue(valeur: Date | string | null | undefined): string {
  if (!valeur) return "—"
  const d = typeof valeur === "string" ? new Date(valeur) : valeur
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
}

export function joursEntre(debut: Date, fin: Date): number {
  return Math.round((fin.getTime() - debut.getTime()) / 86_400_000)
}

export function ajouterJours(date: Date, jours: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + jours)
  return d
}

/** Nombre de jours ouvres (lundi-vendredi) ajoutes a une date. */
export function ajouterJoursOuvres(date: Date, jours: number): Date {
  const d = new Date(date)
  let restant = jours
  while (restant > 0) {
    d.setDate(d.getDate() + 1)
    const jour = d.getDay()
    if (jour !== 0 && jour !== 6) restant--
  }
  return d
}

export function initiales(nom: string): string {
  return nom
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((m) => m[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export function slugifier(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/** Libelle lisible pour une valeur d'enum Prisma (SOUS_TRAITANCE -> Sous traitance). */
export function libelleEnum(valeur: string | null | undefined): string {
  if (!valeur) return "—"
  const t = valeur.replace(/_/g, " ").toLowerCase()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export function arrondi(valeur: number, decimales = 2): number {
  const f = 10 ** decimales
  return Math.round((valeur + Number.EPSILON) * f) / f
}

/** Division protegee : renvoie 0 plutot que NaN/Infinity. */
export function ratio(numerateur: number, denominateur: number): number {
  if (!denominateur) return 0
  const r = numerateur / denominateur
  return Number.isFinite(r) ? r : 0
}

export function borner(valeur: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, valeur))
}

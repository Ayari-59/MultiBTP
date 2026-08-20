import Link from "next/link"
import { Badge, Carte, Jauge } from "@/components/ui/primitives"
import { cn, euros, eurosCompact, pourcent } from "@/lib/utils"
import { LIBELLES_STATUT_PROJET } from "@/lib/metier/referentiel"

// ═══════════════════════════════════════════════════════════════════════════
//  Tuile de KPI
// ═══════════════════════════════════════════════════════════════════════════

export function Kpi({
  libelle,
  valeur,
  precision,
  variation,
  ton = "neutre",
  lien,
  compact,
}: {
  libelle: string
  valeur: string | number
  precision?: string
  variation?: { valeur: number; libelle: string }
  ton?: "neutre" | "positif" | "negatif" | "attention"
  lien?: string
  compact?: boolean
}) {
  const tons: Record<string, string> = {
    neutre: "text-ardoise-900",
    positif: "text-emerald-600",
    negatif: "text-red-600",
    attention: "text-chantier-600",
  }

  const contenu = (
    <Carte
      className={cn(
        "h-full px-4 py-3 transition-shadow",
        lien && "hover:border-ardoise-300 hover:shadow"
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-ardoise-500">{libelle}</p>
      <p className={cn("mt-1 font-semibold tabulaire", compact ? "text-xl" : "text-2xl", tons[ton])}>
        {valeur}
      </p>
      {precision && <p className="mt-0.5 text-xs text-ardoise-500">{precision}</p>}
      {variation && (
        <p
          className={cn(
            "mt-1 text-xs font-medium tabulaire",
            variation.valeur >= 0 ? "text-emerald-600" : "text-red-600"
          )}
        >
          {variation.valeur >= 0 ? "▲" : "▼"} {pourcent(Math.abs(variation.valeur))} {variation.libelle}
        </p>
      )}
    </Carte>
  )

  return lien ? <Link href={lien}>{contenu}</Link> : contenu
}

// ═══════════════════════════════════════════════════════════════════════════
//  Badges de statut
// ═══════════════════════════════════════════════════════════════════════════

const TONS_STATUT: Record<string, "neutre" | "info" | "succes" | "alerte" | "danger" | "chantier" | "violet"> = {
  ETUDE: "neutre",
  CHIFFRAGE: "info",
  CONSULTATION: "violet",
  PREPARATION: "alerte",
  EN_COURS: "chantier",
  RECEPTION: "succes",
  TERMINE: "succes",
  ARCHIVE: "neutre",
}

export function StatutProjet({ statut }: { statut: string }) {
  return <Badge ton={TONS_STATUT[statut] ?? "neutre"}>{LIBELLES_STATUT_PROJET[statut] ?? statut}</Badge>
}

const TONS_GENERIQUES: Record<string, "neutre" | "info" | "succes" | "alerte" | "danger" | "chantier" | "violet"> = {
  // Consultations
  BROUILLON: "neutre",
  ENVOYEE: "info",
  EN_ANALYSE: "violet",
  ATTRIBUEE: "succes",
  INFRUCTUEUSE: "danger",
  ANNULEE: "neutre",
  // Offres
  RECUE: "info",
  RETENUE: "succes",
  ECARTEE: "neutre",
  // Marches
  ENVOYE: "info",
  SIGNE: "succes",
  EN_COURS: "chantier",
  RECEPTIONNE: "succes",
  RESILIE: "danger",
  // Taches
  A_FAIRE: "neutre",
  TERMINE: "succes",
  BLOQUE: "danger",
  // Avenants
  DEMANDE: "info",
  CHIFFRE: "alerte",
  ACCEPTE: "succes",
  REFUSE: "danger",
  // Situations / factures
  DEPOSEE: "info",
  EN_VERIFICATION: "alerte",
  VALIDEE: "succes",
  REJETEE: "danger",
  A_VALIDER: "alerte",
  PAYEE: "succes",
  LITIGE: "danger",
  // Incidents / reserves
  OUVERT: "danger",
  EN_TRAITEMENT: "alerte",
  RESOLU: "succes",
  CLOS: "neutre",
  OUVERTE: "alerte",
  LEVEE: "succes",
  // Gravite
  MINEUR: "neutre",
  MODERE: "info",
  MAJEUR: "alerte",
  CRITIQUE: "danger",
  // Lots
  A_CHIFFRER: "neutre",
  EN_CONSULTATION: "violet",
  ATTRIBUE: "info",
  // Pipeline
  NOUVEAU: "neutre",
  QUALIFICATION: "info",
  PROPOSITION: "violet",
  NEGOCIATION: "alerte",
  GAGNE: "succes",
  PERDU: "danger",
}

export function StatutBadge({ statut, libelle }: { statut: string; libelle?: string }) {
  const texte =
    libelle ??
    statut.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase())
  return <Badge ton={TONS_GENERIQUES[statut] ?? "neutre"}>{texte}</Badge>
}

// ═══════════════════════════════════════════════════════════════════════════
//  Affichage de montants
// ═══════════════════════════════════════════════════════════════════════════

export function Montant({
  valeur,
  compact,
  signe,
  className,
}: {
  valeur: number
  compact?: boolean
  /** Colore selon le signe : vert si positif, rouge si negatif */
  signe?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        "tabulaire",
        signe && (valeur > 0 ? "text-emerald-600" : valeur < 0 ? "text-red-600" : "text-ardoise-500"),
        className
      )}
    >
      {signe && valeur > 0 ? "+" : ""}
      {compact ? eurosCompact(valeur) : euros(valeur)}
    </span>
  )
}

export function TauxMarge({ taux, cible }: { taux: number; cible?: number }) {
  const insuffisante = cible !== undefined && taux < cible - 3
  const critique = cible !== undefined && taux < cible / 2
  return (
    <span
      className={cn(
        "tabulaire font-medium",
        critique ? "text-red-600" : insuffisante ? "text-chantier-600" : "text-emerald-600"
      )}
    >
      {pourcent(taux)}
    </span>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  Barre budget -> engage -> realise
// ═══════════════════════════════════════════════════════════════════════════

export function BarreAvancement({
  libelle,
  valeur,
  total,
  ton = "ardoise",
}: {
  libelle: string
  valeur: number
  total: number
  ton?: "ardoise" | "succes" | "alerte" | "danger" | "chantier"
}) {
  const pct = total > 0 ? (valeur / total) * 100 : 0
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-xs text-ardoise-600">{libelle}</span>
        <span className="text-xs font-medium tabulaire text-ardoise-800">
          {euros(valeur)} <span className="text-ardoise-400">({pourcent(pct, 0)})</span>
        </span>
      </div>
      <Jauge valeur={pct} ton={pct > 100 ? "danger" : ton} />
    </div>
  )
}

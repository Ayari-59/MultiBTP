import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// ═══════════════════════════════════════════════════════════════════════════
//  Bouton
// ═══════════════════════════════════════════════════════════════════════════

const variantesBouton = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ardoise-400 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primaire: "bg-ardoise-800 text-white hover:bg-ardoise-900 shadow-sm",
        chantier: "bg-chantier-500 text-white hover:bg-chantier-600 shadow-sm",
        contour: "border border-ardoise-200 bg-white text-ardoise-800 hover:bg-ardoise-50",
        discret: "text-ardoise-600 hover:bg-ardoise-100 hover:text-ardoise-900",
        danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
        succes: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
        lien: "text-ardoise-700 underline-offset-4 hover:underline",
      },
      taille: {
        sm: "h-8 px-3 text-xs",
        md: "h-9 px-4",
        lg: "h-11 px-6 text-base",
        icone: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "primaire", taille: "md" },
  }
)

export interface ProprietesBouton
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof variantesBouton> {
  asChild?: boolean
}

export const Bouton = React.forwardRef<HTMLButtonElement, ProprietesBouton>(
  ({ className, variant, taille, asChild = false, ...props }, ref) => {
    const Composant = asChild ? Slot : "button"
    return (
      <Composant
        ref={ref}
        className={cn(variantesBouton({ variant, taille }), className)}
        {...props}
      />
    )
  }
)
Bouton.displayName = "Bouton"

// ═══════════════════════════════════════════════════════════════════════════
//  Carte
// ═══════════════════════════════════════════════════════════════════════════

export function Carte({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-lg border border-ardoise-200/70 bg-white shadow-sm", className)}
      {...props}
    />
  )
}

export function EnteteCarte({
  titre,
  description,
  action,
  className,
}: {
  titre: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 border-b border-ardoise-200/70 px-4 py-3",
        className
      )}
    >
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-ardoise-900">{titre}</h2>
        {description && <p className="mt-0.5 text-xs text-ardoise-500">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function CorpsCarte({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...props} />
}

// ═══════════════════════════════════════════════════════════════════════════
//  Badge
// ═══════════════════════════════════════════════════════════════════════════

const variantesBadge = cva(
  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-4 ring-1 ring-inset",
  {
    variants: {
      ton: {
        neutre: "bg-ardoise-50 text-ardoise-700 ring-ardoise-200",
        info: "bg-sky-50 text-sky-700 ring-sky-200",
        succes: "bg-emerald-50 text-emerald-700 ring-emerald-200",
        alerte: "bg-amber-50 text-amber-800 ring-amber-200",
        danger: "bg-red-50 text-red-700 ring-red-200",
        chantier: "bg-chantier-50 text-chantier-800 ring-chantier-200",
        violet: "bg-violet-50 text-violet-700 ring-violet-200",
      },
    },
    defaultVariants: { ton: "neutre" },
  }
)

export function Badge({
  className,
  ton,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof variantesBadge>) {
  return <span className={cn(variantesBadge({ ton }), className)} {...props} />
}

// ═══════════════════════════════════════════════════════════════════════════
//  Champs de formulaire
// ═══════════════════════════════════════════════════════════════════════════

export const Champ = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-9 w-full rounded-md border border-ardoise-200 bg-white px-3 text-sm text-ardoise-900 placeholder:text-ardoise-400",
        "focus:border-ardoise-400 focus:outline-none focus:ring-1 focus:ring-ardoise-400",
        "disabled:cursor-not-allowed disabled:bg-ardoise-50",
        className
      )}
      {...props}
    />
  )
)
Champ.displayName = "Champ"

export const ZoneTexte = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "w-full rounded-md border border-ardoise-200 bg-white px-3 py-2 text-sm text-ardoise-900 placeholder:text-ardoise-400",
      "focus:border-ardoise-400 focus:outline-none focus:ring-1 focus:ring-ardoise-400",
      className
    )}
    {...props}
  />
))
ZoneTexte.displayName = "ZoneTexte"

export const Liste = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "h-9 w-full rounded-md border border-ardoise-200 bg-white px-2 text-sm text-ardoise-900",
      "focus:border-ardoise-400 focus:outline-none focus:ring-1 focus:ring-ardoise-400",
      className
    )}
    {...props}
  />
))
Liste.displayName = "Liste"

export function Etiquette({
  className,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn("mb-1 block text-xs font-medium text-ardoise-600", className)} {...props}>
      {children}
    </label>
  )
}

export function Groupe({
  label,
  aide,
  children,
  className,
}: {
  label: string
  aide?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <Etiquette>{label}</Etiquette>
      {children}
      {aide && <p className="mt-1 text-[11px] text-ardoise-400">{aide}</p>}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  Tableau
// ═══════════════════════════════════════════════════════════════════════════

export function Tableau({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="defilement-fin w-full overflow-x-auto">
      <table className={cn("w-full text-sm tabulaire", className)} {...props} />
    </div>
  )
}

export function EnteteTableau({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        "border-b border-ardoise-200 bg-ardoise-50/60 text-[11px] uppercase tracking-wide text-ardoise-500",
        className
      )}
      {...props}
    />
  )
}

export function Th({
  className,
  numerique,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { numerique?: boolean }) {
  return (
    <th
      className={cn(
        "px-3 py-2 font-medium",
        numerique ? "text-right" : "text-left",
        className
      )}
      {...props}
    />
  )
}

export function Td({
  className,
  numerique,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { numerique?: boolean }) {
  return (
    <td
      className={cn("px-3 py-2 align-middle", numerique ? "text-right" : "text-left", className)}
      {...props}
    />
  )
}

export function Tr({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn("border-b border-ardoise-100 last:border-0 hover:bg-ardoise-50/50", className)}
      {...props}
    />
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  Divers
// ═══════════════════════════════════════════════════════════════════════════

export function Vide({
  titre,
  description,
  action,
}: {
  titre: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <p className="text-sm font-medium text-ardoise-700">{titre}</p>
      {description && <p className="max-w-md text-xs text-ardoise-500">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function Jauge({
  valeur,
  ton = "ardoise",
  className,
}: {
  valeur: number
  ton?: "ardoise" | "succes" | "alerte" | "danger" | "chantier"
  className?: string
}) {
  const couleurs: Record<string, string> = {
    ardoise: "bg-ardoise-600",
    succes: "bg-emerald-500",
    alerte: "bg-amber-500",
    danger: "bg-red-500",
    chantier: "bg-chantier-500",
  }
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-ardoise-100", className)}>
      <div
        className={cn("h-full rounded-full transition-all", couleurs[ton])}
        style={{ width: `${Math.min(100, Math.max(0, valeur))}%` }}
      />
    </div>
  )
}

export function Separateur({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-ardoise-200", className)} />
}

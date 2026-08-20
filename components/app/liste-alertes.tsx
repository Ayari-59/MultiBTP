import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { couleurNiveau, pastilleNiveau, type Alerte } from "@/lib/metier/alertes"
import { Vide } from "@/components/ui/primitives"
import { cn } from "@/lib/utils"

export function ListeAlertes({ alertes, limite }: { alertes: Alerte[]; limite?: number }) {
  if (alertes.length === 0) {
    return (
      <Vide
        titre="Aucune alerte"
        description="Marges tenues, budgets respectes, plannings a jour. Rien ne demande d'arbitrage."
      />
    )
  }

  const affichees = limite ? alertes.slice(0, limite) : alertes

  return (
    <ul className="divide-y divide-ardoise-100">
      {affichees.map((alerte) => (
        <li key={alerte.id}>
          <Link
            href={alerte.lien}
            className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-ardoise-50"
          >
            <span
              className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", pastilleNiveau(alerte.niveau))}
              aria-hidden
            />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline gap-2">
                <span className="text-sm font-medium text-ardoise-900">{alerte.titre}</span>
                {alerte.projetRef && (
                  <span className="text-[11px] tabulaire text-ardoise-400">{alerte.projetRef}</span>
                )}
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-ardoise-600">
                {alerte.message}
              </span>
            </span>
            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-ardoise-300" />
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function BandeauAlerte({ alerte }: { alerte: Alerte }) {
  return (
    <div className={cn("rounded-lg border px-4 py-3 text-sm", couleurNiveau(alerte.niveau))}>
      <p className="font-medium">{alerte.titre}</p>
      <p className="mt-0.5 text-xs opacity-90">{alerte.message}</p>
    </div>
  )
}

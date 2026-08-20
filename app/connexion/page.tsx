import type { Metadata } from "next"
import Link from "next/link"
import { FormulaireConnexion } from "./formulaire"

export const metadata: Metadata = { title: "Connexion" }

export default async function PageConnexion({
  searchParams,
}: {
  searchParams: Promise<{ suite?: string }>
}) {
  const { suite } = await searchParams

  return (
    <div className="flex min-h-screen">
      <div className="hidden flex-1 flex-col justify-between bg-ardoise-950 p-10 text-white lg:flex">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded bg-chantier-500 text-sm font-bold">
            BP
          </span>
          <span className="text-base font-semibold tracking-tight">BTP Pilote</span>
        </Link>

        <div className="max-w-md">
          <p className="text-2xl font-semibold leading-snug">
            « Ou en est le chantier, et quelle marge va-t-il laisser ? »
          </p>
          <p className="mt-4 text-sm leading-relaxed text-ardoise-400">
            La reponse ne devrait pas demander trois classeurs Excel et deux appels. Elle est sur
            le tableau de bord, a jour, a chaque instant.
          </p>
        </div>

        <p className="text-xs text-ardoise-600">
          Coordination de travaux · AMO · Chiffrage · Conseil immobilier
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded bg-chantier-500 text-sm font-bold text-white">
                BP
              </span>
              <span className="text-base font-semibold tracking-tight text-ardoise-900">
                BTP Pilote
              </span>
            </Link>
          </div>

          <h1 className="text-xl font-semibold text-ardoise-900">Connexion</h1>
          <p className="mt-1 text-sm text-ardoise-500">
            Accedez a vos projets, chiffrages et chantiers.
          </p>

          <FormulaireConnexion suite={suite} />
        </div>
      </div>
    </div>
  )
}

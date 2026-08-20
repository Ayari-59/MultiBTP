import Link from "next/link"
import { ArrowRight, BarChart3, ClipboardList, HardHat, Scale } from "lucide-react"
import { Bouton } from "@/components/ui/primitives"

const ETAPES = [
  "Prospect",
  "Projet",
  "Chiffrage",
  "Consultation",
  "Comparaison",
  "Marche",
  "Chantier",
  "Situations",
  "Marge finale",
]

const PILIERS = [
  {
    icone: ClipboardList,
    titre: "Chiffrer sans Excel",
    texte:
      "Lots, postes, quantites, prix unitaires et ventilation des couts. La bibliotheque de prix propose le prix pratique sur vos chantiers precedents.",
  },
  {
    icone: Scale,
    titre: "Comparer les offres objectivement",
    texte:
      "Chaque consultation genere un tableau comparatif note sur le prix, le delai, la qualite, la fiabilite administrative et l'historique.",
  },
  {
    icone: BarChart3,
    titre: "Voir la marge avant la fin",
    texte:
      "Budget, engage, realise et prevision d'atterrissage se recalculent a chaque marche signe, chaque avenant et chaque facture.",
  },
  {
    icone: HardHat,
    titre: "Suivre le chantier depuis le terrain",
    texte:
      "Avancement, photos, incidents et reserves saisis sur tablette alimentent directement le planning et le controle budgetaire.",
  },
]

export default function Accueil() {
  return (
    <div className="min-h-screen bg-ardoise-950 text-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded bg-chantier-500 text-sm font-bold">
            BP
          </span>
          <span className="text-base font-semibold tracking-tight">BTP Pilote</span>
        </span>
        <Bouton asChild variant="contour" taille="sm">
          <Link href="/connexion">Se connecter</Link>
        </Bouton>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 pb-16 pt-10 sm:pt-20">
          <p className="mb-4 inline-flex rounded-full border border-chantier-500/40 bg-chantier-500/10 px-3 py-1 text-xs font-medium text-chantier-300">
            SaaS vertical BTP — chiffrage, sous-traitance, rentabilite
          </p>
          <h1 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Combien le chantier doit couter, combien il coute deja, ou il en est,
            <span className="text-chantier-400"> et quelle marge il laissera.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-ardoise-300">
            BTP Pilote reunit dans une seule fiche projet le chiffrage, la consultation des
            sous-traitants, les marches, le budget, le planning et le suivi de chantier. Quatre
            questions, une reponse a jour en permanence.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Bouton asChild variant="chantier" taille="lg">
              <Link href="/connexion">
                Acceder a la plateforme <ArrowRight className="h-4 w-4" />
              </Link>
            </Bouton>
          </div>

          <div className="mt-14 flex flex-wrap items-center gap-x-2 gap-y-2 text-xs text-ardoise-400">
            {ETAPES.map((etape, i) => (
              <span key={etape} className="flex items-center gap-2">
                <span className="rounded border border-ardoise-700 bg-ardoise-900 px-2.5 py-1 font-medium text-ardoise-200">
                  {etape}
                </span>
                {i < ETAPES.length - 1 && <span className="text-ardoise-600">→</span>}
              </span>
            ))}
          </div>
        </section>

        <section className="border-t border-ardoise-800 bg-ardoise-900/50">
          <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 sm:grid-cols-2">
            {PILIERS.map((pilier) => {
              const Icone = pilier.icone
              return (
                <div key={pilier.titre} className="flex gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ardoise-800 text-chantier-400">
                    <Icone className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold">{pilier.titre}</h2>
                    <p className="mt-1.5 text-sm leading-relaxed text-ardoise-400">{pilier.texte}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </main>

      <footer className="border-t border-ardoise-800 px-6 py-6 text-center text-xs text-ardoise-500">
        BTP Pilote — coordination de travaux, AMO, conseil immobilier.
      </footer>
    </div>
  )
}

"use client"

import { useActionState, useEffect, useMemo, useState, useTransition } from "react"
import { useFormStatus } from "react-dom"
import { Copy, Pencil, Plus, Trash2, Wand2 } from "lucide-react"
import {
  Bouton,
  Champ,
  Etiquette,
  Groupe,
  Liste,
  ZoneTexte,
} from "@/components/ui/primitives"
import { ContenuDialogue, Dialogue, DeclencheurDialogue } from "@/components/ui/dialogue"
import {
  ajusterPrixLot,
  creerScenario,
  enregistrerLot,
  enregistrerPoste,
  retenirScenario,
  supprimerLot,
  supprimerPoste,
  supprimerScenario,
  ventilerAutomatiquement,
  verserDansBibliotheque,
  type EtatFormulaire,
} from "@/lib/actions/chiffrage"
import type { PosteVue, SuggestionPrix } from "@/lib/queries/chiffrage"
import { LIBELLES_CATEGORIE, LIBELLES_UNITE } from "@/lib/metier/referentiel"
import { arrondi, euros } from "@/lib/utils"

const UNITES = Object.keys(LIBELLES_UNITE)
const CATEGORIES = Object.keys(LIBELLES_CATEGORIE)

function BoutonEnvoi({ libelle }: { libelle: string }) {
  const { pending } = useFormStatus()
  return (
    <Bouton type="submit" disabled={pending}>
      {pending ? "Enregistrement..." : libelle}
    </Bouton>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  Poste de chiffrage
// ═══════════════════════════════════════════════════════════════════════════

export function DialoguePoste({
  estimateId,
  lotId,
  lotNom,
  categorie,
  poste,
  suggestions,
  margeCible,
  declencheur,
}: {
  estimateId: string
  lotId: string
  lotNom: string
  categorie: string
  poste?: PosteVue
  suggestions: SuggestionPrix[]
  margeCible: number
  declencheur?: React.ReactNode
}) {
  const [ouvert, setOuvert] = useState(false)
  const [etat, action] = useActionState<EtatFormulaire, FormData>(enregistrerPoste, {})

  const [designation, setDesignation] = useState(poste?.designation ?? "")
  const [unite, setUnite] = useState(poste?.unite ?? "U")
  const [quantite, setQuantite] = useState(String(poste?.quantite ?? 1))
  const [prixUnitaire, setPrixUnitaire] = useState(String(poste?.prixUnitaire ?? 0))
  const [couts, setCouts] = useState({
    coutMateriaux: String(poste?.coutMateriaux ?? 0),
    coutMainOeuvre: String(poste?.coutMainOeuvre ?? 0),
    coutSousTraitance: String(poste?.coutSousTraitance ?? 0),
    coutMateriel: String(poste?.coutMateriel ?? 0),
    coutTransport: String(poste?.coutTransport ?? 0),
  })
  const [priceItemId, setPriceItemId] = useState("")

  useEffect(() => {
    if (etat.ok) setOuvert(false)
  }, [etat.ok])

  // Suggestions filtrees sur la categorie du lot puis sur la saisie.
  const proposees = useMemo(() => {
    const terme = designation.trim().toLowerCase()
    return suggestions
      .filter((s) => s.categorie === categorie || terme.length >= 3)
      .filter((s) => terme.length < 2 || s.designation.toLowerCase().includes(terme))
      .slice(0, 6)
  }, [suggestions, categorie, designation])

  const total = arrondi((Number(quantite) || 0) * (Number(prixUnitaire) || 0))
  const coutUnitaire = Object.values(couts).reduce((s, v) => s + (Number(v) || 0), 0)
  const coutTotal = arrondi((Number(quantite) || 0) * coutUnitaire)
  const marge = total - (coutTotal > 0 ? coutTotal : total * (1 - margeCible / 100))
  const tauxMarge = total > 0 ? (marge / total) * 100 : 0

  function appliquerSuggestion(s: SuggestionPrix) {
    setDesignation(s.designation)
    setUnite(s.unite)
    setPrixUnitaire(String(s.prix))
    setPriceItemId(s.id)
    setCouts({
      coutMateriaux: "0",
      coutMainOeuvre: "0",
      coutSousTraitance: String(s.cout),
      coutMateriel: "0",
      coutTransport: "0",
    })
  }

  return (
    <Dialogue open={ouvert} onOpenChange={setOuvert}>
      <DeclencheurDialogue asChild>
        {declencheur ?? (
          <Bouton variant="contour" taille="sm">
            <Plus className="h-3.5 w-3.5" /> Poste
          </Bouton>
        )}
      </DeclencheurDialogue>

      <ContenuDialogue
        large
        titre={poste ? "Modifier le poste" : "Ajouter un poste"}
        description={lotNom}
      >
        <form action={action} className="space-y-4">
          <input type="hidden" name="estimateId" value={estimateId} />
          <input type="hidden" name="lotId" value={lotId} />
          {poste && <input type="hidden" name="posteId" value={poste.id} />}
          {priceItemId && <input type="hidden" name="priceItemId" value={priceItemId} />}

          <Groupe label="Designation">
            <Champ
              name="designation"
              value={designation}
              onChange={(e) => {
                setDesignation(e.target.value)
                setPriceItemId("")
              }}
              placeholder="Prise electrique 16 A avec terre"
              autoComplete="off"
            />
          </Groupe>

          {proposees.length > 0 && (
            <div className="rounded-md border border-ardoise-200 bg-ardoise-50/60 p-2">
              <p className="mb-1.5 text-[11px] font-medium text-ardoise-600">
                Bibliotheque de prix — cliquez pour reprendre le prix pratique
              </p>
              <ul className="space-y-1">
                {proposees.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => appliquerSuggestion(s)}
                      className="flex w-full items-baseline justify-between gap-3 rounded px-2 py-1 text-left text-xs hover:bg-white"
                    >
                      <span className="min-w-0 flex-1 truncate text-ardoise-800">
                        {s.designation}
                      </span>
                      <span className="shrink-0 tabulaire text-ardoise-500">
                        {euros(s.prix, 2)} / {LIBELLES_UNITE[s.unite]}
                        {s.prixMin !== null && s.prixMax !== null && s.prixMin !== s.prixMax && (
                          <span className="ml-1.5 text-ardoise-400">
                            ({euros(s.prixMin)} – {euros(s.prixMax)})
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <Groupe label="Unite">
              <Liste name="unite" value={unite} onChange={(e) => setUnite(e.target.value)}>
                {UNITES.map((u) => (
                  <option key={u} value={u}>
                    {LIBELLES_UNITE[u]}
                  </option>
                ))}
              </Liste>
            </Groupe>
            <Groupe label="Quantite">
              <Champ
                name="quantite"
                type="number"
                step="0.001"
                min="0"
                value={quantite}
                onChange={(e) => setQuantite(e.target.value)}
              />
            </Groupe>
            <Groupe label="Prix unitaire HT (€)">
              <Champ
                name="prixUnitaire"
                type="number"
                step="0.01"
                min="0"
                value={prixUnitaire}
                onChange={(e) => setPrixUnitaire(e.target.value)}
              />
            </Groupe>
          </div>

          <div>
            <Etiquette>Ventilation du cout de revient unitaire (€)</Etiquette>
            <div className="grid gap-2 sm:grid-cols-5">
              {(
                [
                  ["coutMateriaux", "Materiaux"],
                  ["coutMainOeuvre", "Main-d'oeuvre"],
                  ["coutSousTraitance", "Sous-traitance"],
                  ["coutMateriel", "Materiel"],
                  ["coutTransport", "Transport"],
                ] as const
              ).map(([cle, libelle]) => (
                <div key={cle}>
                  <Champ
                    name={cle}
                    type="number"
                    step="0.01"
                    min="0"
                    value={couts[cle]}
                    onChange={(e) => setCouts((c) => ({ ...c, [cle]: e.target.value }))}
                  />
                  <p className="mt-0.5 text-[10px] text-ardoise-400">{libelle}</p>
                </div>
              ))}
            </div>
          </div>

          <Groupe label="Description (optionnel)">
            <ZoneTexte name="description" rows={2} defaultValue={poste?.description ?? ""} />
          </Groupe>

          <div className="grid grid-cols-3 gap-3 rounded-md bg-ardoise-50 px-3 py-2.5 text-center">
            <div>
              <p className="text-[10px] uppercase text-ardoise-500">Total HT</p>
              <p className="text-sm font-semibold tabulaire text-ardoise-900">{euros(total, 2)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-ardoise-500">Cout de revient</p>
              <p className="text-sm font-semibold tabulaire text-ardoise-700">
                {euros(coutTotal > 0 ? coutTotal : total * (1 - margeCible / 100), 2)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-ardoise-500">Marge</p>
              <p
                className={
                  tauxMarge < margeCible - 3
                    ? "text-sm font-semibold tabulaire text-red-600"
                    : "text-sm font-semibold tabulaire text-emerald-600"
                }
              >
                {tauxMarge.toFixed(1)} %
              </p>
            </div>
          </div>

          {etat.erreur && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {etat.erreur}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Bouton type="button" variant="contour" onClick={() => setOuvert(false)}>
              Annuler
            </Bouton>
            <BoutonEnvoi libelle={poste ? "Enregistrer" : "Ajouter le poste"} />
          </div>
        </form>
      </ContenuDialogue>
    </Dialogue>
  )
}

export function BoutonModifierPoste(props: Omit<Parameters<typeof DialoguePoste>[0], "declencheur">) {
  return (
    <DialoguePoste
      {...props}
      declencheur={
        <button
          type="button"
          className="rounded p-1 text-ardoise-400 hover:bg-ardoise-100 hover:text-ardoise-700"
          title="Modifier"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      }
    />
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  Lot
// ═══════════════════════════════════════════════════════════════════════════

export function DialogueLot({
  projectId,
  lot,
  declencheur,
}: {
  projectId: string
  lot?: { id: string; code: string; nom: string; categorie: string; sousTraite: boolean; descriptif: string | null }
  declencheur?: React.ReactNode
}) {
  const [ouvert, setOuvert] = useState(false)
  const [etat, action] = useActionState<EtatFormulaire, FormData>(enregistrerLot, {})

  useEffect(() => {
    if (etat.ok) setOuvert(false)
  }, [etat.ok])

  return (
    <Dialogue open={ouvert} onOpenChange={setOuvert}>
      <DeclencheurDialogue asChild>
        {declencheur ?? (
          <Bouton variant="contour" taille="sm">
            <Plus className="h-3.5 w-3.5" /> Lot
          </Bouton>
        )}
      </DeclencheurDialogue>

      <ContenuDialogue titre={lot ? "Modifier le lot" : "Ajouter un lot"}>
        <form action={action} className="space-y-4">
          <input type="hidden" name="projectId" value={projectId} />
          {lot && <input type="hidden" name="lotId" value={lot.id} />}

          <div className="grid gap-3 sm:grid-cols-[100px_1fr]">
            <Groupe label="Code">
              <Champ name="code" defaultValue={lot?.code ?? ""} placeholder="06" />
            </Groupe>
            <Groupe label="Intitule">
              <Champ name="nom" defaultValue={lot?.nom ?? ""} placeholder="Electricite courants forts" />
            </Groupe>
          </div>

          <Groupe label="Categorie">
            <Liste name="categorie" defaultValue={lot?.categorie ?? "AUTRE"}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {LIBELLES_CATEGORIE[c]}
                </option>
              ))}
            </Liste>
          </Groupe>

          <label className="flex items-center gap-2 text-sm text-ardoise-700">
            <input
              type="checkbox"
              name="sousTraite"
              defaultChecked={lot?.sousTraite ?? true}
              className="h-4 w-4 accent-ardoise-800"
            />
            Lot confie a un sous-traitant
          </label>

          <Groupe label="Descriptif" aide="Repris dans le dossier de consultation.">
            <ZoneTexte name="descriptif" rows={3} defaultValue={lot?.descriptif ?? ""} />
          </Groupe>

          {etat.erreur && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {etat.erreur}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Bouton type="button" variant="contour" onClick={() => setOuvert(false)}>
              Annuler
            </Bouton>
            <BoutonEnvoi libelle={lot ? "Enregistrer" : "Ajouter le lot"} />
          </div>
        </form>
      </ContenuDialogue>
    </Dialogue>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  Actions rapides
// ═══════════════════════════════════════════════════════════════════════════

export function BoutonSuppression({
  cible,
  id,
  confirmation,
}: {
  cible: "poste" | "lot" | "scenario"
  id: string
  confirmation: string
}) {
  const [enCours, demarrer] = useTransition()

  return (
    <button
      type="button"
      disabled={enCours}
      title="Supprimer"
      onClick={() => {
        if (!window.confirm(confirmation)) return
        demarrer(() => {
          if (cible === "poste") void supprimerPoste(id)
          else if (cible === "lot") void supprimerLot(id)
          else void supprimerScenario(id)
        })
      }}
      className="rounded p-1 text-ardoise-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  )
}

export function ActionsChiffrage({
  estimateId,
  retenu,
}: {
  estimateId: string
  retenu: boolean
}) {
  const [enCours, demarrer] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  return (
    <div className="flex flex-wrap items-center gap-2">
      {message && <span className="text-xs text-emerald-600">{message}</span>}

      <Bouton
        variant="contour"
        taille="sm"
        disabled={enCours}
        onClick={() => demarrer(() => void ventilerAutomatiquement(estimateId))}
        title="Repartit le cout de revient sur materiaux, main-d'oeuvre et sous-traitance pour les postes non ventiles"
      >
        <Wand2 className="h-3.5 w-3.5" /> Ventiler les couts
      </Bouton>

      <Bouton
        variant="contour"
        taille="sm"
        disabled={enCours}
        onClick={() =>
          demarrer(async () => {
            const n = await verserDansBibliotheque(estimateId)
            setMessage(`${n} poste(s) verses dans la bibliotheque.`)
          })
        }
      >
        <Copy className="h-3.5 w-3.5" /> Verser en bibliotheque
      </Bouton>

      {!retenu && (
        <Bouton
          variant="succes"
          taille="sm"
          disabled={enCours}
          onClick={() => demarrer(() => void retenirScenario(estimateId))}
        >
          Retenir ce chiffrage
        </Bouton>
      )}
    </div>
  )
}

export function BoutonScenario({ estimateId, scenario }: { estimateId: string; scenario: string }) {
  const [enCours, demarrer] = useTransition()
  return (
    <Bouton
      variant="contour"
      taille="sm"
      disabled={enCours}
      onClick={() => demarrer(() => void creerScenario(estimateId, scenario))}
    >
      + Variante {scenario.toLowerCase()}
    </Bouton>
  )
}

export function AjustementLot({
  estimateId,
  lotId,
}: {
  estimateId: string
  lotId: string
}) {
  const [enCours, demarrer] = useTransition()
  const [valeur, setValeur] = useState("-5")

  return (
    <div className="flex items-center gap-1">
      <Champ
        type="number"
        step="0.5"
        value={valeur}
        onChange={(e) => setValeur(e.target.value)}
        className="h-7 w-16 px-1.5 text-xs"
        title="Pourcentage a appliquer aux prix du lot"
      />
      <Bouton
        variant="discret"
        taille="sm"
        disabled={enCours}
        className="h-7 px-2 text-xs"
        onClick={() => demarrer(() => void ajusterPrixLot(estimateId, lotId, Number(valeur) || 0))}
      >
        %
      </Bouton>
    </div>
  )
}

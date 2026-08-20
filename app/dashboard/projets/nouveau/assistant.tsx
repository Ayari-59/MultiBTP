"use client"

import { useActionState, useMemo, useState } from "react"
import { useFormStatus } from "react-dom"
import { AlertCircle, ArrowLeft, ArrowRight, Check, Rocket } from "lucide-react"
import {
  Bouton,
  Carte,
  Champ,
  CorpsCarte,
  EnteteCarte,
  EnteteTableau,
  Etiquette,
  Groupe,
  Liste,
  Tableau,
  Td,
  Th,
  Tr,
  ZoneTexte,
} from "@/components/ui/primitives"
import { lancerProjet, type EtatLancement } from "@/lib/actions/projets"
import { genererProjet } from "@/lib/metier/lancement"
import { LIBELLES_OPERATION, LIBELLES_UNITE, TRAMES } from "@/lib/metier/referentiel"
import { cn, dateCourte, euros, nombre, pourcent } from "@/lib/utils"

type Contact = { id: string; libelle: string; ville: string | null }
type Defauts = {
  margeCible: number
  tauxFraisChantier: number
  tauxFraisGeneraux: number
  tauxTva: number
}

const ETAPES = [
  "Client",
  "Bien",
  "Travaux",
  "Surface",
  "Lots",
  "Chiffrage",
  "Sous-traitance",
  "Planning",
  "Validation",
]

const TYPES_BIEN = [
  "IMMEUBLE",
  "APPARTEMENT",
  "MAISON",
  "LOCAL_COMMERCIAL",
  "BUREAUX",
  "ENTREPOT",
  "TERRAIN",
  "AUTRE",
]

export function AssistantCreation({
  contacts,
  defauts,
  prix,
}: {
  contacts: Contact[]
  defauts: Defauts
  prix: { code: string; prix: number; cout: number }[]
}) {
  const [etat, action] = useActionState<EtatLancement, FormData>(lancerProjet, {})
  const [etape, setEtape] = useState(0)

  // ─── Etat du formulaire ───────────────────────────────────────────────────
  const [contactId, setContactId] = useState("")
  const [clientNom, setClientNom] = useState("")
  const [clientSociete, setClientSociete] = useState("")
  const [clientEmail, setClientEmail] = useState("")
  const [clientTelephone, setClientTelephone] = useState("")

  const [nom, setNom] = useState("")
  const [adresse, setAdresse] = useState("")
  const [codePostal, setCodePostal] = useState("")
  const [ville, setVille] = useState("")
  const [typeBien, setTypeBien] = useState("IMMEUBLE")

  const [typeOperation, setTypeOperation] = useState("RENOVATION_LOURDE")
  const [surface, setSurface] = useState("1200")

  const [lotsExclus, setLotsExclus] = useState<string[]>([])

  const [margeCible, setMargeCible] = useState(String(defauts.margeCible))
  const [tauxFraisChantier, setTauxFraisChantier] = useState(String(defauts.tauxFraisChantier))
  const [tauxFraisGeneraux, setTauxFraisGeneraux] = useState(String(defauts.tauxFraisGeneraux))
  const [tauxTva, setTauxTva] = useState(String(defauts.tauxTva))

  const [genererConsultations, setGenererConsultations] = useState(true)
  const [genererPlanning, setGenererPlanning] = useState(true)

  const [dateDebut, setDateDebut] = useState(() => new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState("")
  const [contraintes, setContraintes] = useState("")

  const prixMap = useMemo(
    () => new Map(prix.map((p) => [p.code, { prix: p.prix, cout: p.cout }])),
    [prix]
  )

  const trames = TRAMES[typeOperation] ?? TRAMES.RENOVATION_LOURDE

  // Le meme moteur que le serveur : l'apercu est exactement ce qui sera cree.
  const proposition = useMemo(() => {
    const s = Number(surface)
    if (!Number.isFinite(s) || s <= 0) return null
    return genererProjet({
      typeOperation,
      surface: s,
      params: {
        margeCible: Number(margeCible) || 0,
        tauxFraisChantier: Number(tauxFraisChantier) || 0,
        tauxFraisGeneraux: Number(tauxFraisGeneraux) || 0,
        tauxTva: Number(tauxTva) || 0,
      },
      prixOrganisation: prixMap,
      dateDebut: new Date(dateDebut),
      lotsExclus,
    })
  }, [
    typeOperation,
    surface,
    margeCible,
    tauxFraisChantier,
    tauxFraisGeneraux,
    tauxTva,
    prixMap,
    dateDebut,
    lotsExclus,
  ])

  const surfaceValide = Number(surface) > 0
  const peutAvancer =
    (etape === 0 && (contactId !== "" || clientNom.trim() !== "" || clientSociete.trim() !== "")) ||
    (etape === 1 && nom.trim().length >= 3) ||
    etape === 2 ||
    (etape === 3 && surfaceValide) ||
    (etape >= 4 && etape < ETAPES.length - 1)

  return (
    <form action={action} className="grid gap-4 lg:grid-cols-[1fr_360px]">
      {/* ─── Champs transmis au serveur ────────────────────────────────── */}
      <ChampsCaches
        valeurs={{
          contactId,
          clientNom,
          clientSociete,
          clientEmail,
          clientTelephone,
          nom,
          adresse,
          codePostal,
          ville,
          typeBien,
          typeOperation,
          surface,
          margeCible,
          tauxFraisChantier,
          tauxFraisGeneraux,
          tauxTva,
          dateDebut,
          description,
          contraintes,
        }}
        lotsExclus={lotsExclus}
        genererPlanning={genererPlanning}
      />
      {genererConsultations && <input type="hidden" name="genererConsultations" value="on" />}

      <div className="space-y-4">
        <Fil etape={etape} onAller={setEtape} />

        <Carte>
          <EnteteCarte
            titre={`Etape ${etape + 1} — ${ETAPES[etape]}`}
            description={AIDE[etape]}
          />
          <CorpsCarte className="space-y-4">
            {etape === 0 && (
              <>
                <Groupe label="Client existant">
                  <Liste value={contactId} onChange={(e) => setContactId(e.target.value)}>
                    <option value="">— Nouveau client —</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.libelle}
                        {c.ville ? ` (${c.ville})` : ""}
                      </option>
                    ))}
                  </Liste>
                </Groupe>

                {contactId === "" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Groupe label="Nom du contact">
                      <Champ value={clientNom} onChange={(e) => setClientNom(e.target.value)} placeholder="Bernard" />
                    </Groupe>
                    <Groupe label="Societe">
                      <Champ
                        value={clientSociete}
                        onChange={(e) => setClientSociete(e.target.value)}
                        placeholder="SCI Les Tilleuls"
                      />
                    </Groupe>
                    <Groupe label="E-mail">
                      <Champ
                        type="email"
                        value={clientEmail}
                        onChange={(e) => setClientEmail(e.target.value)}
                        placeholder="contact@societe.fr"
                      />
                    </Groupe>
                    <Groupe label="Telephone">
                      <Champ
                        value={clientTelephone}
                        onChange={(e) => setClientTelephone(e.target.value)}
                        placeholder="06 12 34 56 78"
                      />
                    </Groupe>
                  </div>
                )}
              </>
            )}

            {etape === 1 && (
              <>
                <Groupe label="Nom du projet" aide="Il apparaitra sur les consultations et les marches.">
                  <Champ
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    placeholder="Renovation immeuble Republique"
                  />
                </Groupe>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Groupe label="Adresse" className="sm:col-span-2">
                    <Champ value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="14 rue de la Republique" />
                  </Groupe>
                  <Groupe label="Code postal">
                    <Champ value={codePostal} onChange={(e) => setCodePostal(e.target.value)} placeholder="59000" />
                  </Groupe>
                  <Groupe label="Ville">
                    <Champ value={ville} onChange={(e) => setVille(e.target.value)} placeholder="Lille" />
                  </Groupe>
                  <Groupe label="Type de bien" className="sm:col-span-2">
                    <Liste value={typeBien} onChange={(e) => setTypeBien(e.target.value)}>
                      {TYPES_BIEN.map((t) => (
                        <option key={t} value={t}>
                          {t.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase())}
                        </option>
                      ))}
                    </Liste>
                  </Groupe>
                </div>
              </>
            )}

            {etape === 2 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries(LIBELLES_OPERATION).map(([cle, libelle]) => (
                  <button
                    key={cle}
                    type="button"
                    onClick={() => {
                      setTypeOperation(cle)
                      setLotsExclus([])
                    }}
                    className={cn(
                      "rounded-md border px-3 py-2.5 text-left text-sm transition-colors",
                      typeOperation === cle
                        ? "border-ardoise-800 bg-ardoise-800 text-white"
                        : "border-ardoise-200 text-ardoise-700 hover:bg-ardoise-50"
                    )}
                  >
                    <span className="block font-medium">{libelle}</span>
                    <span
                      className={cn(
                        "mt-0.5 block text-[11px]",
                        typeOperation === cle ? "text-ardoise-300" : "text-ardoise-400"
                      )}
                    >
                      {(TRAMES[cle] ?? []).length} lot(s) proposes
                    </span>
                  </button>
                ))}
              </div>
            )}

            {etape === 3 && (
              <>
                <Groupe
                  label="Surface de l'operation (m²)"
                  aide="Toutes les quantites du chiffrage genere sont deduites de cette surface."
                >
                  <Champ
                    type="number"
                    min={1}
                    step={1}
                    value={surface}
                    onChange={(e) => setSurface(e.target.value)}
                  />
                </Groupe>
                {proposition && (
                  <p className="rounded-md bg-ardoise-50 px-3 py-2 text-xs text-ardoise-600">
                    Ratio indicatif : <strong className="tabulaire">{euros(proposition.ratioAuM2)}/m²</strong> HT,
                    soit {euros(proposition.montantHT)} pour {nombre(Number(surface))} m².
                  </p>
                )}
              </>
            )}

            {etape === 4 && (
              <div className="space-y-1.5">
                <p className="text-xs text-ardoise-500">
                  Decochez les lots qui ne concernent pas l&apos;operation.
                </p>
                {trames.map((lot) => {
                  const inclus = !lotsExclus.includes(lot.code)
                  const detail = proposition?.lots.find((l) => l.code === lot.code)
                  return (
                    <label
                      key={lot.code}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm",
                        inclus ? "border-ardoise-200 bg-white" : "border-ardoise-100 bg-ardoise-50/50 opacity-60"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={inclus}
                        onChange={() =>
                          setLotsExclus((prev) =>
                            prev.includes(lot.code)
                              ? prev.filter((c) => c !== lot.code)
                              : [...prev, lot.code]
                          )
                        }
                        className="h-4 w-4 rounded border-ardoise-300 accent-ardoise-800"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-ardoise-900">
                          {lot.code} — {lot.nom}
                        </span>
                        <span className="block truncate text-[11px] text-ardoise-400">
                          {lot.sousTraite ? "Sous-traite" : "Realise en interne"} · {lot.postes.length} poste(s)
                        </span>
                      </span>
                      {detail && (
                        <span className="shrink-0 text-xs font-medium tabulaire text-ardoise-700">
                          {euros(detail.montantHT)}
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>
            )}

            {etape === 5 && (
              <>
                <div className="grid gap-3 sm:grid-cols-4">
                  <Groupe label="Marge cible (%)" aide="Sur le prix de vente">
                    <Champ type="number" step="0.5" value={margeCible} onChange={(e) => setMargeCible(e.target.value)} />
                  </Groupe>
                  <Groupe label="Frais de chantier (%)">
                    <Champ
                      type="number"
                      step="0.5"
                      value={tauxFraisChantier}
                      onChange={(e) => setTauxFraisChantier(e.target.value)}
                    />
                  </Groupe>
                  <Groupe label="Frais generaux (%)">
                    <Champ
                      type="number"
                      step="0.5"
                      value={tauxFraisGeneraux}
                      onChange={(e) => setTauxFraisGeneraux(e.target.value)}
                    />
                  </Groupe>
                  <Groupe label="TVA (%)">
                    <Champ type="number" step="0.5" value={tauxTva} onChange={(e) => setTauxTva(e.target.value)} />
                  </Groupe>
                </div>

                {proposition && (
                  <Tableau>
                    <EnteteTableau>
                      <tr>
                        <Th>Lot</Th>
                        <Th numerique>Postes</Th>
                        <Th numerique>Cout direct</Th>
                        <Th numerique>Montant HT</Th>
                      </tr>
                    </EnteteTableau>
                    <tbody>
                      {proposition.lots.map((lot) => (
                        <Tr key={lot.code}>
                          <Td>
                            <span className="text-sm">{lot.code} — {lot.nom}</span>
                          </Td>
                          <Td numerique className="text-xs text-ardoise-500">{lot.postes.length}</Td>
                          <Td numerique className="text-xs text-ardoise-600">{euros(lot.coutDirect)}</Td>
                          <Td numerique className="text-sm font-medium">{euros(lot.montantHT)}</Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Tableau>
                )}
              </>
            )}

            {etape === 6 && (
              <>
                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-ardoise-200 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={genererConsultations}
                    onChange={(e) => setGenererConsultations(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-ardoise-800"
                  />
                  <span>
                    <span className="block text-sm font-medium text-ardoise-900">
                      Preparer les consultations des lots sous-traites
                    </span>
                    <span className="mt-0.5 block text-xs text-ardoise-500">
                      Une consultation en brouillon est creee par lot sous-traite, avec le descriptif,
                      le budget estime et le delai souhaite. Vous choisirez les entreprises a
                      consulter depuis la fiche projet.
                    </span>
                  </span>
                </label>

                {proposition && (
                  <div className="rounded-md bg-ardoise-50 px-3 py-2.5">
                    <p className="text-xs font-medium text-ardoise-700">
                      {proposition.lotsASousTraiter.length} lot(s) a sous-traiter
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-ardoise-500">
                      {proposition.lots
                        .filter((l) => l.sousTraite)
                        .map((l) => l.nom)
                        .join(" · ")}
                    </p>
                  </div>
                )}
              </>
            )}

            {etape === 7 && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Groupe label="Date de demarrage prevue">
                    <Champ type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
                  </Groupe>
                  <div className="flex items-end">
                    <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-ardoise-700">
                      <input
                        type="checkbox"
                        checked={genererPlanning}
                        onChange={(e) => setGenererPlanning(e.target.checked)}
                        className="h-4 w-4 accent-ardoise-800"
                      />
                      Generer le planning previsionnel
                    </label>
                  </div>
                </div>

                {proposition && genererPlanning && (
                  <Tableau>
                    <EnteteTableau>
                      <tr>
                        <Th>Tache</Th>
                        <Th numerique>Debut</Th>
                        <Th numerique>Fin</Th>
                        <Th numerique>Duree</Th>
                      </tr>
                    </EnteteTableau>
                    <tbody>
                      {proposition.taches.map((t) => (
                        <Tr key={t.lotCode}>
                          <Td className="text-sm">{t.nom}</Td>
                          <Td numerique className="text-xs text-ardoise-600">{dateCourte(t.dateDebut)}</Td>
                          <Td numerique className="text-xs text-ardoise-600">{dateCourte(t.dateFin)}</Td>
                          <Td numerique className="text-xs text-ardoise-500">{t.dureeJours} j</Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Tableau>
                )}
              </>
            )}

            {etape === 8 && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Groupe label="Description de l'operation" className="sm:col-span-2">
                    <ZoneTexte
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Renovation complete de 18 logements, remise aux normes electriques, isolation thermique..."
                    />
                  </Groupe>
                  <Groupe label="Contraintes particulieres" className="sm:col-span-2">
                    <ZoneTexte
                      rows={2}
                      value={contraintes}
                      onChange={(e) => setContraintes(e.target.value)}
                      placeholder="Site occupe, acces limite, copropriete, amiante..."
                    />
                  </Groupe>
                </div>

                <div className="rounded-md border border-chantier-200 bg-chantier-50 px-4 py-3">
                  <p className="text-sm font-medium text-chantier-900">Ce qui va etre cree</p>
                  <ul className="mt-2 space-y-1 text-xs text-chantier-800">
                    <li>• {proposition?.lots.length ?? 0} lots et {proposition?.lots.reduce((s, l) => s + l.postes.length, 0) ?? 0} postes chiffres</li>
                    <li>• Un chiffrage retenu de {euros(proposition?.montantHT ?? 0)} HT</li>
                    <li>• Un budget de couts de {euros(proposition?.coutRevient ?? 0)}</li>
                    <li>
                      • {genererConsultations ? `${proposition?.lotsASousTraiter.length ?? 0} consultations en brouillon` : "Aucune consultation"}
                    </li>
                    <li>
                      • {genererPlanning ? `Un planning de ${proposition?.taches.length ?? 0} taches jusqu'au ${dateCourte(proposition?.dateFinPrevue ?? null)}` : "Aucun planning"}
                    </li>
                  </ul>
                  <p className="mt-2 text-[11px] text-chantier-700">
                    Tout reste modifiable ensuite : rien n&apos;est fige.
                  </p>
                </div>
              </>
            )}

            {etat.erreur && (
              <p className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {etat.erreur}
                {etat.champs &&
                  Object.values(etat.champs).length > 0 &&
                  ` (${Object.values(etat.champs).join(" ")})`}
              </p>
            )}
          </CorpsCarte>

          <div className="flex items-center justify-between gap-3 border-t border-ardoise-200/70 px-4 py-3">
            <Bouton
              type="button"
              variant="contour"
              onClick={() => setEtape((e) => Math.max(0, e - 1))}
              disabled={etape === 0}
            >
              <ArrowLeft className="h-4 w-4" /> Precedent
            </Bouton>

            {etape < ETAPES.length - 1 ? (
              <Bouton
                type="button"
                onClick={() => setEtape((e) => Math.min(ETAPES.length - 1, e + 1))}
                disabled={!peutAvancer}
              >
                Suivant <ArrowRight className="h-4 w-4" />
              </Bouton>
            ) : (
              <BoutonLancement />
            )}
          </div>
        </Carte>
      </div>

      {/* ─── Apercu permanent ──────────────────────────────────────────── */}
      <Carte className="h-fit lg:sticky lg:top-20">
        <EnteteCarte titre="Apercu du projet" description="Recalcule a chaque modification" />
        <CorpsCarte className="space-y-3">
          <Ligne libelle="Projet" valeur={nom || "—"} />
          <Ligne
            libelle="Client"
            valeur={
              contactId
                ? contacts.find((c) => c.id === contactId)?.libelle ?? "—"
                : clientSociete || clientNom || "—"
            }
          />
          <Ligne libelle="Operation" valeur={LIBELLES_OPERATION[typeOperation]} />
          <Ligne libelle="Surface" valeur={surfaceValide ? `${nombre(Number(surface))} m²` : "—"} />

          <div className="border-t border-ardoise-100 pt-3">
            <Ligne libelle="Lots" valeur={String(proposition?.lots.length ?? 0)} />
            <Ligne
              libelle="Postes"
              valeur={String(proposition?.lots.reduce((s, l) => s + l.postes.length, 0) ?? 0)}
            />
          </div>

          <div className="space-y-1.5 border-t border-ardoise-100 pt-3">
            <Ligne libelle="Cout direct" valeur={euros(proposition?.coutDirect ?? 0)} />
            <Ligne libelle="Cout de revient" valeur={euros(proposition?.coutRevient ?? 0)} />
            <Ligne
              libelle="Montant HT"
              valeur={euros(proposition?.montantHT ?? 0)}
              fort
            />
            <Ligne
              libelle="Marge"
              valeur={`${euros(proposition?.margeEuros ?? 0)} (${pourcent(proposition?.margeTaux ?? 0)})`}
            />
            <Ligne libelle="Prix TTC" valeur={euros((proposition?.montantHT ?? 0) * (1 + Number(tauxTva) / 100))} />
          </div>

          <div className="border-t border-ardoise-100 pt-3">
            <Ligne libelle="Duree" valeur={`${proposition?.dureeTotaleJours ?? 0} jours`} />
            <Ligne libelle="Fin prevue" valeur={dateCourte(proposition?.dateFinPrevue ?? null)} />
            <Ligne libelle="Ratio" valeur={`${euros(proposition?.ratioAuM2 ?? 0)}/m²`} />
          </div>

          {proposition && proposition.lots.some((l) => l.postes.some((p) => p.prixHistorique)) && (
            <p className="rounded bg-emerald-50 px-2.5 py-1.5 text-[11px] text-emerald-700">
              Certains prix proviennent de votre bibliotheque : les montants reflètent vos couts reels.
            </p>
          )}
        </CorpsCarte>
      </Carte>
    </form>
  )
}

const AIDE = [
  "Selectionnez un client existant ou saisissez-en un nouveau.",
  "Le bien concerne par l'operation.",
  "La nature des travaux determine la trame de lots proposee.",
  "La surface sert de base a toutes les quantites estimees.",
  "Ajustez la trame de lots a la realite de l'operation.",
  "Parametres economiques appliques au chiffrage genere.",
  "Preparation des consultations des lots confies a des entreprises.",
  "Date de demarrage et generation du planning previsionnel.",
  "Verifiez, completez, puis lancez le projet.",
]

function Fil({ etape, onAller }: { etape: number; onAller: (n: number) => void }) {
  return (
    <ol className="flex flex-wrap gap-1.5">
      {ETAPES.map((libelle, i) => (
        <li key={libelle}>
          <button
            type="button"
            onClick={() => onAller(i)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors",
              i === etape
                ? "bg-ardoise-800 font-medium text-white"
                : i < etape
                  ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : "border border-ardoise-200 text-ardoise-500 hover:bg-ardoise-50"
            )}
          >
            {i < etape ? <Check className="h-3 w-3" /> : <span className="tabulaire">{i + 1}</span>}
            {libelle}
          </button>
        </li>
      ))}
    </ol>
  )
}

function Ligne({ libelle, valeur, fort }: { libelle: string; valeur: string; fort?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="text-xs text-ardoise-500">{libelle}</span>
      <span
        className={cn(
          "truncate text-right tabulaire",
          fort ? "text-sm font-semibold text-ardoise-900" : "text-xs font-medium text-ardoise-800"
        )}
      >
        {valeur}
      </span>
    </div>
  )
}

function BoutonLancement() {
  const { pending } = useFormStatus()
  return (
    <Bouton type="submit" variant="chantier" taille="lg" disabled={pending}>
      <Rocket className="h-4 w-4" />
      {pending ? "Generation en cours..." : "Lancer le projet"}
    </Bouton>
  )
}

function ChampsCaches({
  valeurs,
  lotsExclus,
  genererPlanning,
}: {
  valeurs: Record<string, string>
  lotsExclus: string[]
  genererPlanning: boolean
}) {
  return (
    <>
      {Object.entries(valeurs).map(([cle, valeur]) => (
        <input key={cle} type="hidden" name={cle} value={valeur} />
      ))}
      {lotsExclus.map((code) => (
        <input key={code} type="hidden" name="lotsExclus" value={code} />
      ))}
      <input type="hidden" name="genererPlanning" value={genererPlanning ? "on" : "off"} />
    </>
  )
}

/** Unites lisibles, exposees pour l'apercu detaille des postes. */
export const UNITES = LIBELLES_UNITE

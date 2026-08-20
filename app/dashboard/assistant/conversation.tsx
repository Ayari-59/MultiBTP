"use client"

import { useActionState, useState } from "react"
import { useFormStatus } from "react-dom"
import { Bot, Send, Sparkles } from "lucide-react"
import { Bouton, Carte, CorpsCarte, Liste, ZoneTexte } from "@/components/ui/primitives"
import { poserQuestion, type EtatAssistant } from "@/lib/actions/assistant"

function BoutonEnvoi() {
  const { pending } = useFormStatus()
  return (
    <Bouton type="submit" disabled={pending}>
      <Send className="h-3.5 w-3.5" />
      {pending ? "Recherche..." : "Demander"}
    </Bouton>
  )
}

export function Conversation({
  projets,
  suggestions,
  fournisseur,
}: {
  projets: { id: string; libelle: string }[]
  suggestions: string[]
  fournisseur: string
}) {
  const [etat, action] = useActionState<EtatAssistant, FormData>(poserQuestion, {})
  const [question, setQuestion] = useState("")

  return (
    <div className="space-y-4">
      <Carte>
        <form action={action}>
          <CorpsCarte className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <ZoneTexte
                name="question"
                rows={3}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Quel est le cout engage sur le lot electricite du chantier Republique ?"
                required
              />
              <div className="flex flex-col justify-between gap-2">
                <Liste name="projectId" defaultValue="" className="sm:w-56">
                  <option value="">Tous les projets</option>
                  {projets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.libelle}
                    </option>
                  ))}
                </Liste>
                <BoutonEnvoi />
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setQuestion(s)}
                  className="rounded-full border border-ardoise-200 px-2.5 py-1 text-[11px] text-ardoise-600 transition-colors hover:bg-ardoise-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </CorpsCarte>
        </form>
      </Carte>

      {etat.erreur && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {etat.erreur}
        </p>
      )}

      {etat.reponse && (
        <Carte className="border-violet-200">
          <div className="flex items-start gap-3 px-4 py-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600">
              <Bot className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              {etat.question && (
                <p className="mb-2 text-xs font-medium text-ardoise-500">« {etat.question} »</p>
              )}
              <p className="whitespace-pre-line text-sm leading-relaxed text-ardoise-800">
                {etat.reponse}
              </p>
              <p className="mt-2 flex items-center gap-1 text-[10px] text-ardoise-400">
                <Sparkles className="h-3 w-3" />
                Reponse produite a partir de vos donnees · fournisseur {etat.fournisseur ?? fournisseur}
              </p>
            </div>
          </div>
        </Carte>
      )}
    </div>
  )
}

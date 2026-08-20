"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { AlertCircle } from "lucide-react"
import { connexion, type EtatConnexion } from "@/lib/actions/auth"
import { Bouton, Champ, Groupe } from "@/components/ui/primitives"

function BoutonEnvoi() {
  const { pending } = useFormStatus()
  return (
    <Bouton type="submit" taille="lg" className="w-full" disabled={pending}>
      {pending ? "Connexion..." : "Se connecter"}
    </Bouton>
  )
}

export function FormulaireConnexion({ suite }: { suite?: string }) {
  const [etat, action] = useActionState<EtatConnexion, FormData>(connexion, {})

  return (
    <form action={action} className="mt-6 space-y-4">
      {suite && <input type="hidden" name="suite" value={suite} />}

      <Groupe label="Adresse e-mail">
        <Champ
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="prenom.nom@societe.fr"
        />
      </Groupe>

      <Groupe label="Mot de passe">
        <Champ
          name="motDePasse"
          type="password"
          autoComplete="current-password"
          required
          minLength={6}
          placeholder="••••••••"
        />
      </Groupe>

      {etat.erreur && (
        <p className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {etat.erreur}
        </p>
      )}

      <BoutonEnvoi />
    </form>
  )
}

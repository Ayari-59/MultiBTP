"use client"

import { useTransition } from "react"
import { changerStatutProjet } from "@/lib/actions/projets"
import { Liste } from "@/components/ui/primitives"
import { LIBELLES_STATUT_PROJET } from "@/lib/metier/referentiel"

export function SelecteurStatut({
  projectId,
  statut,
  desactive,
}: {
  projectId: string
  statut: string
  desactive?: boolean
}) {
  const [enCours, demarrer] = useTransition()

  return (
    <Liste
      value={statut}
      disabled={desactive || enCours}
      className="h-8 w-auto text-xs"
      onChange={(e) => {
        const valeur = e.target.value
        demarrer(() => void changerStatutProjet(projectId, valeur))
      }}
    >
      {Object.entries(LIBELLES_STATUT_PROJET).map(([cle, libelle]) => (
        <option key={cle} value={cle}>
          {libelle}
        </option>
      ))}
    </Liste>
  )
}

"use client"

import { useState } from "react"
import { FileSpreadsheet, FileText } from "lucide-react"
import { Etiquette, Liste, Vide } from "@/components/ui/primitives"

export function SelecteurRapport({
  projets,
  rapports,
  exports,
}: {
  projets: { id: string; libelle: string }[]
  rapports: { type: string; titre: string; description: string }[]
  exports: { type: string; titre: string; projet: boolean }[]
}) {
  const [projetId, setProjetId] = useState(projets[0]?.id ?? "")

  if (projets.length === 0) {
    return <Vide titre="Aucun projet" description="Creez un projet pour generer des documents." />
  }

  return (
    <div className="space-y-4">
      <div className="max-w-md">
        <Etiquette>Projet</Etiquette>
        <Liste value={projetId} onChange={(e) => setProjetId(e.target.value)}>
          {projets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.libelle}
            </option>
          ))}
        </Liste>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {rapports.map((r) => (
          <a
            key={r.type}
            href={`/api/rapports?type=${r.type}&projet=${projetId}&format=pdf`}
            target="_blank"
            rel="noreferrer"
            className="flex gap-3 rounded-md border border-ardoise-200 px-3 py-3 transition-colors hover:border-ardoise-300 hover:bg-ardoise-50"
          >
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-chantier-500" />
            <span>
              <span className="block text-sm font-medium text-ardoise-900">{r.titre}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-ardoise-500">
                {r.description}
              </span>
            </span>
          </a>
        ))}
      </div>

      <div className="grid gap-2 border-t border-ardoise-100 pt-3 sm:grid-cols-2">
        {exports
          .filter((e) => e.projet)
          .map((e) => (
            <a
              key={e.type}
              href={`/api/rapports?type=${e.type}&projet=${projetId}&format=csv`}
              className="flex items-center gap-2.5 rounded-md border border-ardoise-200 px-3 py-2.5 text-sm text-ardoise-800 transition-colors hover:bg-ardoise-50"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              {e.titre} (CSV)
            </a>
          ))}
      </div>
    </div>
  )
}

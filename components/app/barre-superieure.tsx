"use client"

import { useState, useTransition } from "react"
import { LogOut, ShieldCheck } from "lucide-react"
import { deconnexion } from "@/lib/actions/auth"
import { LIBELLES_ROLES, type Role } from "@/lib/permissions"
import { initiales } from "@/lib/utils"

export function BarreSuperieure({
  nom,
  email,
  role,
  organisation,
}: {
  nom: string
  email: string
  role: Role
  organisation: string
}) {
  const [ouvert, setOuvert] = useState(false)
  const [enCours, demarrer] = useTransition()

  return (
    <header className="sans-impression sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-ardoise-200 bg-white/95 px-4 backdrop-blur lg:px-6">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ardoise-900">{organisation}</p>
        <p className="text-[11px] text-ardoise-500">Pilotage des operations et des chantiers</p>
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setOuvert((o) => !o)}
          className="flex items-center gap-2 rounded-md border border-ardoise-200 py-1 pl-1 pr-2.5 text-left hover:bg-ardoise-50"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded bg-ardoise-800 text-[11px] font-semibold text-white">
            {initiales(nom)}
          </span>
          <span className="hidden min-w-0 sm:block">
            <span className="block truncate text-xs font-medium text-ardoise-900">{nom}</span>
            <span className="block truncate text-[10px] text-ardoise-500">
              {LIBELLES_ROLES[role]}
            </span>
          </span>
        </button>

        {ouvert && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOuvert(false)} />
            <div className="absolute right-0 z-20 mt-1.5 w-64 rounded-lg border border-ardoise-200 bg-white p-1 shadow-lg">
              <div className="border-b border-ardoise-100 px-3 py-2">
                <p className="truncate text-sm font-medium text-ardoise-900">{nom}</p>
                <p className="truncate text-xs text-ardoise-500">{email}</p>
                <p className="mt-1.5 flex items-center gap-1 text-[11px] text-ardoise-600">
                  <ShieldCheck className="h-3 w-3" />
                  {LIBELLES_ROLES[role]}
                </p>
              </div>
              <button
                type="button"
                disabled={enCours}
                onClick={() => demarrer(() => void deconnexion())}
                className="mt-1 flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-ardoise-700 hover:bg-ardoise-50 disabled:opacity-50"
              >
                <LogOut className="h-4 w-4" />
                {enCours ? "Deconnexion..." : "Se deconnecter"}
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  )
}

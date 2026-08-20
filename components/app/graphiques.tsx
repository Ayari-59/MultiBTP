"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  ComposedChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { euros, eurosCompact } from "@/lib/utils"

const ARDOISE = "#3a5470"
const CHANTIER = "#f9860f"
const EMERAUDE = "#059669"
const ROUGE = "#dc2626"

const PALETTE = ["#3a5470", "#f9860f", "#4c6b8a", "#059669", "#8b5cf6", "#0ea5e9", "#e11d48", "#a3b6c8"]

const styleInfobulle = {
  border: "1px solid #e4e8ed",
  borderRadius: 6,
  fontSize: 12,
  padding: "6px 10px",
}

/** Engagements et depenses mois par mois. */
export function GraphiqueFlux({
  donnees,
}: {
  donnees: { mois: string; engage: number; realise: number }[]
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={donnees} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef1f4" vertical={false} />
        <XAxis dataKey="mois" tick={{ fontSize: 11, fill: "#5c6b7d" }} tickLine={false} axisLine={false} />
        <YAxis
          tickFormatter={(v: number) => eurosCompact(v)}
          tick={{ fontSize: 11, fill: "#5c6b7d" }}
          tickLine={false}
          axisLine={false}
          width={62}
        />
        <Tooltip
          contentStyle={styleInfobulle}
          formatter={(v, n) => [euros(Number(v)), n === "engage" ? "Engage" : "Realise"]}
        />
        <Legend
          wrapperStyle={{ fontSize: 11 }}
          formatter={(v: string) => (v === "engage" ? "Engage" : "Realise")}
        />
        <Bar dataKey="engage" fill={ARDOISE} radius={[3, 3, 0, 0]} maxBarSize={26} />
        <Line dataKey="realise" stroke={CHANTIER} strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

/** Repartition des projets par statut. */
export function GraphiqueStatuts({
  donnees,
}: {
  donnees: { statut: string; nombre: number; montant: number }[]
}) {
  if (donnees.length === 0) {
    return <p className="py-12 text-center text-xs text-ardoise-400">Aucun projet enregistre.</p>
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={donnees}
          dataKey="montant"
          nameKey="statut"
          innerRadius={52}
          outerRadius={86}
          paddingAngle={2}
        >
          {donnees.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={styleInfobulle}
          formatter={(v, n) => [euros(Number(v)), String(n)]}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

/** Budget / engage / realise par lot. */
export function GraphiqueLots({
  donnees,
}: {
  donnees: { code: string; budget: number; engage: number; realise: number }[]
}) {
  if (donnees.length === 0) {
    return <p className="py-12 text-center text-xs text-ardoise-400">Aucun lot chiffre.</p>
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(240, donnees.length * 34)}>
      <BarChart data={donnees} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef1f4" horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(v: number) => eurosCompact(v)}
          tick={{ fontSize: 11, fill: "#5c6b7d" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="code"
          tick={{ fontSize: 11, fill: "#5c6b7d" }}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip
          contentStyle={styleInfobulle}
          formatter={(v, n) => [
            euros(Number(v)),
            n === "budget" ? "Budget" : n === "engage" ? "Engage" : "Realise",
          ]}
        />
        <Legend
          wrapperStyle={{ fontSize: 11 }}
          formatter={(v: string) => (v === "budget" ? "Budget" : v === "engage" ? "Engage" : "Realise")}
        />
        <Bar dataKey="budget" fill="#a3b6c8" radius={[0, 3, 3, 0]} maxBarSize={9} />
        <Bar dataKey="engage" fill={ARDOISE} radius={[0, 3, 3, 0]} maxBarSize={9} />
        <Bar dataKey="realise" fill={CHANTIER} radius={[0, 3, 3, 0]} maxBarSize={9} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Comparaison des offres d'une consultation. */
export function GraphiqueOffres({
  donnees,
  budget,
}: {
  donnees: { sousTraitant: string; montantHT: number; retenue: boolean }[]
  budget: number | null
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, donnees.length * 46)}>
      <BarChart data={donnees} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef1f4" horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(v: number) => eurosCompact(v)}
          tick={{ fontSize: 11, fill: "#5c6b7d" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="sousTraitant"
          tick={{ fontSize: 11, fill: "#5c6b7d" }}
          tickLine={false}
          axisLine={false}
          width={130}
        />
        <Tooltip contentStyle={styleInfobulle} formatter={(v) => [euros(Number(v)), "Montant HT"]} />
        <Bar dataKey="montantHT" radius={[0, 3, 3, 0]} maxBarSize={22}>
          {donnees.map((d, i) => (
            <Cell
              key={i}
              fill={d.retenue ? EMERAUDE : budget && d.montantHT > budget ? ROUGE : ARDOISE}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Ventilation du cout de revient d'un chiffrage. */
export function GraphiqueVentilation({
  donnees,
}: {
  donnees: { nature: string; montant: number }[]
}) {
  const utiles = donnees.filter((d) => d.montant > 0)
  if (utiles.length === 0) {
    return <p className="py-8 text-center text-xs text-ardoise-400">Ventilation non renseignee.</p>
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={utiles} dataKey="montant" nameKey="nature" innerRadius={48} outerRadius={80} paddingAngle={2}>
          {utiles.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={styleInfobulle} formatter={(v, n) => [euros(Number(v)), String(n)]} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

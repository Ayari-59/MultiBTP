import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { can, type Role } from "@/lib/permissions"
import { genererPdf, type DocumentPdf } from "@/lib/pdf"
import {
  csvBudget,
  csvChiffrage,
  csvFactures,
  csvProjets,
  rapportChantier,
  rapportConsultation,
  rapportDevis,
  rapportFinancier,
  rapportMarge,
  rapportReception,
  rapportSousTraitants,
} from "@/lib/rapports"
import { slugifier } from "@/lib/utils"

/**
 * Generation des documents et exports.
 *   /api/rapports?type=devis&projet=<id>&format=pdf
 *   /api/rapports?type=projets&format=csv
 */
export async function GET(requete: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ erreur: "Non authentifie." }, { status: 401 })
  }

  const role = session.user.role as Role
  if (!can(role, "rapports", "read")) {
    return NextResponse.json({ erreur: "Acces refuse." }, { status: 403 })
  }

  const url = new URL(requete.url)
  const type = url.searchParams.get("type") ?? "financier"
  const projectId = url.searchParams.get("projet") ?? undefined
  const consultationId = url.searchParams.get("consultation") ?? undefined
  const format = url.searchParams.get("format") ?? "pdf"
  const organizationId = session.user.organizationId

  // ─── Exports tabulaires ───────────────────────────────────────────────────
  if (format === "csv") {
    let contenu: string
    switch (type) {
      case "chiffrage":
        if (!projectId) return NextResponse.json({ erreur: "Projet requis." }, { status: 400 })
        contenu = await csvChiffrage(projectId, organizationId)
        break
      case "budget":
        if (!projectId) return NextResponse.json({ erreur: "Projet requis." }, { status: 400 })
        contenu = await csvBudget(projectId, organizationId)
        break
      case "factures":
        contenu = await csvFactures(organizationId)
        break
      default:
        contenu = await csvProjets(organizationId)
    }

    return new NextResponse(contenu, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${slugifier(type)}-${Date.now()}.csv"`,
      },
    })
  }

  // ─── Documents PDF ────────────────────────────────────────────────────────
  let document: DocumentPdf | null = null

  switch (type) {
    case "devis":
      if (!projectId) return NextResponse.json({ erreur: "Projet requis." }, { status: 400 })
      document = await rapportDevis(projectId, organizationId)
      break
    case "consultation":
      if (!consultationId)
        return NextResponse.json({ erreur: "Consultation requise." }, { status: 400 })
      document = await rapportConsultation(consultationId, organizationId)
      break
    case "marge":
      if (!projectId) return NextResponse.json({ erreur: "Projet requis." }, { status: 400 })
      document = await rapportMarge(projectId, organizationId)
      break
    case "chantier":
    case "avancement":
      if (!projectId) return NextResponse.json({ erreur: "Projet requis." }, { status: 400 })
      document = await rapportChantier(projectId, organizationId)
      break
    case "reception":
      if (!projectId) return NextResponse.json({ erreur: "Projet requis." }, { status: 400 })
      document = await rapportReception(projectId, organizationId)
      break
    case "sous-traitants":
      document = await rapportSousTraitants(organizationId)
      break
    default:
      document = await rapportFinancier(organizationId, projectId)
  }

  if (!document) {
    return NextResponse.json({ erreur: "Donnees introuvables." }, { status: 404 })
  }

  const octets = await genererPdf(document)

  return new NextResponse(new Uint8Array(octets), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${slugifier(document.titre)}-${slugifier(document.reference ?? "")}.pdf"`,
    },
  })
}

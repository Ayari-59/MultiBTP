import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { lireFichier } from "@/lib/storage"

/**
 * Sert un fichier stocke. Deux verifications successives :
 *  1. le chemin commence par l'identifiant de l'organisation de l'appelant ;
 *  2. un document correspondant existe bien dans cette organisation.
 * Un document marque « visible client » reste accessible aux comptes CLIENT.
 */
export async function GET(
  _requete: Request,
  { params }: { params: Promise<{ chemin: string[] }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ erreur: "Non authentifie." }, { status: 401 })
  }

  const { chemin } = await params
  const relatif = chemin.join("/")

  if (!relatif.startsWith(`${session.user.organizationId}/`)) {
    return NextResponse.json({ erreur: "Acces refuse." }, { status: 403 })
  }

  const url = `/api/fichiers/${relatif}`
  const document = await prisma.document.findFirst({
    where: { url, organizationId: session.user.organizationId },
    select: { nom: true, mimeType: true, visibleClient: true, visibleSousTraitant: true },
  })

  const role = session.user.role
  if (document) {
    if (role === "CLIENT" && !document.visibleClient) {
      return NextResponse.json({ erreur: "Acces refuse." }, { status: 403 })
    }
    if (role === "SOUS_TRAITANT" && !document.visibleSousTraitant) {
      return NextResponse.json({ erreur: "Acces refuse." }, { status: 403 })
    }
  } else if (role === "CLIENT" || role === "SOUS_TRAITANT") {
    // Fichier sans fiche document (photo de chantier) : reserve aux internes.
    return NextResponse.json({ erreur: "Acces refuse." }, { status: 403 })
  }

  try {
    const contenu = await lireFichier(relatif)
    return new NextResponse(new Uint8Array(contenu), {
      headers: {
        "content-type": document?.mimeType ?? "application/octet-stream",
        "content-disposition": `inline; filename="${encodeURIComponent(document?.nom ?? "fichier")}"`,
        "cache-control": "private, max-age=3600",
      },
    })
  } catch {
    return NextResponse.json({ erreur: "Fichier introuvable." }, { status: 404 })
  }
}

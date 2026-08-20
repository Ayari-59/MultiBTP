import { NextResponse } from "next/server"
import { auth } from "@/lib/auth-edge"

const ROLES_INTERNES = ["ADMIN", "DIRIGEANT", "CONDUCTEUR", "METREUR", "COMPTA"]

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth
  const role = (session?.user as { role?: string } | undefined)?.role

  const estConnexion = pathname === "/connexion"
  const estInterne = pathname.startsWith("/dashboard")
  const estPortail = pathname.startsWith("/portail")
  const estEspaceClient = pathname.startsWith("/espace-client")
  const estProtege = estInterne || estPortail || estEspaceClient

  if (estProtege && !session) {
    const url = new URL("/connexion", req.url)
    url.searchParams.set("suite", pathname)
    return NextResponse.redirect(url)
  }

  if (estConnexion && session) {
    return NextResponse.redirect(new URL(accueil(role), req.url))
  }

  // Cloisonnement des espaces : un sous-traitant ne voit jamais l'interface interne.
  if (session && role) {
    if (estInterne && !ROLES_INTERNES.includes(role)) {
      return NextResponse.redirect(new URL(accueil(role), req.url))
    }
    if (estPortail && role !== "SOUS_TRAITANT" && role !== "ADMIN") {
      return NextResponse.redirect(new URL(accueil(role), req.url))
    }
    if (estEspaceClient && role !== "CLIENT" && role !== "ADMIN") {
      return NextResponse.redirect(new URL(accueil(role), req.url))
    }
  }

  return NextResponse.next()
})

function accueil(role?: string): string {
  if (role === "SOUS_TRAITANT") return "/portail"
  if (role === "CLIENT") return "/espace-client"
  return "/dashboard"
}

export const config = {
  matcher: ["/dashboard/:path*", "/portail/:path*", "/espace-client/:path*", "/connexion"],
}

"use server"

import { AuthError } from "next-auth"
import { signIn, signOut } from "@/lib/auth"

export type EtatConnexion = { erreur?: string }

export async function connexion(
  _etat: EtatConnexion,
  donnees: FormData
): Promise<EtatConnexion> {
  const suite = String(donnees.get("suite") ?? "") || undefined

  try {
    await signIn("credentials", {
      email: String(donnees.get("email") ?? ""),
      motDePasse: String(donnees.get("motDePasse") ?? ""),
      redirectTo: suite && suite.startsWith("/") ? suite : "/dashboard",
    })
    return {}
  } catch (erreur) {
    // next-auth signale la redirection reussie par une exception : la relancer.
    if (erreur instanceof AuthError) {
      return { erreur: "Identifiants incorrects ou compte desactive." }
    }
    throw erreur
  }
}

export async function deconnexion(): Promise<void> {
  await signOut({ redirectTo: "/connexion" })
}

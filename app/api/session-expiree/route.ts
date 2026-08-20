import { signOut } from "@/lib/auth"

/**
 * Purge une session dont le compte n'existe plus ou a ete desactive.
 *
 * Une page ne peut pas effacer un cookie pendant son rendu : la redirection
 * passe donc par cette route, qui invalide le jeton avant de renvoyer vers
 * l'ecran de connexion. Sans cela, le middleware verrait un JWT encore valide
 * et renverrait l'utilisateur vers le tableau de bord — boucle infinie.
 */
export async function GET() {
  await signOut({ redirectTo: "/connexion?session=expiree" })
}

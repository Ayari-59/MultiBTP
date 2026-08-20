import { handlers } from "@/lib/auth"

/**
 * Endpoints HTTP de NextAuth (callback, session, csrf, signout).
 *
 * Les Server Actions `signIn` / `signOut` posent le cookie directement cote
 * serveur et fonctionnent sans passer par ces routes — c'est pourquoi leur
 * absence ne se voit pas en developpement. Mais des que le navigateur retombe
 * sur une soumission de formulaire native (page pas encore hydratee, JavaScript
 * desactive), la requete part vers /api/auth/callback/credentials : sans ce
 * fichier, elle repond 404 et la connexion echoue silencieusement.
 */
export const { GET, POST } = handlers

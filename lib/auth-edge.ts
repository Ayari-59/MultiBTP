import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"

/**
 * Configuration minimale sans Prisma ni pg : compatible Edge Runtime.
 * Le middleware n'a besoin que de lire le JWT, jamais la base.
 */
export const { auth } = NextAuth({
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/connexion" },
  providers: [Credentials({ authorize: async () => null })],
  callbacks: {
    jwt({ token }) {
      return token
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as never
        session.user.organizationId = token.organizationId as string
      }
      return session
    },
  },
})

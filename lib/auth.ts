import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { prisma } from "./prisma"
import type { Role } from "./permissions"

const schemaConnexion = z.object({
  email: z.string().email(),
  motDePasse: z.string().min(6),
})

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: Role
      organizationId: string
      subcontractorId: string | null
      contactId: string | null
    }
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/connexion" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        motDePasse: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        const parsed = schemaConnexion.safeParse(credentials)
        if (!parsed.success) return null

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase().trim() },
        })
        if (!user || !user.password || !user.actif) return null

        const valide = await bcrypt.compare(parsed.data.motDePasse, user.password)
        if (!valide) return null

        await prisma.user.update({
          where: { id: user.id },
          data: { derniereConnexion: new Date() },
        })

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organizationId,
          subcontractorId: user.subcontractorId,
          contactId: user.contactId,
        } as never
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        const u = user as unknown as {
          id: string
          role: Role
          organizationId: string
          subcontractorId: string | null
          contactId: string | null
        }
        token.id = u.id
        token.role = u.role
        token.organizationId = u.organizationId
        token.subcontractorId = u.subcontractorId
        token.contactId = u.contactId
      }
      return token
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as Role
        session.user.organizationId = token.organizationId as string
        session.user.subcontractorId = (token.subcontractorId as string | null) ?? null
        session.user.contactId = (token.contactId as string | null) ?? null
      }
      return session
    },
  },
})

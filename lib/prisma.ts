import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

// Postgres serverless (Neon, Supabase pooler) : le serveur ferme les connexions
// inactives et le compute peut se mettre en veille. Le client doit donc fermer
// ses sockets avant le serveur (idleTimeoutMillis court) et tolerer la latence
// de reveil lors d'une connexion neuve (connectionTimeoutMillis large).
function createPool(): Pool {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
    keepAlive: true,
  })
  // Sans listener, une connexion idle coupee cote serveur emet un evenement
  // "error" non gere qui fait tomber le process Node.
  pool.on("error", () => {})
  return pool
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg(createPool()),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  })
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

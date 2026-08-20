import "dotenv/config"
import { defineConfig } from "prisma/config"

// Prisma 7 : l'URL de connexion ne vit plus dans schema.prisma. La CLI la lit
// ici, le client applicatif la recoit via l'adaptateur pg (lib/prisma.ts).
//
// La CLI (db push, migrate) utilise DIRECT_URL quand elle existe : les
// operations de schema passent mal a travers un pooler en mode transaction
// (PgBouncer chez Neon, Supavisor chez Supabase). L'application, elle, garde
// la connexion poolee de DATABASE_URL.
export default defineConfig({
  schema: "./prisma/schema.prisma",
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
})

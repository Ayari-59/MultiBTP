import "dotenv/config"
import { defineConfig } from "prisma/config"

// Prisma 7 : l'URL de connexion ne vit plus dans schema.prisma. La CLI la lit
// ici, le client applicatif la recoit via l'adaptateur pg (lib/prisma.ts).
export default defineConfig({
  schema: "./prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL!,
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
})

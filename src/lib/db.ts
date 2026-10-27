import { PrismaClient } from "@prisma/client";

// En développement, Next.js recharge le code à chaque modification :
// on réutilise la même connexion pour ne pas ouvrir des dizaines de connexions.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // On ne journalise jamais les requêtes complètes (elles peuvent contenir des données personnelles).
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

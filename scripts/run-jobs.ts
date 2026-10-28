/**
 * Lance les tâches automatiques en ligne de commande (pour la tâche planifiée
 * de l'hébergeur, toutes les heures) : npm run jobs
 */
import "dotenv/config";
import { runJobs } from "../src/lib/jobs/run";
import { prisma } from "../src/lib/db";

runJobs()
  .then((report) => console.log(`[tâches] ${new Date().toISOString()} ${JSON.stringify(report)}`))
  .catch((e) => {
    console.error("[tâches] échec", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

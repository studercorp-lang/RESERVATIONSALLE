// Applique toutes les migrations sur la base de TEST (les tests vident eux-mêmes leurs tables).
import "dotenv/config";
import { execSync } from "node:child_process";

const url = process.env.DATABASE_URL_TEST;
if (!url) {
  console.error("DATABASE_URL_TEST n'est pas défini dans le fichier .env");
  process.exit(1);
}
execSync("npx prisma migrate deploy", {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url },
});

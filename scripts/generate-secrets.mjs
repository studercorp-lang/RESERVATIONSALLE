// Génère les trois clés secrètes à copier dans la configuration (.env ou hébergeur).
// Utilisation : npm run secrets
import { randomBytes } from "node:crypto";

const key = () => randomBytes(32).toString("base64");
console.log("\nCopiez ces trois lignes dans votre configuration (gardez-les secrètes) :\n");
console.log(`AUTH_SECRET="${key()}"`);
console.log(`ENCRYPTION_KEY="${key()}"`);
console.log(`CRON_SECRET="${randomBytes(32).toString("base64url")}"`);
console.log("\n⚠️  Ne changez plus ENCRYPTION_KEY après la mise en ligne : les codes de double authentification");
console.log("    de l'équipe deviendraient illisibles (il faudrait les réinitialiser).\n");

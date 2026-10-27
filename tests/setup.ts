// Les tests utilisent toujours la base de TEST, jamais la base réelle.
import "dotenv/config";
process.env.TZ = "UTC"; // le serveur peut tourner en UTC : le code ne doit pas en dépendre
if (process.env.DATABASE_URL_TEST) process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
